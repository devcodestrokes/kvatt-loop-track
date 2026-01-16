import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const processAndUpsertOrders = async (supabase: any, orders: any[]) => {
  let inserted = 0;
  let errors = 0;
  const batchSize = 1000;

  for (let i = 0; i < orders.length; i += batchSize) {
    const batch = orders.slice(i, i + batchSize);
    
    const formattedBatch = batch.map((order: any) => {
      // Parse destination - can be object or string
      let destination = {};
      if (order.destination) {
        if (typeof order.destination === 'object') {
          destination = order.destination;
        } else if (typeof order.destination === 'string') {
          try {
            destination = JSON.parse(order.destination);
          } catch {
            destination = {};
          }
        }
      }

      return {
        external_id: order.id?.toString() || `api-${Date.now()}-${Math.random()}`,
        name: order.name || null,
        shopify_order_id: order.shopify_order_id?.toString() || null,
        customer_id: order.customer_id?.toString() || null,
        opt_in: order.opt_in === true || order.opt_in === 'true' || order.opt_in === 1 || order.opt_in === '1',
        total_price: parseFloat(order.total_price) || 0,
        destination,
        user_id: order.user_id?.toString() || null,
        payment_status: order.payment_status || null,
        shopify_created_at: order.shopify_created_at || order.created_at || null,
        updated_at: order.updated_at || new Date().toISOString(),
      };
    });

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

  return { inserted, errors };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const API_KEY = Deno.env.get('SHOPIFY_EXTRACTOR_API_KEY');
    if (!API_KEY) {
      throw new Error('SHOPIFY_EXTRACTOR_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let triggerRefresh = false;
    let forceFull = false;
    
    try {
      const body = await req.json();
      triggerRefresh = body.refresh === true;
      forceFull = body.forceFull === true;
    } catch {
      // No body or invalid JSON
    }

    // Get current DB count
    const { count: currentDbCount } = await supabase
      .from('imported_orders')
      .select('*', { count: 'exact', head: true });

    console.log(`Current DB count: ${currentDbCount}`);

    // New API base URL
    const baseUrl = 'https://shopify-phpmyadmin-extractor-api.onrender.com/api/data';

    // First, get metadata to check total count
    console.log('Fetching metadata...');
    const metadataResponse = await fetch(
      'https://shopify-phpmyadmin-extractor-api.onrender.com/api/metadata',
      {
        method: 'GET',
        headers: { 'X-API-Key': API_KEY },
      }
    );

    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text();
      console.error('Metadata API error:', metadataResponse.status, errorText);
      throw new Error(`Metadata API failed: ${metadataResponse.status}`);
    }

    const metadata = await metadataResponse.json();
    const apiTotalCount = metadata.total_count || 0;
    console.log(`API total count: ${apiTotalCount}, DB count: ${currentDbCount}`);

    // If DB is up to date, no need to fetch
    if (!forceFull && currentDbCount && currentDbCount >= apiTotalCount) {
      console.log('Database is up to date');
      return new Response(
        JSON.stringify({ 
          success: true, 
          inserted: 0,
          errors: 0,
          total: currentDbCount,
          apiRecordCount: apiTotalCount,
          message: 'Database is up to date',
          timestamp: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Calculate which rows to fetch
    const startRow = forceFull ? 1 : (currentDbCount || 0) + 1;
    const batchSize = 5000;
    
    let allOrders: any[] = [];
    let currentStart = startRow;
    let hasMoreData = true;

    console.log(`Fetching orders starting from row ${startRow}...`);

    while (hasMoreData && currentStart <= apiTotalCount) {
      const endRow = Math.min(currentStart + batchSize - 1, apiTotalCount);
      
      const apiUrl = `${baseUrl}?start_row=${currentStart}&end_row=${endRow}&refresh=${triggerRefresh}`;
      console.log(`Fetching rows ${currentStart}-${endRow}...`);

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'X-API-Key': API_KEY,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error:', response.status, errorText);
        
        if (response.status === 401) {
          throw new Error('API authentication failed - check API key');
        }
        
        if (response.status === 503 || response.status >= 500) {
          if (allOrders.length > 0) {
            console.log('API temporarily unavailable, processing partial data...');
            break;
          }
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'External API temporarily unavailable.',
              retryable: true,
              apiStatus: response.status,
              dbCount: currentDbCount
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }
        
        throw new Error(`API request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`Received ${data.returned_count || 0} orders, source: ${data.source}`);

      const orders = data.data || [];
      if (orders.length === 0) {
        hasMoreData = false;
      } else {
        allOrders = allOrders.concat(orders);
        currentStart = endRow + 1;
        
        if (orders.length < batchSize) {
          hasMoreData = false;
        }
      }

      if (allOrders.length >= 50000) {
        console.log('Reached 50k order limit for single sync');
        hasMoreData = false;
      }
    }

    console.log(`Total orders fetched: ${allOrders.length}`);

    if (allOrders.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          inserted: 0, 
          errors: 0,
          total: currentDbCount,
          apiRecordCount: apiTotalCount,
          message: 'No new orders to process',
          timestamp: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const { inserted, errors } = await processAndUpsertOrders(supabase, allOrders);

    // Get final count
    const { count: finalDbCount } = await supabase
      .from('imported_orders')
      .select('*', { count: 'exact', head: true });

    console.log(`Import complete: ${inserted} inserted, ${errors} errors. Final DB count: ${finalDbCount}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        inserted, 
        errors,
        total: finalDbCount,
        apiRecordCount: apiTotalCount,
        refreshTriggered: triggerRefresh,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in fetch-orders-api:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});