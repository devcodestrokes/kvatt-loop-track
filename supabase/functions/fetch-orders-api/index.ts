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

      // Extract city, country, province from destination
      const city = (destination as any).city || null;
      const country = (destination as any).country || null;
      const province = (destination as any).province || null;

      return {
        external_id: order.id?.toString() || `api-${Date.now()}-${Math.random()}`,
        name: order.name || null,
        shopify_order_id: order.shopify_order_id?.toString() || null,
        customer_id: order.customer_id?.toString() || null,
        // Handle opt_in as 1/0 from new API
        opt_in: order.opt_in === true || order.opt_in === 'true' || order.opt_in === 1 || order.opt_in === '1',
        total_price: parseFloat(order.total_price) || 0,
        destination,
        city,
        country,
        province,
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let forceFull = false;
    let pagesLimit = 0; // 0 = fetch all, otherwise limit pages for quick sync
    
    try {
      const body = await req.json();
      forceFull = body.forceFull === true;
      pagesLimit = body.pagesLimit || 0; // For optimization: fetch only first N pages
    } catch {
      // No body or invalid JSON
    }

    // Get current DB count
    const { count: currentDbCount } = await supabase
      .from('imported_orders')
      .select('*', { count: 'exact', head: true });

    console.log(`Current DB count: ${currentDbCount}`);

    // New API base URL - https://shopify.kvatt.com/api/get-orders
    const baseUrl = 'https://shopify.kvatt.com/api/get-orders';

    // Fetch first page to get pagination info
    console.log('Fetching first page to get total count...');
    const firstPageResponse = await fetch(`${baseUrl}?page=1`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!firstPageResponse.ok) {
      const errorText = await firstPageResponse.text();
      console.error('API error:', firstPageResponse.status, errorText);
      throw new Error(`API request failed: ${firstPageResponse.status}`);
    }

    const firstPageData = await firstPageResponse.json();
    const apiTotalCount = firstPageData.total || 0;
    const lastPage = firstPageData.last_page || 1;
    const perPage = firstPageData.per_page || 100;

    console.log(`API total: ${apiTotalCount}, pages: ${lastPage}, per_page: ${perPage}`);

    // If DB is up to date and not forcing full sync, just return
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

    // Collect all orders - start with first page data
    let allOrders: any[] = firstPageData.data || [];
    console.log(`Page 1: received ${allOrders.length} orders`);

    // Determine how many pages to fetch
    // For optimization: if pagesLimit > 0, only fetch that many pages (latest data first)
    const maxPages = pagesLimit > 0 ? Math.min(pagesLimit, lastPage) : lastPage;

    // Fetch remaining pages (if needed)
    for (let page = 2; page <= maxPages; page++) {
      console.log(`Fetching page ${page}/${maxPages}...`);
      
      const response = await fetch(`${baseUrl}?page=${page}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`Page ${page} failed:`, response.status);
        // Continue with what we have
        break;
      }

      const pageData = await response.json();
      const orders = pageData.data || [];
      
      if (orders.length === 0) {
        console.log(`Page ${page}: no more data`);
        break;
      }

      allOrders = allOrders.concat(orders);
      console.log(`Page ${page}: received ${orders.length} orders, total: ${allOrders.length}`);

      // Safety limit
      if (allOrders.length >= 150000) {
        console.log('Reached 150k order limit for single sync');
        break;
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
          message: 'No orders to process',
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
        pagesFetched: Math.min(maxPages, lastPage),
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
