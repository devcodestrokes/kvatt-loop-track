
-- Table to track sequential pack serial numbers per prefix/month
CREATE TABLE IF NOT EXISTS public.pack_sequences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prefix TEXT NOT NULL,
  month_code TEXT NOT NULL,
  year_code TEXT NOT NULL,
  last_serial TEXT NOT NULL DEFAULT '00000',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(prefix, month_code, year_code)
);

ALTER TABLE public.pack_sequences ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/write sequences
CREATE POLICY "Allow all access to pack_sequences" ON public.pack_sequences
  FOR ALL USING (true) WITH CHECK (true);

-- Serial character set (alphanumeric excluding vowels)
-- 0123456789BCDFGHJKLMNPQRSTVWXYZ = 31 chars

-- Function to get next pack serials atomically
CREATE OR REPLACE FUNCTION public.get_next_pack_serials(
  p_prefix TEXT,
  p_month_code TEXT,
  p_year_code TEXT,
  p_count INTEGER
) RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_serial_chars TEXT := '0123456789BCDFGHJKLMNPQRSTVWXYZ';
  v_base INTEGER := 31;
  v_last_serial TEXT;
  v_last_num INTEGER;
  v_next_num INTEGER;
  v_result TEXT;
  v_i INTEGER;
  v_temp INTEGER;
BEGIN
  -- Upsert to get or create the sequence row, locking it
  INSERT INTO pack_sequences (prefix, month_code, year_code, last_serial)
  VALUES (p_prefix, p_month_code, p_year_code, '00000')
  ON CONFLICT (prefix, month_code, year_code) DO NOTHING;

  -- Lock and get current value
  SELECT last_serial INTO v_last_serial
  FROM pack_sequences
  WHERE prefix = p_prefix AND month_code = p_month_code AND year_code = p_year_code
  FOR UPDATE;

  -- Convert last serial to number
  v_last_num := 0;
  FOR v_i IN 1..5 LOOP
    v_last_num := v_last_num * v_base + (POSITION(SUBSTRING(v_last_serial FROM v_i FOR 1) IN v_serial_chars) - 1);
  END LOOP;

  -- The next serial starts at last_num + 1
  v_next_num := v_last_num + 1;

  -- Convert next start serial to string for return
  v_temp := v_next_num;
  v_result := '';
  FOR v_i IN 1..5 LOOP
    v_result := SUBSTRING(v_serial_chars FROM (v_temp % v_base) + 1 FOR 1) || v_result;
    v_temp := v_temp / v_base;
  END LOOP;

  -- Update the last serial to last_num + count
  v_temp := v_last_num + p_count;
  v_last_serial := '';
  FOR v_i IN 1..5 LOOP
    v_last_serial := SUBSTRING(v_serial_chars FROM (v_temp % v_base) + 1 FOR 1) || v_last_serial;
    v_temp := v_temp / v_base;
  END LOOP;

  UPDATE pack_sequences
  SET last_serial = v_last_serial, updated_at = now()
  WHERE prefix = p_prefix AND month_code = p_month_code AND year_code = p_year_code;

  RETURN v_result;
END;
$$;

-- Cleanup expired month sequences (older than 2 months)
CREATE OR REPLACE FUNCTION public.cleanup_expired_pack_sequences()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  DELETE FROM pack_sequences
  WHERE updated_at < now() - INTERVAL '60 days';
END;
$$;
