// Supabase Edge Functions - Sanitized Secure Logger
// Release 3: Secure Backend Foundation

type LogLevel = "info" | "warn" | "error";

interface LogPayload {
  service: string;
  action: string;
  status: "success" | "warning" | "error" | "received";
  channel?: string;
  eventId?: string;
  durationMs?: number;
  message?: string;
  details?: Record<string, unknown>;
}

const SENSITIVE_KEYS = [
  "token",
  "secret",
  "key",
  "authorization",
  "password",
  "apikey",
  "access_token",
  "verify_token",
  "app_secret",
];

function sanitizeValue(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sanitizeValue);

  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const isSensitive = SENSITIVE_KEYS.some((sk) => k.toLowerCase().includes(sk));
    if (isSensitive) {
      sanitized[k] = "[REDACTED_SECRET]";
    } else if (typeof v === "object" && v !== null) {
      sanitized[k] = sanitizeValue(v);
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

export function logSecure(level: LogLevel, data: LogPayload) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    service: data.service,
    action: data.action,
    status: data.status,
    channel: data.channel,
    eventId: data.eventId,
    durationMs: data.durationMs,
    message: data.message,
    details: data.details ? sanitizeValue(data.details) : undefined,
  };

  const formatted = JSON.stringify(logEntry);

  if (level === "error") {
    console.error(formatted);
  } else if (level === "warn") {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}
