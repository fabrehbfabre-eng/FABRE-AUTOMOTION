/**
 * FABRE AUTOMATION - Mock Conversation Repository
 * Release 2: Supabase Persistence Foundation
 */

import { Conversation, Message, ChannelType } from '../../../types';
import { IConversationRepository } from '../IConversationRepository';
import { INITIAL_CONVERSATIONS, storageService } from '../../StorageService';

const SAMPLE_MESSAGES: Record<string, Message[]> = {
  conv_demo_01: [
    {
      id: 'msg_demo_01_1',
      conversationId: 'conv_demo_01',
      sender: 'contact',
      channel: 'instagram',
      content: 'Olá! Acompanho as publicações de vocês no Instagram.',
      contentType: 'text',
      status: 'read',
      createdAt: '2026-08-31T07:30:00Z',
    },
    {
      id: 'msg_demo_01_2',
      conversationId: 'conv_demo_01',
      sender: 'bot',
      channel: 'instagram',
      content: 'Olá Mariana! Agradecemos o carinho. Como podemos te orientar hoje?',
      contentType: 'text',
      status: 'read',
      createdAt: '2026-08-31T07:31:00Z',
      metadata: {
        automationName: 'Boas-Vindas Instagram (Demo)',
        isAiGenerated: true,
      }
    },
    {
      id: 'msg_demo_01_3',
      conversationId: 'conv_demo_01',
      sender: 'contact',
      channel: 'instagram',
      content: 'INFO: Gostaria de receber mais detalhes sobre a programação.',
      contentType: 'text',
      status: 'delivered',
      createdAt: '2026-08-31T08:45:00Z',
    },
  ],
  conv_demo_02: [
    {
      id: 'msg_demo_02_1',
      conversationId: 'conv_demo_02',
      sender: 'contact',
      channel: 'whatsapp',
      content: 'Bom dia! Gostaria de tirar uma dúvida sobre a emissão de nota fiscal para PJ.',
      contentType: 'text',
      status: 'read',
      createdAt: '2026-08-31T06:10:00Z',
    },
    {
      id: 'msg_demo_02_2',
      conversationId: 'conv_demo_02',
      sender: 'bot',
      channel: 'whatsapp',
      content: 'Olá Rodrigo! Claro, vou direcionar seu atendimento para a nossa equipe verificar para você.',
      contentType: 'text',
      status: 'read',
      createdAt: '2026-08-31T06:11:00Z',
    },
    {
      id: 'msg_demo_02_3',
      conversationId: 'conv_demo_02',
      sender: 'system',
      channel: 'whatsapp',
      content: 'Atendimento transferido para operador humano',
      contentType: 'system_event',
      status: 'read',
      createdAt: '2026-08-31T08:15:00Z',
    },
    {
      id: 'msg_demo_02_4',
      conversationId: 'conv_demo_02',
      sender: 'user',
      channel: 'whatsapp',
      content: 'Olá Rodrigo! Atendimento humano iniciado. Emitimos NF para pessoa jurídica sim. Qual o CNPJ da sua empresa?',
      contentType: 'text',
      status: 'read',
      createdAt: '2026-08-31T08:20:00Z',
    },
  ],
  conv_demo_03: [
    {
      id: 'msg_demo_03_1',
      conversationId: 'conv_demo_03',
      sender: 'contact',
      channel: 'messenger',
      content: 'Olá! Onde posso encontrar as orientações em vídeo?',
      contentType: 'text',
      status: 'read',
      createdAt: '2026-08-30T18:00:00Z',
    },
    {
      id: 'msg_demo_03_2',
      conversationId: 'conv_demo_03',
      sender: 'bot',
      channel: 'messenger',
      content: 'Obrigado pelo contato! Ficamos à disposição em nossos canais oficiais.',
      contentType: 'text',
      status: 'read',
      createdAt: '2026-08-30T19:15:00Z',
    },
  ],
};

