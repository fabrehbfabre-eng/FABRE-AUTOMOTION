/**
 * FABRE AUTOMATION - WhatsApp Cloud API Service Abstraction
 * Release 3: Secure Backend Foundation
 * 
 * Prepared for official WhatsApp Business Cloud API.
 * Decoupled interface contract proxying through Supabase Edge Functions.
 * Never stores or uses WHATSAPP_ACCESS_TOKEN on the frontend.
 */

import { IWhatsAppService } from './types';
import { NormalizedInboundMessage } from '../types/webhook';
import { WebhookNormalizer } from './normalizers/WebhookNormalizer';

export class WhatsAppService implements IWhatsAppService {
  async checkStatus(): Promise<{ whatsapp: boolean; error?: string }> {
    return {
      whatsapp: false,
      error: 'WhatsApp Business Cloud API aguardando ativação via Edge Function whatsapp-webhook no Release 4',
    };
  }

  verifyWebhook(hubChallenge: string, _hubToken: string): boolean {
    return Boolean(hubChallenge);
  }

  async receiveMessage(rawPayload: Record<string, any>): Promise<NormalizedInboundMessage | null> {
    return WebhookNormalizer.normalizeWhatsAppMessage(rawPayload);
  }

  async sendWhatsAppMessage(phoneNumber: string, text: string): Promise<{ success: boolean; messageId?: string }> {
    console.info('[WhatsAppService] Prepared contract for sendWhatsAppMessage to:', phoneNumber, text);
    return {
      success: true,
      messageId: `wa_msg_${Date.now()}`,
    };
  }

  async sendTemplateMessage(phoneNumber: string, templateName: string, params: Record<string, string>): Promise<{ success: boolean }> {
    console.info('[WhatsAppService] Prepared contract for sendTemplateMessage:', { phoneNumber, templateName, params });
    return {
      success: true,
    };
  }

  async sendMedia(phoneNumber: string, mediaType: 'image' | 'audio' | 'document', mediaUrl: string, caption?: string): Promise<{ success: boolean; messageId?: string }> {
    console.info('[WhatsAppService] Prepared contract for sendMedia:', { phoneNumber, mediaType, mediaUrl, caption });
    return {
      success: true,
      messageId: `wa_media_${Date.now()}`,
    };
  }
}

export const whatsAppService = new WhatsAppService();
