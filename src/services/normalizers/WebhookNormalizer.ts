/**
 * FABRE AUTOMATION - Webhook & Conversation Normalizer
 * Release 3: Secure Backend Foundation
 * 
 * Normalizes multi-channel incoming messages (Instagram, Messenger, WhatsApp)
 * into a single unified internal structure so that core automations,
 * database persistence, and AI pipelines remain channel-agnostic.
 */

import { ChannelType, MessageContentType } from '../../types';
import { NormalizedInboundMessage } from '../../types/webhook';

export class WebhookNormalizer {
  /**
   * Normalizes incoming Instagram Direct payload
   */
  static normalizeInstagramMessage(rawPayload: Record<string, any>): NormalizedInboundMessage | null {
    try {
      const entry = rawPayload.entry?.[0];
      const messaging = entry?.messaging?.[0];
      if (!messaging) return null;

      const senderId = messaging.sender?.id || 'unknown_ig_sender';
      const recipientId = messaging.recipient?.id;
      const messageObj = messaging.message || {};
      const rawMid = messageObj.mid || `${senderId}_${entry.time || Date.now()}`;
      const eventId = rawMid;

      let contentType: MessageContentType = 'text';
      let mediaUrl: string | undefined = undefined;
      let textContent = messageObj.text || '';

      if (messageObj.attachments && messageObj.attachments.length > 0) {
        const attachment = messageObj.attachments[0];
        mediaUrl = attachment.payload?.url;
        if (attachment.type === 'image') {
          contentType = 'image';
          if (!textContent) textContent = '[Imagem recebida]';
        } else if (attachment.type === 'audio') {
          contentType = 'audio';
          if (!textContent) textContent = '[Áudio recebido]';
        } else if (attachment.type === 'video') {
          contentType = 'text';
          if (!textContent) textContent = '[Vídeo recebido]';
        } else if (attachment.type === 'file') {
          contentType = 'text';
          if (!textContent) textContent = '[Arquivo recebido]';
        } else {
          contentType = 'text';
          if (!textContent) textContent = '[Mídia recebida]';
        }
      }

      if (!textContent && !mediaUrl) {
        textContent = '[Mensagem do Instagram Direct]';
      }

      const timestamp = new Date(messaging.timestamp || entry.time || Date.now()).toISOString();

      return {
        // Conceptual fields (Release 5)
        externalEventId: eventId,
        channel: 'instagram',
        externalUserId: senderId,
        externalConversationId: recipientId ? `ig_conv_${recipientId}_${senderId}` : undefined,
        messageId: rawMid,
        messageText: textContent,
        timestamp,
        direction: 'inbound',
        messageType: contentType,
        rawMetadata: {
          rawMessageId: rawMid,
          appId: rawPayload.app_id,
          recipientId,
        },

        // Helper / UI fields
        senderId,
        senderName: `Seguidor IG (${senderId.slice(-4)})`,
        senderUsername: `ig_${senderId}`,
        content: textContent,
        contentType,
        mediaUrl,
        isStoryReply: Boolean(messageObj.reply_to?.story || messageObj.is_story_reply),
        metadata: {
          rawMessageId: rawMid,
          appId: rawPayload.app_id,
          recipientId,
        },
      };
    } catch (err) {
      console.warn('[WebhookNormalizer] Error normalizing Instagram message:', err);
      return null;
    }
  }

