
-- Add Mintsoft ASN tracking columns to label_groups
ALTER TABLE public.label_groups 
  ADD COLUMN IF NOT EXISTS mintsoft_asn_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS mintsoft_asn_id integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS merchant_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamp with time zone DEFAULT NULL;

-- Add index for faster lookups during sync
CREATE INDEX IF NOT EXISTS idx_label_groups_group_id ON public.label_groups(group_id);
