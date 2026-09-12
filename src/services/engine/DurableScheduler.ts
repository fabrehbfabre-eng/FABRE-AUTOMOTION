/**
 * FABRE AUTOMATION - Durable Scheduler & Delay Engine
 * Release 14: Durable Scheduler + Delay Engine
 * 
 * Provides production-grade persistent delayed execution for automations.
 * Guarantees:
 * - Persistence across process restarts
 * - Concurrency safety via transactional claim
 * - Deterministic retry with exponential backoff
 * - Idempotency against duplicates
 * - Zero secrets in jobs or logs
 * - Stale processing recovery
 */

import { Automation, AutomationAction } from '../../types';
import { AutomationJob, AutomationJobStatus } from '../../types/jobs';
import { RuleEngineEvent, EvaluationContext } from './types';
import { repositoryManager } from '../repositories';
import { ActionExecutor } from './ActionExecutor';
import { InactiveFollowupEngine } from './InactiveFollowupEngine';
import { logScheduler, sanitizeData } from './engineLogger';

export interface ProcessDueJobsOptions {
  limit?: number;
  workerId?: string;
  now?: Date;
  autoRecoverStale?: boolean;
  staleThresholdMs?: number;
}

export interface ProcessedJobSummary {
  jobId: string;
  automationId: string;
  actionId: string;
  status: AutomationJobStatus;
  attempts: number;
  error?: string;
}

export interface ProcessDueJobsResult {
  claimedCount: number;
  processedCount: number;
  completedCount: number;
  failedCount: number;
  retriedCount: number;
  jobs: ProcessedJobSummary[];
}

export class DurableScheduler {
  /**
   * Helper to build a deterministic idempotency key for scheduled actions
   */
  static buildJobIdempotencyKey(
    automationId: string,
    conversationId: string,
    actionId: string,
    eventIdentifier: string
  ): string {
    return `job::${automationId}::${conversationId}::${actionId}::${eventIdentifier}`;
  }

  /**
   * Creates and persists a durable automation job for an action with delay
   */
  static async scheduleActionJob(params: {
    automation: Automation;
    action: AutomationAction;
    event: RuleEngineEvent;
    delaySeconds: number;
    maxAttempts?: number;
  }): Promise<AutomationJob> {
    const { automation, action, event, delaySeconds, maxAttempts = 3 } = params;
    const nowMs = Date.now();
    const scheduledAt = new Date(nowMs + delaySeconds * 1000).toISOString();
    const eventId = event.messageId || event.externalEventId || `manual_${nowMs}`;

    const idempotencyKey = this.buildJobIdempotencyKey(
      automation.id,
      event.conversationId,
      action.id,
      eventId
    );

    // Sanitize payload to guarantee zero secrets or access tokens are persisted
    const cleanPayload = sanitizeData({
      automationId: automation.id,
      actionId: action.id,
      conversationId: event.conversationId,
      channel: event.channel,
      event: {
        conversationId: event.conversationId,
        channel: event.channel,
        messageId: event.messageId,
        externalEventId: event.externalEventId,
        sender: event.sender,
        content: event.content,
        contentType: event.contentType,
        timestamp: event.timestamp,
        contact: event.contact,
      },
      delaySeconds,
    }) as Record<string, unknown>;

    const createdJob = await repositoryManager.job.createJob({
      automationId: automation.id,
      conversationId: event.conversationId,
      actionId: action.id,
      jobType: 'delayed_action',
      scheduledAt,
      maxAttempts,
      payload: cleanPayload,
      idempotencyKey,
    });

    logScheduler('info', 'JOB_CREATED', {
      jobId: createdJob.id,
      automationId: createdJob.automationId,
      conversationId: createdJob.conversationId,
      actionId: createdJob.actionId,
      scheduledAt: createdJob.scheduledAt,
      delaySeconds,
      attempt: createdJob.attempts,
    });

    return createdJob;
  }

  /**
   * Cancels a pending job
   */
  static async cancelJob(jobId: string, reason?: string): Promise<AutomationJob> {
    const cancelledJob = await repositoryManager.job.cancelJob(jobId, reason);

    logScheduler('info', 'JOB_CANCELLED', {
      jobId: cancelledJob.id,
      automationId: cancelledJob.automationId,
      conversationId: cancelledJob.conversationId,
      actionId: cancelledJob.actionId,
      reason: reason || 'Cancelled by operator',
    });

    return cancelledJob;
  }

  /**
   * Recovers jobs stuck in 'processing' state for longer than threshold
   */
  static async recoverStaleJobs(
    staleThresholdMs = 5 * 60 * 1000,
    now = new Date()
  ): Promise<AutomationJob[]> {
    const recovered = await repositoryManager.job.recoverStaleJobs(staleThresholdMs, now);

    for (const job of recovered) {
      logScheduler('warn', 'JOB_STALE_RECOVERED', {
        jobId: job.id,
        automationId: job.automationId,
        conversationId: job.conversationId,
        actionId: job.actionId,
        status: job.status,
        attempt: job.attempts,
      });
    }

    return recovered;
  }

