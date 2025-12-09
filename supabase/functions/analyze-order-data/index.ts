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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting comprehensive order analysis...');

    // Get total counts
    const { count: totalOrders } = await supabase
      .from('imported_orders')
      .select('*', { count: 'exact', head: true });

    const { count: optInCount } = await supabase
      .from('imported_orders')
      .select('*', { count: 'exact', head: true })
      .eq('opt_in', true);

    console.log(`Total orders: ${totalOrders}, Opt-ins: ${optInCount}`);

    // Fetch all orders in batches for aggregation
    const allOrders: any[] = [];
    const batchSize = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: batch, error } = await supabase
        .from('imported_orders')
        .select('opt_in, total_price, city, country, province, store_id, created_at')
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.error('Batch fetch error:', error);
        break;
      }

      if (batch && batch.length > 0) {
        allOrders.push(...batch);
        offset += batchSize;
        console.log(`Fetched ${allOrders.length} orders so far...`);
      }

      if (!batch || batch.length < batchSize) {
        hasMore = false;
      }
    }

    console.log(`Total orders fetched: ${allOrders.length}`);

    const optInOrders = allOrders.filter(o => o.opt_in);
    const optOutOrders = allOrders.filter(o => !o.opt_in);
    const optInRate = allOrders.length > 0 ? ((optInOrders.length / allOrders.length) * 100).toFixed(2) : '0';

    // Calculate average order values
    const avgOptInValue = optInOrders.length > 0 
      ? optInOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0) / optInOrders.length 
      : 0;
    const avgOptOutValue = optOutOrders.length > 0 
      ? optOutOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0) / optOutOrders.length 
      : 0;

    // ORDER VALUE RANGE ANALYSIS
    const priceRanges = [
      { min: 0, max: 50, label: '£0-50' },
      { min: 50, max: 100, label: '£50-100' },
      { min: 100, max: 150, label: '£100-150' },
      { min: 150, max: 200, label: '£150-200' },
      { min: 200, max: 300, label: '£200-300' },
      { min: 300, max: 500, label: '£300-500' },
      { min: 500, max: Infinity, label: '£500+' },
    ];

    const orderValueAnalysis = priceRanges.map(range => {
      const ordersInRange = allOrders.filter(o => {
        const price = Number(o.total_price) || 0;
        return price >= range.min && price < range.max;
      });
      const optInsInRange = ordersInRange.filter(o => o.opt_in);
      return {
        range: range.label,
        total: ordersInRange.length,
        optIns: optInsInRange.length,
        optInRate: ordersInRange.length > 0 
          ? ((optInsInRange.length / ordersInRange.length) * 100).toFixed(1) 
          : '0',
      };
    });

    // GEOGRAPHIC ANALYSIS - Cities
    const cityStats = new Map<string, { total: number; optIn: number; revenue: number }>();
    allOrders.forEach(order => {
      if (order.city) {
        const key = order.city;
        const existing = cityStats.get(key) || { total: 0, optIn: 0, revenue: 0 };
        cityStats.set(key, {
          total: existing.total + 1,
          optIn: existing.optIn + (order.opt_in ? 1 : 0),
          revenue: existing.revenue + (Number(order.total_price) || 0),
        });
      }
    });

    const topCities = Array.from(cityStats.entries())
      .map(([name, stats]) => ({
        name,
        total: stats.total,
        optIn: stats.optIn,
        optInRate: ((stats.optIn / stats.total) * 100).toFixed(1),
        avgOrderValue: (stats.revenue / stats.total).toFixed(2),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);

    // Best performing cities by opt-in rate (min 50 orders)
    const bestCitiesByOptIn = Array.from(cityStats.entries())
      .filter(([_, stats]) => stats.total >= 50)
      .map(([name, stats]) => ({
        name,
        total: stats.total,
        optIn: stats.optIn,
        optInRate: ((stats.optIn / stats.total) * 100).toFixed(1),
      }))
      .sort((a, b) => parseFloat(b.optInRate) - parseFloat(a.optInRate))
      .slice(0, 10);

    // GEOGRAPHIC ANALYSIS - Countries
    const countryStats = new Map<string, { total: number; optIn: number; revenue: number }>();
    allOrders.forEach(order => {
      if (order.country) {
        const key = order.country;
        const existing = countryStats.get(key) || { total: 0, optIn: 0, revenue: 0 };
        countryStats.set(key, {
          total: existing.total + 1,
          optIn: existing.optIn + (order.opt_in ? 1 : 0),
          revenue: existing.revenue + (Number(order.total_price) || 0),
        });
      }
    });

    const topCountries = Array.from(countryStats.entries())
      .map(([name, stats]) => ({
        name,
        total: stats.total,
        optIn: stats.optIn,
        optInRate: ((stats.optIn / stats.total) * 100).toFixed(1),
        avgOrderValue: (stats.revenue / stats.total).toFixed(2),
      }))
      .sort((a, b) => b.total - a.total);

    // GEOGRAPHIC ANALYSIS - Provinces/Regions
    const provinceStats = new Map<string, { total: number; optIn: number; revenue: number }>();
    allOrders.forEach(order => {
      if (order.province) {
        const key = order.province;
        const existing = provinceStats.get(key) || { total: 0, optIn: 0, revenue: 0 };
        provinceStats.set(key, {
          total: existing.total + 1,
          optIn: existing.optIn + (order.opt_in ? 1 : 0),
          revenue: existing.revenue + (Number(order.total_price) || 0),
        });
      }
    });

    const topProvinces = Array.from(provinceStats.entries())
      .map(([name, stats]) => ({
        name,
        total: stats.total,
        optIn: stats.optIn,
        optInRate: ((stats.optIn / stats.total) * 100).toFixed(1),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    // STORE ANALYSIS
    const storeStats = new Map<string, { total: number; optIn: number; revenue: number }>();
    allOrders.forEach(order => {
      if (order.store_id) {
        const key = order.store_id;
        const existing = storeStats.get(key) || { total: 0, optIn: 0, revenue: 0 };
        storeStats.set(key, {
          total: existing.total + 1,
          optIn: existing.optIn + (order.opt_in ? 1 : 0),
          revenue: existing.revenue + (Number(order.total_price) || 0),
        });
      }
    });

    const stores = Array.from(storeStats.entries())
      .map(([storeId, stats]) => ({
        storeId,
        total: stats.total,
        optIn: stats.optIn,
        optInRate: ((stats.optIn / stats.total) * 100).toFixed(1),
        avgOrderValue: (stats.revenue / stats.total).toFixed(2),
        totalRevenue: stats.revenue.toFixed(2),
      }))
      .sort((a, b) => b.total - a.total);

    // TEMPORAL ANALYSIS
    const monthStats = new Map<string, { total: number; optIn: number }>();
    const dayOfWeekStats = new Map<number, { total: number; optIn: number }>();
    
    allOrders.forEach(order => {
      if (order.created_at) {
        const date = new Date(order.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const dayOfWeek = date.getDay();

        const monthExisting = monthStats.get(monthKey) || { total: 0, optIn: 0 };
        monthStats.set(monthKey, {
          total: monthExisting.total + 1,
          optIn: monthExisting.optIn + (order.opt_in ? 1 : 0),
        });

        const dayExisting = dayOfWeekStats.get(dayOfWeek) || { total: 0, optIn: 0 };
        dayOfWeekStats.set(dayOfWeek, {
          total: dayExisting.total + 1,
          optIn: dayExisting.optIn + (order.opt_in ? 1 : 0),
        });
      }
    });

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const byDayOfWeek = Array.from(dayOfWeekStats.entries())
      .map(([day, stats]) => ({
        day: dayNames[day],
        dayNum: day,
        total: stats.total,
        optIn: stats.optIn,
        optInRate: ((stats.optIn / stats.total) * 100).toFixed(1),
      }))
      .sort((a, b) => a.dayNum - b.dayNum);

    const byMonth = Array.from(monthStats.entries())
      .map(([month, stats]) => ({
        month,
        total: stats.total,
        optIn: stats.optIn,
        optInRate: ((stats.optIn / stats.total) * 100).toFixed(1),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // KEY INSIGHTS
    const insights = [];

    // Best order value range for opt-ins
    const bestValueRange = orderValueAnalysis
      .filter(r => r.total >= 100)
      .sort((a, b) => parseFloat(b.optInRate) - parseFloat(a.optInRate))[0];
    if (bestValueRange) {
      insights.push({
        type: 'order_value',
        title: 'Best Converting Order Value',
        description: `Orders in the ${bestValueRange.range} range have the highest opt-in rate at ${bestValueRange.optInRate}%`,
        value: bestValueRange.optInRate,
        impact: 'high',
      });
    }

    // Best performing store
    const bestStore = stores.sort((a, b) => parseFloat(b.optInRate) - parseFloat(a.optInRate))[0];
    if (bestStore) {
      insights.push({
        type: 'store',
        title: 'Top Performing Store',
        description: `Store ${bestStore.storeId} leads with ${bestStore.optInRate}% opt-in rate across ${bestStore.total.toLocaleString()} orders`,
        value: bestStore.optInRate,
        impact: 'high',
      });
    }

    // Best day of week
    const bestDay = byDayOfWeek.sort((a, b) => parseFloat(b.optInRate) - parseFloat(a.optInRate))[0];
    if (bestDay) {
      insights.push({
        type: 'temporal',
        title: 'Best Day for Opt-Ins',
        description: `${bestDay.day} has the highest opt-in rate at ${bestDay.optInRate}%`,
        value: bestDay.optInRate,
        impact: 'medium',
      });
    }

    // Best city
    if (bestCitiesByOptIn[0]) {
      insights.push({
        type: 'geographic',
        title: 'Top City by Opt-In Rate',
        description: `${bestCitiesByOptIn[0].name} leads with ${bestCitiesByOptIn[0].optInRate}% opt-in rate (${bestCitiesByOptIn[0].total} orders)`,
        value: bestCitiesByOptIn[0].optInRate,
        impact: 'medium',
      });
    }

    // Order value difference
    const valueDiff = avgOptInValue - avgOptOutValue;
    if (Math.abs(valueDiff) > 5) {
      insights.push({
        type: 'value',
        title: 'Order Value Insight',
        description: valueDiff > 0 
          ? `Opt-in customers spend £${valueDiff.toFixed(2)} more on average`
          : `Opt-out customers spend £${Math.abs(valueDiff).toFixed(2)} more on average`,
        value: valueDiff.toFixed(2),
        impact: valueDiff > 0 ? 'high' : 'medium',
      });
    }

    const analytics = {
      summary: {
        totalOrders: allOrders.length,
        totalOptIns: optInOrders.length,
        totalOptOuts: optOutOrders.length,
        optInRate,
        avgOptInOrderValue: avgOptInValue.toFixed(2),
        avgOptOutOrderValue: avgOptOutValue.toFixed(2),
        valueDifference: valueDiff.toFixed(2),
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
        byMonth: byMonth.slice(-12), // Last 12 months
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
