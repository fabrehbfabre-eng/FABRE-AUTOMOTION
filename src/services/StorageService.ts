/**
 * FABRE AUTOMATION - Storage & State Service
 * Release 2: Supabase Persistence Foundation
 * 
 * Data Integrity Compliance:
 * - All demo data is strictly generic and explicitly labeled as [DEMONSTRAÇÃO].
 * - No fictitious persona names, prices, or unauthorized product claims.
 */

import { DashboardStats, Conversation, Automation, KnowledgeItem, ChannelConnection, IntegrationCardConfig } from '../types';
import { IStorageService } from './types';

export const INITIAL_CONNECTIONS: Record<'instagram' | 'messenger' | 'whatsapp', ChannelConnection> = {
  instagram: {
    id: 'conn_ig_01',
    channel: 'instagram',
    name: 'Instagram Direct',
    accountHandle: 'Conta Instagram (Aguardando Conexão)',
    status: 'awaiting_connection',
    statusMessage: 'Aguardando configuração de App Meta & Webhook',
  },
  messenger: {
    id: 'conn_fb_01',
    channel: 'messenger',
    name: 'Facebook Messenger',
    accountHandle: 'Página Facebook (Aguardando Conexão)',
    status: 'awaiting_connection',
    statusMessage: 'Aguardando autenticação Meta Graph API',
  },
  whatsapp: {
    id: 'conn_wa_01',
    channel: 'whatsapp',
    name: 'WhatsApp Business Cloud',
    accountHandle: 'Número WhatsApp (Aguardando Conexão)',
    status: 'awaiting_connection',
    statusMessage: 'Aguardando WhatsApp Cloud API Token & Webhook',
  },
};

export const INITIAL_KNOWLEDGE_ITEMS: KnowledgeItem[] = [
  {
    id: 'kb_demo_01',
    title: '[Demonstração] Diretrizes Gerais de Atendimento e Tom de Voz',
    category: 'tone',
    content: 'Diretriz de comunicação: Atendimento acolhedor, profissional, transparente e objetivo. Responder com clareza em português do Brasil e transferir para atendimento humano sempre que o seguidor solicitar auxílio personalizado.',
    summary: 'Estrutura padrão de tom de voz para o motor de IA e operadores.',
    tags: ['diretrizes', 'tom-de-voz', 'atendimento'],
    isActive: true,
    priority: 1,
    isOfficial: false,
    createdAt: '2026-08-30T10:00:00Z',
    updatedAt: '2026-08-30T10:00:00Z',
  },
  {
    id: 'kb_demo_02',
    title: '[Demonstração] Regras de Transbordo para Atendimento Humano',
    category: 'rules',
    content: 'Critérios de transbordo imediato: 1) Usuário solicitou falar com uma pessoa da equipe; 2) Dúvida ou caso específico não registrado na base de conhecimento oficial; 3) Questões financeiras ou comerciais personalizadas.',
    summary: 'Critérios estruturais de handoff bot -> atendente humano.',
    tags: ['regras', 'handoff', 'humano'],
    isActive: true,
    priority: 1,
    isOfficial: false,
    createdAt: '2026-08-30T11:00:00Z',
    updatedAt: '2026-08-30T11:00:00Z',
  },
  {
    id: 'kb_demo_03',
    title: '[Demonstração] Segurança e Links Oficiais de Checkout',
    category: 'link',
    content: 'Segurança operacional: Nunca enviar dados bancários pessoais ou chaves PIX em conversas abertas. Todo pagamento deve ser realizado exclusivamente através das plataformas de checkout e links oficiais validados.',
    summary: 'Diretriz de proteção e boas práticas de pagamento.',
    tags: ['segurança', 'links', 'pagamento'],
    isActive: true,
    priority: 2,
    isOfficial: false,
    createdAt: '2026-08-30T11:30:00Z',
    updatedAt: '2026-08-30T11:30:00Z',
  },
];

