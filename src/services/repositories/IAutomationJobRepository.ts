/**
 * FABRE AUTOMATION - Automation Job Repository Interface
 * Release 14: Durable Scheduler + Delay Engine
 */

import { AutomationJob, AutomationJobStatus, CreateJobInput, ClaimJobsOptions } from '../../types/jobs';

export interface IAutomationJobRepository {
  createJob(input: CreateJobInput): Promise<AutomationJob>;
  claimDueJobs(options?: ClaimJobsOptions): Promise<AutomationJob[]>;
  markCompleted(jobId: string): Promise<AutomationJob>;
  markFailed(jobId: string, error: string): Promise<AutomationJob>;
  scheduleRetry(jobId: string, nextScheduledAt: string, error: string): Promise<AutomationJob>;
  cancelJob(jobId: string, reason?: string, options?: { allowProcessing?: boolean }): Promise<AutomationJob>;
  cancelPendingJobsForConversation(
    conversationId: string,
    options?: { jobType?: string; reason?: string }
  ): Promise<AutomationJob[]>;
  recoverStaleJobs(staleThresholdMs?: number, now?: Date): Promise<AutomationJob[]>;
  getJobById(jobId: string): Promise<AutomationJob | null>;
  getJobByIdempotencyKey(key: string): Promise<AutomationJob | null>;
  listJobs(filter?: {
    status?: AutomationJobStatus;
    conversationId?: string;
    automationId?: string;
    limit?: number;
  }): Promise<AutomationJob[]>;
}
