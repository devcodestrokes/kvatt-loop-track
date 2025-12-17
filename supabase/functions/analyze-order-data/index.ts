import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SHOPIFY_API_BASE = 'https://shopify.kvatt.com/api';
const SHOPIFY_API_TOKEN = 'Bearer %^75464tnfsdhndsfbgr54';

interface StoreAnalytics {
  store: string;
  total_checkouts: number;
  opt_ins: number;
  opt_outs: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting Shopify order analysis...');

    // Get date range - last 90 days by default
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    // Fetch stores list
    const storesResponse = await fetch(`${SHOPIFY_API_BASE}/get-stores`, {
      headers: {
        'Authorization': SHOPIFY_API_TOKEN,
        'Content-Type': 'application/json',
      },
    });

    if (!storesResponse.ok) {
      throw new Error(`Failed to fetch stores: ${storesResponse.status}`);
    }

    const storesData = await storesResponse.json();
    const storesList: string[] = storesData.data || [];
    console.log(`Found ${storesList.length} stores`);

    // Fetch analytics data for all stores
    const analyticsResponse = await fetch(
      `${SHOPIFY_API_BASE}/get-alaytics?store=all&start_date=${formatDate(startDate)}&end_date=${formatDate(endDate)}`,
      {
        headers: {
          'Authorization': SHOPIFY_API_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!analyticsResponse.ok) {
      throw new Error(`Failed to fetch analytics: ${analyticsResponse.status}`);
    }

    const analyticsData = await analyticsResponse.json();
    const storeAnalytics: StoreAnalytics[] = analyticsData.data || [];
    console.log(`Received analytics for ${storeAnalytics.length} stores`);

    // Calculate totals
    let totalOrders = 0;
    let totalOptIns = 0;
    let totalOptOuts = 0;

    storeAnalytics.forEach(store => {
      totalOrders += store.total_checkouts;
      totalOptIns += store.opt_ins;
      totalOptOuts += store.opt_outs;
    });

    const optInRate = totalOrders > 0 ? ((totalOptIns / totalOrders) * 100).toFixed(2) : '0.00';

    console.log(`Total orders: ${totalOrders}, Opt-ins: ${totalOptIns}, Opt-outs: ${totalOptOuts}`);

    // Process store data
    const stores = storeAnalytics
      .filter(s => s.total_checkouts > 0)
      .map(s => ({
        storeId: s.store,
        total: s.total_checkouts,
        optIn: s.opt_ins,
        optInRate: s.total_checkouts > 0 
          ? ((s.opt_ins / s.total_checkouts) * 100).toFixed(2) 
          : '0.00',
        avgOrderValue: '0.00', // Not available from Shopify API
        totalRevenue: '0.00', // Not available from Shopify API
      }))
      .sort((a, b) => b.total - a.total);

    // Generate insights
    const insights = [];

    // Best performing store
    const bestStore = [...stores].sort((a, b) => parseFloat(b.optInRate) - parseFloat(a.optInRate))[0];
    if (bestStore && parseFloat(bestStore.optInRate) > 0) {
      insights.push({
        type: 'store',
        title: 'Top Performing Store',
        description: `${bestStore.storeId.replace('.myshopify.com', '')} leads with ${bestStore.optInRate}% opt-in rate across ${bestStore.total.toLocaleString()} checkouts`,
        value: bestStore.optInRate,
        impact: 'high' as const,
      });
    }

    // Lowest performing store with significant traffic
    const underperformingStores = stores
      .filter(s => s.total >= 50 && parseFloat(s.optInRate) < parseFloat(optInRate))
      .sort((a, b) => parseFloat(a.optInRate) - parseFloat(b.optInRate));
    
    if (underperformingStores.length > 0) {
      const worstStore = underperformingStores[0];
      insights.push({
        type: 'store',
        title: 'Improvement Opportunity',
        description: `${worstStore.storeId.replace('.myshopify.com', '')} has ${worstStore.optInRate}% opt-in rate - below average. Consider reviewing widget placement.`,
        value: worstStore.optInRate,
        impact: 'medium' as const,
      });
    }

    // Overall performance insight
    if (totalOrders > 0) {
      const performanceLevel = parseFloat(optInRate) >= 5 ? 'high' : parseFloat(optInRate) >= 2 ? 'medium' : 'low';
      insights.push({
        type: 'overall',
        title: 'Overall Opt-In Performance',
        description: `${totalOptIns.toLocaleString()} customers opted in out of ${totalOrders.toLocaleString()} checkouts (${optInRate}%)`,
        value: optInRate,
        impact: performanceLevel as 'high' | 'medium' | 'low',
      });
    }

    // Active stores insight
    const activeStores = stores.filter(s => s.total > 0).length;
    if (activeStores > 0) {
      insights.push({
        type: 'stores',
        title: 'Active Stores',
        description: `${activeStores} stores with checkout activity in the last 90 days`,
        value: activeStores.toString(),
        impact: 'medium' as const,
      });
    }

    const analytics = {
      summary: {
        totalOrders,
        totalOptIns,
        totalOptOuts,
        optInRate,
        avgOptInOrderValue: '0.00', // Not available from Shopify API
        avgOptOutOrderValue: '0.00', // Not available from Shopify API
        valueDifference: '0.00', // Not available from Shopify API
      },
      orderValueAnalysis: [], // Not available from Shopify API
      geographic: {
        topCities: [],
        bestCitiesByOptIn: [],
        topCountries: [],
        topProvinces: [],
      },
      stores,
      temporal: {
        byDayOfWeek: [],
        byMonth: [],
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
