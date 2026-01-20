import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body for selected stores filter
    let selectedStores: string[] = [];
    try {
      const body = await req.json();
      if (body.selectedStores && Array.isArray(body.selectedStores)) {
        selectedStores = body.selectedStores;
      }
    } catch {
      // No body or invalid JSON - analyze all stores
    }

    console.log('Starting imported orders analysis with SQL aggregation...');
    console.log('Selected stores filter:', selectedStores.length > 0 ? selectedStores : 'ALL');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Use user_id as store identifier (user_id contains store IDs in this dataset)
    const { count: userIdCount } = await supabase
      .from('imported_orders')
      .select('*', { count: 'exact', head: true })
      .not('user_id', 'is', null);
    
    const hasStoreData = (userIdCount || 0) > 0;
    console.log(`Store data available via user_id: ${hasStoreData} (${userIdCount} orders have user_id)`);

    // Helper to add store filter to queries using user_id field
    const addStoreFilter = (query: any) => {
      if (hasStoreData && selectedStores.length > 0) {
        return query.in('user_id', selectedStores);
      }
      return query;
    };

    // Use SQL aggregation instead of loading all orders into memory
    // This is much more efficient for large datasets

    // 1. Get overall summary stats
    const { data: summaryData, error: summaryError } = await supabase.rpc('get_order_summary_stats');
    
    let summary = {
      totalOrders: 0,
      totalOptIns: 0,
      totalOptOuts: 0,
      optInRate: '0.00',
      avgOptInOrderValue: '0.00',
      avgOptOutOrderValue: '0.00',
      valueDifference: '0.00',
    };

    // Fallback: direct queries if RPC doesn't exist
    if (summaryError) {
      console.log('RPC not available, using direct queries...');
      
      // Total counts - with store filter
      let totalOrdersQuery = supabase
        .from('imported_orders')
        .select('*', { count: 'exact', head: true });
      const { count: totalOrders } = await addStoreFilter(totalOrdersQuery);
      
      let totalOptInsQuery = supabase
        .from('imported_orders')
        .select('*', { count: 'exact', head: true })
        .eq('opt_in', true);
      const { count: totalOptIns } = await addStoreFilter(totalOptInsQuery);
      
      let totalOptOutsQuery = supabase
        .from('imported_orders')
        .select('*', { count: 'exact', head: true })
        .eq('opt_in', false);
      const { count: totalOptOuts } = await addStoreFilter(totalOptOutsQuery);
      
      // Get average order values using a limited sample for performance
      let optInPricesQuery = supabase
        .from('imported_orders')
        .select('total_price')
        .eq('opt_in', true)
        .not('total_price', 'is', null)
        .limit(10000);
      const { data: optInPrices } = await addStoreFilter(optInPricesQuery);
      
      let optOutPricesQuery = supabase
        .from('imported_orders')
        .select('total_price')
        .eq('opt_in', false)
        .not('total_price', 'is', null)
        .limit(10000);
      const { data: optOutPrices } = await optOutPricesQuery;
      
      const optInRevenue = optInPrices?.reduce((sum: number, o: any) => sum + (parseFloat(o.total_price) || 0), 0) || 0;
      const optOutRevenue = optOutPrices?.reduce((sum: number, o: any) => sum + (parseFloat(o.total_price) || 0), 0) || 0;
      
      const avgOptInOrderValue = optInPrices?.length ? (optInRevenue / optInPrices.length).toFixed(2) : '0.00';
      const avgOptOutOrderValue = optOutPrices?.length ? (optOutRevenue / optOutPrices.length).toFixed(2) : '0.00';
      
      summary = {
        totalOrders: totalOrders || 0,
        totalOptIns: totalOptIns || 0,
        totalOptOuts: totalOptOuts || 0,
        optInRate: totalOrders && totalOrders > 0 ? ((totalOptIns || 0) / totalOrders * 100).toFixed(2) : '0.00',
        avgOptInOrderValue,
        avgOptOutOrderValue,
        valueDifference: (parseFloat(avgOptInOrderValue) - parseFloat(avgOptOutOrderValue)).toFixed(2),
      };
    } else if (summaryData) {
      summary = summaryData;
    }

    console.log(`Summary: ${summary.totalOrders} orders, ${summary.optInRate}% opt-in`);

    // 2. Get store stats - using user_id as store identifier
    let storeQuery = supabase
      .from('imported_orders')
      .select('user_id, opt_in, total_price')
      .not('user_id', 'is', null)
      .limit(50000); // Sample for performance
    const { data: storeData } = await addStoreFilter(storeQuery);

    const storeMap = new Map<string, { total: number; optIn: number; revenue: number }>();
    storeData?.forEach((order: any) => {
      const storeId = order.user_id || 'unknown';
      const data = storeMap.get(storeId) || { total: 0, optIn: 0, revenue: 0 };
      data.total++;
      if (order.opt_in === true) data.optIn++;
      data.revenue += parseFloat(order.total_price) || 0;
      storeMap.set(storeId, data);
    });

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

    // Helper function to validate geographic values
    const isValidValue = (val: string | null): boolean => {
      if (!val) return false;
      const trimmed = val.trim();
      if (trimmed.length === 0) return false;
      if (trimmed === 'Unknown' || trimmed === 'null' || trimmed === 'undefined' || trimmed === 'N/A') return false;
      if (trimmed.includes('{') || trimmed.includes('"') || trimmed.includes('\\') || trimmed.includes(':')) return false;
      if (/^\d+/.test(trimmed)) return false; // Starts with number (address)
      if (/^\+?\d{10,}$/.test(trimmed.replace(/\s/g, ''))) return false; // Phone number
      if (trimmed.includes('Floor') || trimmed.includes('Street') || trimmed.includes('Road')) return false; // Address parts
      return true;
    };

    // 3. Get geographic stats - query ALL data for accuracy
    // Query countries - aggregate from full dataset
    // IMPORTANT: Supabase default limit is 1000, must set higher for full dataset
    let countryQuery = supabase
      .from('imported_orders')
      .select('country, opt_in, total_price')
      .limit(150000);
    const { data: rawCountryData } = await addStoreFilter(countryQuery);
    
    // Aggregate in memory from FULL dataset (no limit)
    const countryMap = new Map<string, { total: number; optIn: number; revenue: number }>();
    rawCountryData?.forEach((order: any) => {
      const country = order.country;
      if (isValidValue(country)) {
        const data = countryMap.get(country!) || { total: 0, optIn: 0, revenue: 0 };
        data.total++;
        if (order.opt_in === true) data.optIn++;
        data.revenue += parseFloat(order.total_price) || 0;
        countryMap.set(country!, data);
      }
    });
    
    const countryResults = Array.from(countryMap.entries()).map(([name, data]) => ({
      name,
      total: data.total,
      optIn: data.optIn,
      optInRate: data.total > 0 ? ((data.optIn / data.total) * 100).toFixed(2) : '0.00',
      avgOrderValue: data.total > 0 ? (data.revenue / data.total).toFixed(2) : '0.00',
    }));

    const topCountries = countryResults
      .filter((c: any) => isValidValue(c.name))
      .sort((a: any, b: any) => b.total - a.total);

    console.log(`Found ${topCountries.length} valid countries:`, topCountries.map((c: any) => `${c.name}(${c.total})`));

    // Query cities WITH country and province for proper hierarchy
    let cityQuery = supabase
      .from('imported_orders')
      .select('city, country, province, opt_in, total_price')
      .limit(150000);
    const { data: rawCityData } = await addStoreFilter(cityQuery);
    
    // Build city map (for top cities display)
    const cityMap = new Map<string, { total: number; optIn: number; revenue: number }>();
    // Build country->city hierarchy map with proper nesting
    const hierarchyMap = new Map<string, Map<string, { total: number; optIn: number; provinces: Map<string, { total: number; optIn: number }> }>>();
    
    rawCityData?.forEach((order: any) => {
      const city = order.city;
      const country = order.country;
      const province = order.province;
      
      // For flat top cities list
      if (isValidValue(city)) {
        const data = cityMap.get(city!) || { total: 0, optIn: 0, revenue: 0 };
        data.total++;
        if (order.opt_in === true) data.optIn++;
        data.revenue += parseFloat(order.total_price) || 0;
        cityMap.set(city!, data);
      }
      
      // Build proper hierarchy: country -> city -> province
      if (isValidValue(country)) {
        if (!hierarchyMap.has(country!)) {
          hierarchyMap.set(country!, new Map());
        }
        const countryData = hierarchyMap.get(country!)!;
        
        if (isValidValue(city)) {
          if (!countryData.has(city!)) {
            countryData.set(city!, { total: 0, optIn: 0, provinces: new Map() });
          }
          const cityData = countryData.get(city!)!;
          cityData.total++;
          if (order.opt_in === true) cityData.optIn++;
          
          // Add province under city
          if (isValidValue(province)) {
            const provinceData = cityData.provinces.get(province!) || { total: 0, optIn: 0 };
            provinceData.total++;
            if (order.opt_in === true) provinceData.optIn++;
            cityData.provinces.set(province!, provinceData);
          }
        }
      }
    });

    const topCities = Array.from(cityMap.entries())
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

    // Query provinces - for flat top provinces list
    let provinceQuery = supabase
      .from('imported_orders')
      .select('province, opt_in, total_price')
      .limit(150000);
    const { data: rawProvinceData } = await addStoreFilter(provinceQuery);
    
    const provinceMap = new Map<string, { total: number; optIn: number; revenue: number }>();
    rawProvinceData?.forEach((order: any) => {
      const province = order.province;
      if (isValidValue(province)) {
        const data = provinceMap.get(province!) || { total: 0, optIn: 0, revenue: 0 };
        data.total++;
        if (order.opt_in === true) data.optIn++;
        data.revenue += parseFloat(order.total_price) || 0;
        provinceMap.set(province!, data);
      }
    });

    const topProvinces = Array.from(provinceMap.entries())
      .map(([name, data]) => ({
        name,
        total: data.total,
        optIn: data.optIn,
        optInRate: data.total > 0 ? ((data.optIn / data.total) * 100).toFixed(2) : '0.00',
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // 4. Get temporal stats - using sampled data
    let temporalQuery = supabase
      .from('imported_orders')
      .select('shopify_created_at, opt_in')
      .not('shopify_created_at', 'is', null)
      .limit(50000);
    const { data: temporalData } = await addStoreFilter(temporalQuery);

    const dayOfWeekMap = new Map<number, { total: number; optIn: number }>();
    const monthMap = new Map<string, { total: number; optIn: number }>();

    temporalData?.forEach((order: any) => {
      if (order.shopify_created_at) {
        const date = new Date(order.shopify_created_at);
        const dayOfWeek = date.getDay();
        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const isOptIn = order.opt_in === true;

        const dayData = dayOfWeekMap.get(dayOfWeek) || { total: 0, optIn: 0 };
        dayData.total++;
        if (isOptIn) dayData.optIn++;
        dayOfWeekMap.set(dayOfWeek, dayData);

        const monthData = monthMap.get(month) || { total: 0, optIn: 0 };
        monthData.total++;
        if (isOptIn) monthData.optIn++;
        monthMap.set(month, monthData);
      }
    });

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

    const byMonth = Array.from(monthMap.entries())
      .map(([month, data]) => ({
        month,
        total: data.total,
        optIn: data.optIn,
        optInRate: data.total > 0 ? ((data.optIn / data.total) * 100).toFixed(2) : '0.00',
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // 5. Get order value analysis - sampled
    let valueQuery = supabase
      .from('imported_orders')
      .select('total_price, opt_in')
      .not('total_price', 'is', null)
      .limit(50000);
    const { data: valueData } = await addStoreFilter(valueQuery);

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

    valueData?.forEach((order: any) => {
      const price = parseFloat(order.total_price) || 0;
      const isOptIn = order.opt_in === true;

      for (const range of valueRanges) {
        if (price >= range.min && price < range.max) {
          const rangeData = valueRangeMap.get(range.label)!;
          rangeData.total++;
          if (isOptIn) rangeData.optIn++;
          break;
        }
      }
    });

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
    if (parseFloat(summary.valueDifference) > 0) {
      insights.push({
        type: 'value',
        title: 'Opt-In Customers Spend More',
        description: `Opt-in customers spend $${summary.valueDifference} more on average`,
        value: summary.valueDifference,
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

    // Build proper hierarchy using hierarchyMap (country -> city -> province)
    const geographicHierarchy = topCountries.map(country => {
      const countryCities = hierarchyMap.get(country.name);
      let cities: any[] = [];
      
      if (countryCities) {
        cities = Array.from(countryCities.entries())
          .map(([cityName, cityData]) => {
            const regions = Array.from(cityData.provinces.entries())
              .map(([provinceName, provinceData]) => ({
                name: provinceName,
                total: provinceData.total,
                optIn: provinceData.optIn,
                optInRate: provinceData.total > 0 ? ((provinceData.optIn / provinceData.total) * 100).toFixed(2) : '0.00',
              }))
              .sort((a, b) => b.total - a.total)
              .slice(0, 10);
            
            return {
              name: cityName,
              total: cityData.total,
              optIn: cityData.optIn,
              optInRate: cityData.total > 0 ? ((cityData.optIn / cityData.total) * 100).toFixed(2) : '0.00',
              regions,
            };
          })
          .sort((a, b) => b.total - a.total)
          .slice(0, 15);
      }
      
      return {
        name: country.name,
        total: country.total,
        optIn: country.optIn,
        optInRate: country.optInRate,
        cities,
      };
    });

    const analytics = {
      summary,
      orderValueAnalysis,
      geographic: {
        topCities,
        bestCitiesByOptIn,
        topCountries,
        topProvinces,
        hierarchy: geographicHierarchy,
      },
      stores,
      temporal: {
        byDayOfWeek,
        byMonth,
      },
      insights,
    };

    console.log('Analysis complete with SQL aggregation');

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
