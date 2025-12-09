-- Create table for imported orders from CSV
CREATE TABLE public.imported_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT UNIQUE NOT NULL,
  store_id TEXT,
  shopify_order_id TEXT,
  order_number TEXT,
  opt_in BOOLEAN DEFAULT false,
  payment_status TEXT,
  total_price DECIMAL(10,2) DEFAULT 0,
  customer_external_id TEXT,
  city TEXT,
  country TEXT,
  province TEXT,
  shopify_created_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for analytics queries
CREATE INDEX idx_imported_orders_opt_in ON public.imported_orders(opt_in);
CREATE INDEX idx_imported_orders_store_id ON public.imported_orders(store_id);
CREATE INDEX idx_imported_orders_created_at ON public.imported_orders(created_at);
CREATE INDEX idx_imported_orders_city ON public.imported_orders(city);
CREATE INDEX idx_imported_orders_country ON public.imported_orders(country);

-- Enable RLS
ALTER TABLE public.imported_orders ENABLE ROW LEVEL SECURITY;

-- Allow admins to read all orders
CREATE POLICY "Admins can view imported orders"
  ON public.imported_orders
  FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Allow admins to insert orders
CREATE POLICY "Admins can insert imported orders"
  ON public.imported_orders
  FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Allow service role full access (for edge function)
CREATE POLICY "Service role full access"
  ON public.imported_orders
  FOR ALL
  USING (auth.role() = 'service_role');