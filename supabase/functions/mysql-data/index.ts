import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  action: string;
  params?: Record<string, any>;
}

serve(async (req) => {
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

    const body: RequestBody = await req.json();
    const { action, params = {} } = body;

    console.log(`MySQL action: ${action}`, params);

    // Connect to MySQL
    client = await new Client().connect({
      hostname: dbHost,
      username: dbUser,
      password: dbPassword,
      db: dbName,
      port: 3306,
    });

    let result: any = null;

    switch (action) {
      // ============ MERCHANTS/STORES ============
      case 'get_merchants': {
        const usersResult = await client.execute(
          `SELECT DISTINCT u.id, u.name, u.email, u.shopify_domain, u.created_at
           FROM users u
           ORDER BY u.created_at DESC
           LIMIT ?`,
          [params.limit || 100]
        );
        
        // Get order counts and opt-in stats per user/store
        const statsResult = await client.execute(
          `SELECT user_id, 
                  COUNT(*) as total_orders,
                  SUM(CASE WHEN opt_in = 1 THEN 1 ELSE 0 END) as opt_ins
           FROM orders 
           GROUP BY user_id`
        );
        
        const statsMap = new Map();
        (statsResult.rows || []).forEach((row: any) => {
          statsMap.set(row.user_id, {
            totalOrders: row.total_orders || 0,
            optIns: row.opt_ins || 0,
          });
        });

        result = (usersResult.rows || []).map((user: any) => {
          const stats = statsMap.get(user.id) || { totalOrders: 0, optIns: 0 };
          return {
            id: user.id,
            name: user.name || user.shopify_domain,
            shopifyDomain: user.shopify_domain,
            email: user.email,
            totalCheckouts: stats.totalOrders,
            totalOptIns: stats.optIns,
            optInRate: stats.totalOrders > 0 
              ? ((stats.optIns / stats.totalOrders) * 100).toFixed(1) 
              : '0',
            status: stats.totalOrders > 0 ? 'active' : 'pending',
            createdAt: user.created_at,
          };
        });
        break;
      }

      // ============ CUSTOMERS ============
      case 'get_customers': {
        const { store_id, limit = 1000, offset = 0 } = params;
        let query = `SELECT id, user_id, shopify_customer_id, name, email, telephone, created_at, updated_at 
                     FROM customers`;
        const queryParams: any[] = [];
        
        if (store_id) {
          query += ` WHERE user_id = ?`;
          queryParams.push(store_id);
        }
        
        query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        queryParams.push(limit, offset);
        
        const customersResult = await client.execute(query, queryParams);
        result = customersResult.rows || [];
        break;
      }

      // ============ ORDERS ============
      case 'get_orders': {
        const { store_id, limit = 1000, offset = 0, opt_in_only } = params;
        let query = `SELECT id, user_id, shopify_order_id, name, opt_in, payment_status, 
                            total_price, customer_id, destination, shopify_created_at, created_at 
                     FROM orders`;
        const queryParams: any[] = [];
        const conditions: string[] = [];
        
        if (store_id) {
          conditions.push(`user_id = ?`);
          queryParams.push(store_id);
        }
        
        if (opt_in_only) {
          conditions.push(`opt_in = 1`);
        }
        
        if (conditions.length > 0) {
          query += ` WHERE ${conditions.join(' AND ')}`;
        }
        
        query += ` ORDER BY shopify_created_at DESC LIMIT ? OFFSET ?`;
        queryParams.push(limit, offset);
        
        const ordersResult = await client.execute(query, queryParams);
        result = ordersResult.rows || [];
        break;
      }

      case 'get_order_analytics': {
        console.log('Starting comprehensive order analytics...');
        
        // Get total counts
        const totalResult = await client.execute(
          `SELECT COUNT(*) as total, 
                  SUM(CASE WHEN opt_in = 1 THEN 1 ELSE 0 END) as opt_ins,
                  AVG(CASE WHEN opt_in = 1 THEN total_price ELSE NULL END) as avg_opt_in_value,
                  AVG(CASE WHEN opt_in = 0 OR opt_in IS NULL THEN total_price ELSE NULL END) as avg_opt_out_value
           FROM orders`
        );
        const totals = totalResult.rows?.[0] || {};
        
        // Get order value ranges
        const orderValueResult = await client.execute(
          `SELECT 
            CASE 
              WHEN total_price < 25 THEN '£0-25'
              WHEN total_price < 50 THEN '£25-50'
              WHEN total_price < 100 THEN '£50-100'
              WHEN total_price < 200 THEN '£100-200'
              ELSE '£200+'
            END as price_range,
            COUNT(*) as total,
            SUM(CASE WHEN opt_in = 1 THEN 1 ELSE 0 END) as opt_ins
           FROM orders
           GROUP BY 
            CASE 
              WHEN total_price < 25 THEN '£0-25'
              WHEN total_price < 50 THEN '£25-50'
              WHEN total_price < 100 THEN '£50-100'
              WHEN total_price < 200 THEN '£100-200'
              ELSE '£200+'
            END
           ORDER BY MIN(total_price)`
        );

        // Get geographic data
        const geoResult = await client.execute(
          `SELECT 
            JSON_UNQUOTE(JSON_EXTRACT(destination, '$.city')) as city,
            JSON_UNQUOTE(JSON_EXTRACT(destination, '$.country')) as country,
            JSON_UNQUOTE(JSON_EXTRACT(destination, '$.province')) as province,
            COUNT(*) as total,
            SUM(CASE WHEN opt_in = 1 THEN 1 ELSE 0 END) as opt_ins,
            AVG(total_price) as avg_order_value
           FROM orders
           WHERE destination IS NOT NULL
           GROUP BY city, country, province
           ORDER BY total DESC
           LIMIT 50`
        );

        // Get store performance
        const storeResult = await client.execute(
          `SELECT u.id, u.name, u.shopify_domain,
                  COUNT(o.id) as total_orders,
                  SUM(CASE WHEN o.opt_in = 1 THEN 1 ELSE 0 END) as opt_ins,
                  SUM(o.total_price) as total_revenue,
                  AVG(o.total_price) as avg_order_value
           FROM users u
           LEFT JOIN orders o ON u.id = o.user_id
           GROUP BY u.id, u.name, u.shopify_domain
           ORDER BY total_orders DESC`
        );

        // Get temporal data - by day of week
        const dayOfWeekResult = await client.execute(
          `SELECT DAYOFWEEK(shopify_created_at) as day_num,
                  DAYNAME(shopify_created_at) as day_name,
                  COUNT(*) as total,
                  SUM(CASE WHEN opt_in = 1 THEN 1 ELSE 0 END) as opt_ins
           FROM orders
           WHERE shopify_created_at IS NOT NULL
           GROUP BY DAYOFWEEK(shopify_created_at), DAYNAME(shopify_created_at)
           ORDER BY day_num`
        );

        // Get temporal data - by month
        const monthResult = await client.execute(
          `SELECT DATE_FORMAT(shopify_created_at, '%Y-%m') as month,
                  COUNT(*) as total,
                  SUM(CASE WHEN opt_in = 1 THEN 1 ELSE 0 END) as opt_ins
           FROM orders
           WHERE shopify_created_at IS NOT NULL
           GROUP BY DATE_FORMAT(shopify_created_at, '%Y-%m')
           ORDER BY month DESC
           LIMIT 12`
        );

        const totalOrders = Number(totals.total) || 0;
        const totalOptIns = Number(totals.opt_ins) || 0;

        result = {
          summary: {
            totalOrders,
            totalOptIns,
            totalOptOuts: totalOrders - totalOptIns,
            optInRate: totalOrders > 0 ? ((totalOptIns / totalOrders) * 100).toFixed(2) : '0',
            avgOptInOrderValue: (Number(totals.avg_opt_in_value) || 0).toFixed(2),
            avgOptOutOrderValue: (Number(totals.avg_opt_out_value) || 0).toFixed(2),
            valueDifference: ((Number(totals.avg_opt_in_value) || 0) - (Number(totals.avg_opt_out_value) || 0)).toFixed(2),
          },
          orderValueAnalysis: (orderValueResult.rows || []).map((row: any) => ({
            range: row.price_range,
            total: Number(row.total) || 0,
            optIns: Number(row.opt_ins) || 0,
            optInRate: row.total > 0 ? ((row.opt_ins / row.total) * 100).toFixed(1) : '0',
          })),
          geographic: {
            topCities: (geoResult.rows || [])
              .filter((r: any) => r.city)
              .slice(0, 15)
              .map((row: any) => ({
                name: row.city || 'Unknown',
                total: Number(row.total) || 0,
                optIn: Number(row.opt_ins) || 0,
                optInRate: row.total > 0 ? ((row.opt_ins / row.total) * 100).toFixed(1) : '0',
                avgOrderValue: (Number(row.avg_order_value) || 0).toFixed(2),
              })),
            topCountries: (geoResult.rows || [])
              .reduce((acc: any[], row: any) => {
                const existing = acc.find(c => c.name === row.country);
                if (existing) {
                  existing.total += Number(row.total) || 0;
                  existing.optIn += Number(row.opt_ins) || 0;
                } else if (row.country) {
                  acc.push({
                    name: row.country,
                    total: Number(row.total) || 0,
                    optIn: Number(row.opt_ins) || 0,
                  });
                }
                return acc;
              }, [])
              .map((c: any) => ({
                ...c,
                optInRate: c.total > 0 ? ((c.optIn / c.total) * 100).toFixed(1) : '0',
              }))
              .sort((a: any, b: any) => b.total - a.total)
              .slice(0, 10),
            topProvinces: (geoResult.rows || [])
              .reduce((acc: any[], row: any) => {
                const existing = acc.find(p => p.name === row.province);
                if (existing) {
                  existing.total += Number(row.total) || 0;
                  existing.optIn += Number(row.opt_ins) || 0;
                } else if (row.province) {
                  acc.push({
                    name: row.province,
                    total: Number(row.total) || 0,
                    optIn: Number(row.opt_ins) || 0,
                  });
                }
                return acc;
              }, [])
              .map((p: any) => ({
                ...p,
                optInRate: p.total > 0 ? ((p.optIn / p.total) * 100).toFixed(1) : '0',
              }))
              .sort((a: any, b: any) => b.total - a.total)
              .slice(0, 10),
          },
          stores: (storeResult.rows || []).map((row: any) => ({
            storeId: row.id,
            name: row.name || row.shopify_domain,
            shopifyDomain: row.shopify_domain,
            total: Number(row.total_orders) || 0,
            optIn: Number(row.opt_ins) || 0,
            optInRate: row.total_orders > 0 ? ((row.opt_ins / row.total_orders) * 100).toFixed(1) : '0',
            avgOrderValue: (Number(row.avg_order_value) || 0).toFixed(2),
            totalRevenue: (Number(row.total_revenue) || 0).toFixed(2),
          })),
          temporal: {
            byDayOfWeek: (dayOfWeekResult.rows || []).map((row: any) => ({
              day: row.day_name,
              dayNum: row.day_num,
              total: Number(row.total) || 0,
              optIn: Number(row.opt_ins) || 0,
              optInRate: row.total > 0 ? ((row.opt_ins / row.total) * 100).toFixed(1) : '0',
            })),
            byMonth: (monthResult.rows || []).map((row: any) => ({
              month: row.month,
              total: Number(row.total) || 0,
              optIn: Number(row.opt_ins) || 0,
              optInRate: row.total > 0 ? ((row.opt_ins / row.total) * 100).toFixed(1) : '0',
            })),
          },
          insights: generateInsights(totals, orderValueResult.rows || [], storeResult.rows || [], geoResult.rows || []),
        };
        console.log('Order analytics complete');
        break;
      }

      // ============ LINE ITEMS / PRODUCTS ============
      case 'get_line_items': {
        const { order_id, limit = 1000 } = params;
        let query = `SELECT id, order_id, shopify_line_item_id, shopify_product_id, shopify_variant_id,
                            product_title, variant_title, quantity, total_price, created_at 
                     FROM line_items`;
        const queryParams: any[] = [];
        
        if (order_id) {
          query += ` WHERE order_id = ?`;
          queryParams.push(order_id);
        }
        
        query += ` ORDER BY created_at DESC LIMIT ?`;
        queryParams.push(limit);
        
        const lineItemsResult = await client.execute(query, queryParams);
        result = lineItemsResult.rows || [];
        break;
      }

      case 'get_product_analytics': {
        const productResult = await client.execute(
          `SELECT li.product_title, li.variant_title,
                  SUM(li.quantity) as total_quantity,
                  SUM(li.total_price) as total_revenue,
                  COUNT(DISTINCT o.id) as order_count,
                  SUM(CASE WHEN o.opt_in = 1 THEN li.quantity ELSE 0 END) as opt_in_quantity
           FROM line_items li
           JOIN orders o ON li.order_id = o.id
           GROUP BY li.product_title, li.variant_title
           ORDER BY total_revenue DESC
           LIMIT 50`
        );
        result = (productResult.rows || []).map((row: any) => ({
          productTitle: row.product_title,
          variantTitle: row.variant_title,
          totalQuantity: Number(row.total_quantity) || 0,
          totalRevenue: (Number(row.total_revenue) || 0).toFixed(2),
          orderCount: Number(row.order_count) || 0,
          optInQuantity: Number(row.opt_in_quantity) || 0,
          optInRate: row.total_quantity > 0 
            ? ((row.opt_in_quantity / row.total_quantity) * 100).toFixed(1) 
            : '0',
        }));
        break;
      }

      // ============ DASHBOARD STATS ============
      case 'get_dashboard_stats': {
        const [ordersStats, customersCount, recentOrders] = await Promise.all([
          client.execute(
            `SELECT COUNT(*) as total,
                    SUM(CASE WHEN opt_in = 1 THEN 1 ELSE 0 END) as opt_ins,
                    SUM(total_price) as total_revenue
             FROM orders`
          ),
          client.execute(`SELECT COUNT(*) as total FROM customers`),
          client.execute(
            `SELECT COUNT(*) as count 
             FROM orders 
             WHERE shopify_created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
          ),
        ]);

        const stats = ordersStats.rows?.[0] || {};
        const customers = customersCount.rows?.[0] || {};
        const recent = recentOrders.rows?.[0] || {};

        result = {
          totalOrders: Number(stats.total) || 0,
          totalOptIns: Number(stats.opt_ins) || 0,
          optInRate: stats.total > 0 ? ((stats.opt_ins / stats.total) * 100).toFixed(1) : '0',
          totalRevenue: (Number(stats.total_revenue) || 0).toFixed(2),
          totalCustomers: Number(customers.total) || 0,
          last30DaysOrders: Number(recent.count) || 0,
        };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    await client.close();
    client = null;

    return new Response(
      JSON.stringify({ status: 200, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'MySQL operation failed';
    console.error('MySQL error:', error);
    
    if (client) {
      try { await client.close(); } catch (e) { console.error('Error closing MySQL:', e); }
    }

    return new Response(
      JSON.stringify({ status: 500, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

function generateInsights(
  totals: any, 
  orderValueRows: any[], 
  storeRows: any[], 
  geoRows: any[]
): Array<{ type: string; title: string; description: string; value: string; impact: 'high' | 'medium' | 'low' }> {
  const insights: Array<{ type: string; title: string; description: string; value: string; impact: 'high' | 'medium' | 'low' }> = [];
  
  const totalOrders = Number(totals.total) || 0;
  const totalOptIns = Number(totals.opt_ins) || 0;
  const optInRate = totalOrders > 0 ? (totalOptIns / totalOrders) * 100 : 0;
  const avgOptIn = Number(totals.avg_opt_in_value) || 0;
  const avgOptOut = Number(totals.avg_opt_out_value) || 0;

  // Opt-in rate insight
  if (optInRate > 0) {
    insights.push({
      type: 'conversion',
      title: 'Overall Opt-In Rate',
      description: `${optInRate.toFixed(1)}% of customers opt for renewable packaging`,
      value: `${optInRate.toFixed(1)}%`,
      impact: optInRate > 2 ? 'high' : optInRate > 1 ? 'medium' : 'low',
    });
  }

  // Order value difference
  if (avgOptIn > avgOptOut) {
    const diff = ((avgOptIn - avgOptOut) / avgOptOut * 100).toFixed(0);
    insights.push({
      type: 'revenue',
      title: 'Opt-In Customers Spend More',
      description: `Customers who opt-in spend £${avgOptIn.toFixed(2)} on average vs £${avgOptOut.toFixed(2)} for opt-out`,
      value: `+${diff}%`,
      impact: 'high',
    });
  }

  // Best performing price range
  const priceRanges = orderValueRows || [];
  const bestRange = priceRanges.reduce((best: any, curr: any) => {
    const currRate = curr.total > 0 ? (curr.opt_ins / curr.total) * 100 : 0;
    const bestRate = best?.total > 0 ? (best.opt_ins / best.total) * 100 : 0;
    return currRate > bestRate ? curr : best;
  }, null);
  
  if (bestRange && bestRange.total > 100) {
    const rate = ((bestRange.opt_ins / bestRange.total) * 100).toFixed(1);
    insights.push({
      type: 'segment',
      title: `Best Price Range: ${bestRange.price_range}`,
      description: `Orders in the ${bestRange.price_range} range have the highest opt-in rate`,
      value: `${rate}%`,
      impact: 'medium',
    });
  }

  // Top store performance
  const topStore = storeRows?.[0];
  if (topStore && topStore.total_orders > 0) {
    insights.push({
      type: 'store',
      title: 'Top Performing Store',
      description: `${topStore.name || topStore.shopify_domain} leads with ${topStore.total_orders} orders`,
      value: `${topStore.opt_ins} opt-ins`,
      impact: 'medium',
    });
  }

  return insights;
}
