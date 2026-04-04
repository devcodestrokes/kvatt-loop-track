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

    // Get email and optional filters from request body or query params
    let email: string | null = null;
    let store_domain: string | null = null;
    let opt_in_only = false;
    
    if (req.method === 'POST') {
      const body = await req.json();
      email = body.email;
      store_domain = body.store_domain || null;
      opt_in_only = body.opt_in_only === true;
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

    // Reverse-lookup: find user_id from store domain
    let storeUserIds: string[] | null = null;
    if (store_domain) {
      storeUserIds = Object.entries(STORE_MAPPINGS)
        .filter(([_, name]) => {
          const domain = store_domain!.toLowerCase();
          return name.toLowerCase().includes(domain) || domain.includes(name.toLowerCase());
        })
        .map(([id]) => id);
      
      // Also try matching the domain part from get-store-mapping static data
      const DOMAIN_MAPPINGS: Record<string, string> = {
        'kvatt-green-package-demo.myshopify.com': '1',
        'quickstart-ba771359.myshopify.com': '5',
        'dev.toa.st': '6',
        'universalworks.com': '7',
        'toast-newdev.myshopify.com': '8',
        'toast-newdev-us.myshopify.com': '9',
        'toast-dev-us.myshopify.com': '10',
        'kvatt-dev.myshopify.com': '11',
        'www.toa.st': '12',
        'zapply.eu': '13',
        'cocopupwipes.com': '14',
        'anerkennen.com': '15',
        'auibrn-ad.myshopify.com': '16',
        'sirplus.co.uk': '17',
        'smitg-kvatt-demo.myshopify.com': '20',
        'smit-v2.myshopify.com': '23',
        'partht-kvatt-demo.myshopify.com': '24',
        'vrutankt-devesha.myshopify.com': '25',
        'bdnee0-s0.myshopify.com': '26',
        'kvatt.com': '27',
        'leming-kvatt-demo.myshopify.com': '28',
        'kapil-kvatt-checkout.myshopify.com': '29',
        'shop.scales-swimskins.com': '30',
      };
      
      const domainMatch = DOMAIN_MAPPINGS[store_domain.toLowerCase()];
      if (domainMatch && !storeUserIds?.includes(domainMatch)) {
        storeUserIds = [...(storeUserIds || []), domainMatch];
      }
      
      console.log(`[search-orders-by-email] Filtering by domain "${store_domain}" -> user_ids: ${storeUserIds?.join(',')}`);
    }

    const searchEmail = email.trim().toLowerCase();
    console.log(`[search-orders-by-email] Searching for: ${searchEmail}`);

    // Step 1: Find all customer records for this email across stores
    let customerQuery = supabase
      .from('imported_customers')
      .select('external_id, name, email, telephone, shopify_created_at, user_id')
      .ilike('email', searchEmail);

    if (storeUserIds && storeUserIds.length > 0) {
      customerQuery = customerQuery.in('user_id', storeUserIds);
    }

    const { data: customers, error: customerError } = await customerQuery
      .order('shopify_created_at', { ascending: false });

    if (customerError || !customers || customers.length === 0) {
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

    const customerIds = customers
      .map((customer) => customer.external_id)
      .filter((externalId): externalId is string => Boolean(externalId));

    console.log(`[search-orders-by-email] Found ${customerIds.length} customer record(s): ${customerIds.join(', ')}`);

    // Step 2: Fetch orders from the last 3 months only (optimization)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    let query = supabase
      .from('imported_orders')
      .select('id, name, total_price, opt_in, payment_status, shopify_created_at, city, province, country, user_id, customer_id, destination')
      .in('customer_id', customerIds)
      .gte('shopify_created_at', threeMonthsAgo.toISOString());

    // Filter by store if pack merchant resolved
    if (storeUserIds && storeUserIds.length > 0) {
      query = query.in('user_id', storeUserIds);
    }

    // Filter by opt_in only (customers who selected Kvatt at checkout)
    if (opt_in_only) {
      query = query.eq('opt_in', true);
    }

    const { data: orders, error: ordersError } = await query
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

    const primaryCustomer = [...customers].sort((a, b) => {
      const aHasOrder = orderList.some(order => order.customer_id === a.external_id);
      const bHasOrder = orderList.some(order => order.customer_id === b.external_id);

      if (aHasOrder !== bHasOrder) {
        return aHasOrder ? -1 : 1;
      }

      return new Date(b.shopify_created_at || 0).getTime() - new Date(a.shopify_created_at || 0).getTime();
    })[0];

    // Transform orders with store names
    const transformedOrders = orderList.map(order => ({
      ...order,
      store_name: getStoreName(order.user_id),
    }));

    const response = {
      success: true,
      customer: {
        id: primaryCustomer.external_id,
        name: primaryCustomer.name,
        email: primaryCustomer.email,
        telephone: primaryCustomer.telephone,
        created_at: primaryCustomer.shopify_created_at,
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
