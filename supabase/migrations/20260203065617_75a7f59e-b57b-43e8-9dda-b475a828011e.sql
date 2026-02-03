-- Add indexes for faster customer queries
CREATE INDEX IF NOT EXISTS idx_imported_customers_user_id ON imported_customers(user_id);
CREATE INDEX IF NOT EXISTS idx_imported_customers_email ON imported_customers(email);
CREATE INDEX IF NOT EXISTS idx_imported_customers_name ON imported_customers(name);
CREATE INDEX IF NOT EXISTS idx_imported_customers_shopify_created_at ON imported_customers(shopify_created_at DESC);

-- Add indexes for faster order queries  
CREATE INDEX IF NOT EXISTS idx_imported_orders_customer_id ON imported_orders(customer_id);

-- Create a function to get customer stats efficiently (aggregated at DB level)
CREATE OR REPLACE FUNCTION get_customer_order_stats(customer_ids text[])
RETURNS TABLE(
  customer_id text,
  order_count bigint,
  total_spent numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    customer_id,
    COUNT(*)::bigint as order_count,
    COALESCE(SUM(total_price), 0)::numeric as total_spent
  FROM imported_orders
  WHERE customer_id = ANY(customer_ids)
  GROUP BY customer_id;
$$;