/**
 * FABRE AUTOMATION - Inactive Follow-Up Engine
 * Release 15: Inactive Follow-Up Engine
 * 
 * Specialized engine responsible for:
 * 1. Validating and parsing inactive_followup triggers
 * 2. Determining customer activity reference (sender === 'contact')
 * 3. Generating deterministic idempotency keys
 * 4. Scheduling persistent jobs in DurableScheduler (job_type = 'inactive_followup')
 * 5. Invalidating/cancelling pending follow-ups when new customer activity arrives
 * 6. Performing strict 10-point revalidation at execution time before dispatching
 * 7. Executing due follow-ups safely through ActionExecutor and AutomationOutboundDispatcher
 * 8. Preventing loops (follow-up output sender='bot' never re-triggers follow-ups)
 */

import { Automation, AutomationAction, AutomationTrigger, Conversation, Message, ChannelType } from '../../types';
import { AutomationJob } from '../../types/jobs';
import { RuleEngineEvent, EvaluationContext, ActionExecutionResult } from './types';
import { repositoryManager } from '../repositories';
import { logEngine, logScheduler } from './engineLogger';
import { ActionExecutor } from './ActionExecutor';
import { AutomationOutboundDispatcher } from './AutomationOutboundDispatcher';

export interface InactivityParseResult {
  valid: boolean;
  minutes: number;
  error?: string;
}

export interface RevalidationResult {
  valid: boolean;
  reason?: string;
  shouldCancel?: boolean;
  automation?: Automation;
  action?: AutomationAction;
  conversation?: Conversation;
  latestCustomerMessage?: Message | null;
}

export interface ScheduleFollowupParams {
  automation: Automation;
  event: RuleEngineEvent;
  context: EvaluationContext;
  actionId?: string;
}

export interface ScheduleFollowupResult {
  job: AutomationJob;
  scheduledAt: string;
  inactivityMinutes: number;
  idempotencyKey: string;
}

export class InactiveFollowupEngine {
  public static readonly MIN_INACTIVITY_MINUTES = 1;
  public static readonly MAX_INACTIVITY_MINUTES = 43200; // 30 days

  /**
   * Parses and validates inactivity configuration from an automation trigger.
   * Supports both inactivityMinutes (preferred) and inactivityHours (backwards compatibility).
   */
  static parseInactivityMinutes(trigger: AutomationTrigger): InactivityParseResult {
    if (!trigger || trigger.type !== 'inactive_followup') {
      return {
        valid: false,
        minutes: 0,
        error: 'Gatilho não é do tipo inactive_followup.',
      };
    }

    const config = trigger.config || {};
    const rawMinutes = config.inactivityMinutes;
    const rawHours = config.inactivityHours;

    let computedMinutes: number;

    if (rawMinutes !== undefined) {
      if (typeof rawMinutes !== 'number' || !Number.isFinite(rawMinutes)) {
        return {
          valid: false,
          minutes: 0,
          error: 'Configuração inválida: inactivityMinutes deve ser um número.',
        };
      }
      computedMinutes = rawMinutes;
    } else if (rawHours !== undefined) {
      if (typeof rawHours !== 'number' || !Number.isFinite(rawHours)) {
        return {
          valid: false,
          minutes: 0,
          error: 'Configuração inválida: inactivityHours deve ser um número.',
        };
      }
      computedMinutes = rawHours * 60;
    } else {
      return {
        valid: false,
        minutes: 0,
        error: 'Configuração de inatividade não encontrada no gatilho.',
      };
    }

    if (computedMinutes <= 0) {
      return {
        valid: false,
        minutes: computedMinutes,
        error: 'Tempo de inatividade deve ser estritamente maior que zero.',
      };
    }

    if (computedMinutes > this.MAX_INACTIVITY_MINUTES) {
      return {
        valid: false,
        minutes: computedMinutes,
        error: `Tempo de inatividade excede o limite máximo permitido de ${this.MAX_INACTIVITY_MINUTES} minutos (30 dias).`,
      };
    }

    return {
      valid: true,
      minutes: Math.round(computedMinutes),
    };
  }

