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
    // Parse request body for filters
    let selectedStores: string[] = [];
    let dateFrom: string | null = null;
    let dateTo: string | null = null;
    
    try {
      const body = await req.json();
      if (body.selectedStores && Array.isArray(body.selectedStores)) {
        selectedStores = body.selectedStores;
      }
      if (body.dateFrom) {
        dateFrom = body.dateFrom;
      }
      if (body.dateTo) {
        dateTo = body.dateTo;
      }
    } catch {
      // No body or invalid JSON - analyze all data
    }

    console.log('Starting complete order analytics using SQL aggregation...');
    console.log('Selected stores filter:', selectedStores.length > 0 ? selectedStores : 'ALL');
    console.log('Date range:', dateFrom ? `${dateFrom} to ${dateTo}` : 'ALL TIME');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Filters for RPC calls (null means all)
    const storeFilter = selectedStores.length > 0 ? selectedStores : null;

    // 1. Get complete summary statistics using SQL aggregation (NO LIMITS)
    console.log('Fetching complete summary stats...');
    const { data: summaryData, error: summaryError } = await supabase.rpc('get_complete_summary_stats', {
      store_filter: storeFilter,
      date_from: dateFrom,
      date_to: dateTo
    });

    let summary = {
      totalOrders: 0,
      totalOptIns: 0,
      totalOptOuts: 0,
      optInRate: '0.00',
      avgOptInOrderValue: '0.00',
      avgOptOutOrderValue: '0.00',
      valueDifference: '0.00',
    };

    if (summaryError) {
      console.error('Summary stats error:', summaryError);
    } else if (summaryData && summaryData.length > 0) {
      const s = summaryData[0];
      summary = {
        totalOrders: Number(s.total_orders) || 0,
        totalOptIns: Number(s.total_opt_ins) || 0,
        totalOptOuts: Number(s.total_opt_outs) || 0,
        optInRate: s.opt_in_rate?.toFixed(2) || '0.00',
        avgOptInOrderValue: s.avg_opt_in_value?.toFixed(2) || '0.00',
        avgOptOutOrderValue: s.avg_opt_out_value?.toFixed(2) || '0.00',
        valueDifference: s.value_difference?.toFixed(2) || '0.00',
      };
    }

    console.log(`Complete summary: ${summary.totalOrders} total orders, ${summary.optInRate}% opt-in rate`);

    // 2. Get store statistics using SQL aggregation (NO LIMITS)
    console.log('Fetching complete store stats...');
    const { data: storeData, error: storeError } = await supabase.rpc('get_store_stats', {
      store_filter: storeFilter,
      date_from: dateFrom,
      date_to: dateTo
    });

    const stores = (storeData || []).map((s: any) => ({
      storeId: s.store_id,
      total: Number(s.total_orders) || 0,
      optIn: Number(s.opt_in_count) || 0,
      optInRate: s.total_orders > 0 ? ((s.opt_in_count / s.total_orders) * 100).toFixed(2) : '0.00',
      avgOrderValue: s.total_orders > 0 ? (Number(s.total_revenue) / s.total_orders).toFixed(2) : '0.00',
      totalRevenue: Number(s.total_revenue).toFixed(2),
    }));

    if (storeError) console.error('Store stats error:', storeError);
    console.log(`Found ${stores.length} stores`);

    // 3. Get complete country statistics using SQL aggregation (NO LIMITS - analyzes ALL orders)
    console.log('Fetching complete country stats...');
    const { data: countryData, error: countryError } = await supabase.rpc('get_country_stats', {
      store_filter: storeFilter,
      date_from: dateFrom,
      date_to: dateTo
    });

    const topCountries = (countryData || []).map((c: any) => ({
      name: c.country,
      total: Number(c.total_orders) || 0,
      optIn: Number(c.opt_in_count) || 0,
      optInRate: c.total_orders > 0 ? ((c.opt_in_count / c.total_orders) * 100).toFixed(2) : '0.00',
      avgOrderValue: c.total_orders > 0 ? (Number(c.total_revenue) / c.total_orders).toFixed(2) : '0.00',
    }));

    if (countryError) console.error('Country stats error:', countryError);
    console.log(`Found ${topCountries.length} countries from ALL orders`);

    // 4. Get complete city statistics with country context using SQL aggregation (NO LIMITS)
    console.log('Fetching complete city stats...');
    const { data: cityData, error: cityError } = await supabase.rpc('get_city_stats', {
      store_filter: storeFilter,
      date_from: dateFrom,
      date_to: dateTo
    });

    // Build city map and hierarchy from complete data
    const cityMap = new Map<string, { total: number; optIn: number; revenue: number }>();
    const hierarchyMap = new Map<string, Map<string, { total: number; optIn: number; provinces: Map<string, { total: number; optIn: number }> }>>();

    (cityData || []).forEach((row: any) => {
      const city = row.city;
      const country = row.country;
      const province = row.province;
      const total = Number(row.total_orders) || 0;
      const optIn = Number(row.opt_in_count) || 0;
      const revenue = Number(row.total_revenue) || 0;

      // Aggregate for flat city list
      if (city) {
        const existing = cityMap.get(city) || { total: 0, optIn: 0, revenue: 0 };
        existing.total += total;
        existing.optIn += optIn;
        existing.revenue += revenue;
        cityMap.set(city, existing);
      }

      // Build hierarchy: country -> city -> province
      if (country) {
        if (!hierarchyMap.has(country)) {
          hierarchyMap.set(country, new Map());
        }
        const countryMap = hierarchyMap.get(country)!;

        if (city) {
          if (!countryMap.has(city)) {
            countryMap.set(city, { total: 0, optIn: 0, provinces: new Map() });
          }
          const cityEntry = countryMap.get(city)!;
          cityEntry.total += total;
          cityEntry.optIn += optIn;

          if (province) {
            const provinceEntry = cityEntry.provinces.get(province) || { total: 0, optIn: 0 };
            provinceEntry.total += total;
            provinceEntry.optIn += optIn;
            cityEntry.provinces.set(province, provinceEntry);
          }
        }
      }
    });

    if (cityError) console.error('City stats error:', cityError);

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

    console.log(`Processed ${cityMap.size} unique cities from ALL orders`);

    // 5. Get complete province statistics using SQL aggregation (NO LIMITS)
    console.log('Fetching complete province stats...');
    const { data: provinceData, error: provinceError } = await supabase.rpc('get_province_stats', {
      store_filter: storeFilter,
      date_from: dateFrom,
      date_to: dateTo
    });

    const topProvinces = (provinceData || []).slice(0, 10).map((p: any) => ({
      name: p.province,
      total: Number(p.total_orders) || 0,
      optIn: Number(p.opt_in_count) || 0,
      optInRate: p.total_orders > 0 ? ((p.opt_in_count / p.total_orders) * 100).toFixed(2) : '0.00',
    }));

    if (provinceError) console.error('Province stats error:', provinceError);

    // 6. Get complete temporal statistics using SQL aggregation (NO LIMITS)
    console.log('Fetching complete temporal stats...');
    const { data: temporalData, error: temporalError } = await supabase.rpc('get_temporal_stats', {
      store_filter: storeFilter,
      date_from: dateFrom,
      date_to: dateTo
    });

    const dayOfWeekMap = new Map<number, { total: number; optIn: number }>();
    const monthMap = new Map<string, { total: number; optIn: number }>();

    (temporalData || []).forEach((row: any) => {
      const dayOfWeek = row.day_of_week;
      const monthYear = row.month_year;
      const total = Number(row.total_orders) || 0;
      const optIn = Number(row.opt_in_count) || 0;

      // Aggregate by day of week
      const dayData = dayOfWeekMap.get(dayOfWeek) || { total: 0, optIn: 0 };
      dayData.total += total;
      dayData.optIn += optIn;
      dayOfWeekMap.set(dayOfWeek, dayData);

      // Aggregate by month
      const monthData = monthMap.get(monthYear) || { total: 0, optIn: 0 };
      monthData.total += total;
      monthData.optIn += optIn;
      monthMap.set(monthYear, monthData);
    });

    if (temporalError) console.error('Temporal stats error:', temporalError);

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

    // 7. Get complete order value analysis using SQL aggregation (NO LIMITS)
    console.log('Fetching complete order value stats...');
    const { data: valueData, error: valueError } = await supabase.rpc('get_order_value_stats', {
      store_filter: storeFilter,
      date_from: dateFrom,
      date_to: dateTo
    });

    const valueRangeOrder = ['$0-25', '$25-50', '$50-100', '$100-200', '$200-500', '$500+'];
    const orderValueAnalysis = valueRangeOrder.map(range => {
      const match = (valueData || []).find((v: any) => v.price_range === range);
      return {
        range,
        total: match ? Number(match.total_orders) : 0,
        optIns: match ? Number(match.opt_in_count) : 0,
        optInRate: match && match.total_orders > 0 
          ? ((match.opt_in_count / match.total_orders) * 100).toFixed(2) 
          : '0.00',
      };
    });

    if (valueError) console.error('Value stats error:', valueError);

    // Generate insights
    const insights = [];

    // Best performing store
    const bestStore = [...stores].sort((a, b) => parseFloat(b.optInRate) - parseFloat(a.optInRate))[0];
    if (bestStore && parseFloat(bestStore.optInRate) > 0) {
      insights.push({
        type: 'store',
        title: 'Top Performing Store',
        description: `${String(bestStore.storeId).replace('.myshopify.com', '')} leads with ${bestStore.optInRate}% opt-in rate`,
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

    // Build proper geographic hierarchy using hierarchyMap (country -> city -> province)
    const geographicHierarchy = topCountries.map((country: any) => {
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
      _meta: {
        analyzedAt: new Date().toISOString(),
        totalOrdersAnalyzed: summary.totalOrders,
        usedSqlAggregation: true,
        noRowLimits: true,
        dateRange: dateFrom ? { from: dateFrom, to: dateTo } : null,
      }
    };

    console.log(`Complete analysis finished: ${summary.totalOrders} orders analyzed with NO row limits`);

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