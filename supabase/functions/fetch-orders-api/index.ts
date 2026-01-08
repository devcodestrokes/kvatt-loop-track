import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse destination field which can be an escaped JSON string or regular JSON
// Example: "{\"first_name\":\"Bhakti\",\"city\":\"Manchester\",...}" needs double parsing
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
    
    // If it's a string, parse it
    if (typeof destination === 'string') {
      // First parse - handles escaped JSON like "{\"city\":\"Manchester\"}"
      parsed = JSON.parse(destination);
      
      // If the result is still a string, parse again (double escaped)
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }
    }
    
    // Log successful parse for debugging
    console.log('Parsed destination successfully:', {
      city: parsed?.city,
      province: parsed?.province,
      country: parsed?.country
    });
    
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
    console.warn('Failed to parse destination:', destination?.substring?.(0, 100), e);
    return emptyResult;
  }
};

const processAndUpsertOrders = async (supabase: any, orders: any[]) => {
  let inserted = 0;
  let errors = 0;
  const batchSize = 500;

  // Log first order structure for debugging
  if (orders.length > 0) {
    console.log('Sample order fields:', Object.keys(orders[0]));
    console.log('Sample order destination:', orders[0].destination);
    console.log('Sample order user_id:', orders[0].user_id);
  }

  for (let i = 0; i < orders.length; i += batchSize) {
    const batch = orders.slice(i, i + batchSize);
    
    const formattedBatch = batch.map((order: any) => {
      // Parse destination field for geographic data
      const parsedDestination = parseDestination(order.destination);
      
      // Log parsing results for first few orders
      if (batch.indexOf(order) < 3) {
        console.log('Order geo parsing:', {
          rawCity: order.city?.substring?.(0, 30),
          parsedCity: parsedDestination.city,
          parsedProvince: parsedDestination.province,
          parsedCountry: parsedDestination.country
        });
      }
      
      // Helper to check if a value is clean (not JSON garbage)
      const isCleanValue = (val: string | null | undefined): boolean => {
        if (!val) return false;
        // Skip if it looks like JSON or has escaped characters
        return !val.includes('{') && !val.includes('\\') && !val.startsWith('"');
      };
      
      // Prioritize parsed destination, only fall back to direct fields if they're clean
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

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body to get options
    let triggerRefresh = false;
    
    try {
      const body = await req.json();
      triggerRefresh = body.refresh === true;
    } catch {
      // No body or invalid JSON, use defaults (cached data)
    }

    // Use stream_all=true endpoint - returns all 102K records efficiently (20-30MB memory)
    // Per API docs: this is the recommended approach for getting complete dataset
    const apiUrl = triggerRefresh 
      ? `https://shopify-phpmyadmin-extractor-api.onrender.com/fetch-data?stream_all=true&refresh=true`
      : `https://shopify-phpmyadmin-extractor-api.onrender.com/fetch-data?stream_all=true`;

    console.log(`Fetching ALL order data from API with stream_all=true (refresh=${triggerRefresh})...`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-API-Key': API_KEY,
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error:', response.status, errorText);
      
      // Handle specific error cases per API documentation
      if (response.status === 401) {
        throw new Error('API authentication failed - check API key');
      }
      
      // 503 = No cached data available, need to wait for sync
      if (response.status === 503) {
        console.log('No cached data available, sync in progress');
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Data sync in progress. Please wait a few minutes and try again.',
            retryable: true,
            apiStatus: 503
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        );
      }
      
      // Other 5xx errors - API temporarily unavailable
      if (response.status >= 500) {
        console.log('External API temporarily unavailable');
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'External API temporarily unavailable. Data will sync automatically when available.',
            retryable: true,
            apiStatus: response.status
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        );
      }
      
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Per API docs, response format: { status: "success", count: N, data: [...] }
    console.log('API Response status:', data.status);
    console.log('Total records in API:', data.count);
    console.log('Last updated:', data.last_updated);

    // Extract orders from the 'data' field as per API documentation
    const orders = data.data || [];
    console.log('Processing orders:', orders.length);

    if (orders.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          inserted: 0, 
          errors: 0,
          total: 0,
          message: 'No orders to process',
          timestamp: new Date().toISOString()
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    const { inserted, errors } = await processAndUpsertOrders(supabase, orders);

    console.log(`Import complete: ${inserted} inserted, ${errors} errors out of ${orders.length} total`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        inserted, 
        errors,
        total: orders.length,
        apiRecordCount: data.count,
        lastUpdated: data.last_updated,
        refreshTriggered: triggerRefresh,
        timestamp: new Date().toISOString()
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
