
CREATE TABLE public.portal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  pack_id text,
  step text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert portal events"
  ON public.portal_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view portal events"
  ON public.portal_events FOR SELECT
  USING (is_admin(auth.uid()));

CREATE INDEX idx_portal_events_step ON public.portal_events(step);
CREATE INDEX idx_portal_events_session ON public.portal_events(session_id);
CREATE INDEX idx_portal_events_created ON public.portal_events(created_at);
