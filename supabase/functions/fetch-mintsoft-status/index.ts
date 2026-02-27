import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MINTSOFT_API_KEY = Deno.env.get('MINTSOFT_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
      fetch('https://api.mintsoft.co.uk/api/Return/List?ClientId=82', {
        headers: { 'Accept': 'application/json', 'ms-apikey': MINTSOFT_API_KEY! },
      }),
    ]);

    const asnRaw = await asnResponse.json();
    const returnsRaw = await returnsResponse.json();

    console.log('RAW ASN keys:', Object.keys(asnRaw?.Results?.[0] || asnRaw?.[0] || asnRaw?.Data?.[0] || {}).join(', '));
    console.log('RAW Returns response:', JSON.stringify(returnsRaw).substring(0, 2000));
    console.log('Returns status:', returnsResponse.status, returnsResponse.statusText);

    const asnData = Array.isArray(asnRaw) ? asnRaw : (asnRaw?.Results || asnRaw?.Data || asnRaw?.data || []);
    const returnsData = Array.isArray(returnsRaw) ? returnsRaw : (returnsRaw?.Results || returnsRaw?.Data || returnsRaw?.data || []);

    // Parse ASN records - fetch items individually for each ASN
    const asnRecords: any[] = [];
    if (Array.isArray(asnData)) {
      // Fetch items for each ASN in parallel
      const itemFetches = asnData.map(async (asn: any) => {
        const asnId = asn.ID || asn.Id;
        let items: any[] = [];
        
        if (asnId) {
          try {
            const itemRes = await fetch(`https://api.mintsoft.co.uk/api/ASN/${asnId}`, {
              headers: { 'Accept': 'application/json', 'ms-apikey': MINTSOFT_API_KEY! },
            });
            const itemData = await itemRes.json();
            const rawItems = itemData?.Items || itemData?.ASNItems || [];
            if (Array.isArray(rawItems)) {
              items = rawItems.map((item: any) => ({
                sku: item.ProductCode || item.SKU || null,
                name: item.ProductName || item.Name || item.Description || null,
                expected_quantity: item.Quantity || item.QuantityExpected || 0,
                quantity_received: item.QuantityReceived || item.ReceivedQuantity || 0,
                quantity_booked: item.QuantityBooked || item.BookedQuantity || 0,
                comments: item.Comments || item.Notes || null,
                last_updated: item.LastUpdated || null,
                last_updated_by_user: item.LastUpdatedByUser || null,
              }));
            }
          } catch (e) {
            console.error(`Failed to fetch items for ASN ${asnId}:`, e);
          }
        }

        return {
          id: asnId || null,
          client: asn.CLIENTSHORTNAME || asn.ClientShortName || asn.Client?.Name || asn.ClientName || null,
          asn_status: asn.ASNStatus?.Name || asn.Status?.Name || asn.Status || 'Unknown',
          warehouse: asn.Warehouse?.Name || asn.WarehouseName || (asn.WarehouseId ? `Warehouse ${asn.WarehouseId}` : null),
          supplier: asn.Supplier || asn.ProductSupplier?.Name || asn.SupplierName || null,
          po_reference: asn.POReference || asn.poReference || asn.Reference || 'N/A',
          estimated_delivery: asn.EstimatedDelivery || asn.ExpectedDate || null,
          comments: asn.Comments || asn.Notes || null,
          goods_in_type: asn.GoodsInType || null,
          quantity: asn.Quantity || asn.TotalQuantity || null,
          last_updated: asn.LastUpdated || asn.UpdatedOn || null,
          last_updated_by_user: asn.LastUpdatedByUser || asn.UpdatedBy || null,
          booked_in_date: asn.BookedInDate || asn.ReceivedDate || null,
          items,
        };
      });

      const results = await Promise.all(itemFetches);
      asnRecords.push(...results);
    }

    // Parse Returns records - fetch items individually for each return
    const returnsRecords: any[] = [];
    if (Array.isArray(returnsData)) {
      const returnFetches = returnsData.map(async (item: any) => {
        const returnId = item.ID || item.Id;
        let returnItems: any[] = [];

        if (returnId) {
          try {
            const detailRes = await fetch(`https://api.mintsoft.co.uk/api/Return/${returnId}`, {
              headers: { 'Accept': 'application/json', 'ms-apikey': MINTSOFT_API_KEY! },
            });
            const detailData = await detailRes.json();
            const rawItems = detailData?.ReturnItems || detailData?.Items || [];
            if (Array.isArray(rawItems)) {
              returnItems = rawItems.map((ri: any) => ({
                product_code: ri.ProductCode || ri.SKU || '',
                product_name: ri.ProductName || ri.Name || '',
                quantity: ri.Quantity || ri.QuantityReturned || 0,
                reason: ri.Reason || ri.ReturnReason || '',
                comments: ri.Comments || '',
                expiry_date: ri.ExpiryDate || null,
                batch: ri.BatchNumber || ri.Batch || '',
                serial: ri.SerialNumber || ri.Serial || '',
                last_updated: ri.LastUpdated || null,
                last_updated_by_user: ri.LastUpdatedByUser || null,
              }));
            }
          } catch (e) {
            console.error(`Failed to fetch items for Return ${returnId}:`, e);
          }
        }

        return {
          return_id: String(returnId || ''),
          reference: item.Reference || '',
          order_number: item.OrderNumber || '',
          client: item.ClientShortName || item.Client || 'Kvatt',
          return_type: item.OrderNumber === 'ExternalReturn' ? 'External Return' : (item.ReturnType || 'Return'),
          confirmed: item.Confirmed || false,
          refunded: item.Refunded || false,
          exchanged: item.Exchanged || false,
          invoiced: item.Invoiced || false,
          last_updated: item.LastUpdated || null,
          last_updated_by_user: item.LastUpdatedByUser || null,
          return_items: returnItems,
        };
      });

      const results = await Promise.all(returnFetches);
      returnsRecords.push(...results);
    }

    // Fetch ALL labels from Supabase (paginated)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
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
