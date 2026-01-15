import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse destination field which can be an escaped JSON string or regular JSON
const parseDestination = (destination: string | null | undefined): { 
  city: string | null; 
  province: string | null; 
  country: string | null;
  first_name: string | null;
  last_name: string | null;
  address1: string | null;
  address2: string | null;
  zip: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  country_code: string | null;
  province_code: string | null;
} => {
  const emptyResult = { 
    city: null, province: null, country: null, first_name: null, last_name: null,
    address1: null, address2: null, zip: null, phone: null, latitude: null, 
    longitude: null, country_code: null, province_code: null 
  };
  
  if (!destination) {
    return emptyResult;
  }
  
  try {
    let parsed: any = destination;
    
    if (typeof destination === 'string') {
      parsed = JSON.parse(destination);
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }
    }
    
    return {
      city: parsed?.city || null,
      province: parsed?.province || null,
      country: parsed?.country || null,
      first_name: parsed?.first_name || null,
      last_name: parsed?.last_name || null,
      address1: parsed?.address1 || null,
      address2: parsed?.address2 || null,
      zip: parsed?.zip || null,
      phone: parsed?.phone || null,
      latitude: parsed?.latitude || null,
      longitude: parsed?.longitude || null,
      country_code: parsed?.country_code || null,
      province_code: parsed?.province_code || null,
    };
  } catch (e) {
    return emptyResult;
  }
};

