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
    const { question, selectedStores } = await req.json();
    
    if (!question || typeof question !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Question is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Create Supabase client to fetch aggregate metrics (no PII)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch aggregate metrics only - NO PII
    console.log('Fetching aggregate metrics for chatbot...', { selectedStores });
    
    // Check if store_id data is available in the database
    const { count: storeIdCount } = await supabase
      .from('imported_orders')
      .select('*', { count: 'exact', head: true })
      .not('store_id', 'is', null);
    
    const hasStoreData = (storeIdCount || 0) > 0;
    console.log(`Store ID data available: ${hasStoreData} (${storeIdCount} orders have store_id)`);
    
    // Build query with optional store filter (only if store data exists)
    let query = supabase
      .from('imported_orders')
      .select('store_id, opt_in, total_price, shopify_created_at, city, country, province');
    
    // Apply store filter only if store data exists and stores are selected
    if (hasStoreData && selectedStores && Array.isArray(selectedStores) && selectedStores.length > 0) {
      query = query.in('store_id', selectedStores);
    }
    
    const { data: orders, error: ordersError } = await query.limit(5000);

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      throw new Error('Failed to fetch metrics');
    }

    // Compute aggregates (no individual customer data)
    const storeMetrics: Record<string, {
      total: number;
      optIns: number;
      totalRevenue: number;
      avgOrderValue: number;
    }> = {};

    const cityMetrics: Record<string, { total: number; optIns: number }> = {};
    const countryMetrics: Record<string, { total: number; optIns: number }> = {};
    
    let totalOrders = 0;
    let totalOptIns = 0;
    let totalRevenue = 0;

    for (const order of orders || []) {
      totalOrders++;
      if (order.opt_in) totalOptIns++;
      totalRevenue += order.total_price || 0;

      // Store metrics
      const storeId = order.store_id || 'unknown';
      if (!storeMetrics[storeId]) {
        storeMetrics[storeId] = { total: 0, optIns: 0, totalRevenue: 0, avgOrderValue: 0 };
      }
      storeMetrics[storeId].total++;
      if (order.opt_in) storeMetrics[storeId].optIns++;
      storeMetrics[storeId].totalRevenue += order.total_price || 0;

      // City metrics (aggregated, not individual)
      if (order.city) {
        if (!cityMetrics[order.city]) cityMetrics[order.city] = { total: 0, optIns: 0 };
        cityMetrics[order.city].total++;
        if (order.opt_in) cityMetrics[order.city].optIns++;
      }

      // Country metrics
      if (order.country) {
        if (!countryMetrics[order.country]) countryMetrics[order.country] = { total: 0, optIns: 0 };
        countryMetrics[order.country].total++;
        if (order.opt_in) countryMetrics[order.country].optIns++;
      }
    }

    // Calculate averages
    Object.keys(storeMetrics).forEach(storeId => {
      const store = storeMetrics[storeId];
      store.avgOrderValue = store.total > 0 ? store.totalRevenue / store.total : 0;
    });

    // Prepare context for AI (aggregate data only - NO PII)
    const metricsContext = {
      summary: {
        totalOrders,
        totalOptIns,
        overallOptInRate: totalOrders > 0 ? ((totalOptIns / totalOrders) * 100).toFixed(2) : '0.00',
        totalRevenue: totalRevenue.toFixed(2),
        avgOrderValue: totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : '0.00',
      },
      storePerformance: Object.entries(storeMetrics)
        .map(([storeId, metrics]) => ({
          store: storeId.replace('.myshopify.com', ''),
          orders: metrics.total,
          optIns: metrics.optIns,
          optInRate: metrics.total > 0 ? ((metrics.optIns / metrics.total) * 100).toFixed(2) : '0.00',
          avgOrderValue: metrics.avgOrderValue.toFixed(2),
        }))
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 20),
      topCities: Object.entries(cityMetrics)
        .map(([city, metrics]) => ({
          city,
          orders: metrics.total,
          optInRate: metrics.total > 0 ? ((metrics.optIns / metrics.total) * 100).toFixed(2) : '0.00',
        }))
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 15),
      topCountries: Object.entries(countryMetrics)
        .map(([country, metrics]) => ({
          country,
          orders: metrics.total,
          optInRate: metrics.total > 0 ? ((metrics.optIns / metrics.total) * 100).toFixed(2) : '0.00',
        }))
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 10),
    };

    console.log('Metrics context prepared, calling Lovable AI...');

    // Call Lovable AI with aggregate metrics context only
    const systemPrompt = `You are a read-only analytics assistant for Kvatt, a reusable packaging company. You can ONLY answer factual questions about the provided aggregate metrics data.

STRICT RULES:
1. You can ONLY answer questions about the provided metrics data
2. You CANNOT make recommendations, suggestions, or predictions
3. You CANNOT access any individual customer data or PII
4. If asked about something outside the provided data, say "I can only answer questions about the aggregate metrics data available."
5. Keep responses concise and factual
6. Format numbers with proper separators and percentages with 2 decimal places

AVAILABLE METRICS DATA:
${JSON.stringify(metricsContext, null, 2)}

When answering:
- Reference specific numbers from the data
- Be precise with percentages and values
- If the data doesn't contain what's being asked, say so clearly`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please contact admin.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('AI service temporarily unavailable');
    }

    const aiResponse = await response.json();
    const answer = aiResponse.choices?.[0]?.message?.content || 'Unable to generate response';

    console.log('AI response received successfully');

    return new Response(
      JSON.stringify({ answer, metrics: metricsContext.summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in insights-chat:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
