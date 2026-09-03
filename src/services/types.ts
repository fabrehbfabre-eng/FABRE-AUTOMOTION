/**
 * FABRE AUTOMATION - Service Layer Contracts
 * Release 3: Secure Backend Foundation
 * 
 * These interfaces define the decoupled contracts for the application core.
 * External integrations are proxied exclusively via secure Supabase Edge Functions:
 * - Supabase for Storage & Database
 * - Meta Graph API for Instagram Direct & Facebook Messenger
 * - WhatsApp Business Cloud API for WhatsApp
 * - OpenAI API for Generative AI & Embeddings
 */

import { 
  Conversation, 
  Message, 
  Automation, 
  KnowledgeItem, 
  ChannelConnection, 
  ChannelType, 
  AIConfiguration, 
  DashboardStats, 
  IntegrationCardConfig 
} from '../types';
import { NormalizedInboundMessage } from '../types/webhook';

export interface IConversationService {
  getConversations(filter?: { channel?: ChannelType; status?: string; handler?: string }): Promise<Conversation[]>;
  getConversationById(id: string): Promise<Conversation | null>;
  getMessages(conversationId: string): Promise<Message[]>;
  sendMessage(conversationId: string, content: string, sender?: 'user' | 'bot'): Promise<Message>;
  toggleHandler(conversationId: string, handler: 'bot' | 'human'): Promise<Conversation>;
  updateStatus(conversationId: string, status: Conversation['status']): Promise<Conversation>;
  subscribeToNewMessages?(callback: (message: Message) => void): () => void;
}

export interface IAutomationService {
  getAutomations(): Promise<Automation[]>;
  getAutomationById(id: string): Promise<Automation | null>;
  createAutomation(data: Omit<Automation, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'>): Promise<Automation>;
  updateAutomation(id: string, updates: Partial<Automation>): Promise<Automation>;
  toggleAutomation(id: string, enabled: boolean): Promise<Automation>;
  deleteAutomation(id: string): Promise<boolean>;
}

export interface IKnowledgeService {
  getKnowledgeItems(category?: string): Promise<KnowledgeItem[]>;
  getKnowledgeItemById(id: string): Promise<KnowledgeItem | null>;
  createKnowledgeItem(data: Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<KnowledgeItem>;
  updateKnowledgeItem(id: string, updates: Partial<KnowledgeItem>): Promise<KnowledgeItem>;
  deleteKnowledgeItem(id: string): Promise<boolean>;
  searchKnowledge(query: string): Promise<KnowledgeItem[]>;
}

export interface IAIService {
  getConfiguration(): Promise<AIConfiguration>;
  updateConfiguration(config: Partial<AIConfiguration>): Promise<AIConfiguration>;
  generateResponse(prompt: string, options?: { maxTokens?: number; temperature?: number }): Promise<{ text: string; confidence: number; model: string }>;
  generateResponseWithContext(prompt: string, context?: { conversationId: string; knowledgeIds?: string[] }): Promise<{ text: string; confidence: number; model: string; contextItemsCount?: number }>;
  generateResponseDraft(prompt: string, context?: { conversationId: string; knowledgeIds?: string[] }): Promise<{ text: string; confidence: number }>;
}

export interface IChannelService {
  getConnections(): Promise<ChannelConnection[]>;
  getConnection(channel: ChannelType): Promise<ChannelConnection>;
  getIntegrationConfigs(): Promise<IntegrationCardConfig[]>;
}

export interface IMetaService {
  checkStatus(): Promise<{ instagram: boolean; messenger: boolean; error?: string }>;
  verifyWebhook(hubChallenge: string, hubToken: string): boolean;
  receiveMessage(rawPayload: Record<string, any>): Promise<NormalizedInboundMessage | null>;
  sendMessage(recipientId: string, text: string): Promise<{ success: boolean; messageId?: string }>;
  sendMedia(recipientId: string, mediaType: 'image' | 'audio', mediaUrl: string): Promise<{ success: boolean; messageId?: string }>;
  getConversation(externalConversationId: string): Promise<{ id: string; messages: any[] } | null>;
}

export interface IWhatsAppService {
  checkStatus(): Promise<{ whatsapp: boolean; error?: string }>;
  verifyWebhook(hubChallenge: string, hubToken: string): boolean;
  receiveMessage(rawPayload: Record<string, any>): Promise<NormalizedInboundMessage | null>;
  sendWhatsAppMessage(phoneNumber: string, text: string): Promise<{ success: boolean; messageId?: string }>;
  sendTemplateMessage(phoneNumber: string, templateName: string, params: Record<string, string>): Promise<{ success: boolean }>;
  sendMedia(phoneNumber: string, mediaType: 'image' | 'audio' | 'document', mediaUrl: string, caption?: string): Promise<{ success: boolean; messageId?: string }>;
}

export interface IStorageService {
  getStats(): Promise<DashboardStats>;
  getItem<T>(key: string): Promise<T | null>;
  setItem<T>(key: string, value: T): Promise<void>;
  removeItem(key: string): Promise<void>;
}