export class MockConversationRepository implements IConversationRepository {
  async getConversations(filter?: { channel?: ChannelType; status?: string; handler?: string }): Promise<Conversation[]> {
    const stored = await storageService.getItem<Conversation[]>('conversations');
    const conversations = stored || INITIAL_CONVERSATIONS;

    return conversations.filter(c => {
      if (filter?.channel && c.channel !== filter.channel) return false;
      if (filter?.status && c.status !== filter.status) return false;
      if (filter?.handler && c.handler !== filter.handler) return false;
      return true;
    });
  }

  async getConversationById(id: string): Promise<Conversation | null> {
    const list = await this.getConversations();
    return list.find(c => c.id === id) || null;
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    const stored = await storageService.getItem<Record<string, Message[]>>('messages_map');
    const messagesMap = stored || SAMPLE_MESSAGES;
    return messagesMap[conversationId] || [];
  }

  async sendMessage(conversationId: string, content: string, sender: 'user' | 'bot' = 'user'): Promise<Message> {
    const conv = await this.getConversationById(conversationId);
    const channel = conv?.channel || 'instagram';

    const newMessage: Message = {
      id: `msg_demo_${Date.now()}`,
      conversationId,
      sender,
      channel,
      content,
      contentType: 'text',
      status: 'sent',
      createdAt: new Date().toISOString(),
    };

    const storedMessages = (await storageService.getItem<Record<string, Message[]>>('messages_map')) || SAMPLE_MESSAGES;
    const currentList = storedMessages[conversationId] || [];
    const updatedList = [...currentList, newMessage];

    storedMessages[conversationId] = updatedList;
    await storageService.setItem('messages_map', storedMessages);

    const conversations = await this.getConversations();
    const updatedConversations = conversations.map(c => {
      if (c.id === conversationId) {
        return {
          ...c,
          lastMessage: newMessage,
          updatedAt: newMessage.createdAt,
          unreadCount: 0,
        };
      }
      return c;
    });
    await storageService.setItem('conversations', updatedConversations);

    return newMessage;
  }

  async toggleHandler(conversationId: string, handler: 'bot' | 'human'): Promise<Conversation> {
    const conversations = await this.getConversations();
    let updatedConv: Conversation | null = null;

    const updated = conversations.map(c => {
      if (c.id === conversationId) {
        updatedConv = {
          ...c,
          handler,
          assignedTo: handler === 'human' ? 'Atendente Humano' : undefined,
          updatedAt: new Date().toISOString(),
        };
        return updatedConv;
      }
      return c;
    });

    await storageService.setItem('conversations', updated);

    const eventMsg: Message = {
      id: `evt_demo_${Date.now()}`,
      conversationId,
      sender: 'system',
      channel: updatedConv?.channel || 'instagram',
      content: handler === 'human'
        ? 'Atendimento transferido para atendente humano'
        : 'Atendimento retomado pelo motor de automação (Bot)',
      contentType: 'system_event',
      status: 'read',
      createdAt: new Date().toISOString(),
    };

    const storedMessages = (await storageService.getItem<Record<string, Message[]>>('messages_map')) || SAMPLE_MESSAGES;
    const currentList = storedMessages[conversationId] || [];
    storedMessages[conversationId] = [...currentList, eventMsg];
    await storageService.setItem('messages_map', storedMessages);

    if (!updatedConv) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    return updatedConv;
  }

  async updateStatus(conversationId: string, status: Conversation['status']): Promise<Conversation> {
    const conversations = await this.getConversations();
    let updatedConv: Conversation | null = null;

    const updated = conversations.map(c => {
      if (c.id === conversationId) {
        updatedConv = {
          ...c,
          status,
          updatedAt: new Date().toISOString(),
        };
        return updatedConv;
      }
      return c;
    });

    await storageService.setItem('conversations', updated);
    if (!updatedConv) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    return updatedConv;
  }

  async getStats(): Promise<{ totalConversations: number; humanHandoffs: number; automatedMessages: number }> {
    const conversations = await this.getConversations();
    const handoffs = conversations.filter(c => c.handler === 'human').length;
    return {
      totalConversations: conversations.length,
      humanHandoffs: handoffs,
      automatedMessages: 12,
    };
  }
}
