import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const API_KEY = Deno.env.get('SHOPIFY_EXTRACTOR_API_KEY');
    if (!API_KEY) {
      throw new Error('SHOPIFY_EXTRACTOR_API_KEY is not configured');
    }

    console.log('Fetching order data from external API...');

    // Fetch data from the external API
    const response = await fetch('https://shopify-phpmyadmin-extractor-api.onrender.com/fetch-data', {
      method: 'GET',
      headers: {
        'X-API-Key': API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error:', response.status, errorText);
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Received data from API, records count:', Array.isArray(data) ? data.length : 'not an array');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Process the data and insert into imported_orders
    let inserted = 0;
    let errors = 0;
    const batchSize = 500;

    // Assuming data is an array of order objects
    const orders = Array.isArray(data) ? data : (data.orders || data.data || []);
    console.log('Processing orders:', orders.length);

    for (let i = 0; i < orders.length; i += batchSize) {
      const batch = orders.slice(i, i + batchSize);
      
      const formattedBatch = batch.map((order: any) => ({
        external_id: order.id?.toString() || order.external_id?.toString() || `api-${Date.now()}-${Math.random()}`,
        order_number: order.order_number?.toString() || order.name || null,
        shopify_order_id: order.shopify_order_id?.toString() || order.id?.toString() || null,
        customer_external_id: order.customer_id?.toString() || order.customer_external_id?.toString() || null,
        opt_in: order.opt_in === true || order.opt_in === 'true' || order.opt_in === 1 || order.opt_in === '1',
        total_price: parseFloat(order.total_price) || 0,
        city: order.city || order.shipping_city || null,
        province: order.province || order.shipping_province || null,
        country: order.country || order.shipping_country || null,
        store_id: order.store_id || order.store || null,
        payment_status: order.payment_status || order.financial_status || null,
        shopify_created_at: order.created_at || order.shopify_created_at || null,
      }));

      const { error } = await supabase
        .from('imported_orders')
        .upsert(formattedBatch, { 
          onConflict: 'external_id',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error('Batch insert error:', error);
        errors += batch.length;
      } else {
        inserted += batch.length;
      }
    }

    console.log(`Import complete: ${inserted} inserted, ${errors} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        inserted, 
        errors,
        total: orders.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Error in fetch-orders-api:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
