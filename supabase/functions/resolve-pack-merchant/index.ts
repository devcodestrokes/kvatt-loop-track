import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const safeStr = (val: unknown): string => {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null && 'Name' in val) return String((val as any).Name);
  return String(val);
};

const CLIENT_ID = 82;

async function findProductNameFromMintsoft(groupSku: string, apiKey: string): Promise<string | null> {
  const headers = { 'Accept': 'application/json', 'ms-apikey': apiKey };

  // Strategy 1: List orders and find matching SKU in items
  try {
    console.log(`[resolve] Fetching orders list...`);
    const orderRes = await fetch(
      `https://api.mintsoft.co.uk/api/Order/List?ClientId=${CLIENT_ID}`,
      { headers }
    );
    if (orderRes.ok) {
      const orderRaw = await orderRes.json();
      const orders = Array.isArray(orderRaw) ? orderRaw : (orderRaw?.Results || orderRaw?.Data || []);
      console.log(`[resolve] Got ${orders.length} orders`);

      for (const order of orders) {
        const orderId = order?.ID || order?.Id;
        if (!orderId) continue;

        const detailRes = await fetch(
          `https://api.mintsoft.co.uk/api/Order/${orderId}`,
          { headers }
        );
        if (!detailRes.ok) continue;

        const detail = await detailRes.json();
        const items = detail?.OrderItems || detail?.Items || [];
        const matchItem = items.find((i: any) =>
          i.SKU === groupSku || i.ProductSKU === groupSku
        );

        if (matchItem) {
          console.log(`[resolve] Found SKU match in order ${orderId}`);
          let name = safeStr(matchItem.Name) || safeStr(matchItem.ProductName);
          if (name) return name;

          const pid = matchItem.ProductId || matchItem.ProductID;
          if (pid) {
            const prodRes = await fetch(
              `https://api.mintsoft.co.uk/api/Product/${pid}`,
              { headers }
            );
            if (prodRes.ok) {
              const prod = await prodRes.json();
              name = safeStr(prod?.Name) || safeStr(prod?.ProductName);
              if (name) return name;
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('[resolve] Order search error:', e);
  }

  // Strategy 2: Check ASNs
  try {
    console.log(`[resolve] Fetching ASN list...`);
    const asnRes = await fetch(
      `https://api.mintsoft.co.uk/api/ASN/List?ClientId=${CLIENT_ID}&IncludeItems=true`,
      { headers }
    );
    if (asnRes.ok) {
      const asnRaw = await asnRes.json();
      const asns = Array.isArray(asnRaw) ? asnRaw : (asnRaw?.Results || asnRaw?.Data || []);
      console.log(`[resolve] Got ${asns.length} ASNs`);

      for (const asn of asns) {
        const asnId = asn?.ID || asn?.Id;
        if (!asnId) continue;

        const detailRes = await fetch(
          `https://api.mintsoft.co.uk/api/ASN/${asnId}`,
          { headers }
        );
        if (!detailRes.ok) continue;

        const detail = await detailRes.json();
        const items = detail?.ASNItems || detail?.Items || [];
        const matchItem = items.find((i: any) =>
          i.SKU === groupSku || i.ProductSKU === groupSku
        );

        if (matchItem) {
          console.log(`[resolve] Found SKU match in ASN ${asnId}`);
          let name = safeStr(matchItem.Name) || safeStr(matchItem.ProductName);
          if (name) return name;

          const pid = matchItem.ProductId || matchItem.ProductID;
          if (pid) {
            const prodRes = await fetch(
              `https://api.mintsoft.co.uk/api/Product/${pid}`,
              { headers }
            );
            if (prodRes.ok) {
              const prod = await prodRes.json();
              name = safeStr(prod?.Name) || safeStr(prod?.ProductName);
              if (name) return name;
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('[resolve] ASN search error:', e);
  }

  return null;
}

function smartMatchMerchant(productName: string, merchants: any[]): any | null {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedProduct = normalize(productName);

  let match = merchants.find(m => normalize(m.name) === normalizedProduct);
  if (match) return match;

  match = merchants.find(m =>
    normalizedProduct.includes(normalize(m.name)) ||
    normalize(m.name).includes(normalizedProduct)
  );
  if (match) return match;

  const productWords = normalizedProduct.match(/[a-z0-9]{3,}/g) || [];
  match = merchants.find(m => {
    const merchantWords = normalize(m.name).match(/[a-z0-9]{3,}/g) || [];
    return productWords.filter(w => merchantWords.includes(w)).length >= 1;
  });
  return match || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { packId } = await req.json();
    if (!packId || typeof packId !== 'string') {
      return new Response(JSON.stringify({ success: false, error: 'packId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const mintsoftApiKey = Deno.env.get('MINTSOFT_API_KEY')!;

    console.log(`[resolve] Resolving merchant for pack: ${packId}`);

    // 1. Find label
    const { data: label } = await supabase
      .from('labels')
      .select('id, group_id, merchant_id')
      .ilike('label_id', packId)
      .limit(1)
      .single();

    if (!label) {
      return new Response(JSON.stringify({ success: false, error: 'Pack not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Get label_group
    let groupSku: string | null = null;
    let groupMerchantId: string | null = null;
    let groupMerchantName: string | null = null;

    if (label.group_id) {
      const { data: group } = await supabase
        .from('label_groups')
        .select('group_id, merchant_id, merchant_name')
        .eq('id', label.group_id)
        .limit(1)
        .single();

      if (group) {
        groupSku = group.group_id;
        groupMerchantId = group.merchant_id;
        groupMerchantName = group.merchant_name;
        console.log(`[resolve] Group SKU: ${groupSku}, merchant_name: ${groupMerchantName}`);
      }
    }

    // 3. Direct merchant_id lookup
    let matchedMerchant: any = null;
    const merchantId = label.merchant_id || groupMerchantId;

    if (merchantId) {
      const { data: m } = await supabase
        .from('merchants')
        .select('name, logo_url, contact_email, return_link, return_link_params, shopify_domain')
        .eq('id', merchantId)
        .limit(1)
        .single();

      if (m) {
        matchedMerchant = m;
        console.log(`[resolve] Direct merchant match: ${m.name}`);
      }
    }

    // 4. Try smart-matching merchant_name from label_group
    if (!matchedMerchant && groupMerchantName) {
      const { data: allMerchants } = await supabase
        .from('merchants')
        .select('name, logo_url, contact_email, return_link, return_link_params, shopify_domain');

      if (allMerchants) {
        matchedMerchant = smartMatchMerchant(groupMerchantName, allMerchants);
        if (matchedMerchant) {
          console.log(`[resolve] Matched via group name -> ${matchedMerchant.name}`);
        }
      }
    }

    // 5. Search Mintsoft for product name and smart-match
    let mintsoftProductName: string | null = null;

    if (!matchedMerchant && groupSku) {
      mintsoftProductName = await findProductNameFromMintsoft(groupSku, mintsoftApiKey);
      console.log(`[resolve] Mintsoft product name: ${mintsoftProductName}`);

      if (mintsoftProductName) {
        const { data: allMerchants } = await supabase
          .from('merchants')
          .select('id, name, logo_url, contact_email, return_link, return_link_params, shopify_domain');

        if (allMerchants) {
          matchedMerchant = smartMatchMerchant(mintsoftProductName, allMerchants);
          if (matchedMerchant) {
            console.log(`[resolve] Smart-matched "${mintsoftProductName}" -> ${matchedMerchant.name}`);
            // Cache merchant_id on label_group so future lookups are instant
            if (label.group_id && matchedMerchant.id) {
              await supabase
                .from('label_groups')
                .update({ merchant_id: matchedMerchant.id, merchant_name: matchedMerchant.name })
                .eq('id', label.group_id);
              console.log(`[resolve] Cached merchant_id on label_group for instant future lookups`);
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      merchant: matchedMerchant ? {
        name: matchedMerchant.name,
        logo_url: matchedMerchant.logo_url,
        contact_email: matchedMerchant.contact_email,
        return_link: matchedMerchant.return_link,
        return_link_params: matchedMerchant.return_link_params,
      } : null,
      mintsoft_product_name: mintsoftProductName,
      group_sku: groupSku,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[resolve] Error:', msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
