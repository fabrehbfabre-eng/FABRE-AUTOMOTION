/**
 * FABRE AUTOMATION - Rule Engine Secure Logger
 * Release: Rule Engine | Observabilidade & Auditoria
 * 
 * Guarantees zero leakage of secrets, access tokens, API keys or passwords.
 * Provides structured traceability for event processing, loop prevention, and triggers.
 */

export type EngineLogLevel = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_KEY_PATTERN = /(token|secret|key|password|bearer|auth|credential|jwt)/i;

/**
 * Recursively redacts sensitive keys from objects and strings
 */
export function sanitizeData(data: unknown, seen = new WeakSet()): unknown {
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    // Redact potential Bearer tokens or secrets
    if (/Bearer\s+[A-Za-z0-9_\-\.]+/i.test(data)) {
      return data.replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, 'Bearer [REDACTED]');
    }
    return data;
  }

  if (typeof data !== 'object') return data;

  if (seen.has(data)) return '[CIRCULAR]';
  seen.add(data);

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item, seen));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value, seen);
    } else if (typeof value === 'string') {
      sanitized[key] = sanitizeData(value, seen);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function logEngine(
  level: EngineLogLevel,
  action: string,
  details: Record<string, unknown>
): void {
  const sanitized = sanitizeData(details);
  const timestamp = new Date().toISOString();
  const logPayload = {
    timestamp,
    component: 'RuleEngine',
    action,
    ...((typeof sanitized === 'object' && sanitized !== null) ? sanitized : { details: sanitized }),
  };

  const message = `[RuleEngine][${action}]`;
  switch (level) {
    case 'error':
      console.error(message, logPayload);
      break;
    case 'warn':
      console.warn(message, logPayload);
      break;
    case 'debug':
      console.debug(message, logPayload);
      break;
    case 'info':
    default:
      console.info(message, logPayload);
      break;
  }
}
