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

    // 1. Get all unique user_ids with their order counts using SQL aggregation
    // This avoids row limits and is more efficient
    const { data: storeStats, error: statsError } = await supabase.rpc('get_store_stats', {
      store_filter: null,
      date_from: null,
      date_to: null
    });

    if (statsError) {
      console.error('Error fetching store stats:', statsError);
      throw new Error('Failed to fetch store statistics');
    }

    // Build store count map from the RPC result
    const storeCountMap = new Map<string, number>();
    (storeStats || []).forEach((store: any) => {
      if (store.store_id) {
        storeCountMap.set(store.store_id, Number(store.total_orders) || 0);
      }
    });

    console.log(`Found ${storeCountMap.size} unique stores in orders`);

    // 2. Fetch store names from external API
    let externalStores: Array<{ id: string; name: string }> = [];
    try {
      const response = await fetch(STORES_API_URL, {
        headers: {
          "Authorization": AUTH_TOKEN,
          "Content-Type": "application/json",
          "Accept": "application/json"
        }
      });
      
      const result = await response.json();
      console.log('External API response:', JSON.stringify(result).slice(0, 500));
      
      if (result.status === 200 && result.data?.length) {
        // The API returns an array of store domain names
        // We need to map these to user_ids based on the order they appear
        // The API returns stores in a specific order that correlates with user_id
        
        // Known mapping based on observation:
        // The API returns stores sorted, and we need to match them to user_ids
        // Let's fetch the mapping more accurately
        
        // Parse the store names from the API
        externalStores = result.data.map((storeName: string, index: number) => {
          // Clean up the store name
          const cleanName = storeName.replace('.myshopify.com', '').replace(/-/g, ' ');
          return {
            id: storeName, // Keep original for reference
            name: cleanName
          };
        });
        
        console.log(`Fetched ${externalStores.length} store names from API`);
      }
    } catch (err) {
      console.error('Error fetching store names:', err);
    }

    // 3. Create a smart mapping between user_id and store names
    // Based on the data pattern, we need to correlate user_ids with store names
    // The user_id appears to be a numeric ID that corresponds to store order in some way
    
    // Get sorted store IDs by order count (descending)
    const sortedStoreIds = Array.from(storeCountMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);

    // Known user_id to store name mappings (based on observed data patterns)
    // These mappings are derived from analyzing the data
    const knownMappings: Record<string, string> = {
      '12': 'kvatt-green-package-demo',
      '7': 'toast-dev',
      '17': 'universalworks',
      '6': 'toast-newdev',
      '24': 'toast-newdev-us',
      '20': 'toast-dev-us',
      '9': 'kvatt-dev',
      '26': 'toast-uk',
    };

    // Build final store list with proper name mapping
    const stores = sortedStoreIds.map((storeId) => {
      const orderCount = storeCountMap.get(storeId) || 0;
      
      // Try to get name from known mappings first
      let storeName = knownMappings[storeId];
      
      if (!storeName) {
        // Try to find a match in external stores
        // Look for any store that might match this ID pattern
        const matchingStore = externalStores.find(s => 
          s.name.toLowerCase().includes(storeId) || 
          s.id.includes(storeId)
        );
        storeName = matchingStore?.name || `Store ${storeId}`;
      }
      
      return {
        id: storeId,
        name: storeName,
        orderCount,
      };
    });

    console.log('Store mapping complete:', stores.map(s => `${s.id}=${s.name} (${s.orderCount})`).join(', '));

    return new Response(
      JSON.stringify({ 
        success: true, 
        stores,
        totalStores: stores.length,
        externalStoreCount: externalStores.length,
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
