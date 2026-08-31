// Supabase Edge Functions - Standard Error Handling
// Release 3: Secure Backend Foundation

import { corsHeaders } from "./cors.ts";

export type HttpErrorCode = 
  | "INVALID_INPUT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "DUPLICATE_EVENT"
  | "INTERNAL_ERROR"
  | "METHOD_NOT_ALLOWED";

export function createErrorResponse(
  status: number,
  message: string,
  code: HttpErrorCode = "INTERNAL_ERROR",
  details?: Record<string, unknown>
): Response {
  // Ensure no sensitive data is leaked in error response
  const body = {
    error: message,
    code,
    status,
    timestamp: new Date().toISOString(),
    details: details ? details : undefined,
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

export function createSuccessResponse(
  data: unknown,
  status = 200,
  headers?: Record<string, string>
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...headers,
    },
  });
}
