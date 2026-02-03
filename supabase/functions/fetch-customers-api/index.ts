import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

interface CustomerRequest {
  page?: number;
  store?: string;
  search?: string;
  start_row?: number;
  end_row?: number;
}

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

    let requestBody: CustomerRequest = {};
    
    try {
      requestBody = await req.json();
    } catch {
      // No body or invalid JSON - use defaults
    }

    const { page = 1, store, search, start_row, end_row } = requestBody;

    // Generate JWT token for API authentication
    const authToken = await generateJWT(jwtSecret);
    console.log('Generated JWT token for customer API authentication');

    // Build API URL with query parameters
    const baseUrl = 'https://shopify.kvatt.com/api/get-customers';
    const params = new URLSearchParams();
    
    params.append('page', page.toString());
    
    if (store) {
      params.append('store', store);
    }
    
    if (start_row !== undefined) {
      params.append('start_row', start_row.toString());
    }
    
    if (end_row !== undefined) {
      params.append('end_row', end_row.toString());
    }

    const apiUrl = `${baseUrl}?${params.toString()}`;
    console.log(`Fetching customers from: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Customer API error:', response.status, errorText);
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    
    // If search is provided, filter the results by email
    let customers = data.data || [];
    
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      customers = customers.filter((customer: any) => 
        (customer.email && customer.email.toLowerCase().includes(searchLower)) ||
        (customer.name && customer.name.toLowerCase().includes(searchLower))
      );
    }

    console.log(`Fetched ${customers.length} customers (page ${data.current_page}/${data.last_page})`);

    return new Response(
      JSON.stringify({
        success: true,
        data: customers,
        pagination: {
          current_page: data.current_page,
          last_page: data.last_page,
          per_page: data.per_page,
          total: data.total,
          from: data.from,
          to: data.to,
        },
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in fetch-customers-api:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
