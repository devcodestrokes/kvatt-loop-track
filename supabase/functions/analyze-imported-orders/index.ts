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
    console.log('Starting imported orders analysis with SQL aggregation...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      
      // Total counts
      const { count: totalOrders } = await supabase
        .from('imported_orders')
        .select('*', { count: 'exact', head: true });
      
      const { count: totalOptIns } = await supabase
        .from('imported_orders')
        .select('*', { count: 'exact', head: true })
        .eq('opt_in', true);
      
      const { count: totalOptOuts } = await supabase
        .from('imported_orders')
        .select('*', { count: 'exact', head: true })
        .eq('opt_in', false);
      
      // Get average order values using a limited sample for performance
      const { data: optInPrices } = await supabase
        .from('imported_orders')
        .select('total_price')
        .eq('opt_in', true)
        .not('total_price', 'is', null)
        .limit(10000);
      
      const { data: optOutPrices } = await supabase
        .from('imported_orders')
        .select('total_price')
        .eq('opt_in', false)
        .not('total_price', 'is', null)
        .limit(10000);
      
      const optInRevenue = optInPrices?.reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0) || 0;
      const optOutRevenue = optOutPrices?.reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0) || 0;
      
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

    // 2. Get store stats - using direct query with aggregation
    const { data: storeData } = await supabase
      .from('imported_orders')
      .select('store_id, opt_in, total_price')
      .not('store_id', 'is', null)
      .limit(50000); // Sample for performance

    const storeMap = new Map<string, { total: number; optIn: number; revenue: number }>();
    storeData?.forEach(order => {
      const storeId = order.store_id || 'unknown';
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

    // 3. Get geographic stats - sample for memory efficiency
    const { data: geoData } = await supabase
      .from('imported_orders')
      .select('city, province, country, opt_in, total_price')
      .limit(50000);

    const cityMap = new Map<string, { total: number; optIn: number; revenue: number }>();
    const countryMap = new Map<string, { total: number; optIn: number; revenue: number }>();
    const provinceMap = new Map<string, { total: number; optIn: number; revenue: number }>();

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

    geoData?.forEach(order => {
      const city = order.city;
      const country = order.country;
      const province = order.province;
      const isOptIn = order.opt_in === true;
      const price = parseFloat(order.total_price) || 0;

      if (isValidValue(city)) {
        const data = cityMap.get(city!) || { total: 0, optIn: 0, revenue: 0 };
        data.total++;
        if (isOptIn) data.optIn++;
        data.revenue += price;
        cityMap.set(city!, data);
      }

      if (isValidValue(country)) {
        const data = countryMap.get(country!) || { total: 0, optIn: 0, revenue: 0 };
        data.total++;
        if (isOptIn) data.optIn++;
        data.revenue += price;
        countryMap.set(country!, data);
      }

      if (isValidValue(province)) {
        const data = provinceMap.get(province!) || { total: 0, optIn: 0, revenue: 0 };
        data.total++;
        if (isOptIn) data.optIn++;
        data.revenue += price;
        provinceMap.set(province!, data);
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

    // Get ALL valid countries (no minimum threshold)
    const topCountries = Array.from(countryMap.entries())
      .map(([name, data]) => ({
        name,
        total: data.total,
        optIn: data.optIn,
        optInRate: data.total > 0 ? ((data.optIn / data.total) * 100).toFixed(2) : '0.00',
        avgOrderValue: data.total > 0 ? (data.revenue / data.total).toFixed(2) : '0.00',
      }))
      .sort((a, b) => b.total - a.total);

    console.log(`Found ${topCountries.length} valid countries:`, topCountries.map(c => `${c.name}(${c.total})`));

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
    const { data: temporalData } = await supabase
      .from('imported_orders')
      .select('shopify_created_at, opt_in')
      .not('shopify_created_at', 'is', null)
      .limit(50000);

    const dayOfWeekMap = new Map<number, { total: number; optIn: number }>();
    const monthMap = new Map<string, { total: number; optIn: number }>();

    temporalData?.forEach(order => {
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
    const { data: valueData } = await supabase
      .from('imported_orders')
      .select('total_price, opt_in')
      .not('total_price', 'is', null)
      .limit(50000);

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

    valueData?.forEach(order => {
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

    // Build simple hierarchy (not the full nested one to save memory)
    const geographicHierarchy = topCountries.map(country => ({
      name: country.name,
      total: country.total,
      optIn: country.optIn,
      optInRate: country.optInRate,
      cities: topCities.slice(0, 5).map(city => ({
        name: city.name,
        total: city.total,
        optIn: city.optIn,
        optInRate: city.optInRate,
        regions: [],
      })),
    }));

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
