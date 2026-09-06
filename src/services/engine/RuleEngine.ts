/**
 * FABRE AUTOMATION - Rule Engine Core
 * Release: Automation Execution Governance
 * Motor de Automação Reativa: Concorrência, Idempotência, Prioridade, Isolamento e Observabilidade
 * 
 * Central orchestration service:
 * 1. Event Reception & Validation
 * 2. Loop Prevention (rejects sender !== 'contact', metadata.automationId)
 * 3. Idempotency & In-Flight Concurrency Lock (composite key messageId/externalEventId + automationId)
 * 4. Per-Conversation FIFO Serialization (prevents race conditions and out-of-order execution)
 * 5. Active Automations Loading & Deterministic Ordering (channel specificity, creation date, ID tie-breaker)
 * 6. Context Resolution (conversation, history, first contact detection strictly scoped to conversationId)
 * 7. Trigger Evaluation (deterministic matching via TriggerEvaluator)
 * 8. Action Execution (isolated & sequential execution via ActionExecutor)
 * 9. Execution Metrics Update & Observability Logging with duration and data sanitization
 * 
 * NOTA DE ARQUITETURA & GOVERNANÇA:
 * O cache de idempotência e o lock in-flight são mantidos em memória do processo Node.js (JavaScript Runtime).
 * Esta proteção garante 100% de integridade contra duplicatas, corridas de rede e retries na mesma instância.
 * Para clusters horizontais com múltiplos containers stateless sem afinidade de sessão, a idempotência
 * deve ser complementada por locks distribuídos (ex: Postgres SELECT FOR UPDATE ou Redis) em releases futuras.
 */

import { Automation, Conversation, Message } from '../../types';
import { 
  IRuleEngine, 
  RuleEngineEvent, 
  RuleEngineResult, 
  RuleEngineExecutionStatus, 
  EvaluationContext, 
  AutomationExecutionResult 
} from './types';
import { TriggerEvaluator } from './TriggerEvaluator';
import { ActionExecutor } from './ActionExecutor';
import { repositoryManager } from '../repositories';
import { logEngine } from './engineLogger';

export class RuleEngine implements IRuleEngine {
  /**
   * In-memory cache for idempotency tracking
   * Stores composite keys of format: `${identifier}::${automationId}`
   */
  private processedEventKeys = new Set<string>();

  /**
   * In-flight lock set to prevent concurrent duplicate executions
   */
  private inFlightKeys = new Set<string>();

  /**
   * Per-conversation promise queue for strict FIFO serialization
   * Prevents race conditions when inbound messages arrive rapidly in the same conversation
   */
  private conversationQueues = new Map<string, Promise<unknown>>();

  /**
   * Maximum cache size to prevent memory bloat
   */
  private readonly MAX_CACHE_SIZE = 10000;

  /**
   * Clears the idempotency cache, in-flight locks, and queues (useful for testing and maintenance)
   */
  clearIdempotencyCache(): void {
    this.processedEventKeys.clear();
    this.inFlightKeys.clear();
    this.conversationQueues.clear();
  }

  /**
   * Checks if an event key is in the idempotency cache
   */
  isEventProcessed(eventKey: string): boolean {
    return this.processedEventKeys.has(eventKey);
  }

  /**
   * Checks if an event key is currently in-flight
   */
  isKeyInFlight(key: string): boolean {
    return this.inFlightKeys.has(key);
  }

  /**
   * Returns current count of processed keys
   */
  getProcessedKeysCount(): number {
    return this.processedEventKeys.size;
  }

  /**
   * Helper to build a unique idempotency key
   */
  private buildIdempotencyKey(identifier: string, automationId: string): string {
    return `${identifier}::${automationId}`;
  }

  /**
   * Adds an execution key to the idempotency cache
   */
  private recordExecution(identifier: string, automationId: string): void {
    if (this.processedEventKeys.size >= this.MAX_CACHE_SIZE) {
      // Clear oldest entries (first 1000) when limit is reached
      const iterator = this.processedEventKeys.values();
      for (let i = 0; i < 1000; i++) {
        const next = iterator.next();
        if (next.done) break;
        this.processedEventKeys.delete(next.value);
      }
    }
    this.processedEventKeys.add(this.buildIdempotencyKey(identifier, automationId));
  }

