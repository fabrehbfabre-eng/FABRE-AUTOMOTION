/**
 * FABRE AUTOMATION - Storage & State Service
 * Release 1: Foundation & Architecture (Local/In-Memory decoupled foundation)
 */

import { DashboardStats, Conversation, Automation, KnowledgeItem, ChannelConnection, IntegrationCardConfig } from '../types';
import { IStorageService } from './types';

const INITIAL_CONNECTIONS: Record<'instagram' | 'messenger' | 'whatsapp', ChannelConnection> = {
  instagram: {
    id: 'conn_ig_01',
    channel: 'instagram',
    name: 'Instagram Direct',
    accountHandle: '@casalfabre',
    status: 'awaiting_connection',
    statusMessage: 'Aguardando configuração de App Meta & Webhook na Release 2',
  },
  messenger: {
    id: 'conn_fb_01',
    channel: 'messenger',
    name: 'Facebook Messenger',
    accountHandle: 'Página Casal Fabre',
    status: 'awaiting_connection',
    statusMessage: 'Aguardando autenticação Meta Graph API na Release 2',
  },
  whatsapp: {
    id: 'conn_wa_01',
    channel: 'whatsapp',
    name: 'WhatsApp Business',
    accountHandle: '+55 (11) 99999-0000',
    status: 'awaiting_connection',
    statusMessage: 'Aguardando WhatsApp Cloud API Token & Webhook na Release 2',
  },
};

export const INITIAL_KNOWLEDGE_ITEMS: KnowledgeItem[] = [
  {
    id: 'kb_01',
    title: 'Apresentação do Casal Fabre & Propósito',
    category: 'profile',
    content: 'O Casal Fabre (Henrique e Bárbara Fabre) produz conteúdos, mentorias e treinamentos focados em crescimento profissional, liberdade financeira e construção de negócios digitais sólidos.',
    summary: 'Visão geral sobre os criadores e pilares de atuação.',
    tags: ['quem-somos', 'institucional', 'propósito'],
    isActive: true,
    priority: 1,
    createdAt: '2026-08-30T10:00:00Z',
    updatedAt: '2026-08-30T10:00:00Z',
  },
  {
    id: 'kb_02',
    title: 'Mentoria Exclusiva Casal Fabre',
    category: 'product',
    content: 'Programa de acompanhamento em grupo e individual com 6 meses de duração, encontros quinzenais ao vivo, análise de estratégias e canal direto com o Casal Fabre. Vagas limitadas por turma.',
    summary: 'Programa premium de aceleração e mentoria estratégica.',
    tags: ['mentoria', 'produtos', 'turma-2026'],
    isActive: true,
    priority: 1,
    createdAt: '2026-08-30T10:30:00Z',
    updatedAt: '2026-08-30T10:30:00Z',
  },
  {
    id: 'kb_03',
    title: 'Tabela de Valores e Formas de Pagamento',
    category: 'price',
    content: 'Mentoria Principal: R$ 4.997 à vista ou 12x no cartão de crédito via checkout seguro. Workshop Intensivo: R$ 497. Não enviar dados bancários pelo chat; direcionar sempre ao link de checkout oficial.',
    summary: 'Preços oficiais e diretrizes seguras de pagamento.',
    tags: ['valores', 'preços', 'pagamento', 'checkout'],
    isActive: true,
    priority: 1,
    createdAt: '2026-08-30T11:00:00Z',
    updatedAt: '2026-08-30T11:00:00Z',
  },
  {
    id: 'kb_04',
    title: 'Tom de Voz e Diretrizes de Comunicação',
    category: 'tone',
    content: 'Comunicação acolhedora, objetiva, ética, encorajadora e sem promessas milagrosas. Usar linguagem clara em português do Brasil, tratando o seguidor com respeito e entusiasmo profissional.',
    summary: 'Postura de atendimento humanizado e transparente.',
    tags: ['tom-de-voz', 'regras-ia', 'postura'],
    isActive: true,
    priority: 2,
    createdAt: '2026-08-30T11:15:00Z',
    updatedAt: '2026-08-30T11:15:00Z',
  },
  {
    id: 'kb_05',
    title: 'Gatilhos para Transferência a Atendimento Humano',
    category: 'rules',
    content: 'Transferir imediatamente quando o usuário solicitar falar com uma pessoa, expressar dúvida complexa não coberta pela base, relatar problema financeiro ou solicitar proposta corporativa personalizada.',
    summary: 'Critérios claros de handoff bot -> operador humano.',
    tags: ['regras', 'handoff', 'humano'],
    isActive: true,
    priority: 1,
    createdAt: '2026-08-30T11:30:00Z',
    updatedAt: '2026-08-30T11:30:00Z',
  },
  {
    id: 'kb_06',
    title: 'Links Oficiais e Canais Autorizados',
    category: 'link',
    content: 'Site Oficial: https://casalfabre.com.br | Inscrições Mentoria: https://casalfabre.com.br/mentoria | Suporte ao Aluno: suporte@casalfabre.com.br',
    summary: 'URLs seguras verificadas para envio nas mensagens.',
    tags: ['links', 'oficial', 'suporte'],
    isActive: true,
    priority: 2,
    createdAt: '2026-08-30T11:45:00Z',
    updatedAt: '2026-08-30T11:45:00Z',
  }
];

