
-- Drop the restrictive policies
DROP POLICY IF EXISTS "Admins can read label_groups" ON public.label_groups;
DROP POLICY IF EXISTS "Users can view all label groups" ON public.label_groups;
DROP POLICY IF EXISTS "Users can create label groups" ON public.label_groups;
DROP POLICY IF EXISTS "Users can update label groups" ON public.label_groups;
DROP POLICY IF EXISTS "Users can delete label groups" ON public.label_groups;

-- Recreate as PERMISSIVE policies for authenticated users
CREATE POLICY "Authenticated users can view label groups"
  ON public.label_groups FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert label groups"
  ON public.label_groups FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update label groups"
  ON public.label_groups FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete label groups"
  ON public.label_groups FOR DELETE
  USING (auth.uid() IS NOT NULL);
