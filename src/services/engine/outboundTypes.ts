/**
 * FABRE AUTOMATION - Outbound Hardening Types & Contracts
 * Release 16: Real WhatsApp Outbound Delivery Hardening
 * 
 * Formal contracts, error classification, and retry policies for official WhatsApp outbound.
 */

import { ChannelType, AutomationActionType } from '../../types';

export type OutboundErrorCategory =
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'VALIDATION_ERROR'
  | 'META_API_ERROR'
  | 'META_POLICY_ERROR'
  | 'TRANSIENT_NETWORK_ERROR'
  | 'PERSISTENCE_ERROR'
  | 'DUPLICATE_EXECUTION';

export type OutboundDispatchStatus =
  | 'EXECUTED'
  | 'DUPLICATE'
  | 'UNSUPPORTED_CHANNEL'
  | 'VALIDATION_FAILED'
  | 'PROVIDER_REJECTED'
  | 'BLOCKED'
  | 'SKIPPED'
  | 'FAILED';

export interface OutboundValidationContext {
  conversationExists: boolean;
  isWhatsAppChannel: boolean;
  hasValidRecipient: boolean;
  automationExists: boolean;
  isAutomationEnabled: boolean;
  actionExists: boolean;
  actionBelongsToAutomation: boolean;
  isSupportedActionType: boolean;
  hasMessageText: boolean;
  isMessageTextNonEmpty: boolean;
}

export interface HardenedOutboundDispatchParams {
  conversationId: string;
  automationId: string;
  automationTitle: string;
  actionId: string;
  actionType: AutomationActionType;
  channel: ChannelType;
  /**
   * Note: Untrusted parameter if passed from caller.
   * Dispatcher will prefer the authoritative text from the database action record.
   */
  untrustedCallerText?: string;
  messageId?: string;
  externalEventId?: string;
}

export type OutboundValidationCode =
  | 'CONVERSATION_NOT_FOUND'
  | 'UNSUPPORTED_CHANNEL'
  | 'AUTOMATION_NOT_FOUND'
  | 'AUTOMATION_DISABLED'
  | 'ACTION_NOT_FOUND'
  | 'ACTION_NOT_BELONGING'
  | 'UNSUPPORTED_ACTION_TYPE'
  | 'EMPTY_MESSAGE_TEXT'
  | 'INVALID_RECIPIENT'
  | 'MISSING_CREDENTIALS'
  | 'MISSING_WAMID';

export interface OutboundDeliveryResult {
  success: boolean;
  status: OutboundDispatchStatus;
  messageId?: string;
  wamid?: string;
  error?: string;
  errorCategory?: OutboundErrorCategory;
  validationCode?: OutboundValidationCode;
  isRetryable?: boolean;
  httpStatus?: number;
}

export interface HardenedOutboundResult extends OutboundDeliveryResult {
  rawResponse?: unknown;
}

/**
 * Maps an HTTP status or Meta error code to an OutboundErrorCategory
 */
export function mapHttpStatusToOutboundErrorCategory(
  status?: number,
  metaCode?: number | string,
  errorMessage?: string
): OutboundErrorCategory {
  const codeNum = Number(metaCode);

  if (codeNum === 131047 || codeNum === 131030) {
    return 'META_POLICY_ERROR';
  }
  if (codeNum === 190 || status === 401) {
    return 'AUTHENTICATION_ERROR';
  }
  if (status === 403) {
    return 'AUTHORIZATION_ERROR';
  }
  if (status === 400 || (status && status >= 400 && status < 500 && status !== 429)) {
    if (errorMessage && /recipient|phone|action|conversation|valid/i.test(errorMessage)) {
      return 'VALIDATION_ERROR';
    }
    return 'META_API_ERROR';
  }
  if (status === 429 || codeNum === 130429) {
    return 'META_API_ERROR';
  }
  if (status && status >= 500) {
    if (status === 502 || status === 504 || (errorMessage && /network|econnrefused|timeout/i.test(errorMessage))) {
      return 'TRANSIENT_NETWORK_ERROR';
    }
    return 'META_API_ERROR';
  }
  return 'META_API_ERROR';
}

/**
 * Determines deterministically if an outbound error is transient (safe to retry)
 * or permanent (must fail immediately without retries).
 */
export function isTransientOutboundError(
  errorCategory?: OutboundErrorCategory,
  metaCode?: number | string,
  httpStatus?: number
): boolean {
  const codeNum = Number(metaCode);

  if (codeNum === 131047 || codeNum === 131030 || codeNum === 190) {
    return false;
  }

  if (codeNum === 130429 || httpStatus === 429) {
    return true;
  }

  if (httpStatus && httpStatus >= 500 && httpStatus <= 599) {
    return true;
  }

  if (!errorCategory) {
    return false;
  }

  switch (errorCategory) {
    case 'TRANSIENT_NETWORK_ERROR':
      return true;
    case 'META_API_ERROR':
      return httpStatus === 429 || codeNum === 130429 || (Boolean(httpStatus) && httpStatus! >= 500 && httpStatus! <= 599);
    case 'AUTHENTICATION_ERROR':
    case 'AUTHORIZATION_ERROR':
    case 'VALIDATION_ERROR':
    case 'META_POLICY_ERROR':
    case 'PERSISTENCE_ERROR':
    case 'DUPLICATE_EXECUTION':
    default:
      return false;
  }
}
