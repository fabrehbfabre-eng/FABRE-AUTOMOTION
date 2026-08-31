/**
 * FABRE AUTOMATION - Instagram Direct Ingestion Service
 * Release 5: Instagram Real Message Ingestion
 * 
 * Manages Instagram Direct webhook configuration inspection,
 * validation, normalization, and diagnostic test ingestion.
 * Strictly respects security: server-side only secrets, no outbound response.
 */

import { ChannelConnection } from '../types';
import { NormalizedIncomingMessage, NormalizedInboundMessage } from '../types/webhook';
import { WebhookNormalizer } from './normalizers/WebhookNormalizer';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { repositoryManager } from './repositories';

export interface IngestionResult {
  success: boolean;
  status: 'INGESTED' | 'DUPLICATE_SKIPPED' | 'INVALID_PAYLOAD' | 'ERROR';
  externalEventId: string;
  conversationId?: string;
  messageId?: string;
  normalizedMessage?: NormalizedInboundMessage | null;
  message?: string;
}

export class InstagramIngestionService {
  /**
   * Returns the Meta Webhook URL endpoint for Instagram Direct
   */
  getWebhookUrl(): string {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    if (supabaseUrl && supabaseUrl.startsWith('http')) {
      return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/meta-webhook`;
    }
    return 'https://[seu-projeto].supabase.co/functions/v1/meta-webhook';
  }

  /**
   * Retrieves current Instagram Channel Connection status
   */
  async getStatus(): Promise<ChannelConnection> {
    try {
      return await repositoryManager.channel.getConnection('instagram');
    } catch {
      return {
        id: 'conn_ig',
        name: 'Instagram Direct',
        channel: 'instagram',
        status: 'awaiting_credentials',
        statusMessage: 'Aguardando configuração de webhook e credenciais Meta',
        lastSyncAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Normalizes an incoming Instagram webhook payload
   */
  normalizePayload(rawPayload: Record<string, any>): NormalizedInboundMessage | null {
    return WebhookNormalizer.normalizeInstagramMessage(rawPayload);
  }

  /**
   * Ingests a normalized Instagram message into Supabase / Active Repository
   * Strictly enforces idempotency using externalEventId
   */
  async ingestMessage(normalized: NormalizedIncomingMessage | NormalizedInboundMessage): Promise<IngestionResult> {
    try {
      const externalEventId = normalized.externalEventId;

      // 1. Idempotency Check with Database / Repository
      const isConfigured = isSupabaseConfigured();
      if (isConfigured) {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data: existing, error } = await supabase
            .from('messages')
            .select('id, conversation_id')
            .eq('external_event_id', externalEventId)
            .limit(1);

          if (!error && existing && existing.length > 0) {
            return {
              success: true,
              status: 'DUPLICATE_SKIPPED',
              externalEventId,
              conversationId: (existing[0] as any).conversation_id,
              messageId: (existing[0] as any).id,
              message: `Evento duplicado (${externalEventId}). Descartado para garantir idempotência.`,
            };
          }
        }
      }

      // 2. Identify / Upsert Contact Profile
      const senderId = normalized.externalUserId;
      const contact = await repositoryManager.conversation.upsertProfile({
        name: `Seguidor IG (${senderId.slice(-4)})`,
        username: `ig_${senderId}`,
        channel: 'instagram',
        metadata: {
          external_id: senderId,
          platform: 'instagram',
        },
      });

      // 3. Identify / Upsert Conversation
      const conversation = await repositoryManager.conversation.findOrCreateConversation({
        contactId: contact.id,
        channel: 'instagram',
        initialHandler: 'human', // Handoff ready: no automated bot response in Release 5
      });

      // 4. Save Inbound Message (sender: 'contact')
      const message = await repositoryManager.conversation.createMessage({
        conversationId: conversation.id,
        sender: 'contact',
        channel: 'instagram',
        content: normalized.messageText,
        contentType: normalized.messageType,
        mediaUrl: normalized.mediaUrl,
        externalEventId: externalEventId,
        status: 'delivered',
        metadata: {
          rawMessageId: normalized.messageId,
          platform: 'instagram_direct',
          isTestEvent: Boolean(normalized.rawMetadata?.isTestEvent),
        },
      });

      // 5. Update Channel Connection status to connected
      try {
        await repositoryManager.channel.updateConnection('instagram', {
          status: 'connected',
          statusMessage: 'Webhook ativo e recebendo mensagens do Instagram Direct',
          lastSyncAt: new Date().toISOString(),
        });
      } catch (connErr) {
        console.warn('[InstagramIngestionService] Could not update channel connection:', connErr);
      }

      return {
        success: true,
        status: 'INGESTED',
        externalEventId,
        conversationId: conversation.id,
        messageId: message.id,
        message: 'Mensagem real do Instagram Direct ingerida com sucesso no Supabase!',
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        status: 'ERROR',
        externalEventId: normalized.externalEventId,
        message: `Falha na ingestão: ${errMsg}`,
      };
    }
  }

  /**
   * Diagnostic Test Runner:
   * Generates a controlled, labeled [TEST EVENT] payload formatted exactly as Meta's Webhook
   * to validate both the single-ingestion pipeline and idempotency duplicate-skipping.
   */
  async runDiagnosticTest(isDuplicate = false): Promise<IngestionResult> {
    const fixedEventId = isDuplicate 
      ? 'ig_test_event_idempotency_sample_001'
      : `ig_test_event_${Date.now()}`;

    const mockMetaPayload = {
      object: 'instagram',
      entry: [
        {
          id: '17841400000000000',
          time: Date.now(),
          messaging: [
            {
              sender: {
                id: '998877665544',
              },
              recipient: {
                id: '17841400000000000',
              },
              timestamp: Date.now(),
              message: {
                mid: fixedEventId,
                text: '[TEST EVENT] Olá! Mensagem de teste de ingestão do Instagram Direct (Release 5)',
              },
            },
          ],
        },
      ],
    };

    const normalized = WebhookNormalizer.normalizeInstagramMessage(mockMetaPayload);
    if (!normalized) {
      return {
        success: false,
        status: 'INVALID_PAYLOAD',
        externalEventId: fixedEventId,
        message: 'Falha ao normalizar o payload de teste do Instagram',
      };
    }

    // Mark explicitly as test event
    if (normalized.rawMetadata) {
      normalized.rawMetadata.isTestEvent = true;
    }

    const result = await this.ingestMessage(normalized);
    result.normalizedMessage = normalized;
    return result;
  }
}

export const instagramIngestionService = new InstagramIngestionService();
