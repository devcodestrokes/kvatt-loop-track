
-- Allow public read access to mintsoft_asn for the status page
CREATE POLICY "Public can read mintsoft_asn"
ON public.mintsoft_asn FOR SELECT
USING (true);

-- Allow public read access to mintsoft_returns for the status page
CREATE POLICY "Public can read mintsoft_returns"
ON public.mintsoft_returns FOR SELECT
USING (true);

-- Allow public read access to labels for the status page
CREATE POLICY "Public can read labels"
ON public.labels FOR SELECT
USING (true);
