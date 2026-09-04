/**
 * FABRE AUTOMATION - Supabase Conversation Repository
 * Release 2: Supabase Persistence Foundation
 */

import { Conversation, Message, ChannelType } from '../../../types';
import { IConversationRepository, RealtimeInboxCallbacks, ConversationUpdateEvent } from '../IConversationRepository';
import { getSupabaseClient } from '../../../lib/supabase';

export class SupabaseConversationRepository implements IConversationRepository {
  async getConversations(filter?: { channel?: ChannelType; status?: string; handler?: string }): Promise<Conversation[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    let query = client
      .from('conversations')
      .select(`
        id,
        contact_id,
        channel,
        status,
        handler,
        unread_count,
        assigned_to,
        created_at,
        updated_at,
        profiles (
          id,
          name,
          username,
          channel,
          avatar_url,
          phone,
          email,
          notes,
          created_at,
          last_active_at
        )
      `)
      .order('updated_at', { ascending: false });

    if (filter?.channel) query = query.eq('channel', filter.channel);
    if (filter?.status) query = (query as any).eq('status', filter.status);
    if (filter?.handler) query = (query as any).eq('handler', filter.handler);

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      if (error) {
        console.warn('[SupabaseConversationRepository] getConversations error:', error);
      }
      return [];
    }

    const conversationIds = (data as { id: string }[]).map(c => c.id);
    const latestMessagesMap = new Map<string, Message>();

