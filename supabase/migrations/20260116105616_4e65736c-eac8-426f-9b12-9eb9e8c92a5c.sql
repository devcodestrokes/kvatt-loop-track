-- First, clear all existing data from imported_orders
TRUNCATE TABLE public.imported_orders;

-- Add new columns for the updated API structure
ALTER TABLE public.imported_orders 
ADD COLUMN IF NOT EXISTS destination jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS user_id text;

-- Rename columns to match API response
ALTER TABLE public.imported_orders RENAME COLUMN customer_external_id TO customer_id;
ALTER TABLE public.imported_orders RENAME COLUMN order_number TO name;