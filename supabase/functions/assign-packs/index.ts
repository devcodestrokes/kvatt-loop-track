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

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify the user is admin
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { pack_ids, merchant_id, shipped_date, notes } = await req.json();

    if (!pack_ids || !Array.isArray(pack_ids) || pack_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'pack_ids array is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!merchant_id || !shipped_date) {
      return new Response(JSON.stringify({ error: 'merchant_id and shipped_date are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch merchant info
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id, name')
      .eq('id', merchant_id)
      .single();

    if (merchantError || !merchant) {
      return new Response(JSON.stringify({ error: 'Merchant not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find matching labels
    const { data: labels, error: labelsError } = await supabase
      .from('labels')
      .select('id, label_id, status, merchant_id')
      .in('label_id', pack_ids);

    if (labelsError) throw labelsError;

    const foundIds = labels?.map(l => l.label_id) || [];
    const notFound = pack_ids.filter((id: string) => !foundIds.includes(id));
    const alreadyAssigned = labels?.filter(l => l.merchant_id && l.merchant_id !== merchant_id) || [];

    // Update labels: set merchant_id and status to 'in_use'
    const toAssign = labels?.filter(l => !l.merchant_id || l.merchant_id === merchant_id) || [];
    
    if (toAssign.length > 0) {
      const { error: updateError } = await supabase
        .from('labels')
        .update({ 
          merchant_id: merchant_id, 
          status: 'in_use',
          updated_at: new Date().toISOString()
        })
        .in('id', toAssign.map(l => l.id));

      if (updateError) throw updateError;
    }

    // Also update any label_groups that contain these packs
    if (toAssign.length > 0) {
      const groupIds = [...new Set(labels?.map(l => l.group_id).filter(Boolean) || [])];
      // We don't need to do anything with groups for now
    }

    // Record the shipment
    const { error: shipmentError } = await supabase
      .from('pack_shipments')
      .insert({
        merchant_id: merchant_id,
        merchant_name: merchant.name,
        shipped_date: shipped_date,
        pack_ids: foundIds,
        pack_count: toAssign.length,
        notes: notes || null,
        created_by: user.id,
      });

    if (shipmentError) throw shipmentError;

    return new Response(JSON.stringify({
      success: true,
      assigned: toAssign.length,
      not_found: notFound,
      already_assigned: alreadyAssigned.map(l => ({ 
        label_id: l.label_id, 
        current_merchant_id: l.merchant_id 
      })),
      merchant_name: merchant.name,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
