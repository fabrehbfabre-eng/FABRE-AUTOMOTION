/**
 * FABRE AUTOMATION - WhatsApp Official Asset E2E Validation Service
 * Release: E2E Validation of WhatsApp Official Asset (+55 14 98840-3642)
 *
 * Enforces canonical Meta Business Portfolio ADM01 assets:
 * - WABA ID: 293410900513919
 * - Phone Number ID: 250763631462152
 * - Official Number: +55 14 98840-3642
 * - Profile: Casal Fabre (@casalfabre)
 *
 * Never exposes or stores secrets on the frontend.
 */

import { getSupabaseClient } from '../lib/supabase';

export interface WhatsAppE2ERequest {
  recipientPhone: string;
  messageText: string;
  conversationId?: string;
}

export interface WhatsAppE2EResult {
  status: 'SUCCESS' | 'FAILED';
  httpStatus: number;
  timestamp: string;
  destination: string;
  phoneNumberId: string;
  wabaId: string;
  endpoint: string;
  metaMessageId?: string;
  conversationId?: string;
  messageContent?: string;
  isTemplateRequired?: boolean;
  errorMessage?: string;
  metaCode?: number;
  rawResponse?: any;
}

export class WhatsAppE2ETestService {
  /**
   * Dispatches a real test message through the official Casal Fabre WhatsApp asset.
   */
  async executeE2ETest(request: WhatsAppE2ERequest): Promise<WhatsAppE2EResult> {
    const client = getSupabaseClient();
    if (!client) {
      return {
        status: 'FAILED',
        httpStatus: 0,
        timestamp: new Date().toISOString(),
        destination: request.recipientPhone,
        phoneNumberId: '250763631462152',
        wabaId: '293410900513919',
        endpoint: 'https://graph.facebook.com/v21.0/250763631462152/messages',
        errorMessage: 'Cliente Supabase não inicializado. Verifique as credenciais no .env',
      };
    }

    const cleanPhone = request.recipientPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      return {
        status: 'FAILED',
        httpStatus: 400,
        timestamp: new Date().toISOString(),
        destination: request.recipientPhone,
        phoneNumberId: '250763631462152',
        wabaId: '293410900513919',
        endpoint: 'https://graph.facebook.com/v21.0/250763631462152/messages',
        errorMessage: 'Número de telefone do destinatário inválido. Informe o DDI + DDD + número (ex: +55 14 99999-9999).',
      };
    }

    const messageText = request.messageText.trim() || 'Teste oficial FABRE AUTOMATION. Mensagem enviada pelo WhatsApp oficial Casal Fabre.';

    // Validate active authenticated session (Zero hardcoded credentials)
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData.session) {
      return {
        status: 'FAILED',
        httpStatus: 401,
        timestamp: new Date().toISOString(),
        destination: request.recipientPhone,
        phoneNumberId: '250763631462152',
        wabaId: '293410900513919',
        endpoint: 'https://graph.facebook.com/v21.0/250763631462152/messages',
        errorMessage: 'Usuário não autenticado. Faça login no FABRE AUTOMATION antes de executar o teste E2E.',
      };
    }

    try {
      const payload: Record<string, any> = {
        recipientPhone: cleanPhone,
        text: messageText,
      };

      if (request.conversationId) {
        payload.conversationId = request.conversationId;
      }

      const { data, error } = await client.functions.invoke('meta-send-message', {
        body: payload,
      });

      if (error) {
        let metaDetails: any = null;
        let errorMsg = error.message;

        if (typeof error === 'object' && error !== null && 'context' in error) {
          try {
            const res = (error as any).context as Response;
            if (res && typeof res.json === 'function') {
              metaDetails = await res.json();
              if (metaDetails?.error) errorMsg = metaDetails.error;
              else if (metaDetails?.message) errorMsg = metaDetails.message;
            }
          } catch (_) {
            // retain error.message
          }
        }

        const isTemplateRequired =
          metaDetails?.details?.isTemplateRequired ||
          metaDetails?.metaCode === 131047 ||
          metaDetails?.metaCode === 131026 ||
          errorMsg?.includes('131047') ||
          errorMsg?.includes('Janela de 24 horas');

        return {
          status: 'FAILED',
          httpStatus: metaDetails?.status || metaDetails?.httpStatus || 400,
          timestamp: new Date().toISOString(),
          destination: cleanPhone,
          phoneNumberId: metaDetails?.details?.phoneNumberId || '250763631462152',
          wabaId: metaDetails?.details?.wabaId || '293410900513919',
          endpoint: metaDetails?.details?.endpoint || 'https://graph.facebook.com/v21.0/250763631462152/messages',
          isTemplateRequired,
          metaCode: metaDetails?.details?.metaCode || metaDetails?.metaCode,
          errorMessage: errorMsg || 'Falha ao disparar mensagem via WhatsApp Cloud API',
          rawResponse: metaDetails,
        };
      }

      if (!data || data.status !== 'SUCCESS') {
        const isTemplateRequired =
          data?.isTemplateRequired ||
          data?.metaCode === 131047 ||
          data?.metaCode === 131026;

        return {
          status: 'FAILED',
          httpStatus: data?.httpStatus || 400,
          timestamp: data?.timestamp || new Date().toISOString(),
          destination: data?.destination || cleanPhone,
          phoneNumberId: data?.phoneNumberId || '250763631462152',
          wabaId: data?.wabaId || '293410900513919',
          endpoint: data?.endpoint || 'https://graph.facebook.com/v21.0/250763631462152/messages',
          isTemplateRequired,
          metaCode: data?.metaCode,
          errorMessage: data?.error || data?.message || 'Falha na resposta do serviço de envio outbound',
          rawResponse: data,
        };
      }

      return {
        status: 'SUCCESS',
        httpStatus: data.httpStatus || 200,
        timestamp: data.timestamp || new Date().toISOString(),
        destination: data.destination || cleanPhone,
        phoneNumberId: data.phoneNumberId || '250763631462152',
        wabaId: data.wabaId || '293410900513919',
        endpoint: data.endpoint || 'https://graph.facebook.com/v21.0/250763631462152/messages',
        metaMessageId: data.metaMessageId || data.externalId,
        conversationId: data.conversationId,
        messageContent: messageText,
        rawResponse: data,
      };
    } catch (err: any) {
      return {
        status: 'FAILED',
        httpStatus: 500,
        timestamp: new Date().toISOString(),
        destination: cleanPhone,
        phoneNumberId: '250763631462152',
        wabaId: '293410900513919',
        endpoint: 'https://graph.facebook.com/v21.0/250763631462152/messages',
        errorMessage: err?.message || 'Erro inesperado na chamada ao serviço de envio',
      };
    }
  }

  /**
   * Subscribe to real-time inbound reply messages for a specific conversation
   */
  subscribeToInboundReply(
    conversationId: string,
    onReply: (message: any) => void
  ): () => void {
    const client = getSupabaseClient();
    if (!client) return () => {};

    const channel = client
      .channel(`e2e_reply_${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: any) => {
          const newRecord = payload.new;
          // Inbound messages have sender !== 'user' (either contact or system) or sender === 'contact'
          if (newRecord && (newRecord.sender === 'contact' || newRecord.metadata?.outbound !== true)) {
            onReply(newRecord);
          }
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }
}

export const whatsAppE2ETestService = new WhatsAppE2ETestService();
