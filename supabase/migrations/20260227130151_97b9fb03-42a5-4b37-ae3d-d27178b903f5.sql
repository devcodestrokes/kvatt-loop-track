
-- Create storage bucket for voice feedback recordings
INSERT INTO storage.buckets (id, name, public) VALUES ('voice-feedback', 'voice-feedback', false);

-- Allow public (unauthenticated) uploads since the returns portal is public
CREATE POLICY "Anyone can upload voice feedback"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'voice-feedback');

-- Allow admins to read/manage recordings
CREATE POLICY "Admins can read voice feedback"
ON storage.objects FOR SELECT
USING (bucket_id = 'voice-feedback' AND (SELECT is_admin(auth.uid())));

CREATE POLICY "Admins can delete voice feedback"
ON storage.objects FOR DELETE
USING (bucket_id = 'voice-feedback' AND (SELECT is_admin(auth.uid())));