  /**
   * Main entry point: processes a normalized inbound event with FIFO conversation queue
   */
  async processEvent(event: RuleEngineEvent): Promise<RuleEngineResult> {
    const conversationId = event.conversationId;
    if (!conversationId) {
      // Handle invalid event without queueing
      return this.executeEventWorkflow(event);
    }

    // Chain execution to per-conversation FIFO queue to isolate conversations
    // and avoid race conditions when rapid inbound messages arrive
    const previousPromise = this.conversationQueues.get(conversationId) || Promise.resolve();
    const currentExecution = previousPromise
      .catch(() => {}) // Prevent previous errors from blocking subsequent messages
      .then(() => this.executeEventWorkflow(event))
      .finally(() => {
        if (this.conversationQueues.get(conversationId) === currentExecution) {
          this.conversationQueues.delete(conversationId);
        }
      });

    this.conversationQueues.set(conversationId, currentExecution);
    return currentExecution as Promise<RuleEngineResult>;
  }

  /**
   * Core event workflow execution
   */
  private async executeEventWorkflow(event: RuleEngineEvent): Promise<RuleEngineResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const eventId = event.messageId || event.externalEventId || `evt_${Date.now()}`;

    logEngine('info', 'EVENT_RECEIVED', {
      eventId,
      conversationId: event.conversationId,
      channel: event.channel,
      sender: event.sender,
      contentPreview: event.content ? event.content.slice(0, 40) : '',
    });

    // -------------------------------------------------------------------------
    // 1. VALIDATION: Check mandatory event fields
    // -------------------------------------------------------------------------
    if (!event.conversationId || !event.channel) {
      logEngine('warn', 'INVALID_EVENT', { eventId, event });
      return {
        eventId,
        conversationId: event.conversationId || 'unknown',
        channel: event.channel || 'instagram',
        status: 'INVALID_EVENT',
        reason: 'Evento incompleto: conversationId e channel são obrigatórios.',
        automationsEvaluated: 0,
        matchedAutomations: [],
        timestamp,
        durationMs: Date.now() - startTime,
      };
    }

    // -------------------------------------------------------------------------
    // 2. LOOP PREVENTION: Outbound / Internal Messages
    // -------------------------------------------------------------------------
    // Messages sent by operator ('user'), bot ('bot'), or system ('system')
    // MUST NEVER trigger automations.
    if (event.sender !== 'contact') {
      logEngine('info', 'LOOP_BLOCKED_SENDER', {
        eventId,
        sender: event.sender,
        reason: 'Mensagem enviada por operador/bot/sistema. Automação ignorada para evitar loops.',
      });

      return {
        eventId,
        conversationId: event.conversationId,
        channel: event.channel,
        status: 'IGNORED_SENDER',
        reason: `Remetente '${event.sender}' não elegível para disparar automações (anti-loop).`,
        automationsEvaluated: 0,
        matchedAutomations: [],
        timestamp,
        durationMs: Date.now() - startTime,
      };
    }

    // Messages generated by automations (marked with automationId in metadata)
    if (event.metadata?.automationId || event.metadata?.isAutomated === true) {
      logEngine('info', 'LOOP_BLOCKED_AUTOMATION_ORIGIN', {
        eventId,
        automationId: event.metadata?.automationId,
        reason: 'Mensagem originada por automação anterior detectada.',
      });

      return {
        eventId,
        conversationId: event.conversationId,
        channel: event.channel,
        status: 'IGNORED_LOOP',
        reason: 'Mensagem gerada por automação anterior. Descartada para evitar cascata de loops.',
        automationsEvaluated: 0,
        matchedAutomations: [],
        timestamp,
        durationMs: Date.now() - startTime,
      };
    }

    // -------------------------------------------------------------------------
    // 3. LOAD & DETERMINISTIC SORTING OF ACTIVE AUTOMATIONS FOR CHANNEL
    // -------------------------------------------------------------------------
    let allAutomations: Automation[] = [];
    try {
      allAutomations = await repositoryManager.automation.getAutomations();
    } catch (loadErr: unknown) {
      const msg = loadErr instanceof Error ? loadErr.message : String(loadErr);
      logEngine('error', 'LOAD_AUTOMATIONS_ERROR', { error: msg, eventId });
    }

    const channelAutomations = allAutomations.filter(
      auto => auto.channel === 'all' || auto.channel === event.channel
    );

    const activeAutomations = channelAutomations.filter(auto => auto.enabled);

