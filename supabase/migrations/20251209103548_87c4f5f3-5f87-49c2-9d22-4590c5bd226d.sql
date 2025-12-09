-- Add explicit denial policy for anonymous/public access to orders table
-- This ensures unauthenticated users cannot access any order data

CREATE POLICY "Deny public access to orders"
ON public.orders
FOR SELECT
TO anon
USING (false);