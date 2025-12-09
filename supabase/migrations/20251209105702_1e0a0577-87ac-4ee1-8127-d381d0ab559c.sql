-- Add policy to deny public/anonymous access to customers table
CREATE POLICY "Deny public access to customers" 
ON public.customers 
FOR SELECT 
USING (false);