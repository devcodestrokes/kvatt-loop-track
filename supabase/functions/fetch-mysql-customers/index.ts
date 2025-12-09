import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const dbHost = Deno.env.get('KVATT_DB_HOST');
    const dbName = Deno.env.get('KVATT_DB_DATABASE');
    const dbUser = Deno.env.get('KVATT_DB_USERNAME');
    const dbPass = Deno.env.get('KVATT_DB_PASSWORD');

    if (!dbHost || !dbName || !dbUser || !dbPass) {
      throw new Error('Database credentials not configured');
    }

    console.log(`Connecting to MySQL database: ${dbName} at ${dbHost}`);

    const client = await new Client().connect({
      hostname: dbHost,
      username: dbUser,
      db: dbName,
      password: dbPass,
      port: 3306,
    });

    // Fetch customers with opt-in status
    const customers = await client.query(`
      SELECT 
        id,
        email,
        first_name,
        last_name,
        phone,
        city,
        province,
        country,
        opt_in,
        store_id,
        created_at,
        updated_at
      FROM customers
      ORDER BY created_at DESC
      LIMIT 1000
    `);

    // Fetch orders with customer data
    const orders = await client.query(`
      SELECT 
        o.id,
        o.order_number,
        o.customer_id,
        o.store_id,
        o.total_price,
        o.currency,
        o.financial_status,
        o.fulfillment_status,
        o.created_at,
        c.email as customer_email,
        c.opt_in as customer_opt_in,
        c.city,
        c.province,
        c.country
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      ORDER BY o.created_at DESC
      LIMIT 2000
    `);

    // Fetch line items for product analysis
    const lineItems = await client.query(`
      SELECT 
        li.id,
        li.order_id,
        li.product_id,
        li.product_title,
        li.variant_title,
        li.sku,
        li.quantity,
        li.price,
        o.customer_id,
        c.opt_in as customer_opt_in
      FROM line_items li
      LEFT JOIN orders o ON li.order_id = o.id
      LEFT JOIN customers c ON o.customer_id = c.id
      ORDER BY li.created_at DESC
      LIMIT 5000
    `);

    await client.close();

    // Process data for CRO analysis
    const optInCustomers = customers.filter((c: any) => c.opt_in === 1 || c.opt_in === true);
    const optOutCustomers = customers.filter((c: any) => c.opt_in === 0 || c.opt_in === false);

    // Geographic analysis
    const optInByCountry: Record<string, number> = {};
    const optInByCity: Record<string, number> = {};
    const optOutByCountry: Record<string, number> = {};

    optInCustomers.forEach((c: any) => {
      if (c.country) optInByCountry[c.country] = (optInByCountry[c.country] || 0) + 1;
      if (c.city) optInByCity[c.city] = (optInByCity[c.city] || 0) + 1;
    });

    optOutCustomers.forEach((c: any) => {
      if (c.country) optOutByCountry[c.country] = (optOutByCountry[c.country] || 0) + 1;
    });

    // Store analysis
    const optInByStore: Record<string, number> = {};
    const optOutByStore: Record<string, number> = {};
    const totalByStore: Record<string, number> = {};

    customers.forEach((c: any) => {
      const store = c.store_id || 'unknown';
      totalByStore[store] = (totalByStore[store] || 0) + 1;
      if (c.opt_in === 1 || c.opt_in === true) {
        optInByStore[store] = (optInByStore[store] || 0) + 1;
      } else {
        optOutByStore[store] = (optOutByStore[store] || 0) + 1;
      }
    });

    // Product preference analysis for opt-in vs opt-out customers
    const productsOptIn: Record<string, { count: number; revenue: number }> = {};
    const productsOptOut: Record<string, { count: number; revenue: number }> = {};

    lineItems.forEach((li: any) => {
      const productKey = li.product_title || li.product_id || 'Unknown';
      const isOptIn = li.customer_opt_in === 1 || li.customer_opt_in === true;
      const target = isOptIn ? productsOptIn : productsOptOut;
      
      if (!target[productKey]) {
        target[productKey] = { count: 0, revenue: 0 };
      }
      target[productKey].count += li.quantity || 1;
      target[productKey].revenue += parseFloat(li.price || 0) * (li.quantity || 1);
    });

    // Order value analysis
    const optInOrderValues = orders
      .filter((o: any) => o.customer_opt_in === 1 || o.customer_opt_in === true)
      .map((o: any) => parseFloat(o.total_price || 0));
    
    const optOutOrderValues = orders
      .filter((o: any) => o.customer_opt_in === 0 || o.customer_opt_in === false)
      .map((o: any) => parseFloat(o.total_price || 0));

    const avgOptInOrderValue = optInOrderValues.length > 0 
      ? optInOrderValues.reduce((a: number, b: number) => a + b, 0) / optInOrderValues.length 
      : 0;
    
    const avgOptOutOrderValue = optOutOrderValues.length > 0 
      ? optOutOrderValues.reduce((a: number, b: number) => a + b, 0) / optOutOrderValues.length 
      : 0;

    // Time-based analysis (when do opt-ins happen)
    const optInsByHour: Record<number, number> = {};
    const optInsByDayOfWeek: Record<number, number> = {};

    optInCustomers.forEach((c: any) => {
      if (c.created_at) {
        const date = new Date(c.created_at);
        const hour = date.getHours();
        const dayOfWeek = date.getDay();
        optInsByHour[hour] = (optInsByHour[hour] || 0) + 1;
        optInsByDayOfWeek[dayOfWeek] = (optInsByDayOfWeek[dayOfWeek] || 0) + 1;
      }
    });

    const analytics = {
      summary: {
        totalCustomers: customers.length,
        totalOptIns: optInCustomers.length,
        totalOptOuts: optOutCustomers.length,
        optInRate: customers.length > 0 ? ((optInCustomers.length / customers.length) * 100).toFixed(2) : 0,
        totalOrders: orders.length,
        avgOptInOrderValue: avgOptInOrderValue.toFixed(2),
        avgOptOutOrderValue: avgOptOutOrderValue.toFixed(2),
      },
      geographic: {
        optInByCountry: Object.entries(optInByCountry)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10),
        optInByCity: Object.entries(optInByCity)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10),
        optOutByCountry: Object.entries(optOutByCountry)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10),
      },
      stores: {
        optInByStore: Object.entries(optInByStore)
          .map(([store, count]) => ({
            store,
            optIns: count,
            total: totalByStore[store] || 0,
            rate: totalByStore[store] ? ((count / totalByStore[store]) * 100).toFixed(2) : 0,
          }))
          .sort((a, b) => parseFloat(b.rate as string) - parseFloat(a.rate as string)),
      },
      products: {
        topOptInProducts: Object.entries(productsOptIn)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 15)
          .map(([product, data]) => ({ product, ...data })),
        topOptOutProducts: Object.entries(productsOptOut)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 15)
          .map(([product, data]) => ({ product, ...data })),
      },
      temporal: {
        optInsByHour: Object.entries(optInsByHour)
          .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
          .map(([hour, count]) => ({ hour: parseInt(hour), count })),
        optInsByDayOfWeek: Object.entries(optInsByDayOfWeek)
          .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
          .map(([day, count]) => ({ 
            day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parseInt(day)], 
            count 
          })),
      },
      rawData: {
        customers: customers.slice(0, 100),
        recentOrders: orders.slice(0, 100),
      }
    };

    console.log(`Successfully fetched ${customers.length} customers, ${orders.length} orders, ${lineItems.length} line items`);

    return new Response(
      JSON.stringify({ status: 200, data: analytics }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching MySQL data:', error);
    return new Response(
      JSON.stringify({ status: 500, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
