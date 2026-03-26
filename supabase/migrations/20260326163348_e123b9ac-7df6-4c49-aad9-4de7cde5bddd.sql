CREATE OR REPLACE FUNCTION public.get_customers_by_latest_order(
  store_filter text[] DEFAULT NULL::text[], 
  search_query text DEFAULT NULL::text, 
  page_offset integer DEFAULT 0, 
  page_limit integer DEFAULT 50
)
RETURNS TABLE(
  customer_id uuid, external_id text, user_id text, shopify_customer_id text, 
  customer_name text, email text, telephone text, 
  shopify_created_at timestamp with time zone, created_at timestamp with time zone, 
  latest_order_date timestamp with time zone, order_count bigint, 
  total_spent numeric, total_matching bigint
)
LANGUAGE sql STABLE
SET search_path TO 'public'
SET statement_timeout TO '30s'
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
  total_count AS (
    SELECT count(*)::bigint AS total FROM filtered_customers
  ),
  paged AS (
    SELECT fc.*
    FROM filtered_customers fc
    ORDER BY fc.shopify_created_at DESC NULLS LAST
    OFFSET page_offset LIMIT page_limit
  ),
  order_stats AS (
    SELECT io.customer_id AS cust_ext_id,
           count(*)::bigint AS order_count,
           coalesce(sum(io.total_price), 0) AS total_spent,
           max(io.shopify_created_at) AS latest_order_date
    FROM imported_orders io
    WHERE io.hidden = false
      AND io.customer_id IN (SELECT p.external_id FROM paged p)
    GROUP BY io.customer_id
  )
  SELECT p.id, p.external_id, p.user_id, p.shopify_customer_id,
         p.name, p.email, p.telephone, p.shopify_created_at, p.created_at,
         coalesce(os.latest_order_date, p.shopify_created_at) AS latest_order_date,
         coalesce(os.order_count, 0) AS order_count,
         coalesce(os.total_spent, 0) AS total_spent,
         tc.total
  FROM paged p
  CROSS JOIN total_count tc
  LEFT JOIN order_stats os ON os.cust_ext_id = p.external_id
  ORDER BY p.shopify_created_at DESC NULLS LAST;
$$;