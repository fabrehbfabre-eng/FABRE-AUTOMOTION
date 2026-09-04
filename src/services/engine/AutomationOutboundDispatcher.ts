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
import { logEngine } from './engineLogger';

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

export interface AutomationDispatchResult {
  success: boolean;
  status: 'EXECUTED' | 'BLOCKED' | 'FAILED' | 'DUPLICATE' | 'UNSUPPORTED_CHANNEL' | 'PROVIDER_REJECTED';
  messageId?: string;
  wamid?: string;
  error?: string;
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

    // 1. Channel Certification Verification
    // Reject uncertified channels (Instagram, Messenger) fail-closed
    if (!this.isChannelCertified(channel)) {
      const channelLabel = channel === 'instagram' ? 'Instagram' : channel === 'messenger' ? 'Messenger' : channel;
      const errorMsg = `Envio outbound automatizado para o canal ${channelLabel} ainda não está certificado nesta Release. Apenas WhatsApp Business Cloud API está habilitado.`;
      
      logEngine('warn', 'AUTOMATION_DISPATCH_UNSUPPORTED_CHANNEL', {
        channel,
        conversationId,
        automationId,
        actionId,
        reason: 'Canal sem dispatcher outbound certificado',
      });

      return {
        success: false,
        status: 'UNSUPPORTED_CHANNEL',
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
      logEngine('info', 'AUTOMATION_DISPATCH_MOCK_START', {
        conversationId,
        automationId,
        actionId,
      });

      // Generate realistic mock wamid
      const mockWamid = `wamid.mock_auto_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      try {
        const createdMsg = await repositoryManager.conversation.createMessage({
          conversationId,
          sender: 'bot',
          channel: 'whatsapp',
          content: text,
          contentType: 'text',
          status: 'sent',
          externalEventId: mockWamid,
          metadata: {
            automationId,
            automationName: automationTitle,
            actionId,
            actionType,
            isAutomated: true,
            triggeredByMessageId: messageId || null,
            externalEventId: externalEventId || null,
            wamid: mockWamid,
            sent_by: 'automation_engine',
          },
        });

        logEngine('info', 'AUTOMATION_DISPATCH_MOCK_SUCCESS', {
          conversationId,
          messageId: createdMsg.id,
          wamid: mockWamid,
        });

        return {
          success: true,
          status: 'EXECUTED',
          messageId: createdMsg.id,
          wamid: mockWamid,
          rawResponse: { mock: true, wamid: mockWamid },
        };
      } catch (mockErr: unknown) {
        const errText = mockErr instanceof Error ? mockErr.message : String(mockErr);
        logEngine('error', 'AUTOMATION_DISPATCH_MOCK_ERROR', {
          conversationId,
          error: errText,
        });

        return {
          success: false,
          status: 'FAILED',
          error: `Falha ao persistir mensagem automatizada no mock: ${errText}`,
        };
      }
    }

    // =========================================================================
    // B. SUPABASE / REAL META BUSINESS CLOUD API EXECUTION
    // =========================================================================
    const supabase = getSupabaseClient();
    if (!supabase) {
      logEngine('error', 'AUTOMATION_DISPATCH_NO_CLIENT', {
        conversationId,
        error: 'Cliente Supabase não configurado ou indisponível',
      });

      return {
        success: false,
        status: 'FAILED',
        error: 'Cliente Supabase não configurado para execução de Edge Function.',
      };
    }

    try {
      logEngine('info', 'AUTOMATION_DISPATCH_EDGE_FUNCTION_INVOKE', {
        conversationId,
        automationId,
        actionId,
        functionName: 'meta-automation-send-message',
      });

      const { data, error } = await supabase.functions.invoke('meta-automation-send-message', {
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
        logEngine('error', 'AUTOMATION_DISPATCH_EDGE_FUNCTION_ERROR', {
          conversationId,
          error: error.message,
        });

        return {
          success: false,
          status: 'PROVIDER_REJECTED',
          error: error.message || 'Falha ao invocar Edge Function meta-automation-send-message',
          rawResponse: error,
        };
      }

      // Handle duplicate event
      if (data?.status === 'DUPLICATE') {
        logEngine('info', 'AUTOMATION_DISPATCH_DUPLICATE', {
          conversationId,
          messageId: data.existingMessageId,
          wamid: data.wamid,
        });

        return {
          success: true,
          status: 'DUPLICATE',
          messageId: data.existingMessageId,
          wamid: data.wamid,
          rawResponse: data,
        };
      }

      // Handle unsupported channel returned by Edge Function
      if (data?.status === 'UNSUPPORTED_CHANNEL') {
        return {
          success: false,
          status: 'UNSUPPORTED_CHANNEL',
          error: data.error,
          rawResponse: data,
        };
      }

      // Handle success
      if (data?.status === 'SUCCESS' && data.message?.id) {
        const resolvedWamid = data.externalId || data.wamid || data.message.external_event_id;

        logEngine('info', 'AUTOMATION_DISPATCH_SUCCESS', {
          conversationId,
          messageId: data.message.id,
          wamid: resolvedWamid,
        });

        return {
          success: true,
          status: 'EXECUTED',
          messageId: data.message.id,
          wamid: resolvedWamid,
          rawResponse: data,
        };
      }

      // Provider failure / rejection
      return {
        success: false,
        status: data?.status || 'PROVIDER_REJECTED',
        error: data?.error || 'A Meta Cloud API rejeitou o envio da mensagem automatizada.',
        rawResponse: data,
      };
    } catch (invokeException: unknown) {
      const exceptionMsg = invokeException instanceof Error ? invokeException.message : String(invokeException);
      
      logEngine('error', 'AUTOMATION_DISPATCH_INVOKE_EXCEPTION', {
        conversationId,
        error: exceptionMsg,
      });

      return {
        success: false,
        status: 'FAILED',
        error: `Exceção de rede na comunicação com a Edge Function: ${exceptionMsg}`,
      };
    }
  }
}
