/**
 * FABRE AUTOMATION - Mock Automation Job Repository
 * Release 14: Durable Scheduler + Delay Engine
 * 
 * Provides thread-safe / atomic queue semantics and deterministic state machine transitions.
 */

import { AutomationJob, AutomationJobStatus, CreateJobInput, ClaimJobsOptions } from '../../../types/jobs';
import { IAutomationJobRepository } from '../IAutomationJobRepository';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class MockAutomationJobRepository implements IAutomationJobRepository {
  private jobs = new Map<string, AutomationJob>();
  private claimMutex: Promise<void> = Promise.resolve();

  /**
   * Resets mock data for testing
   */
  clear(): void {
    this.jobs.clear();
  }

  async createJob(input: CreateJobInput): Promise<AutomationJob> {
    if (input.idempotencyKey) {
      for (const job of this.jobs.values()) {
        if (job.idempotencyKey === input.idempotencyKey) {
          const err = new Error(`Unique constraint violation: Job with idempotency key '${input.idempotencyKey}' already exists.`);
          (err as any).code = '23505';
          throw err;
        }
      }
    }

    const now = new Date().toISOString();
    const id = generateUUID();

    const job: AutomationJob = {
      id,
      automationId: input.automationId,
      conversationId: input.conversationId,
      actionId: input.actionId,
      jobType: input.jobType || 'delayed_action',
      status: 'pending',
      scheduledAt: input.scheduledAt,
      startedAt: null,
      completedAt: null,
      failedAt: null,
      attempts: 0,
      maxAttempts: input.maxAttempts !== undefined ? input.maxAttempts : 3,
      payload: input.payload ? JSON.parse(JSON.stringify(input.payload)) : {},
      lastError: null,
      idempotencyKey: input.idempotencyKey || null,
      createdAt: now,
      updatedAt: now,
    };

    this.jobs.set(id, job);
    return { ...job };
  }

  /**
   * Concurrency-safe atomic claim simulation equivalent to FOR UPDATE SKIP LOCKED
   */
  async claimDueJobs(options?: ClaimJobsOptions): Promise<AutomationJob[]> {
    let releaseLock: () => void = () => {};
    const lockAcquired = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    const previousLock = this.claimMutex;
    this.claimMutex = previousLock.then(() => lockAcquired);

    await previousLock;

    try {
      const limit = options?.limit || 10;
      const nowTime = options?.now ? options.now.getTime() : Date.now();
      const claimed: AutomationJob[] = [];

      const candidateJobs = Array.from(this.jobs.values())
        .filter((job) => job.status === 'pending' && new Date(job.scheduledAt).getTime() <= nowTime)
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

      for (const job of candidateJobs) {
        if (claimed.length >= limit) break;

        // Atomically claim
        job.status = 'processing';
        job.startedAt = new Date(nowTime).toISOString();
        job.attempts += 1;
        job.updatedAt = new Date(nowTime).toISOString();

        claimed.push({ ...job });
      }

      return claimed;
    } finally {
      releaseLock();
    }
  }

  async markCompleted(jobId: string): Promise<AutomationJob> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.status === 'cancelled') {
      throw new Error(`Cannot complete a cancelled job: ${jobId}`);
    }

    const now = new Date().toISOString();
    job.status = 'completed';
    job.completedAt = now;
    job.updatedAt = now;

    return { ...job };
  }

  async markFailed(jobId: string, error: string): Promise<AutomationJob> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.status === 'completed') {
      throw new Error(`Cannot fail an already completed job: ${jobId}`);
    }

    const now = new Date().toISOString();
    job.status = 'failed';
    job.failedAt = now;
    job.lastError = error;
    job.updatedAt = now;

    return { ...job };
  }

  async scheduleRetry(jobId: string, nextScheduledAt: string, error: string): Promise<AutomationJob> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.status === 'completed') {
      throw new Error(`Cannot retry a completed job: ${jobId}`);
    }

    if (job.status === 'cancelled') {
      throw new Error(`Cannot retry a cancelled job: ${jobId}`);
    }

    const now = new Date().toISOString();
    if (job.attempts >= job.maxAttempts) {
      job.status = 'failed';
      job.failedAt = now;
      job.lastError = `Max attempts reached (${job.attempts}/${job.maxAttempts}). Last error: ${error}`;
      job.updatedAt = now;
    } else {
      job.status = 'pending';
      job.scheduledAt = nextScheduledAt;
      job.lastError = error;
      job.updatedAt = now;
    }

    return { ...job };
  }

  async cancelJob(jobId: string, reason?: string, options?: { allowProcessing?: boolean }): Promise<AutomationJob> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.status === 'completed') {
      throw new Error(`Cannot cancel an already completed job: ${jobId}`);
    }

    if (job.status === 'processing' && !options?.allowProcessing) {
      throw new Error(`Cannot cancel a job currently in processing state: ${jobId}`);
    }

    const now = new Date().toISOString();
    job.status = 'cancelled';
    job.lastError = reason || 'Cancelled by operator';
    job.updatedAt = now;

    return { ...job };
  }

  async cancelPendingJobsForConversation(
    conversationId: string,
    options?: { jobType?: string; reason?: string }
  ): Promise<AutomationJob[]> {
    const cancelled: AutomationJob[] = [];
    const now = new Date().toISOString();

    for (const job of this.jobs.values()) {
      if (job.conversationId === conversationId && job.status === 'pending') {
        if (!options?.jobType || job.jobType === options.jobType) {
          job.status = 'cancelled';
          job.lastError = options?.reason || 'Cancelado por nova atividade na conversa';
          job.updatedAt = now;
          cancelled.push({ ...job });
        }
      }
    }

    return cancelled;
  }

  async recoverStaleJobs(staleThresholdMs = 5 * 60 * 1000, now = new Date()): Promise<AutomationJob[]> {
    const nowTime = now.getTime();
    const recovered: AutomationJob[] = [];

    for (const job of this.jobs.values()) {
      if (job.status === 'processing' && job.startedAt) {
        const startedTime = new Date(job.startedAt).getTime();
        if (nowTime - startedTime >= staleThresholdMs) {
          if (job.attempts < job.maxAttempts) {
            job.status = 'pending';
            job.scheduledAt = now.toISOString();
            job.lastError = 'Recovered from stale processing state';
          } else {
            job.status = 'failed';
            job.failedAt = now.toISOString();
            job.lastError = 'Stale processing timeout exceeded max attempts';
          }
          job.updatedAt = now.toISOString();
          recovered.push({ ...job });
        }
      }
    }

    return recovered;
  }

  async getJobById(jobId: string): Promise<AutomationJob | null> {
    const job = this.jobs.get(jobId);
    return job ? { ...job } : null;
  }

  async getJobByIdempotencyKey(key: string): Promise<AutomationJob | null> {
    for (const job of this.jobs.values()) {
      if (job.idempotencyKey === key) {
        return { ...job };
      }
    }
    return null;
  }

  async listJobs(filter?: {
    status?: AutomationJobStatus;
    conversationId?: string;
    automationId?: string;
    limit?: number;
  }): Promise<AutomationJob[]> {
    let list = Array.from(this.jobs.values());

    if (filter?.status) {
      list = list.filter((j) => j.status === filter.status);
    }
    if (filter?.conversationId) {
      list = list.filter((j) => j.conversationId === filter.conversationId);
    }
    if (filter?.automationId) {
      list = list.filter((j) => j.automationId === filter.automationId);
    }

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (filter?.limit) {
      list = list.slice(0, filter.limit);
    }

    return list.map((j) => ({ ...j }));
  }

  /**
   * Helper for mock testing/simulation to update internal job fields (e.g. simulate stale startedAt)
   */
  updateJobInternal(jobId: string, updates: Partial<AutomationJob>): AutomationJob {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }
    Object.assign(job, updates);
    return { ...job };
  }
}
