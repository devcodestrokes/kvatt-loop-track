-- Create update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create is_admin function
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'super_admin')
  )
$$;

-- Create is_invited_email function
CREATE OR REPLACE FUNCTION public.is_invited_email(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_invites
    WHERE email = _email
      AND accepted_at IS NULL
      AND expires_at > now()
  )
$$;

-- Create profiles table if not exists
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL PRIMARY KEY,
  email text NOT NULL,
  full_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table if not exists
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create admin_invites table if not exists
CREATE TABLE IF NOT EXISTS public.admin_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  invited_by uuid,
  accepted_at timestamp with time zone,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;

-- Create merchants table if not exists
CREATE TABLE IF NOT EXISTS public.merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  shopify_domain text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  total_opt_ins integer NOT NULL DEFAULT 0,
  total_packages integer NOT NULL DEFAULT 0,
  return_rate numeric NOT NULL DEFAULT 0,
  landing_page_config jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;

-- Create customers table if not exists
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  first_name text,
  last_name text,
  phone text,
  city text,
  province text,
  country text,
  store_id text NOT NULL,
  opt_in boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Create orders table if not exists
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL,
  customer_id uuid NOT NULL,
  store_id text NOT NULL,
  total_price numeric NOT NULL DEFAULT 0,
  currency text DEFAULT 'USD',
  financial_status text,
  fulfillment_status text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Create line_items table if not exists
CREATE TABLE IF NOT EXISTS public.line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  product_id text,
  product_title text NOT NULL,
  variant_title text,
  sku text,
  quantity integer NOT NULL DEFAULT 1,
  price numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.line_items ENABLE ROW LEVEL SECURITY;

-- Create imported_orders table if not exists
CREATE TABLE IF NOT EXISTS public.imported_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text NOT NULL UNIQUE,
  order_number text,
  shopify_order_id text,
  customer_external_id text,
  store_id text,
  opt_in boolean DEFAULT false,
  total_price numeric DEFAULT 0,
  payment_status text,
  city text,
  province text,
  country text,
  shopify_created_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.imported_orders ENABLE ROW LEVEL SECURITY;

-- Create label_groups table if not exists
CREATE TABLE IF NOT EXISTS public.label_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id text NOT NULL,
  merchant_id uuid,
  label_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.label_groups ENABLE ROW LEVEL SECURITY;

-- Create labels table if not exists
CREATE TABLE IF NOT EXISTS public.labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label_id text NOT NULL,
  merchant_id uuid,
  group_id uuid,
  current_order_id text,
  previous_uses integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'available',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;

-- Create landing_pages table if not exists
CREATE TABLE IF NOT EXISTS public.landing_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Return Your Package',
  subtitle text DEFAULT 'Help us create a circular economy',
  logo_url text,
  primary_color text DEFAULT '#fe655b',
  instructions jsonb DEFAULT '["Scan the QR code", "Drop at nearest collection point", "Earn rewards!"]'::jsonb,
  drop_off_locations jsonb DEFAULT '[]'::jsonb,
  rewards_enabled boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;

-- Create stock table if not exists
CREATE TABLE IF NOT EXISTS public.stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid,
  location text NOT NULL,
  available integer NOT NULL DEFAULT 0,
  in_use integer NOT NULL DEFAULT 0,
  returned integer NOT NULL DEFAULT 0,
  damaged integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.stock ENABLE ROW LEVEL SECURITY;

-- Create shipments table if not exists
CREATE TABLE IF NOT EXISTS public.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL,
  merchant_id uuid,
  label_id uuid,
  status text NOT NULL DEFAULT 'processing',
  carrier text,
  destination text,
  shipped_at timestamp with time zone,
  delivered_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

-- Create returns table if not exists
CREATE TABLE IF NOT EXISTS public.returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label_id uuid,
  merchant_id uuid,
  status text NOT NULL DEFAULT 'pending',
  condition text NOT NULL DEFAULT 'good',
  previous_uses integer NOT NULL DEFAULT 0,
  returned_at timestamp with time zone NOT NULL DEFAULT now(),
  inspected_at timestamp with time zone
);
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

-- Create scan_events table if not exists
CREATE TABLE IF NOT EXISTS public.scan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label_id uuid,
  merchant_id uuid,
  event_type text NOT NULL,
  location text,
  latitude numeric,
  longitude numeric,
  scanned_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY;

-- Create insights table if not exists
CREATE TABLE IF NOT EXISTS public.insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid,
  insight_type text NOT NULL,
  title text NOT NULL,
  description text,
  value numeric,
  trend text,
  period_start date,
  period_end date,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;

-- Create circularity_reports table if not exists
CREATE TABLE IF NOT EXISTS public.circularity_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_packages integer NOT NULL DEFAULT 0,
  packages_reused integer NOT NULL DEFAULT 0,
  average_reuses numeric NOT NULL DEFAULT 0,
  plastic_saved_kg numeric NOT NULL DEFAULT 0,
  co2_saved_kg numeric NOT NULL DEFAULT 0,
  circularity_score numeric NOT NULL DEFAULT 0,
  comments jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.circularity_reports ENABLE ROW LEVEL SECURITY;

