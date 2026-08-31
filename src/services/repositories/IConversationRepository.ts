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
  getStats(): Promise<{ totalConversations: number; humanHandoffs: number; automatedMessages: number }>;
}
