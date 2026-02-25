
DROP FUNCTION IF EXISTS public.get_customer_order_stats(text[]);

CREATE FUNCTION public.get_customer_order_stats(customer_ids text[])
RETURNS TABLE(customer_id text, order_count bigint, total_spent numeric, latest_order_date timestamptz)
LANGUAGE sql STABLE
AS $$
  SELECT 
    io.customer_id,
    count(*)::bigint AS order_count,
    coalesce(sum(io.total_price), 0) AS total_spent,
    max(io.shopify_created_at) AS latest_order_date
  FROM imported_orders io
  WHERE io.customer_id = ANY(customer_ids)
    AND io.hidden = false
  GROUP BY io.customer_id;
$$;
