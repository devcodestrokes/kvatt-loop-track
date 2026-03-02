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

    console.log(`[resolve-pack-merchant] Resolving merchant for pack: ${packId}`);

    // 1. Find label by packId (case-insensitive)
    const { data: label } = await supabase
      .from('labels')
      .select('id, group_id, merchant_id')
      .ilike('label_id', packId)
      .limit(1)
      .single();

    if (!label) {
      console.log(`[resolve-pack-merchant] Label not found: ${packId}`);
      return new Response(JSON.stringify({ success: false, error: 'Pack not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Get label_group to find the SKU (group_id text field)
    let groupSku: string | null = null;
    let groupMerchantId: string | null = null;

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
        console.log(`[resolve-pack-merchant] Found group SKU: ${groupSku}`);
      }
    }

    // 3. Try direct merchant_id from label or label_group first
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
        console.log(`[resolve-pack-merchant] Direct merchant match: ${m.name}`);
      }
    }

    // 4. If no direct match, search Mintsoft for orders/ASNs with the group SKU
    let mintsoftProductName: string | null = null;

    if (!matchedMerchant && groupSku) {
      console.log(`[resolve-pack-merchant] No direct merchant, searching Mintsoft for SKU: ${groupSku}`);

      try {
        // Try Order search by SKU
        const orderRes = await fetch(
          `https://api.mintsoft.co.uk/api/Order?SKU=${encodeURIComponent(groupSku)}&APIKey=${mintsoftApiKey}`,
          { headers: { 'Accept': 'application/json' } }
        );

        if (orderRes.ok) {
          const orderData = await orderRes.json();
          const orders = orderData?.Results || orderData?.Data || (Array.isArray(orderData) ? orderData : []);

          if (orders.length > 0) {
            const orderId = orders[0]?.ID || orders[0]?.Id;
            if (orderId) {
              const detailRes = await fetch(
                `https://api.mintsoft.co.uk/api/Order/${orderId}?APIKey=${mintsoftApiKey}`,
                { headers: { 'Accept': 'application/json' } }
              );
              if (detailRes.ok) {
                const detail = await detailRes.json();
                const items = detail?.OrderItems || detail?.Items || [];
                const matchItem = items.find((i: any) =>
                  i.SKU === groupSku || i.ProductSKU === groupSku
                );
                if (matchItem) {
                  const pid = matchItem.ProductId || matchItem.ProductID;
                  if (pid) {
                    const prodRes = await fetch(
                      `https://api.mintsoft.co.uk/api/Product/${pid}?APIKey=${mintsoftApiKey}`,
                      { headers: { 'Accept': 'application/json' } }
                    );
                    if (prodRes.ok) {
                      const prod = await prodRes.json();
                      mintsoftProductName = safeStr(prod?.Name) || safeStr(prod?.ProductName) || null;
                    }
                  }
                  if (!mintsoftProductName) {
                    mintsoftProductName = safeStr(matchItem.Name) || safeStr(matchItem.ProductName) || null;
                  }
                }
              }
            }
          }
        }

        // Also try ASN search if no product name yet
        if (!mintsoftProductName) {
          const asnRes = await fetch(
            `https://api.mintsoft.co.uk/api/ASN?SKU=${encodeURIComponent(groupSku)}&APIKey=${mintsoftApiKey}`,
            { headers: { 'Accept': 'application/json' } }
          );
          if (asnRes.ok) {
            const asnData = await asnRes.json();
            const asns = asnData?.Results || asnData?.Data || (Array.isArray(asnData) ? asnData : []);
            if (asns.length > 0) {
              const asnId = asns[0]?.ID || asns[0]?.Id;
              if (asnId) {
                const detailRes = await fetch(
                  `https://api.mintsoft.co.uk/api/ASN/${asnId}?APIKey=${mintsoftApiKey}`,
                  { headers: { 'Accept': 'application/json' } }
                );
                if (detailRes.ok) {
                  const detail = await detailRes.json();
                  const items = detail?.ASNItems || detail?.Items || [];
                  const matchItem = items.find((i: any) =>
                    i.SKU === groupSku || i.ProductSKU === groupSku
                  );
                  if (matchItem) {
                    const pid = matchItem.ProductId || matchItem.ProductID;
                    if (pid) {
                      const prodRes = await fetch(
                        `https://api.mintsoft.co.uk/api/Product/${pid}?APIKey=${mintsoftApiKey}`,
                        { headers: { 'Accept': 'application/json' } }
                      );
                      if (prodRes.ok) {
                        const prod = await prodRes.json();
                        mintsoftProductName = safeStr(prod?.Name) || safeStr(prod?.ProductName) || null;
                      }
                    }
                    if (!mintsoftProductName) {
                      mintsoftProductName = safeStr(matchItem.Name) || safeStr(matchItem.ProductName) || null;
                    }
                  }
                }
              }
            }
          }
        }

        console.log(`[resolve-pack-merchant] Mintsoft product name: ${mintsoftProductName}`);
      } catch (e) {
        console.error('[resolve-pack-merchant] Mintsoft lookup error:', e);
      }

      // 5. Smart-match product name to merchants table
      if (mintsoftProductName) {
        const { data: allMerchants } = await supabase
          .from('merchants')
          .select('name, logo_url, contact_email, return_link, return_link_params, shopify_domain');

        if (allMerchants && allMerchants.length > 0) {
          const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
          const normalizedProduct = normalize(mintsoftProductName);

          // Exact normalized match
          matchedMerchant = allMerchants.find(m => normalize(m.name) === normalizedProduct);

          // Contains match (either direction)
          if (!matchedMerchant) {
            matchedMerchant = allMerchants.find(m =>
              normalizedProduct.includes(normalize(m.name)) ||
              normalize(m.name).includes(normalizedProduct)
            );
          }

          // Word-level matching: at least 1 common word with 3+ chars
          if (!matchedMerchant) {
            const productWords = normalizedProduct.match(/[a-z0-9]{3,}/g) || [];
            matchedMerchant = allMerchants.find(m => {
              const merchantWords = normalize(m.name).match(/[a-z0-9]{3,}/g) || [];
              const common = productWords.filter(w => merchantWords.includes(w));
              return common.length >= 1;
            });
          }

          if (matchedMerchant) {
            console.log(`[resolve-pack-merchant] Smart-matched to merchant: ${matchedMerchant.name}`);
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
    console.error('[resolve-pack-merchant] Error:', msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
