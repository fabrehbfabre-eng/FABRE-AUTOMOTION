/**
 * FABRE AUTOMATION - AI Service Abstraction
 * Release 1: Foundation & Architecture
 * 
 * Prepared for OpenAI API (GPT-4o & Embeddings) in Release 3.
 * No real API keys or external calls are made in this release.
 */

import { AIConfiguration } from '../types';
import { IAIService } from './types';
import { storageService } from './StorageService';

const DEFAULT_AI_CONFIG: AIConfiguration = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  systemPrompt: `Você é a inteligência artificial oficial de atendimento do Casal Fabre (Henrique e Bárbara Fabre).
Seu objetivo é acolher os seguidores, responder dúvidas com base na Base de Conhecimento oficial, apresentar a Mentoria e treinamentos, e transferir para atendimento humano sempre que necessário.
Diretrizes:
- Seja sempre ético, encorajador, caloroso e profissional.
- Nunca faça promessas de ganhos fáceis ou irreais.
- Use a base de conhecimento para responder sobre preços, links e regras da mentoria.
- Caso o usuário faça uma pergunta complexa não coberta pela base, convide-o amigavelmente a aguardar um atendente humano.`,
  temperature: 0.7,
  maxTokens: 500,
  fallbackToHuman: true,
  personalityTone: 'Acolhedor, profissional, objetivo e inspirador',
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
    // Foundation mock draft generator (Real OpenAI SDK integration in Release 3)
    return {
      text: `[Rascunho Sugerido]: Olá! Agradecemos sua mensagem. Estamos à disposição para ajudar você a conhecer nossa mentoria e acelerar seus resultados. Acesse o link oficial: https://casalfabre.com.br/mentoria (Prompt recebido: "${prompt.slice(0, 30)}...")`,
      confidence: 0.95
    };
  }
}

export const aiService = new AIService();
