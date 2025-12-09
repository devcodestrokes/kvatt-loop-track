-- Fix orders table RLS: Change to PERMISSIVE policy for proper access control
-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Admins can read orders" ON public.orders;

-- Create permissive policy for admin SELECT access only
CREATE POLICY "Admins can read orders"
ON public.orders
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));