  /**
   * Main entry point: Claims and processes all pending jobs that are due
   */
  static async processDueAutomationJobs(
    options?: ProcessDueJobsOptions
  ): Promise<ProcessDueJobsResult> {
    const now = options?.now || new Date();
    const limit = options?.limit || 10;
    const workerId = options?.workerId || 'worker_default';

    // 1. Recover stale processing jobs if enabled
    if (options?.autoRecoverStale !== false) {
      await this.recoverStaleJobs(options?.staleThresholdMs || 5 * 60 * 1000, now);
    }

    // 2. Claim due jobs atomically (FOR UPDATE SKIP LOCKED)
    const claimedJobs = await repositoryManager.job.claimDueJobs({
      limit,
      workerId,
      now,
    });

    for (const job of claimedJobs) {
      logScheduler('info', 'JOB_CLAIMED', {
        jobId: job.id,
        automationId: job.automationId,
        conversationId: job.conversationId,
        actionId: job.actionId,
        workerId,
        attempt: job.attempts,
      });
    }

    const summaryList: ProcessedJobSummary[] = [];
    let completedCount = 0;
    let failedCount = 0;
    let retriedCount = 0;

    // 3. Process each claimed job
    for (const job of claimedJobs) {
      logScheduler('info', 'JOB_STARTED', {
        jobId: job.id,
        automationId: job.automationId,
        conversationId: job.conversationId,
        actionId: job.actionId,
        attempt: job.attempts,
      });

      try {
        // Special revalidation for inactive_followup jobs
        if (job.jobType === 'inactive_followup') {
          const reval = await InactiveFollowupEngine.revalidateFollowupJob(job, { now });
          if (!reval.valid) {
            if (reval.shouldCancel) {
              logScheduler('warn', 'FOLLOWUP_JOB_INVALIDATED', {
                jobId: job.id,
                automationId: job.automationId,
                conversationId: job.conversationId,
                actionId: job.actionId,
                reason: reval.reason,
              });
              failedCount++;
              summaryList.push({
                jobId: job.id,
                automationId: job.automationId,
                actionId: job.actionId,
                status: 'cancelled',
                attempts: job.attempts,
                error: reval.reason,
              });
              continue;
            } else {
              summaryList.push({
                jobId: job.id,
                automationId: job.automationId,
                actionId: job.actionId,
                status: 'pending',
                attempts: job.attempts,
                error: reval.reason,
              });
              continue;
            }
          }
        }

        // 3.1 Resolve automation
        const automation = await repositoryManager.automation.getAutomationById(job.automationId);
        if (!automation) {
          const err = `Automação ${job.automationId} não encontrada no repositório.`;
          await repositoryManager.job.markFailed(job.id, err);
          logScheduler('error', 'JOB_FAILED', {
            jobId: job.id,
            automationId: job.automationId,
            conversationId: job.conversationId,
            actionId: job.actionId,
            attempt: job.attempts,
            error: err,
          });
          failedCount++;
          summaryList.push({
            jobId: job.id,
            automationId: job.automationId,
            actionId: job.actionId,
            status: 'failed',
            attempts: job.attempts,
            error: err,
          });
          continue;
        }

        // 3.2 Check if automation is active
        if (!automation.enabled) {
          const err = `Automação '${automation.title}' está desativada no momento da execução agendada.`;
          await repositoryManager.job.markFailed(job.id, err);
          logScheduler('warn', 'JOB_FAILED', {
            jobId: job.id,
            automationId: job.automationId,
            conversationId: job.conversationId,
            actionId: job.actionId,
            attempt: job.attempts,
            error: err,
          });
          failedCount++;
          summaryList.push({
            jobId: job.id,
            automationId: job.automationId,
            actionId: job.actionId,
            status: 'failed',
            attempts: job.attempts,
            error: err,
          });
          continue;
        }

        // 3.3 Resolve action from automation
        const action = automation.actions?.find((a) => a.id === job.actionId);
        if (!action) {
          const err = `Ação ${job.actionId} não encontrada na automação '${automation.title}'.`;
          await repositoryManager.job.markFailed(job.id, err);
          logScheduler('error', 'JOB_FAILED', {
            jobId: job.id,
            automationId: job.automationId,
            conversationId: job.conversationId,
            actionId: job.actionId,
            attempt: job.attempts,
            error: err,
          });
          failedCount++;
          summaryList.push({
            jobId: job.id,
            automationId: job.automationId,
            actionId: job.actionId,
            status: 'failed',
            attempts: job.attempts,
            error: err,
          });
          continue;
        }

        // 3.4 Reconstruct event & context
        const payload = job.payload || {};
        const payloadEvent = (payload.event as Partial<RuleEngineEvent>) || {};
        const event: RuleEngineEvent = {
          conversationId: job.conversationId,
          channel: (payloadEvent.channel as any) || automation.channel || 'whatsapp',
          messageId: payloadEvent.messageId || `scheduled_msg_${job.id}`,
          externalEventId: payloadEvent.externalEventId,
          sender: payloadEvent.sender || 'contact',
          content: payloadEvent.content || '',
          contentType: payloadEvent.contentType || 'text',
          timestamp: payloadEvent.timestamp || new Date().toISOString(),
          contact: payloadEvent.contact,
        };

        const conversation = await repositoryManager.conversation.getConversationById(job.conversationId);
        const context: EvaluationContext = {
          conversation,
          isFirstContact: false,
          depth: 1,
        };

        // 3.5 Execute Action with scheduled flag so it doesn't re-delay
        const result = await ActionExecutor.executeAction(action, automation, event, context, {
          isScheduledExecution: true,
        });

        if (result.success) {
          await repositoryManager.job.markCompleted(job.id);
          logScheduler('info', 'JOB_COMPLETED', {
            jobId: job.id,
            automationId: job.automationId,
            conversationId: job.conversationId,
            actionId: job.actionId,
            attempt: job.attempts,
          });
          completedCount++;
          summaryList.push({
            jobId: job.id,
            automationId: job.automationId,
            actionId: job.actionId,
            status: 'completed',
            attempts: job.attempts,
          });
        } else {
          // Execution returned controlled error
          const errorMsg = result.error || 'Falha na execução da ação agendada';
          const isRetryable = result.isRetryable !== false;

          // Only schedule retry if error is transient and maxAttempts not reached
          if (isRetryable && job.attempts < job.maxAttempts) {
            // Calculate deterministic exponential backoff
            const backoffSeconds = Math.min(30 * Math.pow(2, job.attempts - 1), 900);
            const nextScheduledAt = new Date(now.getTime() + backoffSeconds * 1000).toISOString();

            await repositoryManager.job.scheduleRetry(job.id, nextScheduledAt, errorMsg);
            logScheduler('warn', 'JOB_RETRY_SCHEDULED', {
              jobId: job.id,
              automationId: job.automationId,
              conversationId: job.conversationId,
              actionId: job.actionId,
              attempt: job.attempts,
              nextScheduledAt,
              backoffSeconds,
              error: errorMsg,
              errorCategory: result.errorCategory,
            });
            retriedCount++;
            summaryList.push({
              jobId: job.id,
              automationId: job.automationId,
              actionId: job.actionId,
              status: 'pending',
              attempts: job.attempts,
              error: errorMsg,
            });
          } else {
            const finalReason = !isRetryable
              ? `${errorMsg} (Erro permanente não retentável: ${result.errorCategory || 'NON_RETRYABLE'})`
              : errorMsg;
            await repositoryManager.job.markFailed(job.id, finalReason);
            logScheduler('error', 'JOB_FAILED', {
              jobId: job.id,
              automationId: job.automationId,
              conversationId: job.conversationId,
              actionId: job.actionId,
              attempt: job.attempts,
              isRetryable,
              errorCategory: result.errorCategory,
              error: finalReason,
            });
            failedCount++;
            summaryList.push({
              jobId: job.id,
              automationId: job.automationId,
              actionId: job.actionId,
              status: 'failed',
              attempts: job.attempts,
              error: finalReason,
            });
          }
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (job.attempts < job.maxAttempts) {
          const backoffSeconds = Math.min(30 * Math.pow(2, job.attempts - 1), 900);
          const nextScheduledAt = new Date(now.getTime() + backoffSeconds * 1000).toISOString();

          await repositoryManager.job.scheduleRetry(job.id, nextScheduledAt, errorMsg);
          logScheduler('warn', 'JOB_RETRY_SCHEDULED', {
            jobId: job.id,
            automationId: job.automationId,
            conversationId: job.conversationId,
            actionId: job.actionId,
            attempt: job.attempts,
            nextScheduledAt,
            backoffSeconds,
            error: errorMsg,
          });
          retriedCount++;
          summaryList.push({
            jobId: job.id,
            automationId: job.automationId,
            actionId: job.actionId,
            status: 'pending',
            attempts: job.attempts,
            error: errorMsg,
          });
        } else {
          await repositoryManager.job.markFailed(job.id, errorMsg);
          logScheduler('error', 'JOB_FAILED', {
            jobId: job.id,
            automationId: job.automationId,
            conversationId: job.conversationId,
            actionId: job.actionId,
            attempt: job.attempts,
            error: errorMsg,
          });
          failedCount++;
          summaryList.push({
            jobId: job.id,
            automationId: job.automationId,
            actionId: job.actionId,
            status: 'failed',
            attempts: job.attempts,
            error: errorMsg,
          });
        }
      }
    }

    return {
      claimedCount: claimedJobs.length,
      processedCount: summaryList.length,
      completedCount,
      failedCount,
      retriedCount,
      jobs: summaryList,
    };
  }
}

/**
 * Standalone exportable function as explicitly specified in Release 14 requirements
 */
export async function processDueAutomationJobs(
  options?: ProcessDueJobsOptions
): Promise<ProcessDueJobsResult> {
  return DurableScheduler.processDueAutomationJobs(options);
}
