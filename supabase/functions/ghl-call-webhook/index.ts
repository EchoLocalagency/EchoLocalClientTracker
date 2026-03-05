import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const expectedSecret = Deno.env.get("GHL_WEBHOOK_SECRET");

    if (!expectedSecret || token !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const customData = body.customData || {};

    // Helper: pull from top-level first, then customData (case-insensitive), then fallback
    const cdKeys = Object.keys(customData);
    const get = (topKey: string, cdKey?: string, fallback: string = "") => {
      if (body[topKey]) return body[topKey];
      const target = cdKey || topKey;
      const match = cdKeys.find(k => k.toLowerCase() === target.toLowerCase());
      if (match && customData[match]) return customData[match];
      return fallback;
    };

    // Map fields -- top-level takes priority, customData as fallback
    const row: Record<string, unknown> = {
      call_transcript: get("call_transcript", "transcript"),
      call_summary: get("call_summary", "summary") || body["Conversation Summary"] || "",
      call_duration: get("call_duration", "duration"),
      call_from: get("call_from"),
      call_to: get("call_to"),
      call_start_time: get("call_start_time") || null,
      call_end_time: get("call_end_time") || null,
      call_status: get("call_status"),
      recording_url: get("recording_url", "call_recording_url"),

      // Contact info -- check multiple locations
      contact_id: body.contact_id || customData.contact_id || "",
      contact_name: body.contact_name || body.full_name || body.company_name || "",
      company_name: body.company_name || body.full_name || "",

      // Store everything
      ghl_payload: body,
    };

    // Clean empty strings to null for timestamp fields
    if (!row.call_start_time) row.call_start_time = null;
    if (!row.call_end_time) row.call_end_time = null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("sales_calls")
      .insert(row)
      .select("id")
      .single();

    if (error) {
      console.error("Insert error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ id: data.id, status: "received" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
