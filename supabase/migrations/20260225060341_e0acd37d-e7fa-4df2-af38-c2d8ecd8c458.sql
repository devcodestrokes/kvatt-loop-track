
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
  WITH customer_stats AS (
    SELECT 
      ic.id as cid,
      ic.external_id,
      ic.user_id,
      ic.shopify_customer_id,
      ic.name,
      ic.email,
      ic.telephone,
      ic.shopify_created_at,
      ic.created_at,
      coalesce(max(io.shopify_created_at), ic.shopify_created_at) as latest_order_date,
      count(io.id)::bigint as order_count,
      coalesce(sum(io.total_price), 0) as total_spent
    FROM imported_customers ic
    LEFT JOIN imported_orders io ON io.customer_id = ic.external_id AND io.hidden = false
    WHERE 
      (store_filter IS NULL OR ic.user_id = ANY(store_filter))
      AND (search_query IS NULL OR search_query = '' OR ic.email ILIKE '%' || search_query || '%' OR ic.name ILIKE '%' || search_query || '%')
    GROUP BY ic.id, ic.external_id, ic.user_id, ic.shopify_customer_id, ic.name, ic.email, ic.telephone, ic.shopify_created_at, ic.created_at
  ),
  counted AS (
    SELECT count(*)::bigint as total FROM customer_stats
  )
  SELECT 
    cs.cid,
    cs.external_id,
    cs.user_id,
    cs.shopify_customer_id,
    cs.name,
    cs.email,
    cs.telephone,
    cs.shopify_created_at,
    cs.created_at,
    cs.latest_order_date,
    cs.order_count,
    cs.total_spent,
    c.total
  FROM customer_stats cs, counted c
  ORDER BY cs.latest_order_date DESC NULLS LAST
  OFFSET page_offset
  LIMIT page_limit;
$$;
