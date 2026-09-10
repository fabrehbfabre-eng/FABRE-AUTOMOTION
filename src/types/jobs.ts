/**
 * FABRE AUTOMATION - Durable Scheduler Job Types
 * Release 14: Durable Scheduler + Delay Engine
 */

export type AutomationJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export type AutomationJobType = 'delayed_action' | 'inactive_followup' | string;

export interface AutomationJob {
  id: string;
  automationId: string;
  conversationId: string;
  actionId: string;
  jobType: AutomationJobType;
  status: AutomationJobStatus;
  scheduledAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  attempts: number;
  maxAttempts: number;
  payload: Record<string, unknown>;
  lastError?: string | null;
  idempotencyKey?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateJobInput {
  automationId: string;
  conversationId: string;
  actionId: string;
  jobType?: string;
  scheduledAt: string;
  maxAttempts?: number;
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface ClaimJobsOptions {
  limit?: number;
  workerId?: string;
  now?: Date;
}
