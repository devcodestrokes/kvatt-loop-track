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

// Extract address from any field that might contain JSON address data
const extractAddressFromAnyField = (order: any): { 
  city: string | null; 
  province: string | null; 
  country: string | null;
} => {
  // Try to find address data in various possible locations
  const fieldsToCheck = [
    order.destination,
    order.shipping_address,
    order.billing_address,
    order.city, // Sometimes the city field itself contains the full address JSON
    order.country,
    order.province,
  ];
  
  for (const field of fieldsToCheck) {
    if (!field || typeof field !== 'string') continue;
    
    // Check if this field looks like JSON
    if (field.includes('{') || field.startsWith('"')) {
      try {
        let parsed: any = field;
        // Handle double-escaped JSON
        if (typeof parsed === 'string') {
          parsed = JSON.parse(parsed);
          if (typeof parsed === 'string') {
            parsed = JSON.parse(parsed);
          }
        }
        
        // If we found valid address components, return them
        if (parsed && typeof parsed === 'object') {
          const city = parsed?.city || null;
          const province = parsed?.province || null;
          const country = parsed?.country || null;
          
          if (city || province || country) {
            return { city, province, country };
          }
        }
      } catch (e) {
        // Continue to next field
      }
    }
  }
  
  return { city: null, province: null, country: null };
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
  const batchSize = 1000; // Larger batches for efficiency

  for (let i = 0; i < orders.length; i += batchSize) {
    const batch = orders.slice(i, i + batchSize);
    
    const formattedBatch = batch.map((order: any) => {
      // First try to parse from destination field
      const parsedDestination = parseDestination(order.destination);
      
      // If destination parsing failed, try other fields
      let addressData = { 
        city: parsedDestination.city, 
        province: parsedDestination.province, 
        country: parsedDestination.country 
      };
      
      // If we don't have address data yet, try extracting from any field
      if (!addressData.city && !addressData.province && !addressData.country) {
        addressData = extractAddressFromAnyField(order);
      }
      
      // Fallback to direct fields only if they're clean values
      const city = addressData.city || 
                   (isCleanValue(order.shipping_city) ? order.shipping_city : null) || 
                   null;
      
      const province = addressData.province || 
                       (isCleanValue(order.shipping_province) ? order.shipping_province : null) || 
                       null;
      
      const country = addressData.country || 
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

    // For incremental sync, get the latest shopify_created_at timestamp
    let lastCreatedAt: string | null = null;
    let lastExternalId: string | null = null;
    
    if (useIncremental && !forceFull) {
      // Get the most recently created order by shopify_created_at
      const { data: lastOrder } = await supabase
        .from('imported_orders')
        .select('external_id, shopify_created_at')
        .order('shopify_created_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .single();
      
      lastExternalId = lastOrder?.external_id || null;
      lastCreatedAt = lastOrder?.shopify_created_at || null;
      console.log(`Last order - external_id: ${lastExternalId}, created_at: ${lastCreatedAt}`);
    }

    // Build API URL - ALWAYS use force_fresh=true for LIVE data from database
    let apiUrl: string;
    const baseUrl = 'https://shopify-phpmyadmin-extractor-api.onrender.com/fetch-data';
    
    // Always use force_fresh=true to get live data from the database (not cached)
    const forceFreshParam = 'force_fresh=true';
    
    if (forceFull || !lastCreatedAt) {
      // Full sync - fetch all with pagination, force fresh data
      apiUrl = `${baseUrl}?${forceFreshParam}&stream_all=true`;
      console.log('Performing FULL sync with LIVE data (force_fresh=true)...');
    } else {
      // Incremental sync - use after_date for more reliable incremental fetching
      // Fall back to after_id if the API doesn't support after_date
      apiUrl = `${baseUrl}?${forceFreshParam}&after_date=${encodeURIComponent(lastCreatedAt)}`;
      console.log(`Performing INCREMENTAL sync with LIVE data after date: ${lastCreatedAt}`);
    }

    console.log(`Fetching LIVE data from: ${apiUrl}`);

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
    console.log('API Response - count:', data.count, 'status:', data.status, 'data_length:', data.data?.length);

    // Handle API busy states - return retryable error
    if (data.status === 'already_updating' || data.status === 'refresh_triggered') {
      console.log('External API is updating, will retry...');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'External data source is refreshing. Please wait 2-3 minutes and try again.',
          retryable: true,
          apiStatus: data.status,
          dbCount: currentDbCount,
          apiReportedCount: data.count
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const orders = data.data || [];
    
    // If API doesn't support after_date, filter client-side by created_at
    let ordersToProcess = orders;
    if (useIncremental && lastCreatedAt && !forceFull) {
      const lastDate = new Date(lastCreatedAt);
      ordersToProcess = orders.filter((order: any) => {
        const orderDate = new Date(order.created_at || order.shopify_created_at || '1970-01-01');
        return orderDate > lastDate;
      });
      console.log(`Filtered to ${ordersToProcess.length} new orders (from ${orders.length} total) by date`);
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
