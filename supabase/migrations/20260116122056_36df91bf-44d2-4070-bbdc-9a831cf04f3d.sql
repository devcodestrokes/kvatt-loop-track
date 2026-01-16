-- Update existing records to extract city, country, province from destination JSONB
UPDATE public.imported_orders
SET 
  city = destination->>'city',
  country = destination->>'country',
  province = destination->>'province'
WHERE destination IS NOT NULL AND destination != '{}'::jsonb;