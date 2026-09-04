/**
 * FABRE AUTOMATION - Rule Engine Types & Contracts
 * Release: Rule Engine | Automação Reativa: Gatilhos -> Condições -> Ações
 * 
 * Agnostic domain types for event ingestion, trigger evaluation,
 * action execution, loop prevention, and idempotency guarantees.
 */

import { 
  ChannelType, 
  MessageContentType, 
  MessageSender, 
  AutomationTriggerType, 
  AutomationActionType, 
  Conversation, 
  Message 
} from '../../types';

/**
 * Normalized incoming event consumed by the Rule Engine
 */
export interface RuleEngineEvent {
  conversationId: string;
  channel: ChannelType;
  messageId: string;
  externalEventId?: string;
  sender: MessageSender;
  content: string;
  contentType: MessageContentType;
  timestamp: string;
  contact?: {
    id?: string;
    name?: string;
    username?: string;
    phone?: string;
    tags?: string[];
  };
  metadata?: Record<string, unknown>;
}

/**
 * Evaluation context passed to triggers and conditions
 */
export interface EvaluationContext {
  conversation?: Conversation | null;
  messagesHistory?: Message[];
  isFirstContact?: boolean;
  inactivityHours?: number;
  depth?: number;
}

/**
 * Result of evaluating a single trigger
 */
export interface TriggerEvaluationResult {
  matched: boolean;
  triggerType: AutomationTriggerType;
  reason?: string;
  matchedKeyword?: string;
  matchedPattern?: string;
}

/**
 * Result of executing a single action
 */
export interface ActionExecutionResult {
  actionId: string;
  actionType: AutomationActionType;
  actionName: string;
  success: boolean;
  executedAt: string;
  message?: string;
  createdMessageId?: string;
  error?: string;
  output?: Record<string, unknown>;
  status?: 'EXECUTED' | 'BLOCKED' | 'FAILED' | 'DUPLICATE' | 'UNSUPPORTED_CHANNEL' | 'PROVIDER_REJECTED';
  dispatchStatus?: 'EXECUTED' | 'BLOCKED' | 'FAILED' | 'DUPLICATE' | 'UNSUPPORTED_CHANNEL' | 'PROVIDER_REJECTED' | 'SKIPPED';
  wamid?: string;
}

/**
 * Result of evaluating and executing a single automation
 */
export interface AutomationExecutionResult {
  automationId: string;
  automationTitle: string;
  triggerMatched: boolean;
  triggerType: AutomationTriggerType;
  matchReason?: string;
  actions: ActionExecutionResult[];
  success: boolean;
  executedAt: string;
  status?: 'EXECUTED' | 'FAILED' | 'SKIPPED';
  durationMs?: number;
  error?: string;
}

/**
 * Status of the entire Rule Engine run for an incoming event
 * Standardized for Governance, Observability & Diagnostic Traceability
 */
export type RuleEngineExecutionStatus =
  | 'EXECUTED'             // Automations evaluated, matched, and executed successfully
  | 'TRIGGER_MATCHED'      // (Standard/Legacy) At least one automation trigger matched and actions executed
  | 'IGNORED_SENDER'       // Sent by operator, bot or system (prevents loops)
  | 'IGNORED_LOOP'         // Message has automation metadata (prevents cascade loops)
  | 'IGNORED_DUPLICATE'    // Already processed this messageId/externalEventId
  | 'IGNORED_NO_MATCH'     // Automations evaluated, but no triggers matched
  | 'NO_TRIGGER_MATCH'     // (Standard/Legacy) Automations evaluated, but no triggers matched
  | 'IGNORED_DISABLED'     // Automations exist for channel but are all disabled
  | 'IGNORED_CHANNEL'      // No automations configured for this channel
  | 'NO_AUTOMATIONS'       // (Legacy) No active automations for the channel
  | 'PROCESSING'           // Event currently undergoing execution
  | 'ACTION_FAILED'        // One or more actions had controlled errors
  | 'FAILED'               // (Alias) Execution failed
  | 'INVALID_EVENT';       // Event missing mandatory fields

/**
 * Full execution report returned by the Rule Engine
 */
export interface RuleEngineResult {
  eventId: string;
  conversationId: string;
  channel: ChannelType;
  status: RuleEngineExecutionStatus;
  reason: string;
  automationsEvaluated: number;
  matchedAutomations: AutomationExecutionResult[];
  timestamp: string;
  durationMs?: number;
}

/**
 * Contract for the Rule Engine service
 */
export interface IRuleEngine {
  processEvent(event: RuleEngineEvent): Promise<RuleEngineResult>;
  processMessage(message: Message, conversation?: Conversation): Promise<RuleEngineResult>;
  clearIdempotencyCache(): void;
  isEventProcessed(eventKey: string): boolean;
  isKeyInFlight?(key: string): boolean;
  getProcessedKeysCount?(): number;
}
