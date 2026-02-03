import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Base64url encode function
const base64UrlEncode = (data: Uint8Array): string => {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// Generate JWT token for kvatt API authentication
const generateJWT = async (secret: string): Promise<string> => {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: "https://shopify.kvatt.com",
    sub: 1,
    iat: now,
    exp: now + 3600 // 1 hour expiry
  };

  const encoder = new TextEncoder();
  
  const encodedHeader = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  
  const signatureBase = `${encodedHeader}.${encodedPayload}`;
  
  // Create HMAC-SHA256 signature
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signatureBase)
  );
  
  const encodedSignature = base64UrlEncode(new Uint8Array(signature));
  
  return `${signatureBase}.${encodedSignature}`;
};

const processAndUpsertCustomers = async (supabase: any, customers: any[]) => {
  let inserted = 0;
  let errors = 0;
  const batchSize = 1000;

  for (let i = 0; i < customers.length; i += batchSize) {
    const batch = customers.slice(i, i + batchSize);
    
    const formattedBatch = batch.map((customer: any) => ({
      external_id: customer.id?.toString() || `api-${Date.now()}-${Math.random()}`,
      user_id: customer.user_id?.toString() || null,
      shopify_customer_id: customer.shopify_customer_id?.toString() || null,
      name: customer.name || null,
      email: customer.email || null,
      telephone: customer.telephone || null,
      shopify_created_at: customer.created_at || null,
      updated_at: customer.updated_at || new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('imported_customers')
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
    // Get JWT secret for API authentication
    const jwtSecret = Deno.env.get('KVATT_API_JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('KVATT_API_JWT_SECRET is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let forceFull = false;
    let pagesLimit = 0; // 0 = fetch all, otherwise limit pages for quick sync
    let storeId: string | undefined;
    
    try {
      const body = await req.json();
      forceFull = body.forceFull === true;
      pagesLimit = body.pagesLimit || 0;
      storeId = body.store;
    } catch {
      // No body or invalid JSON
    }

    // Generate JWT token for API authentication
    const authToken = await generateJWT(jwtSecret);
    console.log('Generated JWT token for customer API authentication');

    // Get current DB count
    const { count: currentDbCount } = await supabase
      .from('imported_customers')
      .select('*', { count: 'exact', head: true });

    console.log(`Current DB customer count: ${currentDbCount}`);

    // API base URL
    const baseUrl = 'https://shopify.kvatt.com/api/get-customers';

    // Build URL with optional store filter
    const buildUrl = (page: number) => {
      const params = new URLSearchParams({ page: page.toString() });
      if (storeId) params.append('store', storeId);
      return `${baseUrl}?${params.toString()}`;
    };

    // Fetch first page to get pagination info
    console.log('Fetching first page to get total count...');
    const firstPageResponse = await fetch(buildUrl(1), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${authToken}`,
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

    console.log(`API total customers: ${apiTotalCount}, pages: ${lastPage}, per_page: ${perPage}`);

    // If DB is up to date and not forcing full sync, just return
    if (!forceFull && currentDbCount && currentDbCount >= apiTotalCount) {
      console.log('Customer database is up to date');
      return new Response(
        JSON.stringify({ 
          success: true, 
          inserted: 0,
          errors: 0,
          total: currentDbCount,
          apiRecordCount: apiTotalCount,
          message: 'Customer database is up to date',
          timestamp: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Collect all customers - start with first page data
    let allCustomers: any[] = firstPageData.data || [];
    console.log(`Page 1: received ${allCustomers.length} customers`);

    // Determine how many pages to fetch
    const maxPages = pagesLimit > 0 ? Math.min(pagesLimit, lastPage) : lastPage;

    // Fetch remaining pages (if needed)
    for (let page = 2; page <= maxPages; page++) {
      console.log(`Fetching page ${page}/${maxPages}...`);
      
      const response = await fetch(buildUrl(page), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        console.error(`Page ${page} failed:`, response.status);
        break;
      }

      const pageData = await response.json();
      const customers = pageData.data || [];
      
      if (customers.length === 0) {
        console.log(`Page ${page}: no more data`);
        break;
      }

      allCustomers = allCustomers.concat(customers);
      console.log(`Page ${page}: received ${customers.length} customers, total: ${allCustomers.length}`);

      // Safety limit
      if (allCustomers.length >= 100000) {
        console.log('Reached 100k customer limit for single sync');
        break;
      }
    }

    console.log(`Total customers fetched: ${allCustomers.length}`);

    if (allCustomers.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          inserted: 0, 
          errors: 0,
          total: currentDbCount,
          apiRecordCount: apiTotalCount,
          message: 'No customers to process',
          timestamp: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const { inserted, errors } = await processAndUpsertCustomers(supabase, allCustomers);

    // Get final count
    const { count: finalDbCount } = await supabase
      .from('imported_customers')
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
    console.error('Error in sync-customers-api:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
