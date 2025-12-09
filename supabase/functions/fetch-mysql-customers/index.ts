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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Fetching customer data from Supabase...');

    // Fetch customers
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('*')
      .limit(5000);

    if (customersError) {
      console.error('Error fetching customers:', customersError);
      throw customersError;
    }

    console.log(`Fetched ${customers?.length || 0} customers`);

    // Fetch orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .limit(10000);

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      throw ordersError;
    }

    console.log(`Fetched ${orders?.length || 0} orders`);

    // Fetch line items
    const { data: lineItems, error: lineItemsError } = await supabase
      .from('line_items')
      .select('*')
      .limit(20000);

    if (lineItemsError) {
      console.error('Error fetching line items:', lineItemsError);
      throw lineItemsError;
    }

    console.log(`Fetched ${lineItems?.length || 0} line items`);

    // Process and analyze the data
    const optInCustomers = customers?.filter(c => c.opt_in === true) || [];
    const optOutCustomers = customers?.filter(c => c.opt_in === false || c.opt_in === null) || [];

    console.log(`Opt-in customers: ${optInCustomers.length}, Opt-out customers: ${optOutCustomers.length}`);

    // Geographic analysis
    const customersByCountry: Record<string, { total: number; optIn: number }> = {};
    const customersByCity: Record<string, { total: number; optIn: number }> = {};

    customers?.forEach(customer => {
      const country = customer.country || 'Unknown';
      const city = customer.city || 'Unknown';
      
      if (!customersByCountry[country]) {
        customersByCountry[country] = { total: 0, optIn: 0 };
      }
      customersByCountry[country].total++;
      if (customer.opt_in) customersByCountry[country].optIn++;

      if (!customersByCity[city]) {
        customersByCity[city] = { total: 0, optIn: 0 };
      }
      customersByCity[city].total++;
      if (customer.opt_in) customersByCity[city].optIn++;
    });

    // Store analysis
    const customersByStore: Record<string, { total: number; optIn: number; optInRate: number }> = {};
    customers?.forEach(customer => {
      const store = customer.store_id || 'Unknown';
      if (!customersByStore[store]) {
        customersByStore[store] = { total: 0, optIn: 0, optInRate: 0 };
      }
      customersByStore[store].total++;
      if (customer.opt_in) customersByStore[store].optIn++;
    });

    // Calculate opt-in rates per store
    Object.keys(customersByStore).forEach(store => {
      const data = customersByStore[store];
      data.optInRate = data.total > 0 ? (data.optIn / data.total) * 100 : 0;
    });

    // Product analysis - what products do opt-in customers buy?
    const optInCustomerIds = new Set(optInCustomers.map(c => c.id));
    const optOutCustomerIds = new Set(optOutCustomers.map(c => c.id));

    const optInOrderIds = new Set(
      orders?.filter(o => optInCustomerIds.has(o.customer_id)).map(o => o.id) || []
    );
    const optOutOrderIds = new Set(
      orders?.filter(o => optOutCustomerIds.has(o.customer_id)).map(o => o.id) || []
    );

    const optInProducts: Record<string, { quantity: number; revenue: number }> = {};
    const optOutProducts: Record<string, { quantity: number; revenue: number }> = {};

    lineItems?.forEach(item => {
      const productName = item.product_title || 'Unknown';
      
      if (optInOrderIds.has(item.order_id)) {
        if (!optInProducts[productName]) {
          optInProducts[productName] = { quantity: 0, revenue: 0 };
        }
        optInProducts[productName].quantity += item.quantity || 1;
        optInProducts[productName].revenue += (item.price || 0) * (item.quantity || 1);
      }

      if (optOutOrderIds.has(item.order_id)) {
        if (!optOutProducts[productName]) {
          optOutProducts[productName] = { quantity: 0, revenue: 0 };
        }
        optOutProducts[productName].quantity += item.quantity || 1;
        optOutProducts[productName].revenue += (item.price || 0) * (item.quantity || 1);
      }
    });

    // Calculate average order values
    const optInOrders = orders?.filter(o => optInCustomerIds.has(o.customer_id)) || [];
    const optOutOrders = orders?.filter(o => optOutCustomerIds.has(o.customer_id)) || [];

    const avgOrderValueOptIn = optInOrders.length > 0 
      ? optInOrders.reduce((sum, o) => sum + (o.total_price || 0), 0) / optInOrders.length 
      : 0;
    const avgOrderValueOptOut = optOutOrders.length > 0 
      ? optOutOrders.reduce((sum, o) => sum + (o.total_price || 0), 0) / optOutOrders.length 
      : 0;

    // Temporal analysis - when do opt-ins happen?
    const optInsByHour: Record<number, number> = {};
    const optInsByDay: Record<number, number> = {};

    optInCustomers.forEach(customer => {
      if (customer.created_at) {
        const date = new Date(customer.created_at);
        const hour = date.getHours();
        const day = date.getDay();
        
        optInsByHour[hour] = (optInsByHour[hour] || 0) + 1;
        optInsByDay[day] = (optInsByDay[day] || 0) + 1;
      }
    });

    // Sort products by quantity
    const topOptInProducts = Object.entries(optInProducts)
      .sort((a, b) => b[1].quantity - a[1].quantity)
      .slice(0, 10)
      .map(([name, data]) => ({ name, ...data }));

    const topOptOutProducts = Object.entries(optOutProducts)
      .sort((a, b) => b[1].quantity - a[1].quantity)
      .slice(0, 10)
      .map(([name, data]) => ({ name, ...data }));

    // Sort geographic data
    const topCountries = Object.entries(customersByCountry)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([name, data]) => ({ 
        name, 
        ...data, 
        optInRate: data.total > 0 ? ((data.optIn / data.total) * 100).toFixed(1) : '0' 
      }));

    const topCities = Object.entries(customersByCity)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 15)
      .map(([name, data]) => ({ 
        name, 
        ...data, 
        optInRate: data.total > 0 ? ((data.optIn / data.total) * 100).toFixed(1) : '0' 
      }));

    const storeAnalysis = Object.entries(customersByStore)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([name, data]) => ({ 
        name: name.replace('.myshopify.com', ''), 
        ...data,
        optInRate: data.optInRate.toFixed(1)
      }));

    const analytics = {
      summary: {
        totalCustomers: customers?.length || 0,
        optInCustomers: optInCustomers.length,
        optOutCustomers: optOutCustomers.length,
        optInRate: customers?.length ? ((optInCustomers.length / customers.length) * 100).toFixed(2) : '0',
        totalOrders: orders?.length || 0,
        totalLineItems: lineItems?.length || 0,
      },
      geographic: {
        topCountries,
        topCities,
      },
      stores: storeAnalysis,
      products: {
        optInTopProducts: topOptInProducts,
        optOutTopProducts: topOptOutProducts,
      },
      orderValue: {
        avgOrderValueOptIn: avgOrderValueOptIn.toFixed(2),
        avgOrderValueOptOut: avgOrderValueOptOut.toFixed(2),
        difference: (avgOrderValueOptIn - avgOrderValueOptOut).toFixed(2),
        percentDifference: avgOrderValueOptOut > 0 
          ? (((avgOrderValueOptIn - avgOrderValueOptOut) / avgOrderValueOptOut) * 100).toFixed(1)
          : '0',
      },
      temporal: {
        optInsByHour,
        optInsByDay,
        peakHour: Object.entries(optInsByHour).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
        peakDay: Object.entries(optInsByDay).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
      },
      rawSamples: {
        customers: customers?.slice(0, 5) || [],
        orders: orders?.slice(0, 5) || [],
        lineItems: lineItems?.slice(0, 5) || [],
      }
    };

    console.log('Analytics generated successfully');

    return new Response(
      JSON.stringify({ status: 200, data: analytics }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch customer data';
    console.error('Error fetching data:', error);
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
