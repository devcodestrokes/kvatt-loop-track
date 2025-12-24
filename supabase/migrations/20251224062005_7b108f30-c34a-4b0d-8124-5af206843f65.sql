-- Remove the redundant deny policy since RLS is already deny-by-default
-- and the "Admins can read customers" policy correctly restricts access to admins only
DROP POLICY IF EXISTS "Deny public access to customers" ON public.customers;