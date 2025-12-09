import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let client: Client | null = null;

  try {
    const dbHost = Deno.env.get('KVATT_DB_HOST');
    const dbUser = Deno.env.get('KVATT_DB_USERNAME');
    const dbPassword = Deno.env.get('KVATT_DB_PASSWORD');
    const dbName = Deno.env.get('KVATT_DB_DATABASE');

    if (!dbHost || !dbUser || !dbPassword || !dbName) {
      throw new Error('Missing MySQL database credentials');
    }

    console.log(`Connecting to MySQL database: ${dbName} at ${dbHost}...`);

    // Connect to MySQL
    client = await new Client().connect({
      hostname: dbHost,
      username: dbUser,
      password: dbPassword,
      db: dbName,
      port: 3306,
    });

    console.log('Connected to MySQL successfully');

    // Fetch customers from MySQL
    const customersResult = await client.execute(
      `SELECT id, user_id, shopify_customer_id, name, email, telephone, created_at, updated_at 
       FROM customers 
       LIMIT 10000`
    );
    const customers = customersResult.rows || [];
    console.log(`Fetched ${customers.length} customers from MySQL`);

    // Fetch orders from MySQL (opt_in is on orders table)
    const ordersResult = await client.execute(
      `SELECT id, user_id, shopify_order_id, name, opt_in, payment_status, total_price, 
              customer_id, destination, shopify_created_at, created_at, updated_at 
       FROM orders 
       LIMIT 20000`
    );
    const orders = ordersResult.rows || [];
    console.log(`Fetched ${orders.length} orders from MySQL`);

    // Fetch line items from MySQL
    const lineItemsResult = await client.execute(
      `SELECT id, order_id, shopify_line_item_id, shopify_product_id, shopify_variant_id,
              product_title, variant_title, quantity, properties, total_price, created_at 
       FROM line_items 
       LIMIT 50000`
    );
    const lineItems = lineItemsResult.rows || [];
    console.log(`Fetched ${lineItems.length} line items from MySQL`);

    // Close MySQL connection
    await client.close();
    client = null;

    // Process and analyze the data
    // Note: opt_in is on the orders table, not customers
    const optInOrders = orders.filter((o: any) => o.opt_in === 1 || o.opt_in === true);
    const optOutOrders = orders.filter((o: any) => o.opt_in === 0 || o.opt_in === false || o.opt_in === null);

    console.log(`Opt-in orders: ${optInOrders.length}, Opt-out orders: ${optOutOrders.length}`);

    // Get unique customers from opt-in and opt-out orders
    const optInCustomerIds = new Set(optInOrders.map((o: any) => o.customer_id));
    const optOutCustomerIds = new Set(optOutOrders.map((o: any) => o.customer_id));

    // Store analysis based on user_id (which represents the store/merchant)
    const ordersByStore: Record<string, { total: number; optIn: number; optInRate: number }> = {};
    orders.forEach((order: any) => {
      const storeId = String(order.user_id || 'Unknown');
      if (!ordersByStore[storeId]) {
        ordersByStore[storeId] = { total: 0, optIn: 0, optInRate: 0 };
      }
      ordersByStore[storeId].total++;
      if (order.opt_in === 1 || order.opt_in === true) {
        ordersByStore[storeId].optIn++;
      }
    });

    // Calculate opt-in rates per store
    Object.keys(ordersByStore).forEach(store => {
      const data = ordersByStore[store];
      data.optInRate = data.total > 0 ? (data.optIn / data.total) * 100 : 0;
    });

    // Geographic analysis from destination JSON
    const ordersByCountry: Record<string, { total: number; optIn: number }> = {};
    const ordersByCity: Record<string, { total: number; optIn: number }> = {};

    orders.forEach((order: any) => {
      let destination: any = null;
      try {
        destination = typeof order.destination === 'string' 
          ? JSON.parse(order.destination) 
          : order.destination;
      } catch (e) {
        // Ignore parse errors
      }

      const country = destination?.country || destination?.country_code || 'Unknown';
      const city = destination?.city || 'Unknown';
      const isOptIn = order.opt_in === 1 || order.opt_in === true;

      if (!ordersByCountry[country]) {
        ordersByCountry[country] = { total: 0, optIn: 0 };
      }
      ordersByCountry[country].total++;
      if (isOptIn) ordersByCountry[country].optIn++;

      if (!ordersByCity[city]) {
        ordersByCity[city] = { total: 0, optIn: 0 };
      }
      ordersByCity[city].total++;
      if (isOptIn) ordersByCity[city].optIn++;
    });

    // Product analysis - what products do opt-in customers buy?
    const optInOrderIds = new Set(optInOrders.map((o: any) => o.id));
    const optOutOrderIds = new Set(optOutOrders.map((o: any) => o.id));

    const optInProducts: Record<string, { quantity: number; revenue: number }> = {};
    const optOutProducts: Record<string, { quantity: number; revenue: number }> = {};

    lineItems.forEach((item: any) => {
      const productName = item.product_title || 'Unknown';
      const quantity = Number(item.quantity) || 1;
      const price = Number(item.total_price) || 0;

      if (optInOrderIds.has(item.order_id)) {
        if (!optInProducts[productName]) {
          optInProducts[productName] = { quantity: 0, revenue: 0 };
        }
        optInProducts[productName].quantity += quantity;
        optInProducts[productName].revenue += price;
      }

      if (optOutOrderIds.has(item.order_id)) {
        if (!optOutProducts[productName]) {
          optOutProducts[productName] = { quantity: 0, revenue: 0 };
        }
        optOutProducts[productName].quantity += quantity;
        optOutProducts[productName].revenue += price;
      }
    });

    // Calculate average order values
    const avgOrderValueOptIn = optInOrders.length > 0 
      ? optInOrders.reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0) / optInOrders.length 
      : 0;
    const avgOrderValueOptOut = optOutOrders.length > 0 
      ? optOutOrders.reduce((sum: number, o: any) => sum + (Number(o.total_price) || 0), 0) / optOutOrders.length 
      : 0;

    // Temporal analysis - when do opt-ins happen?
    const optInsByHour: Record<number, number> = {};
    const optInsByDay: Record<number, number> = {};

    optInOrders.forEach((order: any) => {
      const createdAt = order.shopify_created_at || order.created_at;
      if (createdAt) {
        const date = new Date(createdAt);
        if (!isNaN(date.getTime())) {
          const hour = date.getHours();
          const day = date.getDay();
          
          optInsByHour[hour] = (optInsByHour[hour] || 0) + 1;
          optInsByDay[day] = (optInsByDay[day] || 0) + 1;
        }
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
    const topCountries = Object.entries(ordersByCountry)
      .filter(([name]) => name !== 'Unknown')
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([name, data]) => ({ 
        name, 
        ...data, 
        optInRate: data.total > 0 ? ((data.optIn / data.total) * 100).toFixed(1) : '0' 
      }));

    const topCities = Object.entries(ordersByCity)
      .filter(([name]) => name !== 'Unknown')
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 15)
      .map(([name, data]) => ({ 
        name, 
        ...data, 
        optInRate: data.total > 0 ? ((data.optIn / data.total) * 100).toFixed(1) : '0' 
      }));

    const storeAnalysis = Object.entries(ordersByStore)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([name, data]) => ({ 
        storeId: name,
        ...data,
        optInRate: data.optInRate.toFixed(1)
      }));

    const analytics = {
      summary: {
        totalCustomers: customers.length,
        totalOrders: orders.length,
        optInOrders: optInOrders.length,
        optOutOrders: optOutOrders.length,
        optInRate: orders.length ? ((optInOrders.length / orders.length) * 100).toFixed(2) : '0',
        totalLineItems: lineItems.length,
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
        customers: customers.slice(0, 5),
        orders: orders.slice(0, 5),
        lineItems: lineItems.slice(0, 5),
      }
    };

    console.log('MySQL analytics generated successfully');

    return new Response(
      JSON.stringify({ status: 200, data: analytics }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch customer data';
    console.error('Error fetching MySQL data:', error);
    
    // Ensure connection is closed on error
    if (client) {
      try {
        await client.close();
      } catch (e) {
        console.error('Error closing MySQL connection:', e);
      }
    }

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
