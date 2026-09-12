/**
 * FABRE AUTOMATION - Automation Outbound Dispatcher
 * Release: Automation Outbound Dispatch | Fechamento do Ciclo Reativo
 * 
 * Central dispatcher responsible for sending automated bot messages to external channels.
 * - Enforces server-side dispatch for WhatsApp Business Cloud API
 * - Rejects uncertified channels (Instagram, Messenger) fail-closed
 * - Prevents loops and ensures idempotency
 * - Seamlessly integrates with Mock Provider and Supabase Edge Functions
 */

import { ChannelType, AutomationActionType } from '../../types';
import { repositoryManager } from '../repositories';
import { getSupabaseClient } from '../../lib/supabase';
import { logEngine, logOutbound } from './engineLogger';
import {
  OutboundDispatchStatus,
  OutboundErrorCategory,
  OutboundValidationCode,
  OutboundDeliveryResult,
  isTransientOutboundError,
  mapHttpStatusToOutboundErrorCategory,
} from './outboundTypes';

export interface AutomationDispatchParams {
  conversationId: string;
  automationId: string;
  automationTitle: string;
  actionId: string;
  actionType: AutomationActionType;
  channel: ChannelType;
  text: string;
  messageId?: string;
  externalEventId?: string;
}

export interface AutomationDispatchResult extends OutboundDeliveryResult {
  rawResponse?: unknown;
}

export class AutomationOutboundDispatcher {
  // Certified outbound channels registry.
  // WhatsApp is the only certified outbound channel in this Release.
  private static certifiedChannels: Map<ChannelType, boolean> = new Map([
    ['whatsapp', true],
    ['instagram', false],
    ['messenger', false],
  ]);

  // When strict outbound is enforced, uncertified channels are rejected fail-closed.
  private static strictOutboundEnforced = false;

  // Mode selector: 'auto' delegates to repositoryManager provider, or explicit 'mock' / 'real'
  private static dispatcherMode: 'mock' | 'real' | 'auto' = 'auto';

  /**
   * Configure dispatcher mode ('mock' | 'real' | 'auto')
   */
  static setDispatcherMode(mode: 'mock' | 'real' | 'auto'): void {
    this.dispatcherMode = mode;
  }

  /**
   * Get active dispatcher mode
   */
  static getDispatcherMode(): 'mock' | 'real' {
    if (this.dispatcherMode !== 'auto') {
      return this.dispatcherMode;
    }
    return repositoryManager.getProvider() === 'mock' ? 'mock' : 'real';
  }

  /**
   * Check if an outbound channel has an officially certified dispatcher
   */
  static isChannelCertified(channel: ChannelType): boolean {
    return this.certifiedChannels.get(channel) === true;
  }

  /**
   * Alias for checking certified dispatcher
   */
  static hasCertifiedDispatcher(channel: ChannelType): boolean {
    return this.isChannelCertified(channel);
  }

  /**
   * Configure certification for a channel (used in testing or expansion)
   */
  static setChannelCertified(channel: ChannelType, certified: boolean): void {
    this.certifiedChannels.set(channel, certified);
  }

  /**
   * Reset channel certification to default release standards
   */
  static resetChannelCertification(): void {
    this.certifiedChannels.set('whatsapp', true);
    this.certifiedChannels.set('instagram', false);
    this.certifiedChannels.set('messenger', false);
    this.strictOutboundEnforced = false;
  }

  /**
   * Check if strict outbound dispatch enforcement is active
   */
  static isStrictOutboundEnforced(): boolean {
    return this.strictOutboundEnforced;
  }

  /**
   * Set strict outbound dispatch enforcement
   */
  static setStrictOutboundEnforced(enforce: boolean): void {
    this.strictOutboundEnforced = enforce;
  }

