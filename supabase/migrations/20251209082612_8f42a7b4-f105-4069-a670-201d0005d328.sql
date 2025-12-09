-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'super_admin');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create admin_invites table for invite-only system
CREATE TABLE public.admin_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  invited_by UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days')
);

-- Enable RLS on admin_invites
ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;

-- Security definer function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Security definer function to check if user is any admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'super_admin')
  )
$$;

-- Security definer function to check if email is invited
CREATE OR REPLACE FUNCTION public.is_invited_email(_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_invites
    WHERE email = _email
      AND accepted_at IS NULL
      AND expires_at > now()
  )
$$;

-- Function to handle new user signup - only if invited
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_record admin_invites%ROWTYPE;
BEGIN
  -- Check if user was invited
  SELECT * INTO invite_record 
  FROM public.admin_invites 
  WHERE email = NEW.email 
    AND accepted_at IS NULL 
    AND expires_at > now();
  
  IF invite_record.id IS NOT NULL THEN
    -- Create profile
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
    
    -- Assign admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
    
    -- Mark invite as accepted
    UPDATE public.admin_invites 
    SET accepted_at = now() 
    WHERE id = invite_record.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies for profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid());

-- RLS Policies for user_roles (only super_admin can manage)
CREATE POLICY "Admins can view roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Super admins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for admin_invites
CREATE POLICY "Admins can view invites"
ON public.admin_invites FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can create invites"
ON public.admin_invites FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Super admins can delete invites"
ON public.admin_invites FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Update existing table RLS policies to require admin role
-- Drop old public read policies
DROP POLICY IF EXISTS "Allow public read access" ON public.circularity_reports;
DROP POLICY IF EXISTS "Allow public read access" ON public.insights;
DROP POLICY IF EXISTS "Allow public read access" ON public.label_groups;
DROP POLICY IF EXISTS "Allow public read access" ON public.labels;
DROP POLICY IF EXISTS "Allow public read access" ON public.landing_pages;
DROP POLICY IF EXISTS "Allow public read access" ON public.merchants;
DROP POLICY IF EXISTS "Allow public read access" ON public.mintsoft_asn;
DROP POLICY IF EXISTS "Allow public read access" ON public.mintsoft_returns;
DROP POLICY IF EXISTS "Allow public read access" ON public.returns;
DROP POLICY IF EXISTS "Allow public read access" ON public.scan_events;
DROP POLICY IF EXISTS "Allow public read access" ON public.shipments;
DROP POLICY IF EXISTS "Allow public read access" ON public.stock;
DROP POLICY IF EXISTS "Authenticated users can view all customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can view all line_items" ON public.line_items;

-- Create admin-only read policies for all tables
CREATE POLICY "Admins can read circularity_reports"
ON public.circularity_reports FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can read insights"
ON public.insights FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can read label_groups"
ON public.label_groups FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can read labels"
ON public.labels FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can read landing_pages"
ON public.landing_pages FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can read merchants"
ON public.merchants FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can read mintsoft_asn"
ON public.mintsoft_asn FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can read mintsoft_returns"
ON public.mintsoft_returns FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can read returns"
ON public.returns FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can read scan_events"
ON public.scan_events FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can read shipments"
ON public.shipments FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can read stock"
ON public.stock FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can read customers"
ON public.customers FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can read orders"
ON public.orders FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can read line_items"
ON public.line_items FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Add full CRUD for admins on key tables
CREATE POLICY "Admins can manage merchants"
ON public.merchants FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage labels"
ON public.labels FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage stock"
ON public.stock FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage landing_pages"
ON public.landing_pages FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));