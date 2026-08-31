// Supabase Edge Function: health-check
// Release 3: Secure Backend Foundation
// Tests server-side availability, Supabase PostgreSQL reachability and environment readiness

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { getServerSupabaseClient } from "../_shared/supabaseServer.ts";
import { createSuccessResponse, createErrorResponse } from "../_shared/errors.ts";
import { logSecure } from "../_shared/logger.ts";

serve(async (req: Request) => {
  const startTime = Date.now();

  // 1. CORS Pre-flight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET") {
    return createErrorResponse(405, "Method not allowed", "METHOD_NOT_ALLOWED");
  }

  try {
    let supabaseReachable = false;
    let tableCount = 0;

    try {
      const supabase = getServerSupabaseClient();
      const { data, error } = await supabase
        .from("channel_connections")
        .select("channel")
        .limit(3);

      if (!error && data) {
        supabaseReachable = true;
        tableCount = data.length;
      }
    } catch {
      supabaseReachable = false;
    }

    const hasOpenAIKey = Boolean(Deno.env.get("OPENAI_API_KEY"));
    const hasMetaSecret = Boolean(Deno.env.get("META_APP_SECRET"));
    const hasWhatsAppToken = Boolean(Deno.env.get("WHATSAPP_ACCESS_TOKEN"));

    const healthData = {
      status: "ok",
      version: "release-3.0.0",
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
      supabaseConnected: supabaseReachable,
      channelsConfigured: tableCount,
      environment: {
        runtime: "Deno / Supabase Edge Functions",
        openAiReady: hasOpenAIKey,
        metaReady: hasMetaSecret,
        whatsAppReady: hasWhatsAppToken,
      },
    };

    logSecure("info", {
      service: "health-check",
      action: "check_health",
      status: "success",
      durationMs: Date.now() - startTime,
      message: "Health check completed successfully",
    });

    return createSuccessResponse(healthData, 200);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    logSecure("error", {
      service: "health-check",
      action: "check_health",
      status: "error",
      durationMs: Date.now() - startTime,
      message: `Health check failed: ${errorMsg}`,
    });

    return createErrorResponse(500, "Backend health check failure", "INTERNAL_ERROR");
  }
});
