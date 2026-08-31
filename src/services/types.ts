/**
 * FABRE AUTOMATION - Service Layer Contracts
 * Release 1: Foundation & Architecture
 * 
 * These interfaces define the decoupled contract for the application core.
 * In future releases, these contracts will be fulfilled by real API clients:
 * - Supabase for Storage & Database
 * - Meta Graph API for Instagram Direct & Facebook Messenger
 * - WhatsApp Business Cloud API for WhatsApp
 * - OpenAI SDK for generative AI & Embeddings
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

export interface IConversationService {
  getConversations(filter?: { channel?: ChannelType; status?: string; handler?: string }): Promise<Conversation[]>;
  getConversationById(id: string): Promise<Conversation | null>;
  getMessages(conversationId: string): Promise<Message[]>;
  sendMessage(conversationId: string, content: string, sender?: 'user' | 'bot'): Promise<Message>;
  toggleHandler(conversationId: string, handler: 'bot' | 'human'): Promise<Conversation>;
  updateStatus(conversationId: string, status: Conversation['status']): Promise<Conversation>;
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
  // Prepared for Release 3 (OpenAI integration)
  generateResponseDraft(prompt: string, context?: { conversationId: string; knowledgeIds?: string[] }): Promise<{ text: string; confidence: number }>;
}

export interface IChannelService {
  getConnections(): Promise<ChannelConnection[]>;
  getConnection(channel: ChannelType): Promise<ChannelConnection>;
  getIntegrationConfigs(): Promise<IntegrationCardConfig[]>;
}

export interface IMetaService {
  // Prepared for Release 2 (Meta Graph API: Instagram & Messenger)
  checkStatus(): Promise<{ instagram: boolean; messenger: boolean; error?: string }>;
  verifyWebhook(hubChallenge: string, hubToken: string): boolean;
  sendDirectMessage(recipientId: string, text: string): Promise<{ success: boolean; messageId?: string }>;
}

export interface IWhatsAppService {
  // Prepared for Release 2 (WhatsApp Cloud API)
  checkStatus(): Promise<{ whatsapp: boolean; error?: string }>;
  sendWhatsAppMessage(phoneNumber: string, text: string): Promise<{ success: boolean; messageId?: string }>;
  sendTemplateMessage(phoneNumber: string, templateName: string, params: Record<string, string>): Promise<{ success: boolean }>;
}

export interface IStorageService {
  // Prepared for Supabase / Independent DB
  getStats(): Promise<DashboardStats>;
  getItem<T>(key: string): Promise<T | null>;
  setItem<T>(key: string, value: T): Promise<void>;
  removeItem(key: string): Promise<void>;
}
