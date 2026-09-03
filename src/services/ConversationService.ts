/**
 * FABRE AUTOMATION - Conversation Service
 * Release 2: Supabase Persistence Foundation
 * 
 * Delegates to repositoryManager (SupabaseProvider or MockProvider)
 */

import { Conversation, Message, ChannelType } from '../types';
import { IConversationService } from './types';
import { repositoryManager } from './repositories';

export class ConversationService implements IConversationService {
  async getConversations(filter?: { channel?: ChannelType; status?: string; handler?: string }): Promise<Conversation[]> {
    return repositoryManager.conversation.getConversations(filter);
  }

  async getConversationById(id: string): Promise<Conversation | null> {
    return repositoryManager.conversation.getConversationById(id);
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    return repositoryManager.conversation.getMessages(conversationId);
  }

  async sendMessage(conversationId: string, content: string, sender: 'user' | 'bot' = 'user'): Promise<Message> {
    return repositoryManager.conversation.sendMessage(conversationId, content, sender);
  }

  async toggleHandler(conversationId: string, handler: 'bot' | 'human'): Promise<Conversation> {
    return repositoryManager.conversation.toggleHandler(conversationId, handler);
  }

  async updateStatus(conversationId: string, status: Conversation['status']): Promise<Conversation> {
    return repositoryManager.conversation.updateStatus(conversationId, status);
  }

  subscribeToNewMessages(callback: (message: Message) => void): () => void {
    if (typeof repositoryManager.conversation.subscribeToNewMessages === 'function') {
      return repositoryManager.conversation.subscribeToNewMessages(callback);
    }
    return () => {};
  }
}

export const conversationService = new ConversationService();