-- Create mintsoft_asn table if not exists
CREATE TABLE IF NOT EXISTS public.mintsoft_asn (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  packaging_id text,
  po_reference text,
  product_name text,
  asn_status text,
  estimated_delivery timestamp with time zone,
  booked_in_date timestamp with time zone,
  last_updated timestamp with time zone,
  synced_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.mintsoft_asn ENABLE ROW LEVEL SECURITY;

-- Create mintsoft_returns table if not exists
CREATE TABLE IF NOT EXISTS public.mintsoft_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id text,
  reference text,
  product_code text,
  reason text,
  qty_returned integer NOT NULL DEFAULT 0,
  return_date timestamp with time zone,
  synced_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.mintsoft_returns ENABLE ROW LEVEL SECURITY;

-- Create handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  invite_record admin_invites%ROWTYPE;
BEGIN
  SELECT * INTO invite_record 
  FROM public.admin_invites 
  WHERE email = NEW.email 
    AND accepted_at IS NULL 
    AND expires_at > now();
  
  IF invite_record.id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
    
    UPDATE public.admin_invites 
    SET accepted_at = now() 
    WHERE id = invite_record.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies (using DROP POLICY IF EXISTS to avoid conflicts)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Deny public access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Deny public access to profiles" ON public.profiles FOR SELECT USING (false);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "Admins can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can view roles" ON public.user_roles FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Super admins can manage roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admins can view invites" ON public.admin_invites;
DROP POLICY IF EXISTS "Admins can create invites" ON public.admin_invites;
DROP POLICY IF EXISTS "Super admins can delete invites" ON public.admin_invites;
DROP POLICY IF EXISTS "Anyone can check invite by email" ON public.admin_invites;
CREATE POLICY "Admins can view invites" ON public.admin_invites FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Admins can create invites" ON public.admin_invites FOR INSERT WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Super admins can delete invites" ON public.admin_invites FOR DELETE USING (has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Anyone can check invite by email" ON public.admin_invites FOR SELECT USING (false);

DROP POLICY IF EXISTS "Admins can manage merchants" ON public.merchants;
CREATE POLICY "Admins can manage merchants" ON public.merchants FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can read customers" ON public.customers;
DROP POLICY IF EXISTS "Deny public access to customers" ON public.customers;
CREATE POLICY "Admins can read customers" ON public.customers FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Deny public access to customers" ON public.customers FOR SELECT USING (false);

DROP POLICY IF EXISTS "Admins can read orders" ON public.orders;
DROP POLICY IF EXISTS "Deny public access to orders" ON public.orders;
CREATE POLICY "Admins can read orders" ON public.orders FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Deny public access to orders" ON public.orders FOR SELECT USING (false);

DROP POLICY IF EXISTS "Admins can read line_items" ON public.line_items;
CREATE POLICY "Admins can read line_items" ON public.line_items FOR SELECT USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view imported orders" ON public.imported_orders;
DROP POLICY IF EXISTS "Admins can insert imported orders" ON public.imported_orders;
DROP POLICY IF EXISTS "Service role full access" ON public.imported_orders;
CREATE POLICY "Admins can view imported orders" ON public.imported_orders FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Admins can insert imported orders" ON public.imported_orders FOR INSERT WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Service role full access" ON public.imported_orders FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins can read label_groups" ON public.label_groups;
CREATE POLICY "Admins can read label_groups" ON public.label_groups FOR SELECT USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can read labels" ON public.labels;
DROP POLICY IF EXISTS "Admins can manage labels" ON public.labels;
CREATE POLICY "Admins can read labels" ON public.labels FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Admins can manage labels" ON public.labels FOR ALL USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can read landing_pages" ON public.landing_pages;
DROP POLICY IF EXISTS "Admins can manage landing_pages" ON public.landing_pages;
CREATE POLICY "Admins can read landing_pages" ON public.landing_pages FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Admins can manage landing_pages" ON public.landing_pages FOR ALL USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can read stock" ON public.stock;
DROP POLICY IF EXISTS "Admins can manage stock" ON public.stock;
CREATE POLICY "Admins can read stock" ON public.stock FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Admins can manage stock" ON public.stock FOR ALL USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can read shipments" ON public.shipments;
CREATE POLICY "Admins can read shipments" ON public.shipments FOR SELECT USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can read returns" ON public.returns;
CREATE POLICY "Admins can read returns" ON public.returns FOR SELECT USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can read scan_events" ON public.scan_events;
CREATE POLICY "Admins can read scan_events" ON public.scan_events FOR SELECT USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can read insights" ON public.insights;
CREATE POLICY "Admins can read insights" ON public.insights FOR SELECT USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can read circularity_reports" ON public.circularity_reports;
CREATE POLICY "Admins can read circularity_reports" ON public.circularity_reports FOR SELECT USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can read mintsoft_asn" ON public.mintsoft_asn;
CREATE POLICY "Admins can read mintsoft_asn" ON public.mintsoft_asn FOR SELECT USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can read mintsoft_returns" ON public.mintsoft_returns;
CREATE POLICY "Admins can read mintsoft_returns" ON public.mintsoft_returns FOR SELECT USING (is_admin(auth.uid()));