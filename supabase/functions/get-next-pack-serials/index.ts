import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prefix, month_code, year_code, count } = await req.json();

    if (!prefix || !month_code || !year_code || !count) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Call the atomic DB function
    const { data, error } = await supabase.rpc("get_next_pack_serials", {
      p_prefix: prefix,
      p_month_code: month_code,
      p_year_code: year_code,
      p_count: count,
    });

    if (error) throw error;

    // Also run cleanup of expired month sequences
    await supabase.rpc("cleanup_expired_pack_sequences");

    return new Response(
      JSON.stringify({ start_serial: data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
