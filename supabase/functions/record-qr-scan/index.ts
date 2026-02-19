import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { packId } = await req.json();

    if (!packId || typeof packId !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'packId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[record-qr-scan] Recording scan for pack: ${packId}`);

    // Find the label by label_id
    const { data: label, error: labelError } = await supabase
      .from('labels')
      .select('id, merchant_id, previous_uses')
      .eq('label_id', packId)
      .limit(1)
      .single();

    if (labelError || !label) {
      console.log(`[record-qr-scan] Label not found: ${packId}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Pack not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert scan event
    const { error: scanError } = await supabase
      .from('scan_events')
      .insert({
        label_id: label.id,
        merchant_id: label.merchant_id,
        event_type: 'qr_scan',
        location: 'returns_portal',
      });

    if (scanError) {
      console.error('[record-qr-scan] Error inserting scan event:', scanError.message);
      throw scanError;
    }

    // Increment previous_uses on the label
    const { error: updateError } = await supabase
      .from('labels')
      .update({ previous_uses: (label.previous_uses || 0) + 1 })
      .eq('id', label.id);

    if (updateError) {
      console.error('[record-qr-scan] Error updating scan count:', updateError.message);
    }

    console.log(`[record-qr-scan] Scan recorded for ${packId}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    console.error('[record-qr-scan] Error:', msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
