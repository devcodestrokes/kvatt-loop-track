
-- Drop old status check constraint and add new one with all statuses
ALTER TABLE public.label_groups DROP CONSTRAINT IF EXISTS label_groups_status_check;
ALTER TABLE public.label_groups ADD CONSTRAINT label_groups_status_check 
  CHECK (status = ANY (ARRAY['pending', 'printed', 'shipped', 'active', 'delivered', 'completed', 'discrepancy']));
