import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MINTSOFT_API_KEY = Deno.env.get('MINTSOFT_API_KEY');
// Use the original Supabase project for labels data
const ORIGINAL_SUPABASE_URL = 'https://eftfcjjhtlzwuqmxwtnq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Fetch Mintsoft ASN and Returns in parallel
    const [asnResponse, returnsResponse] = await Promise.all([
      fetch('https://api.mintsoft.co.uk/api/ASN/List?ClientId=82&IncludeItems=true', {
        headers: { 'Accept': 'application/json', 'ms-apikey': MINTSOFT_API_KEY! },
      }),
      fetch('https://api.mintsoft.co.uk/api/Returns/List?ClientId=82', {
        headers: { 'Accept': 'application/json', 'ms-apikey': MINTSOFT_API_KEY! },
      }),
    ]);

    const asnRaw = await asnResponse.json();
    const returnsRaw = await returnsResponse.json();

    const asnData = Array.isArray(asnRaw) ? asnRaw : (asnRaw?.Results || asnRaw?.Data || asnRaw?.data || []);
    const returnsData = Array.isArray(returnsRaw) ? returnsRaw : (returnsRaw?.Results || returnsRaw?.Data || returnsRaw?.data || []);

    // Parse ASN records
    const asnRecords: any[] = [];
    if (Array.isArray(asnData)) {
      asnData.forEach((asn: any) => {
        const items = asn.Items || asn.ASNItems || asn.items || [];
        if (Array.isArray(items) && items.length > 0) {
          items.forEach((item: any) => {
            asnRecords.push({
              po_reference: asn.POReference || asn.poReference || asn.Reference || 'N/A',
              packaging_id: item.SerialNumber || item.BatchNumber || item.ProductCode || item.SKU || 'N/A',
              product_name: item.ProductName || item.Name || item.Description || 'Unknown',
              asn_status: asn.ASNStatus?.Name || asn.Status?.Name || asn.Status || 'Unknown',
              estimated_delivery: asn.EstimatedDelivery || asn.ExpectedDate || null,
              booked_in_date: asn.BookedInDate || asn.ReceivedDate || null,
              last_updated: asn.LastUpdated || asn.UpdatedOn || null,
            });
          });
        } else {
          asnRecords.push({
            po_reference: asn.POReference || asn.poReference || asn.Reference || 'N/A',
            packaging_id: asn.ProductCode || asn.SKU || asn.SerialNumber || asn.BatchNumber || 'N/A',
            product_name: asn.ProductName || asn.Name || asn.Description || 'Unknown',
            asn_status: asn.ASNStatus?.Name || asn.Status?.Name || asn.Status || 'Unknown',
            estimated_delivery: asn.EstimatedDelivery || asn.ExpectedDate || null,
            booked_in_date: asn.BookedInDate || asn.ReceivedDate || null,
            last_updated: asn.LastUpdated || asn.UpdatedOn || null,
          });
        }
      });
    }

    // Parse Returns records
    const returnsRecords: any[] = [];
    if (Array.isArray(returnsData)) {
      returnsData.forEach((item: any) => {
        const items = item.Items || item.ReturnItems || item.items || [];
        if (Array.isArray(items) && items.length > 0) {
          items.forEach((product: any) => {
            returnsRecords.push({
              return_id: String(item.ID || item.Id || ''),
              reference: item.Reference || item.OrderReference || '',
              return_date: item.ReturnDate || item.DateReturned || null,
              reason: item.Reason || product.Reason || '',
              product_code: product.ProductCode || product.SKU || '',
              qty_returned: product.QuantityReturned || product.Quantity || 0,
            });
          });
        } else {
          returnsRecords.push({
            return_id: String(item.ID || item.Id || ''),
            reference: item.Reference || item.OrderReference || '',
            return_date: item.ReturnDate || item.DateReturned || null,
            reason: item.Reason || '',
            product_code: item.ProductCode || item.SKU || '',
            qty_returned: item.QuantityReturned || item.Quantity || 0,
          });
        }
      });
    }

    // Fetch ALL labels from Supabase (paginated)
    const supabase = createClient(ORIGINAL_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!);
    const allLabels: any[] = [];
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('labels')
        .select('label_id, status, previous_uses, current_order_id, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.error('Labels fetch error:', error);
        break;
      }
      if (data && data.length > 0) {
        allLabels.push(...data);
        offset += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }

    return new Response(JSON.stringify({
      asn: asnRecords,
      returns: returnsRecords,
      labels: allLabels,
      stats: {
        asn_count: asnRecords.length,
        returns_count: returnsRecords.length,
        packs_count: allLabels.length,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in fetch-mintsoft-status:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
