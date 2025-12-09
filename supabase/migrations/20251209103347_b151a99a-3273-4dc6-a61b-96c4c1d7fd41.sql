-- Fix customers table RLS: Change to PERMISSIVE policy for proper access control
-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Admins can read customers" ON public.customers;

-- Create permissive policy for admin SELECT access only
CREATE POLICY "Admins can read customers"
ON public.customers
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));