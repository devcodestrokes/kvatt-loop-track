
-- Create index to speed up the join for latest order date lookup
CREATE INDEX IF NOT EXISTS idx_imported_orders_customer_id_created 
ON imported_orders(customer_id, shopify_created_at DESC) 
WHERE hidden = false;