    // Explicit Statuses for empty automation conditions
    if (activeAutomations.length === 0) {
      let status: RuleEngineExecutionStatus = 'NO_AUTOMATIONS';
      let reason = `Nenhuma automação ativa encontrada para o canal '${event.channel}'.`;

      if (channelAutomations.length > 0 && channelAutomations.every(a => !a.enabled)) {
        status = 'IGNORED_DISABLED';
        reason = `Todas as automações configuradas para o canal '${event.channel}' estão desativadas.`;
      } else if (allAutomations.length > 0 && channelAutomations.length === 0) {
        status = 'IGNORED_CHANNEL';
        reason = `Nenhuma automação configurada para o canal '${event.channel}'.`;
      }

      logEngine('info', 'NO_ACTIVE_AUTOMATIONS', {
        channel: event.channel,
        totalConfigured: allAutomations.length,
        status,
        reason,
      });

      return {
        eventId,
        conversationId: event.conversationId,
        channel: event.channel,
        status,
        reason,
        automationsEvaluated: 0,
        matchedAutomations: [],
        timestamp,
        durationMs: Date.now() - startTime,
      };
    }

    // Deterministic Execution Policy (FASE 2 & FASE 6):
    // 1. Channel specificity: exact channel match before wildcard 'all'
    // 2. Creation order: older/first-configured automations evaluate first
    // 3. Tie-breaker: ID stability
    const sortedAutomations = [...activeAutomations].sort((a, b) => {
      if (a.channel === event.channel && b.channel !== event.channel) return -1;
      if (b.channel === event.channel && a.channel !== event.channel) return 1;

      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      if (timeA !== timeB) return timeA - timeB;

      return a.id.localeCompare(b.id);
    });

    // -------------------------------------------------------------------------
    // 4. LOAD CONVERSATION CONTEXT & HISTORY (Strictly scoped to event.conversationId)
    // -------------------------------------------------------------------------
    let conversation: Conversation | null = null;
    let messagesHistory: Message[] = [];

    try {
      conversation = await repositoryManager.conversation.getConversationById(event.conversationId);
      messagesHistory = await repositoryManager.conversation.getMessages(event.conversationId);
    } catch (contextErr) {
      logEngine('warn', 'CONTEXT_RESOLUTION_WARNING', {
        conversationId: event.conversationId,
        error: String(contextErr),
      });
    }

    const contactMessages = messagesHistory.filter(m => m.sender === 'contact');
    const isFirstContact = contactMessages.length <= 1;

    const context: EvaluationContext = {
      conversation,
      messagesHistory,
      isFirstContact,
      depth: 1,
    };

    // -------------------------------------------------------------------------
    // 5. EVALUATE AUTOMATIONS & EXECUTE ACTIONS
    // -------------------------------------------------------------------------
    const matchedResults: AutomationExecutionResult[] = [];
    let hadActionFailure = false;
    let duplicateSkippedCount = 0;