  /**
   * Dispatch an automated message through the appropriate channel dispatcher
   */
  static async dispatchAutomatedMessage(
    params: AutomationDispatchParams
  ): Promise<AutomationDispatchResult> {
    const { channel, conversationId, automationId, automationTitle, actionId, actionType, text, messageId, externalEventId } = params;

    logOutbound('info', 'OUTBOUND_REQUESTED', {
      channel,
      conversationId,
      automationId,
      actionId,
      messageId,
    });

    // 1. Channel Certification Verification
    // Reject uncertified channels (Instagram, Messenger) fail-closed
    if (!this.isChannelCertified(channel)) {
      const channelLabel = channel === 'instagram' ? 'Instagram' : channel === 'messenger' ? 'Messenger' : channel;
      const errorMsg = `Envio outbound automatizado para o canal ${channelLabel} ainda não está certificado nesta Release. Apenas WhatsApp Business Cloud API está habilitado.`;
      
      logOutbound('warn', 'OUTBOUND_FAILED', {
        channel,
        conversationId,
        automationId,
        actionId,
        errorCategory: 'VALIDATION_ERROR',
        validationCode: 'UNSUPPORTED_CHANNEL',
        reason: 'Canal sem dispatcher outbound certificado',
      });

      return {
        success: false,
        status: 'UNSUPPORTED_CHANNEL',
        errorCategory: 'VALIDATION_ERROR',
        validationCode: 'UNSUPPORTED_CHANNEL',
        isRetryable: false,
        error: errorMsg,
      };
    }

    // 2. Dispatch for WhatsApp Business Cloud API
    if (channel === 'whatsapp') {
      return this.dispatchWhatsApp({
        conversationId,
        automationId,
        automationTitle,
        actionId,
        actionType,
        channel,
        text,
        messageId,
        externalEventId,
      });
    }

    // Fallback for any unanticipated channel
    return {
      success: false,
      status: 'UNSUPPORTED_CHANNEL',
      errorCategory: 'VALIDATION_ERROR',
      validationCode: 'UNSUPPORTED_CHANNEL',
      isRetryable: false,
      error: `Canal ${channel} não suportado para despacho automatizado.`,
    };
  }

