-- Create imported_customers table to store synced customer data from Shopify API
CREATE TABLE public.imported_customers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id text NOT NULL UNIQUE,
  user_id text NULL, -- store identifier
  shopify_customer_id text NULL,
  name text NULL,
  email text NULL,
  telephone text NULL,
  shopify_created_at timestamp with time zone NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now()
);

-- Create index on external_id for fast lookups
CREATE INDEX idx_imported_customers_external_id ON public.imported_customers(external_id);

-- Create index on shopify_customer_id for order mapping
CREATE INDEX idx_imported_customers_shopify_customer_id ON public.imported_customers(shopify_customer_id);

-- Create index on user_id for store filtering
CREATE INDEX idx_imported_customers_user_id ON public.imported_customers(user_id);

-- Create index on email for search
CREATE INDEX idx_imported_customers_email ON public.imported_customers(email);

-- Enable Row Level Security
ALTER TABLE public.imported_customers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can view imported customers"
ON public.imported_customers
FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert imported customers"
ON public.imported_customers
FOR INSERT
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Service role full access for customers"
ON public.imported_customers
FOR ALL
USING (auth.role() = 'service_role');