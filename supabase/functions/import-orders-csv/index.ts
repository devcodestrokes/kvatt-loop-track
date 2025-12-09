import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderRow {
  id: string;
  user_id: string;
  shopify_order_id: string;
  name: string;
  opt_in: string;
  payment_status: string;
  total_price: string;
  customer_id: string;
  destination: string;
  shopify_created_at: string;
  created_at: string;
  updated_at: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
      continue;
    }
    
    if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
      i++;
      continue;
    }
    
    current += char;
    i++;
  }
  
  result.push(current);
  return result;
}

function parseDestination(dest: string): { city?: string; country?: string; province?: string } {
  try {
    // Remove outer quotes and unescape
    let cleaned = dest.replace(/^"|"$/g, '').replace(/\\"/g, '"').replace(/""/g, '"');
    if (cleaned === 'null' || cleaned === '"null"') {
      return {};
    }
    const parsed = JSON.parse(cleaned);
    return {
      city: parsed?.city || null,
      country: parsed?.country || null,
      province: parsed?.province || null,
    };
  } catch (e) {
    console.log('Failed to parse destination:', dest.substring(0, 100));
    return {};
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { csvData, batchNumber } = await req.json();
    
    if (!csvData) {
      return new Response(
        JSON.stringify({ error: 'No CSV data provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing batch ${batchNumber}, CSV length: ${csvData.length}`);

    const lines = csvData.split('\n').filter((line: string) => line.trim());
    const headers = parseCSVLine(lines[0]);
    
    console.log('Headers:', headers);
    console.log(`Total lines: ${lines.length}`);

    const orders: any[] = [];
    let parseErrors = 0;

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);
        if (values.length < 12) continue;

        const destination = parseDestination(values[8]);
        
        orders.push({
          external_id: values[0],
          store_id: values[1],
          shopify_order_id: values[2],
          order_number: values[3],
          opt_in: values[4] === '1',
          payment_status: values[5],
          total_price: parseFloat(values[6]) || 0,
          customer_external_id: values[7],
          city: destination.city,
          country: destination.country,
          province: destination.province,
          shopify_created_at: values[9] ? new Date(values[9]).toISOString() : null,
          created_at: values[10] ? new Date(values[10]).toISOString() : new Date().toISOString(),
        });
      } catch (e) {
        parseErrors++;
        if (parseErrors < 5) {
          console.log(`Error parsing line ${i}:`, e);
        }
      }
    }

    console.log(`Parsed ${orders.length} orders, ${parseErrors} errors`);

    // Insert in batches of 500
    const batchSize = 500;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < orders.length; i += batchSize) {
      const batch = orders.slice(i, i + batchSize);
      const { error } = await supabase
        .from('imported_orders')
        .upsert(batch, { onConflict: 'external_id' });

      if (error) {
        console.error(`Batch insert error at ${i}:`, error);
        errors += batch.length;
      } else {
        inserted += batch.length;
      }
    }

    console.log(`Inserted ${inserted} orders, ${errors} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        parsed: orders.length,
        inserted,
        errors,
        parseErrors 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
