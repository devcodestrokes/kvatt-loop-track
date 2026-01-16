import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse destination field which can be an object or escaped JSON string
const parseDestination = (destination: any): { 
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
    
    // If it's already an object (new API auto-parses), use it directly
    if (typeof destination === 'object') {
      parsed = destination;
    } else if (typeof destination === 'string') {
      // Handle escaped JSON string
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

// Check if a value is a clean string (not JSON)
const isCleanValue = (val: string | null | undefined): boolean => {
  if (!val) return false;
  if (val === 'null' || val === 'undefined') return false;
  return !val.includes('{') && !val.includes('\\') && !val.startsWith('"') && !val.includes(':');
};

const processAndUpsertOrders = async (supabase: any, orders: any[]) => {
  let inserted = 0;
  let errors = 0;
  const batchSize = 1000;

  for (let i = 0; i < orders.length; i += batchSize) {
    const batch = orders.slice(i, i + batchSize);
    
    const formattedBatch = batch.map((order: any) => {
      // Parse destination - new API auto-parses to object
      const parsedDestination = parseDestination(order.destination);
      
      // Use parsed destination values, fallback to direct fields
      const city = parsedDestination.city || 
                   (isCleanValue(order.shipping_city) ? order.shipping_city : null);
      
      const province = parsedDestination.province || 
                       (isCleanValue(order.shipping_province) ? order.shipping_province : null);
      
      const country = parsedDestination.country || 
                      (isCleanValue(order.shipping_country) ? order.shipping_country : null);
      
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

    // New API base URL - using /api/data endpoint
    const baseUrl = 'https://shopify-phpmyadmin-extractor-api.onrender.com/api/data';
    
    // For incremental sync, get the latest external_id to know where we are
    let lastExternalId: number | null = null;
    
    if (!forceFull) {
      const { data: lastOrder } = await supabase
        .from('imported_orders')
        .select('external_id')
        .order('external_id', { ascending: false })
        .limit(1)
        .single();
      
      if (lastOrder?.external_id) {
        lastExternalId = parseInt(lastOrder.external_id);
        console.log(`Last external_id in DB: ${lastExternalId}`);
      }
    }

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
    const batchSize = 5000; // Fetch in batches
    
    let allOrders: any[] = [];
    let currentStart = startRow;
    let hasMoreData = true;

    console.log(`Fetching orders starting from row ${startRow}...`);

    while (hasMoreData && currentStart <= apiTotalCount) {
      const endRow = Math.min(currentStart + batchSize - 1, apiTotalCount);
      
      // Use refresh=true for background refresh, parse_json=true for auto-parsed destination
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
          // Return partial success if we got some data
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
        
        // If we got fewer than requested, we're done
        if (orders.length < batchSize) {
          hasMoreData = false;
        }
      }

      // Safety limit - don't fetch more than 50k in one sync
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
