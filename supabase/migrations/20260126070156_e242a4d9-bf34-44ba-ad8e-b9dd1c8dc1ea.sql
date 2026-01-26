-- Update all RPC functions to accept date range parameters

-- Drop and recreate get_complete_summary_stats with date range support
DROP FUNCTION IF EXISTS public.get_complete_summary_stats(text[]);
CREATE OR REPLACE FUNCTION public.get_complete_summary_stats(
  store_filter text[] DEFAULT NULL,
  date_from timestamp with time zone DEFAULT NULL,
  date_to timestamp with time zone DEFAULT NULL
)
RETURNS TABLE(
  total_orders bigint,
  total_opt_ins bigint,
  total_opt_outs bigint,
  opt_in_rate numeric,
  avg_opt_in_value numeric,
  avg_opt_out_value numeric,
  value_difference numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH stats AS (
    SELECT 
      COUNT(*)::bigint as total_orders,
      COUNT(*) FILTER (WHERE opt_in = true)::bigint as total_opt_ins,
      COUNT(*) FILTER (WHERE opt_in = false)::bigint as total_opt_outs,
      COALESCE(AVG(total_price) FILTER (WHERE opt_in = true), 0) as avg_opt_in,
      COALESCE(AVG(total_price) FILTER (WHERE opt_in = false), 0) as avg_opt_out
    FROM imported_orders
    WHERE (store_filter IS NULL OR user_id = ANY(store_filter))
      AND (date_from IS NULL OR shopify_created_at >= date_from)
      AND (date_to IS NULL OR shopify_created_at <= date_to)
  )
  SELECT 
    total_orders,
    total_opt_ins,
    total_opt_outs,
    CASE WHEN total_orders > 0 THEN ROUND((total_opt_ins::numeric / total_orders * 100), 2) ELSE 0 END as opt_in_rate,
    ROUND(avg_opt_in::numeric, 2) as avg_opt_in_value,
    ROUND(avg_opt_out::numeric, 2) as avg_opt_out_value,
    ROUND((avg_opt_in - avg_opt_out)::numeric, 2) as value_difference
  FROM stats;
$$;

-- Drop and recreate get_store_stats with date range support
DROP FUNCTION IF EXISTS public.get_store_stats(text[]);
CREATE OR REPLACE FUNCTION public.get_store_stats(
  store_filter text[] DEFAULT NULL,
  date_from timestamp with time zone DEFAULT NULL,
  date_to timestamp with time zone DEFAULT NULL
)
RETURNS TABLE(
  store_id text,
  total_orders bigint,
  opt_in_count bigint,
  total_revenue numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    user_id as store_id,
    COUNT(*)::bigint as total_orders,
    COUNT(*) FILTER (WHERE opt_in = true)::bigint as opt_in_count,
    COALESCE(SUM(total_price), 0)::numeric as total_revenue
  FROM imported_orders
  WHERE user_id IS NOT NULL
    AND (store_filter IS NULL OR user_id = ANY(store_filter))
    AND (date_from IS NULL OR shopify_created_at >= date_from)
    AND (date_to IS NULL OR shopify_created_at <= date_to)
  GROUP BY user_id
  ORDER BY total_orders DESC;
$$;

-- Drop and recreate get_country_stats with date range support
DROP FUNCTION IF EXISTS public.get_country_stats(text[]);
CREATE OR REPLACE FUNCTION public.get_country_stats(
  store_filter text[] DEFAULT NULL,
  date_from timestamp with time zone DEFAULT NULL,
  date_to timestamp with time zone DEFAULT NULL
)
RETURNS TABLE(
  country text,
  total_orders bigint,
  opt_in_count bigint,
  total_revenue numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    country,
    COUNT(*)::bigint as total_orders,
    COUNT(*) FILTER (WHERE opt_in = true)::bigint as opt_in_count,
    COALESCE(SUM(total_price), 0)::numeric as total_revenue
  FROM imported_orders
  WHERE country IS NOT NULL 
    AND country != ''
    AND country NOT LIKE '%{%'
    AND country NOT LIKE '%"%'
    AND (store_filter IS NULL OR user_id = ANY(store_filter))
    AND (date_from IS NULL OR shopify_created_at >= date_from)
    AND (date_to IS NULL OR shopify_created_at <= date_to)
  GROUP BY country
  ORDER BY total_orders DESC;
$$;

-- Drop and recreate get_city_stats with date range support
DROP FUNCTION IF EXISTS public.get_city_stats(text[]);
CREATE OR REPLACE FUNCTION public.get_city_stats(
  store_filter text[] DEFAULT NULL,
  date_from timestamp with time zone DEFAULT NULL,
  date_to timestamp with time zone DEFAULT NULL
)
RETURNS TABLE(
  city text,
  country text,
  province text,
  total_orders bigint,
  opt_in_count bigint,
  total_revenue numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    INITCAP(LOWER(TRIM(city))) as city,
    INITCAP(LOWER(TRIM(country))) as country,
    INITCAP(LOWER(TRIM(province))) as province,
    COUNT(*)::bigint as total_orders,
    COUNT(*) FILTER (WHERE opt_in = true)::bigint as opt_in_count,
    COALESCE(SUM(total_price), 0)::numeric as total_revenue
  FROM imported_orders
  WHERE city IS NOT NULL 
    AND city != ''
    AND city NOT LIKE '%{%'
    AND city NOT LIKE '%"%'
    AND LENGTH(TRIM(city)) > 1
    AND (store_filter IS NULL OR user_id = ANY(store_filter))
    AND (date_from IS NULL OR shopify_created_at >= date_from)
    AND (date_to IS NULL OR shopify_created_at <= date_to)
  GROUP BY INITCAP(LOWER(TRIM(city))), INITCAP(LOWER(TRIM(country))), INITCAP(LOWER(TRIM(province)))
  ORDER BY total_orders DESC;
$$;

-- Drop and recreate get_province_stats with date range support
DROP FUNCTION IF EXISTS public.get_province_stats(text[]);
CREATE OR REPLACE FUNCTION public.get_province_stats(
  store_filter text[] DEFAULT NULL,
  date_from timestamp with time zone DEFAULT NULL,
  date_to timestamp with time zone DEFAULT NULL
)
RETURNS TABLE(
  province text,
  total_orders bigint,
  opt_in_count bigint,
  total_revenue numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    INITCAP(LOWER(TRIM(province))) as province,
    COUNT(*)::bigint as total_orders,
    COUNT(*) FILTER (WHERE opt_in = true)::bigint as opt_in_count,
    COALESCE(SUM(total_price), 0)::numeric as total_revenue
  FROM imported_orders
  WHERE province IS NOT NULL 
    AND province != ''
    AND province NOT LIKE '%{%'
    AND province NOT LIKE '%"%'
    AND LENGTH(TRIM(province)) > 1
    AND (store_filter IS NULL OR user_id = ANY(store_filter))
    AND (date_from IS NULL OR shopify_created_at >= date_from)
    AND (date_to IS NULL OR shopify_created_at <= date_to)
  GROUP BY INITCAP(LOWER(TRIM(province)))
  ORDER BY total_orders DESC;
$$;

-- Drop and recreate get_temporal_stats with date range support
DROP FUNCTION IF EXISTS public.get_temporal_stats(text[]);
CREATE OR REPLACE FUNCTION public.get_temporal_stats(
  store_filter text[] DEFAULT NULL,
  date_from timestamp with time zone DEFAULT NULL,
  date_to timestamp with time zone DEFAULT NULL
)
RETURNS TABLE(
  day_of_week integer,
  month_year text,
  total_orders bigint,
  opt_in_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    EXTRACT(DOW FROM shopify_created_at)::integer as day_of_week,
    TO_CHAR(shopify_created_at, 'YYYY-MM') as month_year,
    COUNT(*)::bigint as total_orders,
    COUNT(*) FILTER (WHERE opt_in = true)::bigint as opt_in_count
  FROM imported_orders
  WHERE shopify_created_at IS NOT NULL
    AND (store_filter IS NULL OR user_id = ANY(store_filter))
    AND (date_from IS NULL OR shopify_created_at >= date_from)
    AND (date_to IS NULL OR shopify_created_at <= date_to)
  GROUP BY EXTRACT(DOW FROM shopify_created_at), TO_CHAR(shopify_created_at, 'YYYY-MM')
  ORDER BY month_year, day_of_week;
$$;

-- Drop and recreate get_order_value_stats with date range support
DROP FUNCTION IF EXISTS public.get_order_value_stats(text[]);
CREATE OR REPLACE FUNCTION public.get_order_value_stats(
  store_filter text[] DEFAULT NULL,
  date_from timestamp with time zone DEFAULT NULL,
  date_to timestamp with time zone DEFAULT NULL
)
RETURNS TABLE(
  price_range text,
  total_orders bigint,
  opt_in_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    CASE 
      WHEN total_price < 25 THEN '$0-25'
      WHEN total_price < 50 THEN '$25-50'
      WHEN total_price < 100 THEN '$50-100'
      WHEN total_price < 200 THEN '$100-200'
      WHEN total_price < 500 THEN '$200-500'
      ELSE '$500+'
    END as price_range,
    COUNT(*)::bigint as total_orders,
    COUNT(*) FILTER (WHERE opt_in = true)::bigint as opt_in_count
  FROM imported_orders
  WHERE total_price IS NOT NULL
    AND (store_filter IS NULL OR user_id = ANY(store_filter))
    AND (date_from IS NULL OR shopify_created_at >= date_from)
    AND (date_to IS NULL OR shopify_created_at <= date_to)
  GROUP BY 
    CASE 
      WHEN total_price < 25 THEN '$0-25'
      WHEN total_price < 50 THEN '$25-50'
      WHEN total_price < 100 THEN '$50-100'
      WHEN total_price < 200 THEN '$100-200'
      WHEN total_price < 500 THEN '$200-500'
      ELSE '$500+'
    END
  ORDER BY 
    MIN(total_price);
$$;