-- Fix customers table: Add explicit deny policy for public/anonymous access
CREATE POLICY "Deny public access to customers"
ON public.customers
FOR SELECT
TO anon, public
USING (false);

-- Fix admin_invites: Drop the confusingly named policy and ensure proper protection
DROP POLICY IF EXISTS "Anyone can check invite by email" ON public.admin_invites;

-- Add explicit deny for anonymous users on admin_invites
CREATE POLICY "Deny public access to admin_invites"
ON public.admin_invites
FOR SELECT
TO anon, public
USING (false);