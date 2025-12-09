-- Fix merchants table RLS: Change to PERMISSIVE policies for proper access control
-- Drop the existing restrictive policies
DROP POLICY IF EXISTS "Admins can manage merchants" ON public.merchants;
DROP POLICY IF EXISTS "Admins can read merchants" ON public.merchants;

-- Create permissive policy for admin full management
CREATE POLICY "Admins can manage merchants" 
ON public.merchants 
FOR ALL 
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));