export const INITIAL_AUTOMATIONS: Automation[] = [
  {
    id: 'auto_01',
    title: 'Envio de Link da Mentoria por Palavra-Chave "QUERO"',
    description: 'Quando o seguidor enviar a mensagem exata "QUERO" no Direct, responder instantaneamente com informações e link.',
    enabled: true,
    channel: 'instagram',
    trigger: {
      type: 'keyword_direct',
      name: 'Recebeu mensagem contendo palavra-chave',
      description: 'Gatilho acionado quando a mensagem no Instagram Direct contém "QUERO"',
      config: {
        keywords: ['QUERO', 'quero', 'Quero'],
        matchType: 'contains',
      },
    },
    actions: [
      {
        id: 'act_01',
        type: 'send_message',
        name: 'Enviar Resposta Automática',
        description: 'Envia mensagem personalizada com o link da mentoria do Casal Fabre',
        config: {
          messageText: 'Olá! Que alegria ver seu interesse na nossa Mentoria. 🚀 Preparamos uma página com todos os detalhes e cronograma dos encontros. Acesse aqui: https://casalfabre.com.br/mentoria',
        },
      },
      {
        id: 'act_02',
        type: 'add_tag',
        name: 'Adicionar Etiqueta de Interesse',
        description: 'Aplica a tag [Lead-Mentoria] no contato para segmentação',
        config: {
          tagName: 'Lead-Mentoria',
        },
      },
    ],
    executionCount: 0,
    createdAt: '2026-08-30T09:00:00Z',
    updatedAt: '2026-08-30T09:00:00Z',
  },
  {
    id: 'auto_02',
    title: 'Resposta Automática a Comentário em Post com "QUERO"',
    description: 'Quando alguém comentar "QUERO" em qualquer publicação do feed, enviar mensagem de boas-vindas no Direct.',
    enabled: true,
    channel: 'instagram',
    trigger: {
      type: 'comment_post',
      name: 'Comentário em Post do Feed',
      description: 'Gatilho acionado quando há novo comentário com palavra "QUERO"',
      config: {
        keywords: ['QUERO', 'quero'],
        matchType: 'contains',
      },
    },
    actions: [
      {
        id: 'act_03',
        type: 'send_dm',
        name: 'Enviar Direct Automático',
        description: 'Abre conversa privada no Instagram com o seguidor',
        config: {
          messageText: 'Oi! Vimos seu comentário no nosso post. Acabamos de te mandar este Direct com o material exclusivo do Casal Fabre que você pediu! ✨',
        },
      },
    ],
    executionCount: 0,
    createdAt: '2026-08-30T09:30:00Z',
    updatedAt: '2026-08-30T09:30:00Z',
  },
  {
    id: 'auto_03',
    title: 'Boas-Vindas no Primeiro Contato via WhatsApp',
    description: 'Apresenta o canal oficial do Casal Fabre e oferece opções rápidas de atendimento.',
    enabled: false,
    channel: 'whatsapp',
    trigger: {
      type: 'first_contact',
      name: 'Primeira Mensagem Recebida',
      description: 'Acionado apenas no primeiro contato de um novo número no WhatsApp',
      config: {},
    },
    actions: [
      {
        id: 'act_04',
        type: 'send_message',
        name: 'Mensagem de Apresentação',
        description: 'Envia menu inicial amigável',
        config: {
          messageText: 'Olá! Você está no canal oficial do Casal Fabre. Como podemos te ajudar hoje?\n1 - Conhecer a Mentoria\n2 - Acessar Conteúdos Gratuitos\n3 - Falar com a Equipe',
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
    id: 'conv_01',
    contactId: 'contact_01',
    contact: {
      id: 'contact_01',
      name: 'Mariana Silveira',
      username: '@mariana.silveira',
      channel: 'instagram',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      tags: ['Lead-Mentoria', 'Instagram'],
      notes: 'Demonstrou interesse na próxima turma de mentoria.',
      createdAt: '2026-08-31T07:30:00Z',
      lastActiveAt: '2026-08-31T08:45:00Z',
    },
    channel: 'instagram',
    status: 'open',
    handler: 'bot',
    unreadCount: 1,
    tags: ['Lead-Mentoria', 'Alta Prioridade'],
    lastMessage: {
      id: 'msg_01_3',
      conversationId: 'conv_01',
      sender: 'contact',
      channel: 'instagram',
      content: 'QUERO saber quando abrem as próximas vagas!',
      contentType: 'text',
      status: 'delivered',
      createdAt: '2026-08-31T08:45:00Z',
    },
    createdAt: '2026-08-31T07:30:00Z',
    updatedAt: '2026-08-31T08:45:00Z',
  },
  {
    id: 'conv_02',
    contactId: 'contact_02',
    contact: {
      id: 'contact_02',
      name: 'Rodrigo Medeiros',
      username: '+55 11 98877-6655',
      channel: 'whatsapp',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      phone: '+55 11 98877-6655',
      tags: ['WhatsApp', 'Dúvida Pagamento'],
      notes: 'Solicitou atendimento humano sobre nota fiscal PJ.',
      createdAt: '2026-08-31T06:10:00Z',
      lastActiveAt: '2026-08-31T08:20:00Z',
    },
    channel: 'whatsapp',
    status: 'waiting_user',
    handler: 'human',
    unreadCount: 0,
    tags: ['Atendimento Humano', 'WhatsApp'],
    assignedTo: 'Henrique Fabre',
    lastMessage: {
      id: 'msg_02_4',
      conversationId: 'conv_02',
      sender: 'user',
      channel: 'whatsapp',
      content: 'Olá Rodrigo! Henrique por aqui. Emitimos NF para pessoa jurídica sim. Qual o CNPJ da sua empresa?',
      contentType: 'text',
      status: 'read',
      createdAt: '2026-08-31T08:20:00Z',
    },
    createdAt: '2026-08-31T06:10:00Z',
    updatedAt: '2026-08-31T08:20:00Z',
  },
  {
    id: 'conv_03',
    contactId: 'contact_03',
    contact: {
      id: 'contact_03',
      name: 'Camila Albuquerque',
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
      id: 'msg_03_2',
      conversationId: 'conv_03',
      sender: 'bot',
      channel: 'messenger',
      content: 'Obrigado pelo contato! Para ver nossos vídeos diários, acompanhe também nosso Instagram @casalfabre.',
      contentType: 'text',
      status: 'read',
      createdAt: '2026-08-30T19:15:00Z',
    },
    createdAt: '2026-08-30T18:00:00Z',
    updatedAt: '2026-08-30T19:15:00Z',
  }
];

export const INITIAL_INTEGRATIONS: IntegrationCardConfig[] = [
  {
    id: 'instagram',
    name: 'Instagram Direct API',
    category: 'channel',
    channelType: 'instagram',
    status: 'awaiting_connection',
    badgeLabel: 'Aguardando Conexão',
    description: 'Permite receber mensagens do Direct, comentários em posts/reels e responder automaticamente com links e tags.',
    targetRelease: 'Release 2 (Meta Integrations)',
    architectureNotes: 'Interface preparada para Meta Graph API v21.0 Webhooks e Messaging Endpoints.',
  },
  {
    id: 'messenger',
    name: 'Facebook Messenger',
    category: 'channel',
    channelType: 'messenger',
    status: 'awaiting_connection',
    badgeLabel: 'Aguardando Conexão',
    description: 'Centraliza conversas da Página Oficial do Facebook do Casal Fabre com respostas ágeis e transbordo para humanos.',
    targetRelease: 'Release 2 (Meta Integrations)',
    architectureNotes: 'Interface preparada para Webhook de Página Meta e Send API.',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business Cloud API',
    category: 'channel',
    channelType: 'whatsapp',
    status: 'awaiting_connection',
    badgeLabel: 'Aguardando Conexão',
    description: 'Integração oficial via Meta Cloud API para atendimento comercial, dúvidas de alunos e envio de notificações.',
    targetRelease: 'Release 2 (WhatsApp Cloud)',
    architectureNotes: 'Estrutura preparada para modelos de mensagem (Templates), mídia e mensagens de texto.',
  },
  {
    id: 'openai',
    name: 'OpenAI API (GPT-4o & Embeddings)',
    category: 'ai',
    status: 'awaiting_connection',
    badgeLabel: 'Camada de IA Desacoplada',
    description: 'Motor inteligente para respostas contextuais consultando a base de conhecimento do Casal Fabre com respeito ao tom de voz.',
    targetRelease: 'Release 3 (AI Engine & Knowledge RAG)',
    architectureNotes: 'Interface IA Service abstraída para suportar chave de API OpenAI ou modelos customizados.',
  },
  {
    id: 'supabase',
    name: 'Supabase (PostgreSQL & Auth)',
    category: 'database',
    status: 'awaiting_connection',
    badgeLabel: 'Banco Independente',
    description: 'Infraestrutura de banco de dados relacional independente e desacoplada do Google para persistência resiliente.',
    targetRelease: 'Release 4 (Cloud Persistence & Auth)',
    architectureNotes: 'Totalmente desacoplado de Firebase/Firestore, aderindo às diretrizes do projeto.',
  }
];

class StorageServiceImpl implements IStorageService {
  private keyPrefix = 'fabre_automation_';

  async getStats(): Promise<DashboardStats> {
    const automations = await this.getItem<Automation[]>('automations') || INITIAL_AUTOMATIONS;
    const conversations = await this.getItem<Conversation[]>('conversations') || INITIAL_CONVERSATIONS;
    
    const activeAutomationsCount = automations.filter(a => a.enabled).length;
    const humanHandoffsCount = conversations.filter(c => c.handler === 'human').length;

    return {
      totalConversations: conversations.length,
      messagesAutomated: 128,
      activeAutomations: activeAutomationsCount,
      humanHandoffs: humanHandoffsCount,
      channelConnections: INITIAL_CONNECTIONS,
      recentConversations: conversations.slice(0, 5),
    };
  }

  async getItem<T>(key: string): Promise<T | null> {
    try {
      const data = localStorage.getItem(`${this.keyPrefix}${key}`);
      return data ? (JSON.parse(data) as T) : null;
    } catch {
      return null;
    }
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    try {
      localStorage.setItem(`${this.keyPrefix}${key}`, JSON.stringify(value));
    } catch {
      // ignore storage errors
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(`${this.keyPrefix}${key}`);
    } catch {
      // ignore storage errors
    }
  }
}

export const storageService = new StorageServiceImpl();
