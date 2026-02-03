import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Store mapping
const STORE_MAPPINGS: Record<string, string> = {
  '1': 'kvatt-green-package-demo',
  '5': 'Quickstart',
  '6': 'TOAST DEV',
  '7': 'Universal Works',
  '8': 'TOAST NEW DEV',
  '9': 'TOAST NEW DEV USD',
  '10': 'TOAST DEV USD',
  '11': 'KVATT DEV',
  '12': 'TOAST',
  '13': 'Zapply EU',
  '14': 'Cocopup™ Wipes',
  '15': 'Anerkennen Fashion',
  '16': 'SPARTAGIFTSHOP USA',
  '17': 'SIRPLUS',
  '20': 'Kvatt - Demo Store',
  '23': 'smit-v2',
  '24': 'partht-kvatt-demo',
  '25': 'vrutankt.devesha',
  '26': 'Plus Test Store 1',
  '27': 'Kvatt | One Tap Returns',
  '28': 'leming-kvatt-demo',
  '29': 'Kapil Kvatt Checkout',
  '30': 'SCALES SwimSkins',
};

const getStoreName = (userId: string | null): string => {
  if (!userId) return "N/A";
  return STORE_MAPPINGS[userId] || `Store ${userId}`;
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get email from request body or query params
    let email: string | null = null;
    
    if (req.method === 'POST') {
      const body = await req.json();
      email = body.email;
    } else {
      const url = new URL(req.url);
      email = url.searchParams.get('email');
    }
    
    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const searchEmail = email.trim().toLowerCase();
    console.log(`[search-orders-by-email] Searching for: ${searchEmail}`);

    // Step 1: Find customer by email (indexed lookup)
    const { data: customer, error: customerError } = await supabase
      .from('imported_customers')
      .select('external_id, name, email, telephone, shopify_created_at')
      .ilike('email', searchEmail)
      .limit(1)
      .single();

    if (customerError || !customer) {
      console.log('[search-orders-by-email] Customer not found:', customerError?.message);
      return new Response(
        JSON.stringify({ 
          success: true,
          customer: null, 
          orders: [],
          summary: null,
          message: 'No customer found with this email'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[search-orders-by-email] Found customer: ${customer.external_id}`);

    // Step 2: Fetch all orders for this customer (indexed by customer_id)
    const { data: orders, error: ordersError } = await supabase
      .from('imported_orders')
      .select('id, name, total_price, opt_in, payment_status, shopify_created_at, city, province, country, user_id')
      .eq('customer_id', customer.external_id)
      .order('shopify_created_at', { ascending: false });

    if (ordersError) {
      console.error('[search-orders-by-email] Error fetching orders:', ordersError.message);
      throw ordersError;
    }

    console.log(`[search-orders-by-email] Found ${orders?.length || 0} orders`);

    // Step 3: Calculate summary statistics
    const orderList = orders || [];
    const totalSpent = orderList.reduce((sum, o) => sum + (o.total_price || 0), 0);
    const optInCount = orderList.filter(o => o.opt_in === true).length;
    const optOutCount = orderList.filter(o => o.opt_in === false).length;

    // Transform orders with store names
    const transformedOrders = orderList.map(order => ({
      ...order,
      store_name: getStoreName(order.user_id),
    }));

    const response = {
      success: true,
      customer: {
        id: customer.external_id,
        name: customer.name,
        email: customer.email,
        telephone: customer.telephone,
        created_at: customer.shopify_created_at,
      },
      orders: transformedOrders,
      summary: {
        total_orders: orderList.length,
        total_spent: totalSpent,
        average_order_value: orderList.length > 0 ? totalSpent / orderList.length : 0,
        opt_in_count: optInCount,
        opt_out_count: optOutCount,
        opt_in_rate: orderList.length > 0 ? (optInCount / orderList.length) * 100 : 0,
      }
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('[search-orders-by-email] Error:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
