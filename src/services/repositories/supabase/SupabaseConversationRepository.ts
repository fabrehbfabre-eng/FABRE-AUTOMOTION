/**
 * FABRE AUTOMATION - Supabase Conversation Repository
 * Release 2: Supabase Persistence Foundation
 */

import { Conversation, Message, ChannelType } from '../../../types';
import { IConversationRepository } from '../IConversationRepository';
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
    if (error || !data) {
      console.warn('[SupabaseConversationRepository] getConversations error:', error);
      return [];
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
      createdAt: m.created_at,
      metadata: (m.metadata as Message['metadata']) || undefined,
    }));
  }

  async sendMessage(conversationId: string, content: string, sender: 'user' | 'bot' = 'user'): Promise<Message> {
    const client = getSupabaseClient();
    const conv = await this.getConversationById(conversationId);
    const channel = conv?.channel || 'instagram';

    const newMessageRow = {
      conversation_id: conversationId,
      sender,
      channel,
      content,
      content_type: 'text' as const,
      status: 'sent' as const,
    };

    if (client) {
      const { data, error } = await client
        .from('messages')
        .insert(newMessageRow)
        .select()
        .single();

      if (!error && data) {
        // Update conversation timestamp
        await client
          .from('conversations')
          .update({ updated_at: new Date().toISOString(), unread_count: 0 })
          .eq('id', conversationId);

        return {
          id: data.id,
          conversationId: data.conversation_id,
          sender: data.sender as Message['sender'],
          channel: data.channel as Message['channel'],
          content: data.content,
          contentType: data.content_type as Message['contentType'],
          mediaUrl: data.media_url || undefined,
          status: data.status as Message['status'],
          createdAt: data.created_at,
        };
      }
    }

    return {
      id: `msg_${Date.now()}`,
      conversationId,
      sender,
      channel,
      content,
      contentType: 'text',
      status: 'sent',
      createdAt: new Date().toISOString(),
    };
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
}