const processAndUpsertOrders = async (supabase: any, orders: any[]) => {
  let inserted = 0;
  let errors = 0;
  const batchSize = 1000; // Larger batches for efficiency

  for (let i = 0; i < orders.length; i += batchSize) {
    const batch = orders.slice(i, i + batchSize);
    
    const formattedBatch = batch.map((order: any) => {
      const parsedDestination = parseDestination(order.destination);
      
      const isCleanValue = (val: string | null | undefined): boolean => {
        if (!val) return false;
        return !val.includes('{') && !val.includes('\\') && !val.startsWith('"');
      };
      
      const city = parsedDestination.city || 
                   (isCleanValue(order.city) ? order.city : null) || 
                   (isCleanValue(order.shipping_city) ? order.shipping_city : null) || 
                   null;
      
      const province = parsedDestination.province || 
                       (isCleanValue(order.province) ? order.province : null) || 
                       (isCleanValue(order.shipping_province) ? order.shipping_province : null) || 
                       null;
      
      const country = parsedDestination.country || 
                      (isCleanValue(order.country) ? order.country : null) || 
                      (isCleanValue(order.shipping_country) ? order.shipping_country : null) || 
                      null;
      
      return {
        external_id: order.id?.toString() || order.external_id?.toString() || `api-${Date.now()}-${Math.random()}`,
        order_number: order.order_number?.toString() || order.name || null,
        shopify_order_id: order.shopify_order_id?.toString() || order.id?.toString() || null,
        customer_external_id: order.customer_id?.toString() || order.customer_external_id?.toString() || null,
        opt_in: order.opt_in === true || order.opt_in === 'true' || order.opt_in === 1 || order.opt_in === '1',
        total_price: parseFloat(order.total_price) || 0,
        city,
        province,
        country,
        store_id: order.store_id || order.store || order.user_id?.toString() || null,
        payment_status: order.payment_status || order.financial_status || null,
        shopify_created_at: order.created_at || order.shopify_created_at || null,
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

// Sync lock key in database to prevent concurrent syncs
const SYNC_LOCK_KEY = 'orders_api_sync_lock';
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

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
    let useIncremental = true; // Default to incremental sync
    let forceFull = false;
    
    try {
      const body = await req.json();
      triggerRefresh = body.refresh === true;
      useIncremental = body.incremental !== false; // Default true
      forceFull = body.forceFull === true;
    } catch {
      // No body or invalid JSON
    }

    // Get current DB count and last order ID for incremental sync
    const { count: currentDbCount } = await supabase
      .from('imported_orders')
      .select('*', { count: 'exact', head: true });

    console.log(`Current DB count: ${currentDbCount}`);

    // For incremental sync, get the highest external_id we have
    let lastExternalId: string | null = null;
    if (useIncremental && !forceFull) {
      const { data: lastOrder } = await supabase
        .from('imported_orders')
        .select('external_id')
        .order('external_id', { ascending: false })
        .limit(1)
        .single();
      
      lastExternalId = lastOrder?.external_id || null;
      console.log(`Last external_id in DB: ${lastExternalId}`);
    }

    // Build API URL - use pagination for incremental updates
    let apiUrl: string;
    
    if (forceFull || !lastExternalId) {
      // Full sync - fetch all with pagination
      apiUrl = `https://shopify-phpmyadmin-extractor-api.onrender.com/fetch-data?stream_all=true${triggerRefresh ? '&refresh=true' : ''}`;
      console.log('Performing FULL sync...');
    } else {
      // Incremental sync - only fetch orders after lastExternalId
      // First try with after_id parameter if API supports it
      apiUrl = `https://shopify-phpmyadmin-extractor-api.onrender.com/fetch-data?after_id=${lastExternalId}${triggerRefresh ? '&refresh=true' : ''}`;
      console.log(`Performing INCREMENTAL sync after ID: ${lastExternalId}`);
    }

    console.log(`Fetching from: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': API_KEY,
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
      },
    });

    // Handle API errors
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error:', response.status, errorText);
      
      if (response.status === 401) {
        throw new Error('API authentication failed - check API key');
      }
      
      if (response.status === 503) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Data sync in progress on external API. Please wait 2-3 minutes and try again.',
            retryable: true,
            apiStatus: 503,
            dbCount: currentDbCount
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      
      if (response.status >= 500) {
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
      
      // If incremental sync fails (API might not support after_id), fall back to checking count
      if (useIncremental && !forceFull && response.status === 400) {
        console.log('Incremental API not supported, checking if full sync needed...');
        
        // Get total count from API
        const countResponse = await fetch(
          'https://shopify-phpmyadmin-extractor-api.onrender.com/fetch-data?limit=1',
          { headers: { 'X-API-Key': API_KEY } }
        );
        
        if (countResponse.ok) {
          const countData = await countResponse.json();
          const apiTotal = countData.count || 0;
          
          if (apiTotal <= (currentDbCount || 0)) {
            return new Response(
              JSON.stringify({ 
                success: true, 
                inserted: 0,
                errors: 0,
                total: currentDbCount,
                apiRecordCount: apiTotal,
                message: 'Database is up to date',
                timestamp: new Date().toISOString()
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
          }
        }
      }
      
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('API Response - count:', data.count, 'status:', data.status);

    const orders = data.data || [];
    
    // If API doesn't support after_id, filter client-side
    let ordersToProcess = orders;
    if (useIncremental && lastExternalId && !forceFull) {
      const lastIdNum = parseInt(lastExternalId);
      if (!isNaN(lastIdNum)) {
        ordersToProcess = orders.filter((order: any) => {
          const orderId = parseInt(order.id?.toString() || order.external_id?.toString() || '0');
          return orderId > lastIdNum;
        });
        console.log(`Filtered to ${ordersToProcess.length} new orders (from ${orders.length} total)`);
      }
    }

    if (ordersToProcess.length === 0) {
      const finalCount = await supabase
        .from('imported_orders')
        .select('*', { count: 'exact', head: true });
        
      return new Response(
        JSON.stringify({ 
          success: true, 
          inserted: 0, 
          errors: 0,
          total: finalCount.count || currentDbCount,
          apiRecordCount: data.count,
          message: 'No new orders to process',
          timestamp: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const { inserted, errors } = await processAndUpsertOrders(supabase, ordersToProcess);

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
        apiRecordCount: data.count,
        lastUpdated: data.last_updated,
        refreshTriggered: triggerRefresh,
        wasIncremental: useIncremental && !forceFull,
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
