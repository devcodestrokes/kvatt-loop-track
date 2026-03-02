
-- Create storage bucket for merchant logos
INSERT INTO storage.buckets (id, name, public) VALUES ('merchant-logos', 'merchant-logos', true);

-- Allow anyone to view merchant logos (public bucket)
CREATE POLICY "Public can view merchant logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'merchant-logos');

-- Admins can upload merchant logos
CREATE POLICY "Admins can upload merchant logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'merchant-logos' AND public.is_admin(auth.uid()));

-- Admins can update merchant logos
CREATE POLICY "Admins can update merchant logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'merchant-logos' AND public.is_admin(auth.uid()));

-- Admins can delete merchant logos
CREATE POLICY "Admins can delete merchant logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'merchant-logos' AND public.is_admin(auth.uid()));
