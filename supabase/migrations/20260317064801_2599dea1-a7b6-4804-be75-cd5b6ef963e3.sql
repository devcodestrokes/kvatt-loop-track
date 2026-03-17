
-- Table to track bulk pack-to-merchant shipment assignments
CREATE TABLE public.pack_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid REFERENCES public.merchants(id) NOT NULL,
  merchant_name text NOT NULL,
  shipped_date date NOT NULL,
  pack_ids text[] NOT NULL DEFAULT '{}',
  pack_count integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pack_shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage pack_shipments"
  ON public.pack_shipments FOR ALL
  TO public
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
