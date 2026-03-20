
CREATE TABLE public.customer_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_ref TEXT NOT NULL,
  sentiment_value INTEGER NOT NULL DEFAULT 0,
  recording_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_feedback ENABLE ROW LEVEL SECURITY;

-- Anyone can insert feedback (public returns portal)
CREATE POLICY "Anyone can insert feedback"
ON public.customer_feedback
FOR INSERT
TO public
WITH CHECK (true);

-- Admins can view all feedback
CREATE POLICY "Admins can view feedback"
ON public.customer_feedback
FOR SELECT
TO public
USING (is_admin(auth.uid()));
