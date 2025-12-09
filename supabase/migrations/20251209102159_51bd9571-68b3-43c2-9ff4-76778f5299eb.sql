-- Fix user_roles table RLS: Change to PERMISSIVE policies for proper access control
-- Drop the existing restrictive policies
DROP POLICY IF EXISTS "Admins can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins can manage roles" ON public.user_roles;

-- Create permissive policy for admin SELECT access
CREATE POLICY "Admins can view roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (is_admin(auth.uid()));

-- Create permissive policy for super admin full management
CREATE POLICY "Super admins can manage roles" 
ON public.user_roles 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));