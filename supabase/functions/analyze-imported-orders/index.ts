import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse geographic data from city field which may contain full JSON destination
// This handles legacy data where the entire escaped JSON was stored in the city field
// Example malformed data: "{\"first_name\":\"Bhakti\",\"city\":\"Manchester\",...}"
const parseGeographicFromField = (value: string | null): { city: string | null; province: string | null; country: string | null } => {
  if (!value) return { city: null, province: null, country: null };
  
  // Skip if it's already a clean value (no JSON markers)
  if (!value.includes('{') && !value.includes('"') && !value.includes('\\')) {
    return { city: value, province: null, country: null };
  }
  
  try {
    let jsonStr = value;
    
    // Handle case where value starts with escaped quote like "{\" or \"
    // This is common when JSON was incorrectly stored
    if (value.startsWith('"{') || value.startsWith('"\\')) {
      // Remove outer quotes if present
      jsonStr = value.slice(1, -1);
    }
    
    // Replace escaped quotes with regular quotes
    jsonStr = jsonStr.replace(/\\"/g, '"');
    
    // Try to parse as JSON
    const parsed = JSON.parse(jsonStr);
    
    console.log('Successfully parsed geographic data:', {
      city: parsed?.city,
      province: parsed?.province,
      country: parsed?.country
    });
    
    return {
      city: parsed?.city || null,
      province: parsed?.province || null,
      country: parsed?.country || null,
    };
  } catch (e) {
    // Try regex extraction as fallback
    try {
      const cityMatch = value.match(/"city"\s*:\s*"([^"]+)"/);
      const provinceMatch = value.match(/"province"\s*:\s*"([^"]+)"/);
      const countryMatch = value.match(/"country"\s*:\s*"([^"]+)"/);
      
      if (cityMatch || provinceMatch || countryMatch) {
        console.log('Extracted via regex:', {
          city: cityMatch?.[1],
          province: provinceMatch?.[1],
          country: countryMatch?.[1]
        });
        
        return {
          city: cityMatch?.[1] || null,
          province: provinceMatch?.[1] || null,
          country: countryMatch?.[1] || null,
        };
      }
    } catch (regexError) {
      console.warn('Regex extraction failed:', regexError);
    }
    
    // Not valid JSON and regex failed, skip this value
    console.warn('Failed to parse geographic field:', value?.substring?.(0, 50));
    return { city: null, province: null, country: null };
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting imported orders analysis...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all imported orders - using pagination to get all records
    let allOrders: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('imported_orders')
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1)
        .order('shopify_created_at', { ascending: false });

      if (error) {
        console.error('Error fetching orders:', error);
        throw error;
      }

      if (data && data.length > 0) {
        allOrders = [...allOrders, ...data];
        page++;
        hasMore = data.length === pageSize;
        console.log(`Fetched page ${page}, total orders: ${allOrders.length}`);
      } else {
        hasMore = false;
      }
    }

    console.log(`Total orders fetched: ${allOrders.length}`);

    // Calculate totals
    let totalOrders = allOrders.length;
    let totalOptIns = 0;
    let totalOptOuts = 0;
    let optInRevenue = 0;
    let optOutRevenue = 0;

    // Store aggregation
    const storeMap = new Map<string, { total: number; optIn: number; revenue: number }>();
    
    // City aggregation
    const cityMap = new Map<string, { total: number; optIn: number; revenue: number }>();
    
    // Country aggregation
    const countryMap = new Map<string, { total: number; optIn: number; revenue: number }>();
    
    // Province aggregation
    const provinceMap = new Map<string, { total: number; optIn: number; revenue: number }>();

    // Day of week aggregation
    const dayOfWeekMap = new Map<number, { total: number; optIn: number }>();
    
    // Month aggregation
    const monthMap = new Map<string, { total: number; optIn: number }>();

    // Order value ranges
    const valueRanges = [
      { min: 0, max: 25, label: '$0-25' },
      { min: 25, max: 50, label: '$25-50' },
      { min: 50, max: 100, label: '$50-100' },
      { min: 100, max: 200, label: '$100-200' },
      { min: 200, max: 500, label: '$200-500' },
      { min: 500, max: Infinity, label: '$500+' },
    ];
    const valueRangeMap = new Map<string, { total: number; optIn: number }>();
    valueRanges.forEach(r => valueRangeMap.set(r.label, { total: 0, optIn: 0 }));

    allOrders.forEach(order => {
      const isOptIn = order.opt_in === true;
      const price = parseFloat(order.total_price) || 0;
      
      if (isOptIn) {
        totalOptIns++;
        optInRevenue += price;
      } else {
        totalOptOuts++;
        optOutRevenue += price;
      }

      // Store aggregation
      const storeId = order.store_id || 'unknown';
      const storeData = storeMap.get(storeId) || { total: 0, optIn: 0, revenue: 0 };
      storeData.total++;
      if (isOptIn) storeData.optIn++;
      storeData.revenue += price;
      storeMap.set(storeId, storeData);

      // Parse geographic data - handles both proper fields and legacy JSON-in-city data
      const geoFromCity = parseGeographicFromField(order.city);
      const geoFromProvince = parseGeographicFromField(order.province);
      const geoFromCountry = parseGeographicFromField(order.country);
      
      // Use parsed city data, falling back to province/country parse results
      const city = geoFromCity.city || geoFromProvince.city || geoFromCountry.city || 'Unknown';
      const province = geoFromCity.province || geoFromProvince.province || order.province || 'Unknown';
      const country = geoFromCity.country || geoFromCountry.country || order.country || 'Unknown';

      // City aggregation (skip if it still looks like JSON)
      if (!city.startsWith('{') && !city.startsWith('"')) {
        const cityData = cityMap.get(city) || { total: 0, optIn: 0, revenue: 0 };
        cityData.total++;
        if (isOptIn) cityData.optIn++;
        cityData.revenue += price;
        cityMap.set(city, cityData);
      }

      // Country aggregation (skip if it still looks like JSON)
      if (!country.startsWith('{') && !country.startsWith('"')) {
        const countryData = countryMap.get(country) || { total: 0, optIn: 0, revenue: 0 };
        countryData.total++;
        if (isOptIn) countryData.optIn++;
        countryData.revenue += price;
        countryMap.set(country, countryData);
      }

      // Province aggregation (skip if it still looks like JSON)
      if (!province.startsWith('{') && !province.startsWith('"')) {
        const provinceData = provinceMap.get(province) || { total: 0, optIn: 0, revenue: 0 };
        provinceData.total++;
        if (isOptIn) provinceData.optIn++;
        provinceMap.set(province, provinceData);
      }

      // Temporal analysis
      if (order.shopify_created_at) {
        const date = new Date(order.shopify_created_at);
        const dayOfWeek = date.getDay();
        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        const dayData = dayOfWeekMap.get(dayOfWeek) || { total: 0, optIn: 0 };
        dayData.total++;
        if (isOptIn) dayData.optIn++;
        dayOfWeekMap.set(dayOfWeek, dayData);

        const monthData = monthMap.get(month) || { total: 0, optIn: 0 };
        monthData.total++;
        if (isOptIn) monthData.optIn++;
        monthMap.set(month, monthData);
      }

      // Value range analysis
      for (const range of valueRanges) {
        if (price >= range.min && price < range.max) {
          const rangeData = valueRangeMap.get(range.label)!;
          rangeData.total++;
          if (isOptIn) rangeData.optIn++;
          break;
        }
      }
    });

    const optInRate = totalOrders > 0 ? ((totalOptIns / totalOrders) * 100).toFixed(2) : '0.00';
    const avgOptInOrderValue = totalOptIns > 0 ? (optInRevenue / totalOptIns).toFixed(2) : '0.00';
    const avgOptOutOrderValue = totalOptOuts > 0 ? (optOutRevenue / totalOptOuts).toFixed(2) : '0.00';
    const valueDifference = (parseFloat(avgOptInOrderValue) - parseFloat(avgOptOutOrderValue)).toFixed(2);

    // Format store data
    const stores = Array.from(storeMap.entries())
      .map(([storeId, data]) => ({
        storeId,
        total: data.total,
        optIn: data.optIn,
        optInRate: data.total > 0 ? ((data.optIn / data.total) * 100).toFixed(2) : '0.00',
        avgOrderValue: data.total > 0 ? (data.revenue / data.total).toFixed(2) : '0.00',
        totalRevenue: data.revenue.toFixed(2),
      }))
      .sort((a, b) => b.total - a.total);

    // Format city data
    const topCities = Array.from(cityMap.entries())
      .filter(([name]) => name !== 'Unknown')
      .map(([name, data]) => ({
        name,
        total: data.total,
        optIn: data.optIn,
        optInRate: data.total > 0 ? ((data.optIn / data.total) * 100).toFixed(2) : '0.00',
        avgOrderValue: data.total > 0 ? (data.revenue / data.total).toFixed(2) : '0.00',
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    const bestCitiesByOptIn = [...topCities]
      .filter(c => c.total >= 10)
      .sort((a, b) => parseFloat(b.optInRate) - parseFloat(a.optInRate))
      .slice(0, 10);

    // Format country data
    const topCountries = Array.from(countryMap.entries())
      .filter(([name]) => name !== 'Unknown')
      .map(([name, data]) => ({
        name,
        total: data.total,
        optIn: data.optIn,
        optInRate: data.total > 0 ? ((data.optIn / data.total) * 100).toFixed(2) : '0.00',
        avgOrderValue: data.total > 0 ? (data.revenue / data.total).toFixed(2) : '0.00',
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Format province data
    const topProvinces = Array.from(provinceMap.entries())
      .filter(([name]) => name !== 'Unknown')
      .map(([name, data]) => ({
        name,
        total: data.total,
        optIn: data.optIn,
        optInRate: data.total > 0 ? ((data.optIn / data.total) * 100).toFixed(2) : '0.00',
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Format day of week data
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const byDayOfWeek = Array.from(dayOfWeekMap.entries())
      .map(([dayNum, data]) => ({
        day: dayNames[dayNum],
        dayNum,
        total: data.total,
        optIn: data.optIn,
        optInRate: data.total > 0 ? ((data.optIn / data.total) * 100).toFixed(2) : '0.00',
      }))
      .sort((a, b) => a.dayNum - b.dayNum);

    // Format month data
    const byMonth = Array.from(monthMap.entries())
      .map(([month, data]) => ({
        month,
        total: data.total,
        optIn: data.optIn,
        optInRate: data.total > 0 ? ((data.optIn / data.total) * 100).toFixed(2) : '0.00',
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Format order value analysis
    const orderValueAnalysis = valueRanges.map(range => {
      const data = valueRangeMap.get(range.label)!;
      return {
        range: range.label,
        total: data.total,
        optIns: data.optIn,
        optInRate: data.total > 0 ? ((data.optIn / data.total) * 100).toFixed(2) : '0.00',
      };
    });

    // Generate insights
    const insights = [];

    // Best performing store
    const bestStore = [...stores].sort((a, b) => parseFloat(b.optInRate) - parseFloat(a.optInRate))[0];
    if (bestStore && parseFloat(bestStore.optInRate) > 0) {
      insights.push({
        type: 'store',
        title: 'Top Performing Store',
        description: `${bestStore.storeId.replace('.myshopify.com', '')} leads with ${bestStore.optInRate}% opt-in rate`,
        value: bestStore.optInRate,
        impact: 'high' as const,
      });
    }

    // Value difference insight
    if (parseFloat(valueDifference) > 0) {
      insights.push({
        type: 'value',
        title: 'Opt-In Customers Spend More',
        description: `Opt-in customers spend $${valueDifference} more on average`,
        value: valueDifference,
        impact: 'high' as const,
      });
    }

    // Best city insight
    if (bestCitiesByOptIn.length > 0) {
      const bestCity = bestCitiesByOptIn[0];
      insights.push({
        type: 'geographic',
        title: 'Best Performing City',
        description: `${bestCity.name} has ${bestCity.optInRate}% opt-in rate with ${bestCity.total} orders`,
        value: bestCity.optInRate,
        impact: 'medium' as const,
      });
    }

    const analytics = {
      summary: {
        totalOrders,
        totalOptIns,
        totalOptOuts,
        optInRate,
        avgOptInOrderValue,
        avgOptOutOrderValue,
        valueDifference,
      },
      orderValueAnalysis,
      geographic: {
        topCities,
        bestCitiesByOptIn,
        topCountries,
        topProvinces,
      },
      stores,
      temporal: {
        byDayOfWeek,
        byMonth,
      },
      insights,
    };

    console.log('Analysis complete');

    return new Response(
      JSON.stringify({ success: true, data: analytics }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