  /**
   * Internal WhatsApp Outbound Dispatcher (handles Mock mode and Supabase Edge Function)
   */
  private static async dispatchWhatsApp(
    params: AutomationDispatchParams
  ): Promise<AutomationDispatchResult> {
    const { conversationId, automationId, automationTitle, actionId, actionType, text, messageId, externalEventId } = params;

    // =========================================================================
    // A. MOCK PROVIDER EXECUTION (Offline, CI/CD, Test Runner)
    // =========================================================================
    if (this.getDispatcherMode() === 'mock') {
      // 1. Validate Conversation
      const conversation = await repositoryManager.conversation.getConversationById(conversationId);
      if (!conversation) {
        logOutbound('warn', 'OUTBOUND_FAILED', {
          conversationId,
          errorCategory: 'VALIDATION_ERROR',
          validationCode: 'CONVERSATION_NOT_FOUND',
        });
        return {
          success: false,
          status: 'FAILED',
          errorCategory: 'VALIDATION_ERROR',
          validationCode: 'CONVERSATION_NOT_FOUND',
          isRetryable: false,
          error: `Conversa ${conversationId} não encontrada.`,
        };
      }

      if (conversation.channel !== 'whatsapp') {
        logOutbound('warn', 'OUTBOUND_FAILED', {
          conversationId,
          channel: conversation.channel,
          errorCategory: 'VALIDATION_ERROR',
          validationCode: 'UNSUPPORTED_CHANNEL',
        });
        return {
          success: false,
          status: 'UNSUPPORTED_CHANNEL',
          errorCategory: 'VALIDATION_ERROR',
          validationCode: 'UNSUPPORTED_CHANNEL',
          isRetryable: false,
          error: `Conversa com canal ${conversation.channel} não suportado para WhatsApp outbound.`,
        };
      }

      // 2. Validate Automation & Action
      const automation = await repositoryManager.automation.getAutomationById(automationId);
      if (!automation) {
        logOutbound('warn', 'OUTBOUND_FAILED', {
          automationId,
          errorCategory: 'VALIDATION_ERROR',
          validationCode: 'AUTOMATION_NOT_FOUND',
        });
        return {
          success: false,
          status: 'FAILED',
          errorCategory: 'VALIDATION_ERROR',
          validationCode: 'AUTOMATION_NOT_FOUND',
          isRetryable: false,
          error: `Automação ${automationId} não encontrada.`,
        };
      }

      if (automation.enabled === false) {
        logOutbound('warn', 'OUTBOUND_FAILED', {
          automationId,
          errorCategory: 'VALIDATION_ERROR',
          validationCode: 'AUTOMATION_DISABLED',
        });
        return {
          success: false,
          status: 'BLOCKED',
          errorCategory: 'VALIDATION_ERROR',
          validationCode: 'AUTOMATION_DISABLED',
          isRetryable: false,
          error: `Automação ${automationId} está desativada.`,
        };
      }

      const matchedAction = (automation.actions || []).find((a) => a.id === actionId);
      if (!matchedAction) {
        logOutbound('warn', 'OUTBOUND_FAILED', {
          automationId,
          actionId,
          errorCategory: 'VALIDATION_ERROR',
          validationCode: 'ACTION_NOT_FOUND',
        });
        return {
          success: false,
          status: 'FAILED',
          errorCategory: 'VALIDATION_ERROR',
          validationCode: 'ACTION_NOT_FOUND',
          isRetryable: false,
          error: `Ação ${actionId} não pertence à automação ${automationId}.`,
        };
      }

      const verifiedText = String(matchedAction.config?.messageText || matchedAction.config?.text || '').trim();
      if (!verifiedText) {
        logOutbound('warn', 'OUTBOUND_FAILED', {
          automationId,
          actionId,
          errorCategory: 'VALIDATION_ERROR',
          validationCode: 'EMPTY_MESSAGE_TEXT',
        });
        return {
          success: false,
          status: 'FAILED',
          errorCategory: 'VALIDATION_ERROR',
          validationCode: 'EMPTY_MESSAGE_TEXT',
          isRetryable: false,
          error: `Texto da mensagem de automação ${actionId} não configurado no banco de dados.`,
        };
      }

      // 3. Validate Recipient Phone
      const contact = conversation.contact;
      const rawPhone = contact?.phone || (contact as any)?.metadata?.wa_id || contact?.username?.replace(/^wa_/, '') || '';
      let recipientPhone = rawPhone.replace(/\D/g, '');

      // In mock mode only, if contact has no phone configured at all, fallback for legacy test fixtures
      if (!recipientPhone && this.getDispatcherMode() === 'mock' && contact?.id) {
        recipientPhone = '5511999999999';
      }

      if (!recipientPhone || recipientPhone.length < 8 || recipientPhone.length > 15) {
        logOutbound('warn', 'OUTBOUND_FAILED', {
          conversationId,
          recipient: recipientPhone,
          errorCategory: 'VALIDATION_ERROR',
          validationCode: 'INVALID_RECIPIENT',
        });
        return {
          success: false,
          status: 'FAILED',
          errorCategory: 'VALIDATION_ERROR',
          validationCode: 'INVALID_RECIPIENT',
          isRetryable: false,
          error: `Número de telefone do destinatário inválido ou fora do padrão ITU-T E.164 (8 a 15 dígitos): ${recipientPhone}`,
        };
      }

      // 4. Idempotency Check
      if (messageId) {
        const existingMessages = await repositoryManager.conversation.getMessages(conversationId);
        const duplicate = existingMessages.find(
          (m) =>
            m.sender === 'bot' &&
            (m.metadata as any)?.triggeredByMessageId === messageId &&
            (m.metadata as any)?.actionId === actionId
        );

        if (duplicate) {
          logOutbound('info', 'OUTBOUND_DUPLICATE_IGNORED', {
            conversationId,
            messageId: duplicate.id,
            wamid: duplicate.externalEventId,
            triggeredBy: messageId,
          });

          return {
            success: true,
            status: 'DUPLICATE',
            errorCategory: 'DUPLICATE_EXECUTION',
            isRetryable: false,
            messageId: duplicate.id,
            wamid: duplicate.externalEventId,
            rawResponse: { duplicate: true, existingMessageId: duplicate.id },
          };
        }
      }

      logOutbound('info', 'OUTBOUND_VALIDATED', {
        conversationId,
        automationId,
        actionId,
        recipient: recipientPhone,
      });

      // Generate realistic mock wamid
      const mockWamid = `wamid.mock_auto_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      try {
        const createdMsg = await repositoryManager.conversation.createMessage({
          conversationId,
          sender: 'bot',
          channel: 'whatsapp',
          content: verifiedText,
          contentType: 'text',
          status: 'sent',
          externalEventId: mockWamid,
          metadata: {
            automationId,
            automationName: automationTitle,
            actionId,
            actionType,
            isAutomated: true,
            recipient: recipientPhone,
            triggeredByMessageId: messageId || null,
            externalEventId: externalEventId || null,
            wamid: mockWamid,
            sent_by: 'automation_engine',
          },
        });

        logOutbound('info', 'OUTBOUND_SENT', {
          conversationId,
          wamid: mockWamid,
          recipient: recipientPhone,
        });

        logOutbound('info', 'OUTBOUND_PERSISTED', {
          conversationId,
          messageId: createdMsg.id,
          wamid: mockWamid,
        });

        return {
          success: true,
          status: 'EXECUTED',
          messageId: createdMsg.id,
          wamid: mockWamid,
          isRetryable: false,
          rawResponse: { mock: true, wamid: mockWamid },
        };
      } catch (mockErr: unknown) {
        const errText = mockErr instanceof Error ? mockErr.message : String(mockErr);
        logOutbound('error', 'OUTBOUND_FAILED', {
          conversationId,
          errorCategory: 'PERSISTENCE_ERROR',
          error: errText,
        });

        return {
          success: false,
          status: 'FAILED',
          errorCategory: 'PERSISTENCE_ERROR',
          isRetryable: false,
          error: `Falha ao persistir mensagem automatizada no mock: ${errText}`,
        };
      }
    }

    // =========================================================================
    // B. SUPABASE / REAL META BUSINESS CLOUD API EXECUTION
    // =========================================================================
    const supabase = getSupabaseClient();
    if (!supabase) {
      logOutbound('error', 'OUTBOUND_FAILED', {
        conversationId,
        errorCategory: 'VALIDATION_ERROR',
        error: 'Cliente Supabase não configurado ou indisponível',
      });

      return {
        success: false,
        status: 'FAILED',
        errorCategory: 'VALIDATION_ERROR',
        isRetryable: false,
        error: 'Cliente Supabase não configurado para execução de Edge Function.',
      };
    }

    try {
      logOutbound('info', 'OUTBOUND_REQUESTED', {
        conversationId,
        automationId,
        actionId,
        target: 'meta-automation-send-message',
      });

      // Attach Authorization Bearer token from active operator session or service key
      let headers: Record<string, string> | undefined = undefined;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.access_token) {
          headers = {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          };
        }
      } catch {
        // Fallback to client default headers
      }

      const { data, error } = await supabase.functions.invoke('meta-automation-send-message', {
        headers,
        body: {
          conversationId,
          automationId,
          actionId,
          text,
          messageId,
          externalEventId,
        },
      });

      if (error) {
        const errorCategory = mapHttpStatusToOutboundErrorCategory(
          (error as any).status || 500,
          undefined,
          error.message
        );
        const retryable = isTransientOutboundError(errorCategory, undefined, (error as any).status);

        logOutbound('error', 'OUTBOUND_FAILED', {
          conversationId,
          errorCategory,
          isRetryable: retryable,
          error: error.message,
        });

        return {
          success: false,
          status: 'PROVIDER_REJECTED',
          errorCategory,
          isRetryable: retryable,
          error: error.message || 'Falha ao invocar Edge Function meta-automation-send-message',
          rawResponse: error,
        };
      }

      // Handle duplicate event
      if (data?.status === 'DUPLICATE') {
        logOutbound('info', 'OUTBOUND_DUPLICATE_IGNORED', {
          conversationId,
          messageId: data.existingMessageId,
          wamid: data.wamid,
        });

        return {
          success: true,
          status: 'DUPLICATE',
          errorCategory: 'DUPLICATE_EXECUTION',
          isRetryable: false,
          messageId: data.existingMessageId,
          wamid: data.wamid,
          rawResponse: data,
        };
      }

      // Handle unsupported channel returned by Edge Function
      if (data?.status === 'UNSUPPORTED_CHANNEL') {
        logOutbound('warn', 'OUTBOUND_FAILED', {
          conversationId,
          errorCategory: 'VALIDATION_ERROR',
          validationCode: 'UNSUPPORTED_CHANNEL',
          error: data.error,
        });

        return {
          success: false,
          status: 'UNSUPPORTED_CHANNEL',
          errorCategory: 'VALIDATION_ERROR',
          validationCode: 'UNSUPPORTED_CHANNEL',
          isRetryable: false,
          error: data.error,
          rawResponse: data,
        };
      }

      // Handle success
      if (data?.status === 'SUCCESS' && data.message?.id) {
        const resolvedWamid = data.externalId || data.wamid || data.message.external_event_id;

        if (!resolvedWamid) {
          logOutbound('error', 'OUTBOUND_FAILED', {
            conversationId,
            errorCategory: 'META_API_ERROR',
            validationCode: 'MISSING_WAMID',
            error: 'Sucesso retornado sem identificador oficial wamid',
          });

          return {
            success: false,
            status: 'PROVIDER_REJECTED',
            errorCategory: 'META_API_ERROR',
            validationCode: 'MISSING_WAMID',
            isRetryable: true,
            error: 'A Meta Cloud API confirmou a requisição, mas não retornou o identificador oficial da mensagem (wamid ausente).',
            rawResponse: data,
          };
        }

        logOutbound('info', 'OUTBOUND_SENT', {
          conversationId,
          wamid: resolvedWamid,
        });

        logOutbound('info', 'OUTBOUND_PERSISTED', {
          conversationId,
          messageId: data.message.id,
          wamid: resolvedWamid,
        });

        return {
          success: true,
          status: 'EXECUTED',
          messageId: data.message.id,
          wamid: resolvedWamid,
          isRetryable: false,
          rawResponse: data,
        };
      }

      // Provider failure / rejection with classification
      const responseCategory = (data?.errorCategory as OutboundErrorCategory) ||
        mapHttpStatusToOutboundErrorCategory(
          data?.code === 'UNAUTHORIZED' ? 401 : data?.code === 'FORBIDDEN' ? 403 : 400,
          data?.metaCode,
          data?.error
        );
      const retryable = data?.isRetryable !== undefined
        ? Boolean(data.isRetryable)
        : isTransientOutboundError(responseCategory, data?.metaCode);

      logOutbound('error', 'OUTBOUND_FAILED', {
        conversationId,
        status: data?.status,
        errorCategory: responseCategory,
        isRetryable: retryable,
        error: data?.error,
      });

      return {
        success: false,
        status: data?.status || 'PROVIDER_REJECTED',
        errorCategory: responseCategory,
        isRetryable: retryable,
        error: data?.error || 'A Meta Cloud API rejeitou o envio da mensagem automatizada.',
        rawResponse: data,
      };
    } catch (invokeException: unknown) {
      const exceptionMsg = invokeException instanceof Error ? invokeException.message : String(invokeException);
      
      logOutbound('error', 'OUTBOUND_FAILED', {
        conversationId,
        errorCategory: 'TRANSIENT_NETWORK_ERROR',
        isRetryable: true,
        error: exceptionMsg,
      });

      return {
        success: false,
        status: 'FAILED',
        errorCategory: 'TRANSIENT_NETWORK_ERROR',
        isRetryable: true,
        error: `Exceção de rede na comunicação com a Edge Function: ${exceptionMsg}`,
      };
    }
  }
}
