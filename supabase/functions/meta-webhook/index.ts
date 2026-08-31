// Supabase Edge Function: meta-webhook
// Handles incoming Instagram Direct & Facebook Messenger Webhooks from Meta Graph API

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERIFY_TOKEN = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") || "fabre_meta_verify_token";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  const url = new URL(req.url);

  // 1. Meta Webhook Verification (GET)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("[meta-webhook] Webhook verified successfully");
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // 2. Incoming Event Ingestion (POST)
  if (req.method === "POST") {
    try {
      const payload = await req.json();
      console.log("[meta-webhook] Incoming Meta payload:", JSON.stringify(payload));

      // Process Instagram Direct / Messenger messaging events here (Release 3)
      return new Response(JSON.stringify({ status: "EVENT_RECEIVED" }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    } catch (err) {
      console.error("[meta-webhook] Error processing payload:", err);
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
