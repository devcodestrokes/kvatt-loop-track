-- Drop existing restrictive RLS policies on label_groups
DROP POLICY IF EXISTS "Allow authenticated users to create label groups" ON public.label_groups;
DROP POLICY IF EXISTS "Allow authenticated users to view label groups" ON public.label_groups;
DROP POLICY IF EXISTS "Allow authenticated users to update label groups" ON public.label_groups;

-- Create new RLS policies that allow authenticated users to manage label_groups
CREATE POLICY "Users can view all label groups" 
ON public.label_groups 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Users can create label groups" 
ON public.label_groups 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can update label groups" 
ON public.label_groups 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Users can delete label groups" 
ON public.label_groups 
FOR DELETE 
TO authenticated
USING (true);