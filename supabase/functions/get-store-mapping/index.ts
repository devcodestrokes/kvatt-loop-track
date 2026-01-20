import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STORES_API_URL = "https://shopify.kvatt.com/api/get-stores";
const AUTH_TOKEN = "Bearer %^75464tnfsdhndsfbgr54";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching store mapping...');

    // 1. Get distinct user_ids with counts - use limit and group by instead of fetching all rows
    // This is more efficient for large datasets
    const storeCountMap = new Map<string, number>();
    
    // Get unique user_ids first
    const { data: uniqueStores, error: storeError } = await supabase
      .from('imported_orders')
      .select('user_id')
      .not('user_id', 'is', null)
      .limit(1); // Just to check if data exists
    
    if (storeError) {
      console.error('Error checking store data:', storeError);
    }

    // Get count per user_id by querying each unique value
    // First, let's get all possible user_ids (they're limited in number)
    const knownStoreIds = ['6', '7', '9', '12', '17', '20', '24', '26'];
    
    for (const storeId of knownStoreIds) {
      const { count } = await supabase
        .from('imported_orders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', storeId);
      
      if (count && count > 0) {
        storeCountMap.set(storeId, count);
        console.log(`Store ${storeId}: ${count} orders`);
      }
    }
    
    // Also check for any other user_ids we might have missed
    const { data: allUserIds } = await supabase
      .from('imported_orders')
      .select('user_id')
      .not('user_id', 'is', null)
      .limit(100);
    
    const additionalIds = new Set<string>();
    allUserIds?.forEach((order: any) => {
      const id = order.user_id?.toString();
      if (id && !storeCountMap.has(id)) {
        additionalIds.add(id);
      }
    });
    
    for (const storeId of additionalIds) {
      const { count } = await supabase
        .from('imported_orders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', storeId);
      
      if (count && count > 0) {
        storeCountMap.set(storeId, count);
        console.log(`Store ${storeId}: ${count} orders (additional)`);
      }
    }

    console.log(`Found ${storeCountMap.size} unique stores in orders`);

    // 2. Fetch store names from external API
    let storeNames: string[] = [];
    try {
      const response = await fetch(STORES_API_URL, {
        headers: {
          "Authorization": AUTH_TOKEN,
          "Content-Type": "application/json",
          "Accept": "application/json"
        }
      });
      
      const result = await response.json();
      if (result.status === 200 && result.data?.length) {
        storeNames = result.data;
        console.log(`Fetched ${storeNames.length} store names from API`);
      }
    } catch (err) {
      console.error('Error fetching store names:', err);
    }

    // 3. Build store list with order counts, sorted by count
    const stores = Array.from(storeCountMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([storeId, orderCount], index) => {
        // Try to match with store name from API (by index if available)
        const storeName = storeNames[index] 
          ? storeNames[index].replace('.myshopify.com', '')
          : `Store ${storeId}`;
        
        return {
          id: storeId,
          name: storeName,
          orderCount,
        };
      });

    console.log('Store mapping complete:', stores.map(s => `${s.id}=${s.name}`));

    return new Response(
      JSON.stringify({ 
        success: true, 
        stores,
        totalStores: stores.length,
        externalStoreCount: storeNames.length,
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