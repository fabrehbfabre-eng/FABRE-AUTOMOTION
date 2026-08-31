/**
 * FABRE AUTOMATION - AI Service Abstraction
 * Release 2: Supabase Persistence Foundation
 * 
 * Prepared for OpenAI API (GPT-4o & Embeddings) via backend Edge Functions.
 * No real API keys or external calls are made in this release.
 */

import { AIConfiguration } from '../types';
import { IAIService } from './types';
import { storageService } from './StorageService';

const DEFAULT_AI_CONFIG: AIConfiguration = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  systemPrompt: `Você é o assistente virtual inteligente da FABRE AUTOMATION.
Seu objetivo é acolher os seguidores com cordialidade, responder dúvidas estritamente com base na Base de Conhecimento oficial cadastrada, e transferir para atendimento humano sempre que necessário.
Diretrizes fundamentais:
- Seja sempre ético, acolhedor, profissional e objetivo.
- Nunca faça promessas ou divulgue informações não registradas oficialmente.
- Nunca solicite dados bancários ou senhas pelo chat.
- Caso o usuário faça uma pergunta complexa não coberta pela base, convide-o amigavelmente a aguardar um atendente humano.`,
  temperature: 0.7,
  maxTokens: 500,
  fallbackToHuman: true,
  personalityTone: 'Acolhedor, profissional, objetivo e transparente',
  guardrails: [
    'Não fornecer dados bancários ou chaves PIX em mensagens de texto (usar links oficiais de checkout)',
    'Transferir para atendimento humano quando solicitado explicitamente',
    'Não inventar informações que não estejam na Base de Conhecimento'
  ]
};

export class AIService implements IAIService {
  async getConfiguration(): Promise<AIConfiguration> {
    const stored = await storageService.getItem<AIConfiguration>('ai_config');
    return stored || DEFAULT_AI_CONFIG;
  }

  async updateConfiguration(config: Partial<AIConfiguration>): Promise<AIConfiguration> {
    const current = await this.getConfiguration();
    const updated = { ...current, ...config };
    await storageService.setItem('ai_config', updated);
    return updated;
  }

  async generateResponseDraft(prompt: string, _context?: { conversationId: string; knowledgeIds?: string[] }): Promise<{ text: string; confidence: number }> {
    // Rascunho demonstrativo (A integração real com OpenAI será executada via Edge Function na Release 4)
    return {
      text: `[Sugestão de Resposta]: Olá! Agradecemos sua mensagem. Estamos à disposição para ajudar com todas as orientações em nossos canais oficiais. (Prompt recebido: "${prompt.slice(0, 35)}...")`,
      confidence: 0.92
    };
  }
}

export const aiService = new AIService();
