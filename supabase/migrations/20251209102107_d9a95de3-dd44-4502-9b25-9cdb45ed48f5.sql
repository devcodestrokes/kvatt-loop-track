-- Fix customers table RLS: Change to PERMISSIVE policy for admin access
-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Admins can read customers" ON public.customers;

-- Create a permissive policy that only allows authenticated admins
CREATE POLICY "Admins can read customers" 
ON public.customers 
FOR SELECT 
TO authenticated
USING (is_admin(auth.uid()));