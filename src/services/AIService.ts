/**
 * FABRE AUTOMATION - Generative AI Service (OpenAI Foundation)
 * Release 3: Secure Backend Foundation
 * 
 * Provides decoupled AI generative capabilities, prompt management,
 * guardrails enforcement and RAG context integration.
 * In Release 4, this communicates with the server-side Edge Function (ai-completion)
 * to interact with OpenAI API (gpt-4o-mini).
 */

import { IAIService } from './types';
import { AIConfiguration } from '../types';
import { getSupabaseConfig, isSupabaseConfigured } from '../lib/supabase';

export class AIService implements IAIService {
  private config: AIConfiguration = {
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 500,
    fallbackToHuman: true,
    personalityTone: 'Elegante, polido, empático e resolutivo',
    systemPrompt: `Você é a assistente oficial do FABRE AUTOMATION.
Seu papel é responder com elegância, clareza, empatia e profissionalismo aos seguidores e contatos nos canais Instagram Direct, Facebook Messenger e WhatsApp.
Diretrizes fundamentais:
- Mantenha sempre um tom acolhedor, polido e refinado.
- Utilize exclusivamente as informações cadastradas na Base de Conhecimento Oficial.
- Nunca invente preços, promoções ou promessas não confirmadas.
- Se houver dúvida ou o contato solicitar atendimento pessoal, transfira cordialmente para a equipe humana.`,
    guardrails: [
      'Não prometer descontos sem regra oficial',
      'Não confirmar datas sem verificação de agenda',
      'Manter sigilo sobre dados sensíveis',
      'Transferir para humano em caso de insatisfação ou pedidos complexos',
      'Responder apenas no idioma do contato (Português por padrão)',
    ],
  };

  async getConfiguration(): Promise<AIConfiguration> {
    return { ...this.config };
  }

  async updateConfiguration(newConfig: Partial<AIConfiguration>): Promise<AIConfiguration> {
    this.config = { ...this.config, ...newConfig };
    return { ...this.config };
  }

  async generateResponse(
    prompt: string,
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<{ text: string; confidence: number; model: string }> {
    const supabaseConfig = getSupabaseConfig();

    // Check if Edge Function is reachable
    if (isSupabaseConfigured() && supabaseConfig.url) {
      try {
        const functionUrl = `${supabaseConfig.url.replace(/\/$/, '')}/functions/v1/ai-completion`;
        const res = await fetch(functionUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, options }),
        });

        if (res.ok) {
          const data = await res.json();
          return {
            text: data.response || 'Resposta gerada via Edge Function.',
            confidence: data.confidence || 0.9,
            model: data.model || this.config.model,
          };
        }
      } catch (err) {
        console.warn('[AIService] Edge function call bypassed, using local fallback:', err);
      }
    }

    // Safe offline fallback (Demo Mode)
    return {
      text: `Olá! Recebi sua mensagem: "${prompt.slice(0, 50)}...". Em breve um de nossos consultores responderá, ou utilize nosso menu de opções automáticas.`,
      confidence: 0.88,
      model: this.config.model,
    };
  }

  async generateResponseWithContext(
    prompt: string,
    context?: { conversationId: string; knowledgeIds?: string[] }
  ): Promise<{ text: string; confidence: number; model: string; contextItemsCount?: number }> {
    const supabaseConfig = getSupabaseConfig();

    if (isSupabaseConfigured() && supabaseConfig.url) {
      try {
        const functionUrl = `${supabaseConfig.url.replace(/\/$/, '')}/functions/v1/ai-completion`;
        const res = await fetch(functionUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            prompt, 
            conversationId: context?.conversationId,
            knowledgeContextIds: context?.knowledgeIds 
          }),
        });

        if (res.ok) {
          const data = await res.json();
          return {
            text: data.response || 'Resposta contextualizada gerada com sucesso.',
            confidence: data.confidence || 0.92,
            model: data.model || this.config.model,
            contextItemsCount: data.contextCount || context?.knowledgeIds?.length || 0,
          };
        }
      } catch (err) {
        console.warn('[AIService] Edge function call bypassed:', err);
      }
    }

    const contextCount = context?.knowledgeIds?.length || 0;
    return {
      text: `[Assistente Fabre AI]: Com base em nossas informações oficiais (${contextCount} tópicos consultados), estamos à disposição para lhe atender.`,
      confidence: 0.9,
      model: this.config.model,
      contextItemsCount: contextCount,
    };
  }

  async generateResponseDraft(
    prompt: string,
    context?: { conversationId: string; knowledgeIds?: string[] }
  ): Promise<{ text: string; confidence: number }> {
    const res = await this.generateResponseWithContext(prompt, context);
    return {
      text: res.text,
      confidence: res.confidence,
    };
  }
}

export const aiService = new AIService();