    if (conversationIds.length > 0) {
      const { data: messagesData, error: messagesError } = await client
        .from('messages')
        .select('*')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false });

      if (messagesData && !messagesError) {
        for (const m of messagesData) {
          if (!latestMessagesMap.has(m.conversation_id)) {
            latestMessagesMap.set(m.conversation_id, {
              id: m.id,
              conversationId: m.conversation_id,
              sender: m.sender as Message['sender'],
              channel: m.channel as Message['channel'],
              content: m.content,
              contentType: m.content_type as Message['contentType'],
              mediaUrl: m.media_url || undefined,
              status: m.status as Message['status'],
              externalEventId: m.external_event_id || undefined,
              createdAt: m.created_at,
              metadata: (m.metadata as Message['metadata']) || undefined,
            });
          }
        }
      } else if (messagesError) {
        console.warn('[SupabaseConversationRepository] Error fetching latest messages:', messagesError);
      }
    }

    return (data as unknown[]).map((rowRaw: unknown) => {
      const row = rowRaw as {
        id: string;
        contact_id: string;
        channel: ChannelType;
        status: Conversation['status'];
        handler: Conversation['handler'];
        unread_count: number;
        assigned_to: string | null;
        created_at: string;
        updated_at: string;
        profiles: {
          id: string;
          name: string;
          username: string;
          channel: ChannelType;
          avatar_url: string | null;
          phone: string | null;
          email: string | null;
          notes: string | null;
          created_at: string;
          last_active_at: string;
        } | null;
      };

      const profile = row.profiles || {
        id: row.contact_id,
        name: 'Contato',
        username: '@usuario',
        channel: row.channel,
        avatar_url: null,
        phone: null,
        email: null,
        notes: null,
        created_at: row.created_at,
        last_active_at: row.updated_at,
      };

      return {
        id: row.id,
        contactId: row.contact_id,
        contact: {
          id: profile.id,
          name: profile.name,
          username: profile.username,
          channel: profile.channel,
          avatarUrl: profile.avatar_url || undefined,
          phone: profile.phone || undefined,
          email: profile.email || undefined,
          notes: profile.notes || undefined,
          tags: [row.channel],
          createdAt: profile.created_at,
          lastActiveAt: profile.last_active_at,
        },
        channel: row.channel,
        status: row.status,
        handler: row.handler,
        unreadCount: row.unread_count,
        lastMessage: latestMessagesMap.get(row.id),
        tags: [row.channel],
        assignedTo: row.assigned_to || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  }

  async getConversationById(id: string): Promise<Conversation | null> {
    const list = await this.getConversations();
    return list.find(c => c.id === id) || null;
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    const { data, error } = await client
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error || !data) {
      console.warn('[SupabaseConversationRepository] getMessages error:', error);
      return [];
    }

    return data.map(m => ({
      id: m.id,
      conversationId: m.conversation_id,
      sender: m.sender as Message['sender'],
      channel: m.channel as Message['channel'],
      content: m.content,
      contentType: m.content_type as Message['contentType'],
      mediaUrl: m.media_url || undefined,
      status: m.status as Message['status'],
      externalEventId: m.external_event_id || undefined,
      createdAt: m.created_at,
      metadata: (m.metadata as Message['metadata']) || undefined,
    }));
  }

  async sendMessage(conversationId: string, content: string, sender: 'user' | 'bot' = 'user'): Promise<Message> {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Supabase não configurado. Não é possível enviar mensagem pelo repositório Supabase.');
    }

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      throw new Error('Não é possível enviar mensagem vazia.');
    }

    const conv = await this.getConversationById(conversationId);
    if (!conv) {
      throw new Error(`Conversa ${conversationId} não encontrada.`);
    }

    const channel = conv.channel;

    // Official Outbound sending for WhatsApp Business Cloud API via Edge Function meta-send-message
    if (channel === 'whatsapp') {
      const { data, error } = await client.functions.invoke('meta-send-message', {
        body: {
          conversationId,
          text: trimmedContent,
        },
      });

      if (error) {
        let errorMsg = error.message;
        if (typeof error === 'object' && error !== null && 'context' in error) {
          try {
            const res = (error as any).context as Response;
            if (res && typeof res.json === 'function') {
              const parsed = await res.json();
              if (parsed?.error) errorMsg = parsed.error;
              else if (parsed?.message) errorMsg = parsed.message;
            }
          } catch (_) {
            // retain error.message
          }
        }
        throw new Error(errorMsg || 'Falha ao enviar mensagem via WhatsApp Cloud API');
      }

      if (!data || data.status !== 'SUCCESS' || !data.message) {
        throw new Error(data?.error || data?.message || 'Falha na resposta do serviço de envio outbound');
      }

      const msgData = data.message;
      return {
        id: msgData.id,
        conversationId: msgData.conversationId,
        sender: msgData.sender,
        channel: msgData.channel,
        content: msgData.content,
        contentType: msgData.contentType || 'text',
        status: msgData.status || 'sent',
        externalEventId: msgData.externalEventId,
        createdAt: msgData.createdAt,
      };
    }

    // Channels pending certification in this release
    if (channel === 'instagram' || channel === 'messenger') {
      throw new Error(
        `Envio outbound para o canal ${channel === 'instagram' ? 'Instagram' : 'Messenger'} ainda não está certificado nesta Release. Apenas WhatsApp Business Cloud API está habilitado para envio real.`
      );
    }

    throw new Error(`Canal ${channel} não suportado para envio outbound.`);
  }


  async toggleHandler(conversationId: string, handler: 'bot' | 'human'): Promise<Conversation> {
    const client = getSupabaseClient();
    const now = new Date().toISOString();

    if (client) {
      await client
        .from('conversations')
        .update({
          handler,
          assigned_to: handler === 'human' ? 'Atendente Humano' : null,
          updated_at: now,
        })
        .eq('id', conversationId);

      // Insert system event message
      await client.from('messages').insert({
        conversation_id: conversationId,
        sender: 'system',
        channel: 'instagram',
        content: handler === 'human'
          ? 'Atendimento transferido para atendente humano'
          : 'Atendimento retomado pelo motor de automação (Bot)',
        content_type: 'system_event',
        status: 'read',
      });
    }

    const updated = await this.getConversationById(conversationId);
    if (!updated) throw new Error(`Conversation not found: ${conversationId}`);
    return updated;
  }

  async updateStatus(conversationId: string, status: Conversation['status']): Promise<Conversation> {
    const client = getSupabaseClient();
    if (client) {
      await client
        .from('conversations')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', conversationId);
    }

    const updated = await this.getConversationById(conversationId);
    if (!updated) throw new Error(`Conversation not found: ${conversationId}`);
    return updated;
  }

  async getStats(): Promise<{ totalConversations: number; humanHandoffs: number; automatedMessages: number }> {
    const client = getSupabaseClient();
    if (!client) {
      return { totalConversations: 0, humanHandoffs: 0, automatedMessages: 0 };
    }

    const { count: totalConversations } = await client
      .from('conversations')
      .select('*', { count: 'exact', head: true });

    const { count: humanHandoffs } = await client
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('handler', 'human');

    const { count: automatedMessages } = await client
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender', 'bot');

    return {
      totalConversations: totalConversations || 0,
      humanHandoffs: humanHandoffs || 0,
      automatedMessages: automatedMessages || 0,
    };
  }

  async upsertProfile(data: {
    name: string;
    username?: string;
    channel: ChannelType;
    avatarUrl?: string;
    phone?: string;
    email?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ id: string; name: string }> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not configured');

    const username = data.username || `@user_${Date.now().toString().slice(-4)}`;
    
    // Check if profile exists by username or metadata
    const { data: existing } = await client
      .from('profiles')
      .select('id, name')
      .eq('username', username)
      .limit(1);

    if (existing && existing.length > 0) {
      return { id: existing[0].id, name: existing[0].name };
    }

    const { data: inserted, error } = await client
      .from('profiles')
      .insert({
        name: data.name,
        username,
        channel: data.channel,
        avatar_url: data.avatarUrl || null,
        phone: data.phone || null,
        email: data.email || null,
      })
      .select('id, name')
      .single();

    if (error || !inserted) {
      throw new Error(`Erro ao criar perfil no Supabase: ${error?.message || 'Falha desconhecida'}`);
    }

    return { id: inserted.id, name: inserted.name };
  }

  async findOrCreateConversation(data: {
    contactId: string;
    channel: ChannelType;
    initialHandler?: 'bot' | 'human';
  }): Promise<Conversation> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not configured');

    // Check existing conversation
    const { data: existing } = await client
      .from('conversations')
      .select('id')
      .eq('contact_id', data.contactId)
      .eq('channel', data.channel)
      .limit(1);

    if (existing && existing.length > 0) {
      const conv = await this.getConversationById(existing[0].id);
      if (conv) return conv;
    }

    // Create conversation
    const { data: inserted, error } = await client
      .from('conversations')
      .insert({
        contact_id: data.contactId,
        channel: data.channel,
        handler: data.initialHandler || 'human',
        status: 'open',
        unread_count: 1,
      })
      .select('id')
      .single();

    if (error || !inserted) {
      throw new Error(`Erro ao criar conversa no Supabase: ${error?.message || 'Falha desconhecida'}`);
    }

    const conv = await this.getConversationById(inserted.id);
    if (!conv) throw new Error('Falha ao carregar conversa criada');
    return conv;
  }

  async createMessage(data: {
    conversationId: string;
    sender: 'contact' | 'user' | 'bot' | 'system';
    channel: ChannelType;
    content: string;
    contentType?: Message['contentType'];
    mediaUrl?: string;
    externalEventId?: string;
    status?: 'sent' | 'delivered' | 'read' | 'failed';
    metadata?: Record<string, any>;
  }): Promise<Message> {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client not configured');

    const { data: inserted, error } = await client
      .from('messages')
      .insert({
        conversation_id: data.conversationId,
        sender: data.sender,
        channel: data.channel,
        content: data.content,
        content_type: data.contentType || 'text',
        media_url: data.mediaUrl || null,
        external_event_id: data.externalEventId || null,
        status: data.status || 'delivered',
        metadata: (data.metadata as any) || null,
      })
      .select()
      .single();

    if (error || !inserted) {
      throw new Error(`Erro ao salvar mensagem no Supabase: ${error?.message || 'Falha desconhecida'}`);
    }

    // Update conversation timestamp
    await client
      .from('conversations')
      .update({
        updated_at: new Date().toISOString(),
        unread_count: data.sender === 'contact' ? 1 : 0,
      })
      .eq('id', data.conversationId);

    return {
      id: inserted.id,
      conversationId: inserted.conversation_id,
      sender: inserted.sender as Message['sender'],
      channel: inserted.channel as Message['channel'],
      content: inserted.content,
      contentType: inserted.content_type as Message['contentType'],
      mediaUrl: inserted.media_url || undefined,
      externalEventId: inserted.external_event_id || undefined,
      status: inserted.status as Message['status'],
      createdAt: inserted.created_at,
      metadata: (inserted.metadata as Message['metadata']) || undefined,
    };
  }

  subscribeToNewMessages(callback: (message: Message) => void): () => void {
    return this.subscribeToInboxEvents({ onNewMessage: callback });
  }

  subscribeToInboxEvents(callbacks: RealtimeInboxCallbacks): () => void {
    const client = getSupabaseClient();
    if (!client) {
      return () => {};
    }

    try {
      const channelId = `inbox_events_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      let channel = client.channel(channelId);

      if (callbacks.onNewMessage) {
        channel = channel.on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          (payload) => {
            const m = payload.new as any;
            if (!m || !m.id || !m.conversation_id) return;

            const message: Message = {
              id: m.id,
              conversationId: m.conversation_id,
              sender: (m.sender || 'contact') as Message['sender'],
              channel: (m.channel || 'instagram') as Message['channel'],
              content: m.content || '',
              contentType: (m.content_type || 'text') as Message['contentType'],
              mediaUrl: m.media_url || undefined,
              status: (m.status || 'delivered') as Message['status'],
              externalEventId: m.external_event_id || undefined,
              createdAt: m.created_at || new Date().toISOString(),
              metadata: (m.metadata as Message['metadata']) || undefined,
            };

            callbacks.onNewMessage?.(message);
          }
        );
      }

      if (callbacks.onConversationUpdate) {
        channel = channel.on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'conversations',
          },
          (payload) => {
            const c = payload.new as any;
            if (!c || !c.id) return;

            const updateEvent: ConversationUpdateEvent = {
              id: c.id,
              status: c.status,
              handler: c.handler,
              unreadCount: typeof c.unread_count === 'number' ? c.unread_count : undefined,
              updatedAt: c.updated_at || undefined,
            };

            callbacks.onConversationUpdate?.(updateEvent);
          }
        );
      }

      channel.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          // Channel connected successfully
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('[SupabaseRealtime] Channel error on inbox events subscription:', err);
        } else if (status === 'TIMED_OUT') {
          console.warn('[SupabaseRealtime] Subscription timed out');
        } else if (status === 'CLOSED') {
          // Channel closed gracefully
        }
      });

      return () => {
        try {
          client.removeChannel(channel);
        } catch (cleanupErr) {
          console.warn('[SupabaseRealtime] Error removing channel:', cleanupErr);
        }
      };
    } catch (err) {
      console.warn('[SupabaseRealtime] Failed to setup inbox realtime subscription:', err);
      return () => {};
    }
  }
}
