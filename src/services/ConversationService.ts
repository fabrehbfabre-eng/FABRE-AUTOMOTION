/**
 * FABRE AUTOMATION - Conversation Service
 * Release 1: Foundation & Architecture
 */

import { Conversation, Message, ChannelType } from '../types';
import { IConversationService } from './types';
import { INITIAL_CONVERSATIONS, storageService } from './StorageService';

const SAMPLE_MESSAGES: Record<string, Message[]> = {
  conv_01: [
    {
      id: 'msg_01_1',
      conversationId: 'conv_01',
      sender: 'contact',
      channel: 'instagram',
      content: 'Olá Henrique e Bárbara! Acompanho vocês todos os dias no Instagram.',
      contentType: 'text',
      status: 'read',
      createdAt: '2026-08-31T07:30:00Z',
    },
    {
      id: 'msg_01_2',
      conversationId: 'conv_01',
      sender: 'bot',
      channel: 'instagram',
      content: 'Olá Mariana! Muito obrigado pelo carinho! Como podemos te ajudar hoje?',
      contentType: 'text',
      status: 'read',
      createdAt: '2026-08-31T07:31:00Z',
      metadata: {
        automationName: 'Boas-Vindas Instagram',
        isAiGenerated: true,
      }
    },
    {
      id: 'msg_01_3',
      conversationId: 'conv_01',
      sender: 'contact',
      channel: 'instagram',
      content: 'QUERO saber quando abrem as próximas vagas da mentoria!',
      contentType: 'text',
      status: 'delivered',
      createdAt: '2026-08-31T08:45:00Z',
    },
  ],
  conv_02: [
    {
      id: 'msg_02_1',
      conversationId: 'conv_02',
      sender: 'contact',
      channel: 'whatsapp',
      content: 'Bom dia! Gostaria de tirar uma dúvida sobre a emissão de nota fiscal para a mentoria do Casal Fabre.',
      contentType: 'text',
      status: 'read',
      createdAt: '2026-08-31T06:10:00Z',
    },
    {
      id: 'msg_02_2',
      conversationId: 'conv_02',
      sender: 'bot',
      channel: 'whatsapp',
      content: 'Olá Rodrigo! Claro, vou direcionar seu atendimento para o Henrique verificar a nota fiscal para você. Um momento por favor.',
      contentType: 'text',
      status: 'read',
      createdAt: '2026-08-31T06:11:00Z',
    },
    {
      id: 'msg_02_3',
      conversationId: 'conv_02',
      sender: 'system',
      channel: 'whatsapp',
      content: 'Atendimento transferido para humano (Henrique Fabre)',
      contentType: 'system_event',
      status: 'read',
      createdAt: '2026-08-31T08:15:00Z',
    },
    {
      id: 'msg_02_4',
      conversationId: 'conv_02',
      sender: 'user',
      channel: 'whatsapp',
      content: 'Olá Rodrigo! Henrique por aqui. Emitimos NF para pessoa jurídica sim. Qual o CNPJ da sua empresa?',
      contentType: 'text',
      status: 'read',
      createdAt: '2026-08-31T08:20:00Z',
    },
  ],
  conv_03: [
    {
      id: 'msg_03_1',
      conversationId: 'conv_03',
      sender: 'contact',
      channel: 'messenger',
      content: 'Olá! Onde posso assistir às aulas gravadas que vocês mencionaram?',
      contentType: 'text',
      status: 'read',
      createdAt: '2026-08-30T18:00:00Z',
    },
    {
      id: 'msg_03_2',
      conversationId: 'conv_03',
      sender: 'bot',
      channel: 'messenger',
      content: 'Obrigado pelo contato! Para ver nossos vídeos diários, acompanhe também nosso Instagram @casalfabre ou nosso canal oficial.',
      contentType: 'text',
      status: 'read',
      createdAt: '2026-08-30T19:15:00Z',
    },
  ],
};

export class ConversationService implements IConversationService {
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
      id: `msg_${Date.now()}`,
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

    // Update conversation lastMessage
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
          assignedTo: handler === 'human' ? 'Atendente Fabre' : undefined,
          updatedAt: new Date().toISOString(),
        };
        return updatedConv;
      }
      return c;
    });

    await storageService.setItem('conversations', updated);

    // Inject system event in messages
    const eventMsg: Message = {
      id: `evt_${Date.now()}`,
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
}

export const conversationService = new ConversationService();
