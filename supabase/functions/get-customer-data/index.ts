import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const storeId = url.searchParams.get('store_id');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    console.log(`Fetching customer data - store_id: ${storeId}, limit: ${limit}, offset: ${offset}`);

    // Fetch customers with optional store filter
    let customersQuery = supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (storeId) {
      customersQuery = customersQuery.eq('store_id', storeId);
    }

    const { data: customers, error: customersError } = await customersQuery;

    if (customersError) {
      console.error('Error fetching customers:', customersError);
      throw customersError;
    }

    // Fetch orders for these customers
    const customerIds = customers?.map(c => c.id) || [];
    
    let orders: any[] = [];
    if (customerIds.length > 0) {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .in('customer_id', customerIds)
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        throw ordersError;
      }
      orders = ordersData || [];
    }

    // Fetch line items for these orders
    const orderIds = orders.map(o => o.id);
    
    let lineItems: any[] = [];
    if (orderIds.length > 0) {
      const { data: lineItemsData, error: lineItemsError } = await supabase
        .from('line_items')
        .select('*')
        .in('order_id', orderIds);

      if (lineItemsError) {
        console.error('Error fetching line items:', lineItemsError);
        throw lineItemsError;
      }
      lineItems = lineItemsData || [];
    }

    // Build response with nested data
    const customersWithOrders = customers?.map(customer => {
      const customerOrders = orders.filter(o => o.customer_id === customer.id);
      const ordersWithItems = customerOrders.map(order => ({
        ...order,
        line_items: lineItems.filter(li => li.order_id === order.id)
      }));
      
      return {
        ...customer,
        orders: ordersWithItems,
        total_orders: customerOrders.length,
        total_spent: customerOrders.reduce((sum, o) => sum + parseFloat(o.total_price || 0), 0)
      };
    });

    // Calculate analytics summary
    const analytics = {
      total_customers: customers?.length || 0,
      opt_in_count: customers?.filter(c => c.opt_in).length || 0,
      opt_out_count: customers?.filter(c => !c.opt_in).length || 0,
      total_orders: orders.length,
      total_revenue: orders.reduce((sum, o) => sum + parseFloat(o.total_price || 0), 0),
      countries: [...new Set(customers?.map(c => c.country).filter(Boolean))],
      cities: [...new Set(customers?.map(c => c.city).filter(Boolean))],
      top_products: getTopProducts(lineItems)
    };

    console.log(`Successfully fetched ${customers?.length} customers with ${orders.length} orders`);

    return new Response(
      JSON.stringify({
        status: 200,
        data: {
          customers: customersWithOrders,
          analytics
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in get-customer-data function:', error);
    return new Response(
      JSON.stringify({ 
        status: 500, 
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

function getTopProducts(lineItems: any[]) {
  const productCounts: Record<string, { title: string; count: number; revenue: number }> = {};
  
  lineItems.forEach(item => {
    const key = item.product_id || item.product_title;
    if (!productCounts[key]) {
      productCounts[key] = { title: item.product_title, count: 0, revenue: 0 };
    }
    productCounts[key].count += item.quantity;
    productCounts[key].revenue += parseFloat(item.price || 0) * item.quantity;
  });

  return Object.values(productCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}
