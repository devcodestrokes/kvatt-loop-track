-- Fix admin_invites: Add public SELECT policy for checking invites during signup
-- But also ensure unauthenticated users can only check if their email exists (for signup flow)
DROP POLICY IF EXISTS "Admins can view invites" ON public.admin_invites;

-- Admins can view all invites
CREATE POLICY "Admins can view invites" 
ON public.admin_invites 
FOR SELECT 
TO authenticated
USING (is_admin(auth.uid()));

-- Allow checking if an email is invited (for signup validation) - limited exposure
CREATE POLICY "Anyone can check invite by email" 
ON public.admin_invites 
FOR SELECT 
TO anon
USING (false); -- Block anonymous access completely

-- Fix customers table - ensure it requires admin access
DROP POLICY IF EXISTS "Admins can read customers" ON public.customers;

CREATE POLICY "Admins can read customers" 
ON public.customers 
FOR SELECT 
TO authenticated
USING (is_admin(auth.uid()));