  /**
   * Locates the latest message sent by the customer (sender === 'contact').
   * Messages sent by 'bot', 'user' (operator), or 'system' are strictly ignored as customer activity.
   */
  static getLastCustomerMessage(messages: Message[]): Message | null {
    if (!messages || messages.length === 0) return null;

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.sender === 'contact') {
        return msg;
      }
    }

    return null;
  }

  /**
   * Generates a deterministic, persistent idempotency key for follow-up jobs.
   * Format: inactive_followup::<automationId>::<conversationId>::<actionId>::<referenceMessageId>
   */
  static buildFollowupIdempotencyKey(
    automationId: string,
    conversationId: string,
    actionId: string,
    referenceMessageId: string
  ): string {
    return `inactive_followup::${automationId}::${conversationId}::${actionId}::${referenceMessageId}`;
  }

  /**
   * Cancels any existing pending inactive_followup jobs for a conversation.
   * Called when a customer sends a new message before scheduled_at.
   */
  static async cancelPendingFollowups(
    conversationId: string,
    reason = 'Cancelado: nova mensagem recebida do cliente'
  ): Promise<AutomationJob[]> {
    if (!conversationId) return [];

    try {
      if (typeof repositoryManager.job.cancelPendingJobsForConversation === 'function') {
        const cancelled = await repositoryManager.job.cancelPendingJobsForConversation(conversationId, {
          jobType: 'inactive_followup',
          reason,
        });

        if (cancelled.length > 0) {
          logEngine('info', 'PENDING_FOLLOWUPS_CANCELLED', {
            conversationId,
            cancelledCount: cancelled.length,
            reason,
          });
        }
        return cancelled;
      }

      // Fallback query and cancel individual pending jobs
      const pendingJobs = await repositoryManager.job.listJobs({
        conversationId,
        status: 'pending',
      });

      const cancelled: AutomationJob[] = [];
      for (const job of pendingJobs) {
        if (job.jobType === 'inactive_followup') {
          const res = await repositoryManager.job.cancelJob(job.id, reason);
          cancelled.push(res);
        }
      }

      if (cancelled.length > 0) {
        logEngine('info', 'PENDING_FOLLOWUPS_CANCELLED', {
          conversationId,
          cancelledCount: cancelled.length,
          reason,
        });
      }

      return cancelled;
    } catch (err) {
      logEngine('warn', 'CANCEL_PENDING_FOLLOWUPS_ERROR', {
        conversationId,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  /**
   * Schedules a persistent follow-up job when an inactive_followup rule matches.
   * scheduled_at is mathematically based on the reference customer message timestamp + inactivityMinutes.
   */
  static async scheduleFollowupJob(
    params: ScheduleFollowupParams
  ): Promise<ScheduleFollowupResult | null> {
    const { automation, event, context } = params;

    const parseResult = this.parseInactivityMinutes(automation.trigger);
    if (!parseResult.valid) {
      logEngine('warn', 'INVALID_FOLLOWUP_CONFIG', {
        automationId: automation.id,
        error: parseResult.error,
      });
      return null;
    }

    const actions = automation.actions || [];
    if (actions.length === 0) {
      logEngine('warn', 'FOLLOWUP_NO_ACTIONS', {
        automationId: automation.id,
      });
      return null;
    }

    const targetAction = params.actionId
      ? actions.find(a => a.id === params.actionId) || actions[0]
      : actions[0];

    // Determine reference message and timestamp
    let referenceMessageId = event.messageId;
    let referenceTimestamp = event.timestamp;

    if (!referenceMessageId || event.sender !== 'contact') {
      const lastCustMsg = this.getLastCustomerMessage(context.messagesHistory || []);
      if (lastCustMsg) {
        referenceMessageId = lastCustMsg.id;
        referenceTimestamp = lastCustMsg.createdAt;
      } else {
        referenceMessageId = referenceMessageId || `cust_evt_${Date.now()}`;
        referenceTimestamp = referenceTimestamp || new Date().toISOString();
      }
    }

    const refTime = new Date(referenceTimestamp).getTime();
    const inactivityMs = parseResult.minutes * 60 * 1000;
    const scheduledAtTime = refTime + inactivityMs;
    const scheduledAt = new Date(scheduledAtTime).toISOString();

    const idempotencyKey = this.buildFollowupIdempotencyKey(
      automation.id,
      event.conversationId,
      targetAction.id,
      referenceMessageId
    );

    // Check if job already exists (idempotency)
    const existing = await repositoryManager.job.getJobByIdempotencyKey(idempotencyKey);
    if (existing) {
      logEngine('info', 'FOLLOWUP_JOB_IDEMPOTENT_HIT', {
        jobId: existing.id,
        idempotencyKey,
        status: existing.status,
      });
      return {
        job: existing,
        scheduledAt: existing.scheduledAt,
        inactivityMinutes: parseResult.minutes,
        idempotencyKey,
      };
    }

    // Create durable job
    const createdJob = await repositoryManager.job.createJob({
      automationId: automation.id,
      conversationId: event.conversationId,
      actionId: targetAction.id,
      jobType: 'inactive_followup',
      scheduledAt,
      maxAttempts: 3,
      idempotencyKey,
      payload: {
        referenceMessageId,
        referenceMessageTimestamp: referenceTimestamp,
        inactivityMinutes: parseResult.minutes,
        automationId: automation.id,
        actionId: targetAction.id,
        channel: event.channel,
        event: {
          conversationId: event.conversationId,
          channel: event.channel,
          sender: 'contact',
          messageId: referenceMessageId,
          timestamp: referenceTimestamp,
        },
      },
    });

    logEngine('info', 'FOLLOWUP_JOB_SCHEDULED', {
      jobId: createdJob.id,
      automationId: automation.id,
      conversationId: event.conversationId,
      actionId: targetAction.id,
      scheduledAt,
      inactivityMinutes: parseResult.minutes,
      idempotencyKey,
    });

    return {
      job: createdJob,
      scheduledAt,
      inactivityMinutes: parseResult.minutes,
      idempotencyKey,
    };
  }

  /**
   * Revalidates an inactive_followup job before execution.
   * Performs the strict 10-point revalidation:
   * 1. Locate conversation
   * 2. Locate automation
   * 3. Locate action
   * 4. Verify automation is enabled
   * 5. Verify action exists
   * 6. Verify trigger is inactive_followup
   * 7. Locate latest message from customer
   * 8. Compare reference message identifier
   * 9. Verify if there was a new message from customer
   * 10. Verify if inactivity period is still satisfied
   */
  static async revalidateFollowupJob(
    job: AutomationJob,
    options?: { now?: Date }
  ): Promise<RevalidationResult> {
    const now = options?.now || new Date();
    const payload = job.payload || {};
    const refMsgId = String(payload.referenceMessageId || '');
    const refTimestamp = String(payload.referenceMessageTimestamp || '');
    const inactivityMinutes = Number(payload.inactivityMinutes) || 0;

    // 1. Locate conversation
    const conversation = await repositoryManager.conversation.getConversationById(job.conversationId);
    if (!conversation) {
      const reason = `Conversa ${job.conversationId} não encontrada.`;
      await repositoryManager.job.cancelJob(job.id, reason, { allowProcessing: true });
      return { valid: false, shouldCancel: true, reason };
    }

    // 2. Locate automation
    const automation = await repositoryManager.automation.getAutomationById(job.automationId);
    if (!automation) {
      const reason = `Automação ${job.automationId} não encontrada no banco de dados.`;
      await repositoryManager.job.cancelJob(job.id, reason, { allowProcessing: true });
      return { valid: false, shouldCancel: true, reason };
    }

    // 3 & 4. Verify automation is enabled
    if (!automation.enabled) {
      const reason = `Automação '${automation.title}' está desativada no momento da execução do follow-up.`;
      await repositoryManager.job.cancelJob(job.id, reason, { allowProcessing: true });
      return { valid: false, shouldCancel: true, reason, automation };
    }

    // 5. Verify action exists
    const action = automation.actions?.find(a => a.id === job.actionId);
    if (!action) {
      const reason = `Ação ${job.actionId} não encontrada na automação '${automation.title}'.`;
      await repositoryManager.job.cancelJob(job.id, reason, { allowProcessing: true });
      return { valid: false, shouldCancel: true, reason, automation };
    }

    // 6. Verify trigger is inactive_followup
    if (automation.trigger?.type !== 'inactive_followup') {
      const reason = `Gatilho da automação '${automation.title}' não é mais inactive_followup (${automation.trigger?.type}).`;
      await repositoryManager.job.cancelJob(job.id, reason, { allowProcessing: true });
      return { valid: false, shouldCancel: true, reason, automation, action };
    }

    // 6.1 Verify channel is certified for outbound dispatch
    const targetChannel: ChannelType | undefined =
      conversation?.channel || (automation.channel !== 'all' ? automation.channel : undefined);
    if (targetChannel && !AutomationOutboundDispatcher.isChannelCertified(targetChannel)) {
      const reason = `Canal ${targetChannel} não certificado para envio outbound.`;
      await repositoryManager.job.cancelJob(job.id, reason, { allowProcessing: true });
      return {
        valid: false,
        shouldCancel: true,
        reason,
        automation,
        action,
        conversation,
      };
    }

    // 7. Locate the latest message from customer
    const messages = await repositoryManager.conversation.getMessages(job.conversationId);
    const latestCustomerMsg = this.getLastCustomerMessage(messages);

    // 8 & 9. Compare reference message identifier & check for new customer message
    if (latestCustomerMsg) {
      const isDifferentId = refMsgId && latestCustomerMsg.id !== refMsgId;
      const isNewerTime = refTimestamp && new Date(latestCustomerMsg.createdAt).getTime() > new Date(refTimestamp).getTime();

      if (isDifferentId || isNewerTime) {
        const reason = 'Cliente respondeu antes ou durante a janela de inatividade.';
        await repositoryManager.job.cancelJob(job.id, reason, { allowProcessing: true });
        return {
          valid: false,
          shouldCancel: true,
          reason,
          automation,
          action,
          conversation,
          latestCustomerMessage: latestCustomerMsg,
        };
      }
    }

    // 10. Verify inactivity condition is still satisfied
    const baselineTime = refTimestamp ? new Date(refTimestamp).getTime() : new Date(job.createdAt).getTime();
    const requiredElapsedMs = inactivityMinutes > 0 ? inactivityMinutes * 60 * 1000 : 0;
    const actualElapsedMs = now.getTime() - baselineTime;

    if (requiredElapsedMs > 0 && actualElapsedMs < requiredElapsedMs) {
      const reason = `Janela de inatividade ainda não cumprida (${Math.round(actualElapsedMs / 60000)}m de ${inactivityMinutes}m).`;
      return {
        valid: false,
        shouldCancel: false,
        reason,
        automation,
        action,
        conversation,
      };
    }

    return {
      valid: true,
      automation,
      action,
      conversation,
      latestCustomerMessage: latestCustomerMsg,
    };
  }

  /**
   * Executes a validated due follow-up job.
   */
  static async executeDueFollowup(
    job: AutomationJob,
    options?: { now?: Date; isScheduledExecution?: boolean }
  ): Promise<{ success: boolean; error?: string; actionResult?: ActionExecutionResult }> {
    const revalidation = await this.revalidateFollowupJob(job, options);

    if (!revalidation.valid) {
      return {
        success: false,
        error: revalidation.reason || 'Falha na revalidação do follow-up',
      };
    }

    const { automation, action, conversation } = revalidation;
    if (!automation || !action) {
      return {
        success: false,
        error: 'Dados de automação ou ação ausentes após revalidação.',
      };
    }

    // Reconstruct event for ActionExecutor
    const payload = job.payload || {};
    const payloadEvent = (payload.event as Partial<RuleEngineEvent>) || {};

    const event: RuleEngineEvent = {
      conversationId: job.conversationId,
      channel: (payloadEvent.channel as any) || conversation?.channel || automation.channel || 'whatsapp',
      messageId: payloadEvent.messageId || `scheduled_followup_${job.id}`,
      externalEventId: payloadEvent.externalEventId,
      sender: 'contact', // Reference event origin
      content: payloadEvent.content || '',
      contentType: payloadEvent.contentType || 'text',
      timestamp: payloadEvent.timestamp || new Date().toISOString(),
      contact: payloadEvent.contact || (conversation?.contact as any),
      metadata: {
        isFollowupExecution: true,
        followupJobId: job.id,
      },
    };

    const context: EvaluationContext = {
      conversation: conversation || null,
      isFirstContact: false,
      depth: 1,
    };

    const actionResult = await ActionExecutor.executeAction(action, automation, event, context, {
      isScheduledExecution: true,
    });

    if (actionResult.success) {
      await repositoryManager.job.markCompleted(job.id);
      logScheduler('info', 'FOLLOWUP_JOB_COMPLETED', {
        jobId: job.id,
        automationId: job.automationId,
        conversationId: job.conversationId,
        actionId: job.actionId,
      });
      return { success: true, actionResult };
    } else {
      return { success: false, error: actionResult.error, actionResult };
    }
  }
}
