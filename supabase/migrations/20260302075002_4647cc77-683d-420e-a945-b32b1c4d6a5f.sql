
-- Add merchant configuration columns for return portal and branding
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS logo_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contact_email text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS return_link text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS return_link_params text DEFAULT NULL;

-- return_link_params stores the URL template suffix with placeholders like:
-- ?s=1&lang=&e={email}&o={order_number}
-- Placeholders: {email}, {order_number} are replaced dynamically

COMMENT ON COLUMN public.merchants.return_link IS 'Base return portal URL, e.g. https://returns.universalworks.co.uk/';
COMMENT ON COLUMN public.merchants.return_link_params IS 'URL query template with placeholders {email} and {order_number}, e.g. ?s=1&lang=&e={email}&o={order_number}';

-- Add index for shopify_domain lookups
CREATE INDEX IF NOT EXISTS idx_merchants_shopify_domain ON public.merchants(shopify_domain);
