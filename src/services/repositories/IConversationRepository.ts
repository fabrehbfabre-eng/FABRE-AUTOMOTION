/**
 * FABRE AUTOMATION - Conversation Repository Interface
 * Release 2: Supabase Persistence Foundation
 */

import { Conversation, Message, ChannelType } from '../../types';

export interface IConversationRepository {
  getConversations(filter?: { channel?: ChannelType; status?: string; handler?: string }): Promise<Conversation[]>;
  getConversationById(id: string): Promise<Conversation | null>;
  getMessages(conversationId: string): Promise<Message[]>;
  sendMessage(conversationId: string, content: string, sender?: 'user' | 'bot'): Promise<Message>;
  toggleHandler(conversationId: string, handler: 'bot' | 'human'): Promise<Conversation>;
  updateStatus(conversationId: string, status: Conversation['status']): Promise<Conversation>;
  addTag?(conversationId: string, tag: string): Promise<Conversation>;
  removeTag?(conversationId: string, tag: string): Promise<Conversation>;
  getStats(): Promise<{ totalConversations: number; humanHandoffs: number; automatedMessages: number }>;
  
  // Ingestion Methods (Release 5)
  upsertProfile(data: { name: string; username?: string; channel: ChannelType; avatarUrl?: string; phone?: string; email?: string; metadata?: Record<string, unknown> }): Promise<{ id: string; name: string }>;
  findOrCreateConversation(data: { contactId: string; channel: ChannelType; initialHandler?: 'bot' | 'human' }): Promise<Conversation>;
  createMessage(data: { conversationId: string; sender: 'contact' | 'user' | 'bot' | 'system'; channel: ChannelType; content: string; contentType?: Message['contentType']; mediaUrl?: string; externalEventId?: string; status?: 'sent' | 'delivered' | 'read' | 'failed'; metadata?: Record<string, any> }): Promise<Message>;

  // Realtime Subscription (Release: Supabase Realtime | Live Inbox)
  subscribeToNewMessages?(callback: (message: Message) => void): () => void;
  subscribeToInboxEvents?(callbacks: RealtimeInboxCallbacks): () => void;
}

export interface ConversationUpdateEvent {
  id: string;
  status?: Conversation['status'];
  handler?: Conversation['handler'];
  unreadCount?: number;
  updatedAt?: string;
}

export interface RealtimeInboxCallbacks {
  onNewMessage?: (message: Message) => void;
  onConversationUpdate?: (update: ConversationUpdateEvent) => void;
}