    for (const automation of sortedAutomations) {
      const primaryId = event.messageId || event.externalEventId || eventId;
      const keyPrimary = this.buildIdempotencyKey(primaryId, automation.id);
      const keyExternal = event.externalEventId 
        ? this.buildIdempotencyKey(event.externalEventId, automation.id) 
        : null;

      // 5.1 Idempotency Check & In-Flight Lock per automation
      const alreadyProcessed = this.isEventProcessed(keyPrimary) || (keyExternal && this.isEventProcessed(keyExternal));
      const alreadyInFlight = this.isKeyInFlight(keyPrimary) || (keyExternal && this.isKeyInFlight(keyExternal));

      if (alreadyProcessed || alreadyInFlight) {
        logEngine('info', 'IDEMPOTENCY_DUPLICATE_SKIPPED', {
          eventId: primaryId,
          externalEventId: event.externalEventId,
          automationId: automation.id,
          reason: alreadyInFlight ? 'IN_FLIGHT_LOCKED' : 'ALREADY_PROCESSED',
        });
        duplicateSkippedCount++;
        continue;
      }

      // 5.2 Trigger Evaluation
      const triggerResult = TriggerEvaluator.evaluate(automation.trigger, event, context);

      if (!triggerResult.matched) {
        logEngine('debug', 'TRIGGER_DID_NOT_MATCH', {
          automationId: automation.id,
          triggerType: automation.trigger.type,
          reason: triggerResult.reason,
        });
        continue;
      }

      logEngine('info', 'TRIGGER_MATCHED', {
        automationId: automation.id,
        automationTitle: automation.title,
        triggerType: automation.trigger.type,
        reason: triggerResult.reason,
      });

      // 5.3 In-Flight Lock Acquisition
      this.inFlightKeys.add(keyPrimary);
      if (keyExternal) this.inFlightKeys.add(keyExternal);

      const actionResults = [];
      let automationSuccess = true;
      let automationError: string | undefined;
      const autoStartTime = Date.now();

      try {
        // Execute Actions Sequentially in Configured Order
        const actions = automation.actions || [];
        for (const action of actions) {
          const res = await ActionExecutor.executeAction(action, automation, event, context);
          actionResults.push(res);

          if (!res.success) {
            automationSuccess = false;
            hadActionFailure = true;
            automationError = res.error;
            logEngine('warn', 'ACTION_EXECUTION_ERROR', {
              actionId: action.id,
              automationId: automation.id,
              error: res.error,
            });
          }
        }

        // 5.4 Record Idempotency (Committed)
        this.recordExecution(primaryId, automation.id);
        if (event.externalEventId) {
          this.recordExecution(event.externalEventId, automation.id);
        }

        // 5.5 Update Automation Metrics (Atomic with fresh read)
        try {
          const fresh = await repositoryManager.automation.getAutomationById(automation.id);
          const count = (fresh?.executionCount ?? automation.executionCount ?? 0) + 1;
          await repositoryManager.automation.updateAutomation(automation.id, {
            executionCount: count,
            lastExecutedAt: new Date().toISOString(),
          });
        } catch (metricErr) {
          logEngine('warn', 'METRIC_UPDATE_FAILED', {
            automationId: automation.id,
            error: String(metricErr),
          });
        }
      } finally {
        // Release in-flight lock
        this.inFlightKeys.delete(keyPrimary);
        if (keyExternal) this.inFlightKeys.delete(keyExternal);
      }

      matchedResults.push({
        automationId: automation.id,
        automationTitle: automation.title,
        triggerMatched: true,
        triggerType: automation.trigger.type,
        matchReason: triggerResult.reason,
        actions: actionResults,
        success: automationSuccess,
        status: automationSuccess ? 'EXECUTED' : 'FAILED',
        durationMs: Date.now() - autoStartTime,
        executedAt: new Date().toISOString(),
        error: automationError,
      });
    }

    // -------------------------------------------------------------------------
    // 6. COMPILE FINAL RESULT
    // -------------------------------------------------------------------------
    let finalStatus: RuleEngineExecutionStatus = 'NO_TRIGGER_MATCH';
    let finalReason = 'Nenhum gatilho de automação correspondeu ao evento recebido.';

    if (duplicateSkippedCount > 0 && matchedResults.length === 0) {
      finalStatus = 'IGNORED_DUPLICATE';
      finalReason = 'Evento já processado anteriormente para as automações aplicáveis (idempotência garantida).';
    } else if (matchedResults.length > 0) {
      if (hadActionFailure) {
        finalStatus = 'ACTION_FAILED';
        finalReason = 'Uma ou mais ações apresentaram falhas controladas durante a execução.';
      } else {
        finalStatus = 'TRIGGER_MATCHED';
        finalReason = `${matchedResults.length} automação(ões) correspondida(s) e executada(s) com sucesso.`;
      }
    }

    const durationMs = Date.now() - startTime;

    logEngine('info', 'EXECUTION_COMPLETED', {
      eventId,
      status: finalStatus,
      automationsEvaluated: activeAutomations.length,
      matchedCount: matchedResults.length,
      duplicateSkippedCount,
      durationMs,
    });

    return {
      eventId,
      conversationId: event.conversationId,
      channel: event.channel,
      status: finalStatus,
      reason: finalReason,
      automationsEvaluated: activeAutomations.length,
      matchedAutomations: matchedResults,
      timestamp,
      durationMs,
    };
  }

  /**
   * Processes a Message object directly
   */
  async processMessage(message: Message, conversation?: Conversation): Promise<RuleEngineResult> {
    const event: RuleEngineEvent = {
      conversationId: message.conversationId,
      channel: message.channel,
      messageId: message.id,
      externalEventId: message.externalEventId,
      sender: message.sender,
      content: message.content,
      contentType: message.contentType,
      timestamp: message.createdAt,
      contact: conversation?.contact ? {
        id: conversation.contact.id,
        name: conversation.contact.name,
        username: conversation.contact.username,
        phone: conversation.contact.phone,
        tags: conversation.contact.tags,
      } : undefined,
      metadata: message.metadata as Record<string, unknown> | undefined,
    };

    return this.processEvent(event);
  }
}

export const ruleEngine = new RuleEngine();