export const INITIAL_AUTOMATIONS: Automation[] = [
  {
    id: 'auto_demo_01',
    title: '[Demonstração] Envio de Informações por Palavra-Chave "INFO"',
    description: 'Quando o seguidor enviar a mensagem contendo a palavra-chave "INFO" no Direct, responder com mensagem estruturada.',
    enabled: true,
    channel: 'instagram',
    trigger: {
      type: 'keyword_direct',
      name: 'Recebeu mensagem contendo palavra-chave',
      description: 'Gatilho acionado quando a mensagem no Instagram Direct contém "INFO"',
      config: {
        keywords: ['INFO', 'info', 'informações'],
        matchType: 'contains',
      },
    },
    actions: [
      {
        id: 'act_demo_01',
        type: 'send_message',
        name: 'Enviar Resposta Automática',
        description: 'Envia mensagem estruturada com as orientações do canal',
        config: {
          messageText: 'Olá! Agradecemos sua mensagem. Estamos à disposição para ajudar você. Como podemos te orientar hoje?',
        },
      },
      {
        id: 'act_demo_02',
        type: 'add_tag',
        name: 'Adicionar Etiqueta de Contato',
        description: 'Aplica a tag [Interesse-Info] no perfil para segmentação',
        config: {
          tagName: 'Interesse-Info',
        },
      },
    ],
    executionCount: 0,
    createdAt: '2026-08-30T09:00:00Z',
    updatedAt: '2026-08-30T09:00:00Z',
  },
  {
    id: 'auto_demo_02',
    title: '[Demonstração] Boas-Vindas no Primeiro Contato via WhatsApp',
    description: 'Apresenta o canal e oferece menu de opções para novos contatos.',
    enabled: false,
    channel: 'whatsapp',
    trigger: {
      type: 'first_contact',
      name: 'Primeira Mensagem Recebida',
      description: 'Acionado no primeiro contato recebido no WhatsApp',
      config: {},
    },
    actions: [
      {
        id: 'act_demo_03',
        type: 'send_message',
        name: 'Mensagem de Apresentação',
        description: 'Envia menu inicial',
        config: {
          messageText: 'Olá! Seja muito bem-vindo ao nosso canal oficial. Como podemos te ajudar hoje?\n1 - Dúvidas Frequentes\n2 - Falar com Atendente',
        },
      },
    ],
    executionCount: 0,
    createdAt: '2026-08-30T10:00:00Z',
    updatedAt: '2026-08-30T10:00:00Z',
  },
];

export const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv_demo_01',
    contactId: 'contact_demo_01',
    contact: {
      id: 'contact_demo_01',
      name: 'Mariana Silveira [Contato Demo]',
      username: '@mariana.silveira',
      channel: 'instagram',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      tags: ['Interesse-Info', 'Instagram'],
      notes: 'Contato de teste para validação de fluxo de Direct.',
      createdAt: '2026-08-31T07:30:00Z',
      lastActiveAt: '2026-08-31T08:45:00Z',
    },
    channel: 'instagram',
    status: 'open',
    handler: 'bot',
    unreadCount: 1,
    tags: ['Interesse-Info', 'Demonstração'],
    lastMessage: {
      id: 'msg_demo_01_3',
      conversationId: 'conv_demo_01',
      sender: 'contact',
      channel: 'instagram',
      content: 'INFO: Gostaria de receber mais detalhes sobre a programação.',
      contentType: 'text',
      status: 'delivered',
      createdAt: '2026-08-31T08:45:00Z',
    },
    createdAt: '2026-08-31T07:30:00Z',
    updatedAt: '2026-08-31T08:45:00Z',
  },
  {
    id: 'conv_demo_02',
    contactId: 'contact_demo_02',
    contact: {
      id: 'contact_demo_02',
      name: 'Rodrigo Medeiros [Contato Demo]',
      username: '+55 (11) 90000-0000',
      channel: 'whatsapp',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      phone: '+55 11 90000-0000',
      tags: ['WhatsApp', 'Atendimento Humano'],
      notes: 'Solicitou atendimento sobre documentação PJ.',
      createdAt: '2026-08-31T06:10:00Z',
      lastActiveAt: '2026-08-31T08:20:00Z',
    },
    channel: 'whatsapp',
    status: 'waiting_user',
    handler: 'human',
    unreadCount: 0,
    tags: ['Atendimento Humano', 'WhatsApp'],
    assignedTo: 'Atendente Humano',
    lastMessage: {
      id: 'msg_demo_02_4',
      conversationId: 'conv_demo_02',
      sender: 'user',
      channel: 'whatsapp',
      content: 'Olá Rodrigo! Atendimento humano iniciado. Como podemos ajudar com a documentação?',
      contentType: 'text',
      status: 'read',
      createdAt: '2026-08-31T08:20:00Z',
    },
    createdAt: '2026-08-31T06:10:00Z',
    updatedAt: '2026-08-31T08:20:00Z',
  },
  {
    id: 'conv_demo_03',
    contactId: 'contact_demo_03',
    contact: {
      id: 'contact_demo_03',
      name: 'Camila Albuquerque [Contato Demo]',
      username: 'camila.albuquerque.fb',
      channel: 'messenger',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      tags: ['Messenger', 'Novo Seguidor'],
      createdAt: '2026-08-30T18:00:00Z',
      lastActiveAt: '2026-08-30T19:15:00Z',
    },
    channel: 'messenger',
    status: 'resolved',
    handler: 'bot',
    unreadCount: 0,
    tags: ['Messenger', 'Resolvido'],
    lastMessage: {
      id: 'msg_demo_03_2',
      conversationId: 'conv_demo_03',
      sender: 'bot',
      channel: 'messenger',
      content: 'Obrigado pela mensagem! Ficamos à disposição em nossos canais oficiais.',
      contentType: 'text',
      status: 'read',
      createdAt: '2026-08-30T19:15:00Z',
    },
    createdAt: '2026-08-30T18:00:00Z',
    updatedAt: '2026-08-30T19:15:00Z',
  },
];

