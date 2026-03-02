import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// user_id -> shopify_domain mapping (from CSV data)
const USER_ID_TO_DOMAIN: Record<string, string> = {
  '1': 'kvatt-green-package-demo.myshopify.com',
  '6': 'toast-dev.myshopify.com',
  '7': 'universalworks.myshopify.com',
  '8': 'toast-newdev.myshopify.com',
  '9': 'toast-newdev-us.myshopify.com',
  '10': 'toast-dev-us.myshopify.com',
  '11': 'kvatt-dev.myshopify.com',
  '12': 'toast-uk.myshopify.com',
  '17': 'sirplus.myshopify.com',
  '20': 'smitg-kvatt-demo.myshopify.com',
  '23': 'smit-v2.myshopify.com',
  '24': 'kvatt-test-gb.myshopify.com',
  '28': 'leming-kvatt-demo.myshopify.com',
  '29': 'kapil-kvatt-checkout.myshopify.com',
  '30': '6a86bd.myshopify.com',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch all merchants with return link config
    const { data, error } = await supabase
      .from('merchants')
      .select('name, shopify_domain, return_link, return_link_params, logo_url, contact_email');

    if (error) throw error;

    // Build a lookup: user_id -> merchant config
    const merchantsByDomain = new Map<string, any>();
    for (const m of data || []) {
      merchantsByDomain.set(m.shopify_domain, m);
    }

    // Map user_id -> merchant config for the frontend
    const configByUserId: Record<string, any> = {};
    for (const [userId, domain] of Object.entries(USER_ID_TO_DOMAIN)) {
      const merchant = merchantsByDomain.get(domain);
      if (merchant) {
        configByUserId[userId] = {
          name: merchant.name,
          return_link: merchant.return_link,
          return_link_params: merchant.return_link_params,
          logo_url: merchant.logo_url,
          contact_email: merchant.contact_email,
        };
      }
    }

    return new Response(JSON.stringify({ success: true, configs: configByUserId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