  /**
   * Normalizes incoming Facebook Messenger payload
   */
  static normalizeMessengerMessage(rawPayload: Record<string, any>): NormalizedInboundMessage | null {
    try {
      const entry = rawPayload.entry?.[0];
      const messaging = entry?.messaging?.[0];
      if (!messaging) return null;

      const senderId = messaging.sender?.id || 'unknown_fb_sender';
      const messageObj = messaging.message || {};
      const eventId = messageObj.mid || `${senderId}_${entry.time || Date.now()}`;

      let contentType: MessageContentType = 'text';
      let mediaUrl: string | undefined = undefined;

      if (messageObj.attachments && messageObj.attachments.length > 0) {
        const attachment = messageObj.attachments[0];
        if (attachment.type === 'image') contentType = 'image';
        else if (attachment.type === 'audio') contentType = 'audio';
        mediaUrl = attachment.payload?.url;
      }

      const timestamp = new Date(messaging.timestamp || Date.now()).toISOString();
      const textContent = messageObj.text || (contentType === 'image' ? '[Imagem enviada]' : '[Mídia Facebook]');

      return {
        // Conceptual fields
        externalEventId: eventId,
        channel: 'messenger',
        externalUserId: senderId,
        messageId: messageObj.mid || eventId,
        messageText: textContent,
        timestamp,
        direction: 'inbound',
        messageType: contentType,
        rawMetadata: {
          rawMessageId: messageObj.mid,
        },

        // Helper / UI fields
        senderId,
        senderName: messaging.sender?.name || `Contato Facebook (${senderId.slice(-4)})`,
        senderUsername: `fb_${senderId.slice(-6)}`,
        content: textContent,
        contentType,
        mediaUrl,
        metadata: {
          rawMessageId: messageObj.mid,
        },
      };
    } catch (err) {
      console.warn('[WebhookNormalizer] Error normalizing Messenger message:', err);
      return null;
    }
  }

  /**
   * Normalizes incoming WhatsApp Business Cloud API payload
   */
  static normalizeWhatsAppMessage(rawPayload: Record<string, any>): NormalizedInboundMessage | null {
    try {
      const entry = rawPayload.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const message = value?.messages?.[0];
      const contact = value?.contacts?.[0];

      if (!message) return null;

      const senderPhone = message.from || 'unknown_phone';
      const senderName = contact?.profile?.name || `WhatsApp (${senderPhone.slice(-4)})`;
      const eventId = message.id || `wa_${senderPhone}_${message.timestamp || Date.now()}`;

      let contentType: MessageContentType = 'text';
      let textContent = '';
      let mediaUrl: string | undefined = undefined;

      if (message.type === 'text') {
        contentType = 'text';
        textContent = message.text?.body || '';
      } else if (message.type === 'image') {
        contentType = 'image';
        textContent = message.image?.caption || '[Foto recebida no WhatsApp]';
        mediaUrl = message.image?.id ? `https://graph.facebook.com/v20.0/${message.image.id}` : undefined;
      } else if (message.type === 'audio') {
        contentType = 'audio';
        textContent = '[Áudio de voz WhatsApp]';
      } else if (message.type === 'interactive') {
        contentType = 'quick_reply';
        textContent = message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || '[Resposta interativa]';
      }

      const timestamp = new Date(Number(message.timestamp) * 1000 || Date.now()).toISOString();

      return {
        // Conceptual fields
        externalEventId: eventId,
        channel: 'whatsapp',
        externalUserId: senderPhone,
        messageId: message.id || eventId,
        messageText: textContent,
        timestamp,
        direction: 'inbound',
        messageType: contentType,
        rawMetadata: {
          waMessageId: message.id,
          displayPhoneNumber: value?.metadata?.display_phone_number,
          phoneNumberId: value?.metadata?.phone_number_id,
        },

        // Helper / UI fields
        senderId: senderPhone,
        senderName,
        senderUsername: senderPhone,
        senderPhone,
        content: textContent,
        contentType,
        mediaUrl,
        metadata: {
          waMessageId: message.id,
          displayPhoneNumber: value?.metadata?.display_phone_number,
          phoneNumberId: value?.metadata?.phone_number_id,
        },
      };
    } catch (err) {
      console.warn('[WebhookNormalizer] Error normalizing WhatsApp message:', err);
      return null;
    }
  }

  /**
   * Generic normalizer delegating to channel-specific implementations
   */
  static normalize(channel: ChannelType, rawPayload: Record<string, any>): NormalizedInboundMessage | null {
    switch (channel) {
      case 'instagram':
        return this.normalizeInstagramMessage(rawPayload);
      case 'messenger':
        return this.normalizeMessengerMessage(rawPayload);
      case 'whatsapp':
        return this.normalizeWhatsAppMessage(rawPayload);
      default:
        return null;
    }
  }
}
