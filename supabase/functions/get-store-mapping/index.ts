import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Complete store mapping from CSV data
// CSV id column maps to user_id in imported_orders table
// Format: user_id -> { name: store_name, domain: domain, currency: currency }
const STORE_MAPPINGS: Record<string, { name: string; domain: string; currency: string }> = {
  '1': { name: 'kvatt-green-package-demo', domain: 'kvatt-green-package-demo.myshopify.com', currency: 'GBP' },
  '5': { name: 'Quickstart (ba771359)', domain: 'quickstart-ba771359.myshopify.com', currency: 'GBP' },
  '6': { name: 'TOAST DEV', domain: 'dev.toa.st', currency: 'GBP' },
  '7': { name: 'Universal Works', domain: 'universalworks.com', currency: 'GBP' },
  '8': { name: 'TOAST NEW DEV', domain: 'toast-newdev.myshopify.com', currency: 'GBP' },
  '9': { name: 'TOAST NEW DEV USD', domain: 'toast-newdev-us.myshopify.com', currency: 'USD' },
  '10': { name: 'TOAST DEV USD', domain: 'toast-dev-us.myshopify.com', currency: 'USD' },
  '11': { name: 'KVATT DEV', domain: 'kvatt-dev.myshopify.com', currency: 'GBP' },
  '12': { name: 'TOAST', domain: 'www.toa.st', currency: 'GBP' },
  '13': { name: 'Zapply EU', domain: 'zapply.eu', currency: 'EUR' },
  '14': { name: 'Cocopup™ Wipes', domain: 'cocopupwipes.com', currency: 'USD' },
  '15': { name: 'Anerkennen Fashion', domain: 'anerkennen.com', currency: 'INR' },
  '16': { name: 'SPARTAGIFTSHOP USA', domain: 'auibrn-ad.myshopify.com', currency: 'USD' },
  '17': { name: 'SIRPLUS', domain: 'sirplus.co.uk', currency: 'GBP' },
  '20': { name: 'Kvatt - Demo Store', domain: 'smitg-kvatt-demo.myshopify.com', currency: 'GBP' },
  '23': { name: 'smit-v2', domain: 'smit-v2.myshopify.com', currency: 'INR' },
  '24': { name: 'partht-kvatt-demo', domain: 'partht-kvatt-demo.myshopify.com', currency: 'GBP' },
  '25': { name: 'vrutankt.devesha', domain: 'vrutankt-devesha.myshopify.com', currency: 'INR' },
  '26': { name: 'Plus Test Store 1', domain: 'bdnee0-s0.myshopify.com', currency: 'USD' },
  '27': { name: 'Kvatt | One Tap Returns', domain: 'kvatt.com', currency: 'GBP' },
  '28': { name: 'leming-kvatt-demo', domain: 'leming-kvatt-demo.myshopify.com', currency: 'GBP' },
  '29': { name: 'Kapil Kvatt Checkout', domain: 'kapil-kvatt-checkout.myshopify.com', currency: 'USD' },
  '30': { name: 'SCALES SwimSkins', domain: 'shop.scales-swimskins.com', currency: 'CHF' },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching store mapping using static CSV data...');

    // Get all unique user_ids with their order counts using SQL aggregation
    const { data: storeStats, error: statsError } = await supabase.rpc('get_store_stats', {
      store_filter: null,
      date_from: null,
      date_to: null
    });

    if (statsError) {
      console.error('Error fetching store stats:', statsError);
      throw new Error('Failed to fetch store statistics');
    }

    // Build store list from RPC results with proper name mapping from CSV
    const stores = (storeStats || []).map((store: any) => {
      const storeId = store.store_id?.toString() || '';
      const mapping = STORE_MAPPINGS[storeId];
      
      return {
        id: storeId,
        name: mapping?.name || `Store ${storeId}`,
        domain: mapping?.domain || `unknown-${storeId}`,
        currency: mapping?.currency || 'GBP',
        orderCount: Number(store.total_orders) || 0,
      };
    });

    // Sort by order count descending
    stores.sort((a: any, b: any) => b.orderCount - a.orderCount);

    console.log('Store mapping complete (CSV-based):', stores.map((s: any) => `${s.id}=${s.name} (${s.orderCount})`).join(', '));

    return new Response(
      JSON.stringify({ 
        success: true, 
        stores,
        totalStores: stores.length,
        mappingSource: 'csv_static',
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
