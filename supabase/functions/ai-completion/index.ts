// Supabase Edge Function: ai-completion
// Release 4: Supabase Activation & Backend Deployment
// Structure prepared for future AI activation
// IMPORTANT: AI engine is explicitly deactivated in Release 4 (no OpenAI API calls, no RAG, no embeddings)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { createErrorResponse, createSuccessResponse } from "../_shared/errors.ts";
import { logSecure } from "../_shared/logger.ts";

serve(async (req: Request) => {
  const startTime = Date.now();

  // 1. CORS Pre-flight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return createErrorResponse(405, "Method not allowed", "METHOD_NOT_ALLOWED");
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { prompt } = body || {};

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return createErrorResponse(400, "Field 'prompt' is required and must be non-empty", "INVALID_INPUT");
    }

    logSecure("info", {
      service: "ai-completion",
      action: "check_status",
      status: "deactivated",
      durationMs: Date.now() - startTime,
      message: "AI service request received but AI is explicitly disabled in Release 4",
    });

    // In Release 4: Explicit non-activated response (no fake simulation, no API call)
    return createSuccessResponse(
      {
        enabled: false,
        status: "AI_SERVICE_DISABLED",
        message: "AI service not enabled in current release.",
        release: "RELEASE 4 | SUPABASE ACTIVATION",
        latencyMs: Date.now() - startTime,
      },
      200
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logSecure("error", {
      service: "ai-completion",
      action: "handle_request",
      status: "error",
      durationMs: Date.now() - startTime,
      message: `Error in AI completion endpoint: ${errorMsg}`,
    });
    return createErrorResponse(500, "Failed to process AI completion request", "INTERNAL_ERROR");
  }
});

