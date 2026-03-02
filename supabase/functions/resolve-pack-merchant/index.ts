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

async function findProductNameFromMintsoft(groupSku: string, apiKey: string): Promise<string | null> {
  // Strategy 1: Search Product directly by SKU
  try {
    const prodUrl = `https://api.mintsoft.co.uk/api/Product?SKU=${encodeURIComponent(groupSku)}&APIKey=${apiKey}`;
    console.log(`[resolve] Trying Product API...`);
    const prodSearchRes = await fetch(prodUrl, { headers: { 'Accept': 'application/json' } });
    console.log(`[resolve] Product API status: ${prodSearchRes.status}`);
    if (prodSearchRes.ok) {
      const prodData = await prodSearchRes.json();
      const products = prodData?.Results || prodData?.Data || (Array.isArray(prodData) ? prodData : []);
      console.log(`[resolve] Product search results: ${products.length}, keys: ${JSON.stringify(Object.keys(prodData || {}))}`);
      if (products.length > 0) {
        const name = safeStr(products[0]?.Name) || safeStr(products[0]?.ProductName);
        if (name) return name;
      }
    }
  } catch (e) {
    console.error('[resolve] Product search error:', e);
  }

  // Strategy 2: Search OrderItem by SKU
  try {
    const oiRes = await fetch(
      `https://api.mintsoft.co.uk/api/OrderItem?SKU=${encodeURIComponent(groupSku)}&APIKey=${apiKey}`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (oiRes.ok) {
      const oiData = await oiRes.json();
      const items = oiData?.Results || oiData?.Data || (Array.isArray(oiData) ? oiData : []);
      console.log(`[resolve] OrderItem search found ${items.length} results`);
      if (items.length > 0) {
        // Try getting product name from item directly
        let name = safeStr(items[0]?.Name) || safeStr(items[0]?.ProductName);
        if (name) return name;
        // Try fetching product by ID
        const pid = items[0]?.ProductId || items[0]?.ProductID;
        if (pid) {
          const prodRes = await fetch(
            `https://api.mintsoft.co.uk/api/Product/${pid}?APIKey=${apiKey}`,
            { headers: { 'Accept': 'application/json' } }
          );
          if (prodRes.ok) {
            const prod = await prodRes.json();
            name = safeStr(prod?.Name) || safeStr(prod?.ProductName);
            if (name) return name;
          }
        }
      }
    }
  } catch (e) {
    console.error('[resolve] OrderItem search error:', e);
  }

  // Strategy 3: Search Order by SKU  
  try {
    const orderRes = await fetch(
      `https://api.mintsoft.co.uk/api/Order?SKU=${encodeURIComponent(groupSku)}&APIKey=${apiKey}`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (orderRes.ok) {
      const orderData = await orderRes.json();
      const orders = orderData?.Results || orderData?.Data || (Array.isArray(orderData) ? orderData : []);
      console.log(`[resolve] Order search by SKU found ${orders.length} results`);
      if (orders.length > 0) {
        const orderId = orders[0]?.ID || orders[0]?.Id;
        if (orderId) {
          const detailRes = await fetch(
            `https://api.mintsoft.co.uk/api/Order/${orderId}?APIKey=${apiKey}`,
            { headers: { 'Accept': 'application/json' } }
          );
          if (detailRes.ok) {
            const detail = await detailRes.json();
            const items = detail?.OrderItems || detail?.Items || [];
            const matchItem = items.find((i: any) => i.SKU === groupSku || i.ProductSKU === groupSku);
            if (matchItem) {
              const name = safeStr(matchItem.Name) || safeStr(matchItem.ProductName);
              if (name) return name;
              const pid = matchItem.ProductId || matchItem.ProductID;
              if (pid) {
                const prodRes = await fetch(
                  `https://api.mintsoft.co.uk/api/Product/${pid}?APIKey=${apiKey}`,
                  { headers: { 'Accept': 'application/json' } }
                );
                if (prodRes.ok) {
                  const prod = await prodRes.json();
                  return safeStr(prod?.Name) || safeStr(prod?.ProductName) || null;
                }
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('[resolve] Order search error:', e);
  }

  // Strategy 4: Search ASN by SKU
  try {
    const asnRes = await fetch(
      `https://api.mintsoft.co.uk/api/ASN?SKU=${encodeURIComponent(groupSku)}&APIKey=${apiKey}`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (asnRes.ok) {
      const asnData = await asnRes.json();
      const asns = asnData?.Results || asnData?.Data || (Array.isArray(asnData) ? asnData : []);
      console.log(`[resolve] ASN search found ${asns.length} results`);
      if (asns.length > 0) {
        const asnId = asns[0]?.ID || asns[0]?.Id;
        if (asnId) {
          const detailRes = await fetch(
            `https://api.mintsoft.co.uk/api/ASN/${asnId}?APIKey=${apiKey}`,
            { headers: { 'Accept': 'application/json' } }
          );
          if (detailRes.ok) {
            const detail = await detailRes.json();
            const items = detail?.ASNItems || detail?.Items || [];
            const matchItem = items.find((i: any) => i.SKU === groupSku || i.ProductSKU === groupSku);
            if (matchItem) {
              const name = safeStr(matchItem.Name) || safeStr(matchItem.ProductName);
              if (name) return name;
              const pid = matchItem.ProductId || matchItem.ProductID;
              if (pid) {
                const prodRes = await fetch(
                  `https://api.mintsoft.co.uk/api/Product/${pid}?APIKey=${apiKey}`,
                  { headers: { 'Accept': 'application/json' } }
                );
                if (prodRes.ok) {
                  const prod = await prodRes.json();
                  return safeStr(prod?.Name) || safeStr(prod?.ProductName) || null;
                }
              }
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

    // 4. Try smart-matching merchant_name from label_group directly
    if (!matchedMerchant && groupMerchantName) {
      const { data: allMerchants } = await supabase
        .from('merchants')
        .select('name, logo_url, contact_email, return_link, return_link_params, shopify_domain');

      if (allMerchants) {
        matchedMerchant = smartMatchMerchant(groupMerchantName, allMerchants);
        if (matchedMerchant) {
          console.log(`[resolve] Matched via group merchant_name "${groupMerchantName}" -> ${matchedMerchant.name}`);
        }
      }
    }

    // 5. Search Mintsoft for product name and smart-match
    let mintsoftProductName: string | null = null;

    if (!matchedMerchant && groupSku) {
      console.log(`[resolve] Searching Mintsoft for SKU: ${groupSku}`);
      mintsoftProductName = await findProductNameFromMintsoft(groupSku, mintsoftApiKey);
      console.log(`[resolve] Mintsoft product name: ${mintsoftProductName}`);

      if (mintsoftProductName) {
        const { data: allMerchants } = await supabase
          .from('merchants')
          .select('name, logo_url, contact_email, return_link, return_link_params, shopify_domain');

        if (allMerchants) {
          matchedMerchant = smartMatchMerchant(mintsoftProductName, allMerchants);
          if (matchedMerchant) {
            console.log(`[resolve] Smart-matched product "${mintsoftProductName}" -> ${matchedMerchant.name}`);
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

function smartMatchMerchant(productName: string, merchants: any[]): any | null {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedProduct = normalize(productName);

  // Exact normalized match
  let match = merchants.find(m => normalize(m.name) === normalizedProduct);
  if (match) return match;

  // Contains match (either direction)
  match = merchants.find(m =>
    normalizedProduct.includes(normalize(m.name)) ||
    normalize(m.name).includes(normalizedProduct)
  );
  if (match) return match;

  // Word-level matching: at least 1 common word with 3+ chars
  const productWords = normalizedProduct.match(/[a-z0-9]{3,}/g) || [];
  match = merchants.find(m => {
    const merchantWords = normalize(m.name).match(/[a-z0-9]{3,}/g) || [];
    return productWords.filter(w => merchantWords.includes(w)).length >= 1;
  });
  return match || null;
}
