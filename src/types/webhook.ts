/**
 * FABRE AUTOMATION - Webhook & Ingestion Layer Type Definitions
 * Release 3: Secure Backend Foundation
 * 
 * Defines cross-channel agnostic models for external events,
 * normalization, idempotency, and server-side responses.
 */

import { ChannelType, MessageContentType } from './index';

export type ExternalEventType = 
  | 'message_received'
  | 'message_delivered'
  | 'message_read'
  | 'post_comment'
  | 'story_reply'
  | 'reaction'
  | 'opt_in';

/**
 * Standardized External Webhook Event structure
 * Received and validated by Supabase Edge Functions
 */
export interface ExternalWebhookEvent {
  externalEventId: string;
  channel: ChannelType;
  eventType: ExternalEventType;
  sender: {
    id: string;
    username?: string;
    name?: string;
    phone?: string;
    avatarUrl?: string;
  };
  recipient: {
    id: string;
    channelAccountId?: string;
  };
  message?: {
    id: string;
    text?: string;
    contentType: MessageContentType;
    mediaUrl?: string;
    quickReplyPayload?: string;
  };
  timestamp: string;
  signature?: string;
  rawPayload?: Record<string, unknown>;
}

/**
 * Normalized Inbound Message (Conceptual & Business Layer Model)
 * Agnostic representation used by Ingestion, Persistence, Automations
 */
export interface NormalizedIncomingMessage {
  externalEventId: string;
  channel: ChannelType;
  externalUserId: string;
  externalConversationId?: string;
  messageId: string;
  messageText: string;
  timestamp: string;
  direction: 'inbound';
  messageType: MessageContentType;
  mediaUrl?: string;
  rawMetadata?: Record<string, unknown>;
}

/**
 * Normalized Inbound Message (Extended with UI helpers)
 */
export interface NormalizedInboundMessage extends NormalizedIncomingMessage {
  senderId: string;
  senderName: string;
  senderUsername: string;
  senderAvatarUrl?: string;
  senderPhone?: string;
  content: string;
  contentType: MessageContentType;
  isStoryReply?: boolean;
  isComment?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Result of Webhook Validation & Handshake
 */
export interface WebhookVerificationResult {
  verified: boolean;
  challenge?: string;
  status: number;
  reason?: string;
}

/**
 * Result of Webhook Ingestion & Processing
 */
export interface WebhookProcessingResult {
  success: boolean;
  externalEventId: string;
  isDuplicate: boolean;
  conversationId?: string;
  messageId?: string;
  error?: string;
  statusCode: number;
}

/**
 * Server & Edge Functions Health Check Structure
 */
export interface ServerHealthStatus {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  timestamp: string;
  environment: 'production' | 'development' | 'edge';
  supabaseConnected: boolean;
  services: {
    metaWebhook: 'configured' | 'pending_token';
    whatsappWebhook: 'configured' | 'pending_token';
    aiCompletion: 'configured' | 'pending_key';
  };
}