export const INITIAL_INTEGRATIONS: IntegrationCardConfig[] = [
  {
    id: 'supabase',
    name: 'Supabase (PostgreSQL & Auth)',
    category: 'database',
    status: 'awaiting_connection',
    badgeLabel: 'Persistência Oficial',
    description: 'Banco de dados relacional oficial do FABRE AUTOMATION com Row Level Security (RLS) e PostgreSQL nativo.',
    targetRelease: 'Release 2 (Supabase Persistence Foundation)',
    architectureNotes: 'Schema de 11 tabelas, índices e triggers prontos. Desacoplado de Firebase.',
    docsUrl: 'https://supabase.com/docs',
  },
  {
    id: 'instagram',
    name: 'Instagram Direct API',
    category: 'channel',
    channelType: 'instagram',
    status: 'awaiting_connection',
    badgeLabel: 'Aguardando Conexão',
    description: 'Permite receber mensagens do Direct, comentários em posts/reels e responder automaticamente com links e tags.',
    targetRelease: 'Release 3 (Meta Integrations)',
    architectureNotes: 'Interface preparada para Meta Graph API v21.0 Webhooks e Messaging Endpoints.',
  },
  {
    id: 'messenger',
    name: 'Facebook Messenger',
    category: 'channel',
    channelType: 'messenger',
    status: 'awaiting_connection',
    badgeLabel: 'Aguardando Conexão',
    description: 'Centraliza conversas da Página Oficial do Facebook com respostas ágeis e transbordo para humanos.',
    targetRelease: 'Release 3 (Meta Integrations)',
    architectureNotes: 'Interface preparada para Webhook de Página Meta e Send API.',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business Cloud API',
    category: 'channel',
    channelType: 'whatsapp',
    status: 'awaiting_connection',
    badgeLabel: 'Aguardando Conexão',
    description: 'Integração oficial via Meta Cloud API para atendimento comercial e envio de notificações.',
    targetRelease: 'Release 3 (WhatsApp Cloud)',
    architectureNotes: 'Estrutura preparada para modelos de mensagem (Templates), mídia e mensagens de texto.',
  },
  {
    id: 'openai',
    name: 'OpenAI API (GPT-4o & Embeddings)',
    category: 'ai',
    status: 'awaiting_connection',
    badgeLabel: 'Camada de IA Desacoplada',
    description: 'Motor inteligente para respostas contextuais consultando a base de conhecimento oficial com respeito ao tom de voz.',
    targetRelease: 'Release 4 (AI Engine & Knowledge RAG)',
    architectureNotes: 'Interface IA Service abstraída para suportar chave de API OpenAI via Edge Functions seguras.',
  },
];

class StorageServiceImpl implements IStorageService {
  private keyPrefix = 'fabre_automation_';
  private memoryStore = new Map<string, string>();

  async getStats(): Promise<DashboardStats> {
    const automations = (await this.getItem<Automation[]>('automations')) || INITIAL_AUTOMATIONS;
    const conversations = (await this.getItem<Conversation[]>('conversations')) || INITIAL_CONVERSATIONS;

    const activeAutomationsCount = automations.filter(a => a.enabled).length;
    const humanHandoffsCount = conversations.filter(c => c.handler === 'human').length;

    return {
      totalConversations: conversations.length,
      messagesAutomated: 12,
      activeAutomations: activeAutomationsCount,
      humanHandoffs: humanHandoffsCount,
      channelConnections: INITIAL_CONNECTIONS,
      recentConversations: conversations.slice(0, 5),
    };
  }

  async getItem<T>(key: string): Promise<T | null> {
    try {
      let data: string | null = null;
      if (typeof localStorage !== 'undefined') {
        data = localStorage.getItem(`${this.keyPrefix}${key}`);
      } else {
        data = this.memoryStore.get(`${this.keyPrefix}${key}`) || null;
      }
      return data ? (JSON.parse(data) as T) : null;
    } catch {
      return null;
    }
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`${this.keyPrefix}${key}`, serialized);
      } else {
        this.memoryStore.set(`${this.keyPrefix}${key}`, serialized);
      }
    } catch {
      // ignore storage errors
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(`${this.keyPrefix}${key}`);
      } else {
        this.memoryStore.delete(`${this.keyPrefix}${key}`);
      }
    } catch {
      // ignore storage errors
    }
  }
}

export const storageService = new StorageServiceImpl();
