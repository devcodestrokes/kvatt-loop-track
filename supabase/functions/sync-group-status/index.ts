import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const MINTSOFT_API_KEY = Deno.env.get('MINTSOFT_API_KEY');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (!MINTSOFT_API_KEY) {
    return new Response(JSON.stringify({ error: 'MINTSOFT_API_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch all label_groups from DB
    const { data: groups, error: groupsError } = await supabase
      .from('label_groups')
      .select('id, group_id, status, mintsoft_asn_status, mintsoft_asn_id');

    if (groupsError) throw new Error(`Failed to fetch label_groups: ${groupsError.message}`);
    if (!groups || groups.length === 0) {
      return new Response(JSON.stringify({ message: 'No groups to sync', updated: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build a lookup map: group_id -> group row
    const groupMap = new Map<string, typeof groups[0]>();
    for (const g of groups) {
      groupMap.set(g.group_id.toUpperCase(), g);
    }

    console.log(`Found ${groups.length} groups to check against Mintsoft ASN`);

    // 2. Fetch ASN list from Mintsoft (includes items)
    const asnListRes = await fetch(
      'https://api.mintsoft.co.uk/api/ASN/List?ClientId=82&IncludeItems=true',
      { headers: { 'Accept': 'application/json', 'ms-apikey': MINTSOFT_API_KEY } }
    );
    const asnRaw = await asnListRes.json();
    const asnData = Array.isArray(asnRaw) ? asnRaw : (asnRaw?.Results || asnRaw?.Data || []);

    console.log(`Fetched ${asnData.length} ASN records from Mintsoft`);

    // 3. For each ASN, fetch detail to get items, then match SKU to group_id
    const updates: { id: string; mintsoft_asn_status: string; mintsoft_asn_id: number; merchant_name: string | null }[] = [];
    const processedGroupIds = new Set<string>();

    for (const asn of asnData) {
      const asnId = asn.ID || asn.Id;
      if (!asnId) continue;

      // Get ASN status
      const asnStatus = asn.ASNStatus?.Name || asn.Status?.Name || asn.Status || 'Unknown';

      // Fetch individual ASN for items
      let items: any[] = [];
      try {
        const detailRes = await fetch(`https://api.mintsoft.co.uk/api/ASN/${asnId}`, {
          headers: { 'Accept': 'application/json', 'ms-apikey': MINTSOFT_API_KEY },
        });
        const detailData = await detailRes.json();
        items = detailData?.Items || detailData?.ASNItems || [];
        if (!Array.isArray(items)) items = [];
      } catch (e) {
        console.error(`Failed to fetch ASN ${asnId} details:`, e);
        continue;
      }

      // Extract merchant name from ASN item names (Toast, UW, Sirplus, etc.)
      let merchantName: string | null = null;
      for (const item of items) {
        const name = item.ProductName || item.Name || item.Description || '';
        if (name) {
          merchantName = name;
          break;
        }
      }

      // Match SKU to group_id
      // SKU format examples: "GROUP PACK KBM4", "GROUP PACK 1000"
      // The group_id is the part after "GROUP PACK " or the entire SKU
      for (const item of items) {
        const sku = (item.ProductCode || item.SKU || '').toUpperCase().trim();
        if (!sku) continue;

        // Try direct match first
        if (groupMap.has(sku) && !processedGroupIds.has(sku)) {
          const group = groupMap.get(sku)!;
          updates.push({
            id: group.id,
            mintsoft_asn_status: asnStatus,
            mintsoft_asn_id: asnId,
            merchant_name: merchantName,
          });
          processedGroupIds.add(sku);
          continue;
        }

        // Try extracting group ID from "GROUP PACK {groupId}" pattern
        const groupPackMatch = sku.match(/^GROUP\s+PACK\s+(.+)$/i);
        if (groupPackMatch) {
          const extractedId = groupPackMatch[1].trim().toUpperCase();
          if (groupMap.has(extractedId) && !processedGroupIds.has(extractedId)) {
            const group = groupMap.get(extractedId)!;
            updates.push({
              id: group.id,
              mintsoft_asn_status: asnStatus,
              mintsoft_asn_id: asnId,
              merchant_name: merchantName,
            });
            processedGroupIds.add(extractedId);
          }
        }

        // Also check ASN comments for group IDs
        const comments = (asn.Comments || '').toUpperCase().trim();
        if (comments && groupMap.has(comments) && !processedGroupIds.has(comments)) {
          const group = groupMap.get(comments)!;
          updates.push({
            id: group.id,
            mintsoft_asn_status: asnStatus,
            mintsoft_asn_id: asnId,
            merchant_name: merchantName,
          });
          processedGroupIds.add(comments);
        }
      }

      // Also check comments at ASN level for group IDs (e.g., "KBM3c100003")
      const asnComments = (asn.Comments || '').toUpperCase().trim();
      if (asnComments && groupMap.has(asnComments) && !processedGroupIds.has(asnComments)) {
        const group = groupMap.get(asnComments)!;
        updates.push({
          id: group.id,
          mintsoft_asn_status: asnStatus,
          mintsoft_asn_id: asnId,
          merchant_name: merchantName,
        });
        processedGroupIds.add(asnComments);
      }
    }

    console.log(`Found ${updates.length} groups to update from ASN data`);

    // 4. Map Mintsoft ASN status to label_groups status
    const mapToGroupStatus = (asnStatus: string): string => {
      const s = asnStatus.toUpperCase();
      switch (s) {
        case 'NEW':
        case 'AWAITNGAPPROVAL':
          return 'pending';
        case 'AWAITINGDELIVERY':
        case 'AWAITINGDELIVERY_LATE':
        case 'SHIPPED':
          return 'shipped';
        case 'DELIVERED':
        case 'BOOKEDIN':
        case 'BOOKEDIN-PARTIAL':
        case 'PARTIALLYBOOKED':
        case 'AWAITINGPUTAWAY':
        case 'ROBOTPUTAWAY':
          return 'delivered';
        case 'COMPLETE':
          return 'completed';
        case 'DISCREPANCY':
          return 'discrepancy';
        default:
          return 'pending';
      }
    };

    // 5. Update label_groups in DB
    let updatedCount = 0;
    for (const update of updates) {
      const mappedStatus = mapToGroupStatus(update.mintsoft_asn_status);
      const { error } = await supabase
        .from('label_groups')
        .update({
          mintsoft_asn_status: update.mintsoft_asn_status,
          mintsoft_asn_id: update.mintsoft_asn_id,
          merchant_name: update.merchant_name,
          status: mappedStatus,
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', update.id);

      if (error) {
        console.error(`Failed to update group ${update.id}:`, error);
      } else {
        updatedCount++;
        console.log(`Updated group ${update.id}: ASN status=${update.mintsoft_asn_status} -> status=${mappedStatus}`);
      }
    }

    return new Response(JSON.stringify({
      message: `Synced ${updatedCount} groups from ${asnData.length} ASN records`,
      updated: updatedCount,
      total_asn: asnData.length,
      total_groups: groups.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in sync-group-status:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
