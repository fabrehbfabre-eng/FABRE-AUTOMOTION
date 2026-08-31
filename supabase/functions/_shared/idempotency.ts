// Supabase Edge Functions - Idempotency & Deduplication Service
// Release 3: Secure Backend Foundation

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logSecure } from "./logger.ts";

/**
 * Checks if an external event ID has already been recorded in PostgreSQL
 * to prevent duplicate processing of webhook retries.
 */
export async function isEventProcessed(
  supabase: SupabaseClient,
  externalEventId: string
): Promise<boolean> {
  if (!externalEventId || externalEventId.trim().length === 0) {
    return false;
  }

  try {
    const { data, error } = await supabase
      .from("messages")
      .select("id")
      .eq("external_event_id", externalEventId)
      .limit(1);

    if (error) {
      logSecure("warn", {
        service: "idempotency",
        action: "check_event",
        status: "warning",
        eventId: externalEventId,
        message: `Idempotency query failed: ${error.message}`,
      });
      return false;
    }

    return Boolean(data && data.length > 0);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logSecure("error", {
      service: "idempotency",
      action: "check_event",
      status: "error",
      eventId: externalEventId,
      message: `Exception in idempotency check: ${msg}`,
    });
    return false;
  }
}
