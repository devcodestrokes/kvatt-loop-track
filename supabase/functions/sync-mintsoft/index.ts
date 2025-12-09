import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MINTSOFT_API_KEY = Deno.env.get('MINTSOFT_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { type } = await req.json();

    if (type === 'asn') {
      // Fetch ASN data from Mintsoft
      const asnUrl = 'https://api.mintsoft.co.uk/api/ASN/List?ClientId=82&IncludeItems=true';
      
      const asnResponse = await fetch(asnUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'ms-apikey': MINTSOFT_API_KEY!,
        },
      });

      const asnData = await asnResponse.json();
      console.log('📦 ASN Raw Response received, count:', Array.isArray(asnData) ? asnData.length : 'not array');

      if (!Array.isArray(asnData)) {
        return new Response(JSON.stringify({ error: 'Invalid ASN response' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Clear existing ASN data and insert new
      await supabase.from('mintsoft_asn').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      const asnRecords: any[] = [];
      asnData.forEach((asn: any) => {
        if (asn.Items && Array.isArray(asn.Items)) {
          asn.Items.forEach((item: any) => {
            asnRecords.push({
              po_reference: asn.POReference || 'N/A',
              packaging_id: item.SerialNumber || item.BatchNumber || 'N/A',
              product_name: item.ProductName || 'Unknown',
              asn_status: asn.ASNStatus?.Name || 'Unknown',
              estimated_delivery: asn.EstimatedDelivery || null,
              booked_in_date: asn.BookedInDate || null,
              last_updated: asn.LastUpdated || null,
              synced_at: new Date().toISOString(),
            });
          });
        }
      });

      if (asnRecords.length > 0) {
        const { error: insertError } = await supabase.from('mintsoft_asn').insert(asnRecords);
        if (insertError) {
          console.error('Error inserting ASN:', insertError);
          throw insertError;
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        type: 'asn',
        count: asnRecords.length 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (type === 'returns') {
      // Fetch Returns data from Mintsoft
      const returnsUrl = 'https://api.mintsoft.co.uk/api/Returns/List?ClientId=82';
      
      const returnsResponse = await fetch(returnsUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'ms-apikey': MINTSOFT_API_KEY!,
        },
      });

      const returnsData = await returnsResponse.json();
      console.log('🔁 Returns Raw Response received, count:', Array.isArray(returnsData) ? returnsData.length : 'not array');

      if (!Array.isArray(returnsData)) {
        return new Response(JSON.stringify({ error: 'Invalid Returns response' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Clear existing returns data and insert new
      await supabase.from('mintsoft_returns').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      const returnsRecords: any[] = [];
      returnsData.forEach((item: any) => {
        const items = item.Items || [];
        items.forEach((product: any) => {
          returnsRecords.push({
            return_id: String(item.ID || ''),
            reference: item.Reference || '',
            return_date: item.ReturnDate || null,
            reason: item.Reason || '',
            product_code: product.ProductCode || '',
            qty_returned: product.QuantityReturned || 0,
            synced_at: new Date().toISOString(),
          });
        });
      });

      if (returnsRecords.length > 0) {
        const { error: insertError } = await supabase.from('mintsoft_returns').insert(returnsRecords);
        if (insertError) {
          console.error('Error inserting returns:', insertError);
          throw insertError;
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        type: 'returns',
        count: returnsRecords.length 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      return new Response(JSON.stringify({ error: 'Invalid type. Use "asn" or "returns"' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error in sync-mintsoft function:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
