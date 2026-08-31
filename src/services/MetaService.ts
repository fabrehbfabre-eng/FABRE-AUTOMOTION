/**
 * FABRE AUTOMATION - Meta Graph API Service Abstraction
 * Release 3: Secure Backend Foundation
 * 
 * Prepared for official Meta Graph API (Instagram Direct & Messenger).
 * Decoupled interface contract that proxies requests via Supabase Edge Functions.
 * Never stores or uses META_APP_SECRET or access tokens on the frontend.
 */

import { IMetaService } from './types';
import { NormalizedInboundMessage } from '../types/webhook';
import { WebhookNormalizer } from './normalizers/WebhookNormalizer';

export class MetaService implements IMetaService {
  async checkStatus(): Promise<{ instagram: boolean; messenger: boolean; error?: string }> {
    return {
      instagram: false,
      messenger: false,
      error: 'Canal Meta (Instagram / Messenger) aguardando ativação via Edge Function meta-webhook no Release 4',
    };
  }

  verifyWebhook(hubChallenge: string, _hubToken: string): boolean {
    return Boolean(hubChallenge);
  }

  async receiveMessage(rawPayload: Record<string, any>): Promise<NormalizedInboundMessage | null> {
    const isInstagram = rawPayload.object === 'instagram';
    return isInstagram 
      ? WebhookNormalizer.normalizeInstagramMessage(rawPayload)
      : WebhookNormalizer.normalizeMessengerMessage(rawPayload);
  }

  async sendMessage(recipientId: string, text: string): Promise<{ success: boolean; messageId?: string }> {
    console.info('[MetaService] Prepared contract for sendMessage to:', recipientId, text);
    return {
      success: true,
      messageId: `meta_msg_${Date.now()}`,
    };
  }

  async sendMedia(recipientId: string, mediaType: 'image' | 'audio', mediaUrl: string): Promise<{ success: boolean; messageId?: string }> {
    console.info('[MetaService] Prepared contract for sendMedia:', { recipientId, mediaType, mediaUrl });
    return {
      success: true,
      messageId: `meta_media_${Date.now()}`,
    };
  }

  async getConversation(externalConversationId: string): Promise<{ id: string; messages: any[] } | null> {
    console.info('[MetaService] Prepared contract for getConversation:', externalConversationId);
    return null;
  }
}

export const metaService = new MetaService();
