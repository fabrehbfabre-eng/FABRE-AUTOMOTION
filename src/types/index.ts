/**
 * FABRE AUTOMATION - Core Type Definitions
 * Release 1: Foundation & Architecture
 */

export type ChannelType = 'instagram' | 'messenger' | 'whatsapp';

export type ConnectionStatus = 
  | 'disconnected' 
  | 'awaiting_credentials'
  | 'awaiting_connection'
  | 'configured'
  | 'webhook_pending'
  | 'connecting' 
  | 'connected' 
  | 'error';

export interface ChannelConnection {
  id: string;
  channel: ChannelType;
  name: string;
  accountHandle?: string;
  status: ConnectionStatus;
  statusMessage?: string;
  connectedAt?: string;
  lastSyncAt?: string;
  metadata?: Record<string, unknown>;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  avatarUrl?: string;
}

export interface Contact {
  id: string;
  name: string;
  username: string;
  channel: ChannelType;
  avatarUrl?: string;
  phone?: string;
  email?: string;
  tags: string[];
  notes?: string;
  createdAt: string;
  lastActiveAt: string;
}

export type ConversationStatus = 'open' | 'waiting_user' | 'resolved' | 'archived';
export type ConversationHandler = 'bot' | 'human';

export interface Conversation {
  id: string;
  contactId: string;
  contact: Contact;
  channel: ChannelType;
  status: ConversationStatus;
  handler: ConversationHandler;
  unreadCount: number;
  lastMessage?: Message;
  tags: string[];
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export type MessageSender = 'user' | 'contact' | 'bot' | 'system';
export type MessageContentType = 'text' | 'image' | 'audio' | 'quick_reply' | 'template' | 'system_event';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Message {
  id: string;
  conversationId: string;
  sender: MessageSender;
  channel: ChannelType;
  content: string;
  contentType: MessageContentType;
  mediaUrl?: string;
  status: MessageStatus;
  externalEventId?: string;
  createdAt: string;
  metadata?: {
    automationId?: string;
    automationName?: string;
    isAiGenerated?: boolean;
    confidenceScore?: number;
    quickReplies?: string[];
  };
}

export type AutomationTriggerType = 
  | 'keyword_direct' 
  | 'comment_post' 
  | 'story_reply' 
  | 'first_contact' 
  | 'inactive_followup';

export interface AutomationTrigger {
  type: AutomationTriggerType;
  name: string;
  description: string;
  config: {
    keywords?: string[];
    matchType?: 'exact' | 'contains' | 'regex';
    postUrl?: string;
    postId?: string;
    inactivityHours?: number;
    [key: string]: unknown;
  };
}

export type AutomationActionType = 
  | 'send_message' 
  | 'send_dm' 
  | 'assign_human' 
  | 'add_tag' 
  | 'remove_tag' 
  | 'query_ai' 
  | 'delay';

export interface AutomationAction {
  id: string;
  type: AutomationActionType;
  name: string;
  description: string;
  config: {
    messageText?: string;
    delaySeconds?: number;
    tagName?: string;
    aiPrompt?: string;
    handoffMessage?: string;
    [key: string]: unknown;
  };
}

export interface Automation {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  channel: ChannelType | 'all';
  trigger: AutomationTrigger;
  actions: AutomationAction[];
  executionCount: number;
  lastExecutedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type KnowledgeCategory = 
  | 'product' 
  | 'price' 
  | 'faq' 
  | 'profile' 
  | 'rules' 
  | 'tone' 
  | 'commercial' 
  | 'link';

export interface KnowledgeItem {
  id: string;
  title: string;
  category: KnowledgeCategory;
  content: string;
  summary?: string;
  tags: string[];
  isActive: boolean;
  priority: number; // 1 (highest) to 5
  isOfficial?: boolean; // True when registered officially; false when demo placeholder
  createdAt: string;
  updatedAt: string;
}

export interface AIConfiguration {
  provider: 'openai' | 'custom';
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  fallbackToHuman: boolean;
  personalityTone: string;
  guardrails: string[];
}

export type IntegrationServiceId = 'instagram' | 'messenger' | 'whatsapp' | 'openai' | 'supabase';

export interface IntegrationCardConfig {
  id: IntegrationServiceId;
  name: string;
  category: 'channel' | 'ai' | 'database';
  channelType?: ChannelType;
  status: ConnectionStatus;
  badgeLabel: string;
  description: string;
  targetRelease: string;
  architectureNotes: string;
  docsUrl?: string;
}

export interface DashboardStats {
  totalConversations: number;
  messagesAutomated: number;
  activeAutomations: number;
  humanHandoffs: number;
  channelConnections: {
    instagram: ChannelConnection;
    messenger: ChannelConnection;
    whatsapp: ChannelConnection;
  };
  recentConversations: Conversation[];
}
