
CREATE OR REPLACE FUNCTION public.get_customers_by_latest_order(
  store_filter text[] DEFAULT NULL,
  search_query text DEFAULT NULL,
  page_offset int DEFAULT 0,
  page_limit int DEFAULT 50
)
RETURNS TABLE(
  customer_id uuid,
  external_id text,
  user_id text,
  shopify_customer_id text,
  customer_name text,
  email text,
  telephone text,
  shopify_created_at timestamptz,
  created_at timestamptz,
  latest_order_date timestamptz,
  order_count bigint,
  total_spent numeric,
  total_matching bigint
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH filtered_customers AS (
    SELECT ic.id, ic.external_id, ic.user_id, ic.shopify_customer_id,
           ic.name, ic.email, ic.telephone, ic.shopify_created_at, ic.created_at
    FROM imported_customers ic
    WHERE (store_filter IS NULL OR ic.user_id = ANY(store_filter))
      AND (search_query IS NULL OR search_query = '' 
           OR ic.email ILIKE '%' || search_query || '%' 
           OR ic.name ILIKE '%' || search_query || '%')
  ),
  order_stats AS (
    SELECT io.customer_id AS cust_ext_id,
           count(*)::bigint AS order_count,
           coalesce(sum(io.total_price), 0) AS total_spent,
           max(io.shopify_created_at) AS latest_order_date
    FROM imported_orders io
    WHERE io.hidden = false
      AND io.customer_id IN (SELECT fc.external_id FROM filtered_customers fc)
    GROUP BY io.customer_id
  ),
  combined AS (
    SELECT fc.id AS cid, fc.external_id, fc.user_id, fc.shopify_customer_id,
           fc.name, fc.email, fc.telephone, fc.shopify_created_at, fc.created_at,
           coalesce(os.latest_order_date, fc.shopify_created_at) AS latest_order_date,
           coalesce(os.order_count, 0) AS order_count,
           coalesce(os.total_spent, 0) AS total_spent
    FROM filtered_customers fc
    LEFT JOIN order_stats os ON os.cust_ext_id = fc.external_id
  ),
  counted AS (
    SELECT count(*)::bigint AS total FROM combined
  )
  SELECT c.cid, c.external_id, c.user_id, c.shopify_customer_id,
         c.name, c.email, c.telephone, c.shopify_created_at, c.created_at,
         c.latest_order_date, c.order_count, c.total_spent, ct.total
  FROM combined c, counted ct
  ORDER BY c.latest_order_date DESC NULLS LAST
  OFFSET page_offset LIMIT page_limit;
$$;
