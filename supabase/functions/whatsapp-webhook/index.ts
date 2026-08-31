// Supabase Edge Function: whatsapp-webhook
// Release 3: Secure Backend Foundation
// Handles WhatsApp Business Cloud API Webhooks

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { getServerSupabaseClient } from "../_shared/supabaseServer.ts";
import { createErrorResponse, createSuccessResponse } from "../_shared/errors.ts";
import { logSecure } from "../_shared/logger.ts";
import { isEventProcessed } from "../_shared/idempotency.ts";

const VERIFY_TOKEN = Deno.env.get("WEBHOOK_VERIFY_TOKEN") || Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN");

serve(async (req: Request) => {
  const startTime = Date.now();

  // 1. CORS Pre-flight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);

  // 2. WhatsApp Webhook Verification Handshake (GET)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (!mode || !token) {
      logSecure("warn", {
        service: "whatsapp-webhook",
        action: "verify_handshake",
        status: "warning",
        message: "Missing hub.mode or hub.verify_token parameter",
      });
      return createErrorResponse(400, "Missing verification parameters", "INVALID_INPUT");
    }

    if (mode === "subscribe" && VERIFY_TOKEN && token === VERIFY_TOKEN) {
      logSecure("info", {
        service: "whatsapp-webhook",
        action: "verify_handshake",
        status: "success",
        message: "WhatsApp webhook handshake verified successfully",
      });
      return new Response(challenge || "", { status: 200 });
    }

    logSecure("warn", {
      service: "whatsapp-webhook",
      action: "verify_handshake",
      status: "error",
      message: "WhatsApp verification failed: token mismatch",
    });
    return createErrorResponse(403, "Verification token mismatch", "FORBIDDEN");
  }

  // 3. Inbound WhatsApp Message Ingestion (POST)
  if (req.method === "POST") {
    try {
      const payload = await req.json();

      if (!payload || typeof payload !== "object") {
        return createErrorResponse(400, "Invalid JSON payload", "INVALID_INPUT");
      }

      if (payload.object !== "whatsapp_business_account") {
        return createErrorResponse(400, "Invalid payload object: expected whatsapp_business_account", "INVALID_INPUT");
      }

      const entry = payload.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];
      const statusUpdate = value?.statuses?.[0];

      const externalEventId = message?.id || statusUpdate?.id || `${entry?.id}_${Date.now()}`;

      // Idempotency check with Supabase PostgreSQL
      try {
        const supabase = getServerSupabaseClient();
        const duplicate = await isEventProcessed(supabase, externalEventId);

        if (duplicate) {
          logSecure("info", {
            service: "whatsapp-webhook",
            action: "process_event",
            status: "received",
            channel: "whatsapp",
            eventId: externalEventId,
            message: "Duplicate WhatsApp event detected. Skipped to preserve idempotency.",
          });

          return createSuccessResponse({ status: "EVENT_ALREADY_PROCESSED", eventId: externalEventId }, 200);
        }
      } catch (dbErr: unknown) {
        const dbMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
        logSecure("warn", {
          service: "whatsapp-webhook",
          action: "idempotency_check",
          status: "warning",
          eventId: externalEventId,
          message: `Database check warning: ${dbMsg}`,
        });
      }

      logSecure("info", {
        service: "whatsapp-webhook",
        action: "receive_event",
        status: "success",
        channel: "whatsapp",
        eventId: externalEventId,
        durationMs: Date.now() - startTime,
        message: message ? "WhatsApp inbound message received" : "WhatsApp status update received",
      });

      return createSuccessResponse({ status: "RECEIVED", eventId: externalEventId }, 200);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logSecure("error", {
        service: "whatsapp-webhook",
        action: "process_payload",
        status: "error",
        durationMs: Date.now() - startTime,
        message: `Error processing WhatsApp payload: ${errorMsg}`,
      });
      return createErrorResponse(400, "Malformed request payload", "INVALID_INPUT");
    }
  }

  return createErrorResponse(405, "Method not allowed", "METHOD_NOT_ALLOWED");
});
