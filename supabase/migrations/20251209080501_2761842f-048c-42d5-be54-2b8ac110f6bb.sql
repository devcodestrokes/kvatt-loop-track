-- Create merchants table
CREATE TABLE public.merchants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  shopify_domain TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'inactive')),
  total_opt_ins INTEGER NOT NULL DEFAULT 0,
  total_packages INTEGER NOT NULL DEFAULT 0,
  return_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  landing_page_config JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create label_groups table
CREATE TABLE public.label_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id TEXT NOT NULL UNIQUE,
  label_count INTEGER NOT NULL DEFAULT 0,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'printed', 'shipped', 'active')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create labels table
CREATE TABLE public.labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label_id TEXT NOT NULL UNIQUE,
  group_id UUID REFERENCES public.label_groups(id) ON DELETE CASCADE,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'returned', 'damaged')),
  current_order_id TEXT,
  previous_uses INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create scan_events table for QR tracking
CREATE TABLE public.scan_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label_id UUID REFERENCES public.labels(id) ON DELETE CASCADE,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('customer_scan', 'wms_outbound', 'wms_inbound')),
  location TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  scanned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create shipments table for outbound
CREATE TABLE public.shipments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label_id UUID REFERENCES public.labels(id) ON DELETE CASCADE,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
  order_id TEXT NOT NULL,
  carrier TEXT,
  destination TEXT,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'shipped', 'in_transit', 'delivered')),
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create returns table for inbound
CREATE TABLE public.returns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label_id UUID REFERENCES public.labels(id) ON DELETE CASCADE,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
  condition TEXT NOT NULL DEFAULT 'good' CHECK (condition IN ('excellent', 'good', 'fair', 'damaged')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'inspected', 'ready_for_reuse')),
  previous_uses INTEGER NOT NULL DEFAULT 0,
  returned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  inspected_at TIMESTAMP WITH TIME ZONE
);

-- Create stock table for stock management
CREATE TABLE public.stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
  location TEXT NOT NULL,
  available INTEGER NOT NULL DEFAULT 0,
  in_use INTEGER NOT NULL DEFAULT 0,
  returned INTEGER NOT NULL DEFAULT 0,
  damaged INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create circularity_reports table
CREATE TABLE public.circularity_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_packages INTEGER NOT NULL DEFAULT 0,
  packages_reused INTEGER NOT NULL DEFAULT 0,
  average_reuses NUMERIC(5,2) NOT NULL DEFAULT 0,
  co2_saved_kg NUMERIC(10,2) NOT NULL DEFAULT 0,
  plastic_saved_kg NUMERIC(10,2) NOT NULL DEFAULT 0,
  circularity_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  comments JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create mintsoft_asn table for ASN data
CREATE TABLE public.mintsoft_asn (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_reference TEXT,
  packaging_id TEXT,
  product_name TEXT,
  asn_status TEXT,
  estimated_delivery TIMESTAMP WITH TIME ZONE,
  booked_in_date TIMESTAMP WITH TIME ZONE,
  last_updated TIMESTAMP WITH TIME ZONE,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create mintsoft_returns table for Mintsoft returns
CREATE TABLE public.mintsoft_returns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  return_id TEXT,
  reference TEXT,
  return_date TIMESTAMP WITH TIME ZONE,
  reason TEXT,
  product_code TEXT,
  qty_returned INTEGER NOT NULL DEFAULT 0,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create landing_pages table for merchant landing pages
CREATE TABLE public.landing_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'Return Your Package',
  subtitle TEXT DEFAULT 'Help us create a circular economy',
  primary_color TEXT DEFAULT '#fe655b',
  logo_url TEXT,
  instructions JSONB DEFAULT '["Scan the QR code", "Drop at nearest collection point", "Earn rewards!"]',
  drop_off_locations JSONB DEFAULT '[]',
  rewards_enabled BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create insights table for analytics insights
CREATE TABLE public.insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  value NUMERIC,
  trend TEXT CHECK (trend IN ('up', 'down', 'stable')),
  period_start DATE,
  period_end DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.label_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circularity_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mintsoft_asn ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mintsoft_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public read access (admin dashboard)
CREATE POLICY "Allow public read access" ON public.merchants FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.label_groups FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.labels FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.scan_events FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.shipments FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.returns FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.stock FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.circularity_reports FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.mintsoft_asn FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.mintsoft_returns FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.landing_pages FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.insights FOR SELECT USING (true);

-- Create indexes for better performance
CREATE INDEX idx_labels_group_id ON public.labels(group_id);
CREATE INDEX idx_labels_merchant_id ON public.labels(merchant_id);
CREATE INDEX idx_scan_events_label_id ON public.scan_events(label_id);
CREATE INDEX idx_shipments_label_id ON public.shipments(label_id);
CREATE INDEX idx_returns_label_id ON public.returns(label_id);
CREATE INDEX idx_stock_merchant_id ON public.stock(merchant_id);
CREATE INDEX idx_circularity_reports_merchant_id ON public.circularity_reports(merchant_id);
CREATE INDEX idx_landing_pages_merchant_id ON public.landing_pages(merchant_id);
CREATE INDEX idx_insights_merchant_id ON public.insights(merchant_id);

-- Add triggers for updated_at
CREATE TRIGGER update_merchants_updated_at BEFORE UPDATE ON public.merchants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_label_groups_updated_at BEFORE UPDATE ON public.label_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_labels_updated_at BEFORE UPDATE ON public.labels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_stock_updated_at BEFORE UPDATE ON public.stock FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_landing_pages_updated_at BEFORE UPDATE ON public.landing_pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();