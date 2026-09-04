/**
 * FABRE AUTOMATION - Trigger Evaluator
 * Release: Rule Engine | Avaliação Determinística de Gatilhos
 * 
 * Implements deterministic matching for triggers defined in the system:
 * - keyword_direct (exact, contains, regex) with robust normalization
 * - first_contact (first inbound contact message)
 * - comment_post (post comment events)
 * - story_reply (Instagram story replies)
 * - inactive_followup (inactivity thresholds)
 */

import { AutomationTrigger } from '../../types';
import { RuleEngineEvent, EvaluationContext, TriggerEvaluationResult } from './types';
import { logEngine } from './engineLogger';

export class TriggerEvaluator {
  /**
   * Evaluates an automation trigger against the incoming event and context
   */
  static evaluate(
    trigger: AutomationTrigger,
    event: RuleEngineEvent,
    context: EvaluationContext
  ): TriggerEvaluationResult {
    try {
      switch (trigger.type) {
        case 'keyword_direct':
          return this.evaluateKeywordDirect(trigger, event);

        case 'first_contact':
          return this.evaluateFirstContact(trigger, event, context);

        case 'comment_post':
          return this.evaluateCommentPost(trigger, event);

        case 'story_reply':
          return this.evaluateStoryReply(trigger, event);

        case 'inactive_followup':
          return this.evaluateInactiveFollowup(trigger, event, context);

        default:
          logEngine('warn', 'UNKNOWN_TRIGGER_TYPE', {
            triggerType: (trigger as any).type,
            eventId: event.messageId,
          });
          return {
            matched: false,
            triggerType: trigger.type,
            reason: `Tipo de gatilho '${(trigger as any).type}' não suportado pelo motor atual.`,
          };
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logEngine('error', 'TRIGGER_EVALUATION_ERROR', {
        triggerType: trigger.type,
        error: errorMsg,
        eventId: event.messageId,
      });
      return {
        matched: false,
        triggerType: trigger.type,
        reason: `Erro durante avaliação do gatilho: ${errorMsg}`,
      };
    }
  }

  /**
   * Normalizes a text string:
   * - Converts to lowercase
   * - Replaces multiple whitespace with a single space
   * - Trims leading/trailing whitespace
   */
  static normalizeText(text: string): string {
    if (!text || typeof text !== 'string') return '';
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Evaluates keyword_direct trigger
   * Robust against case differences, redundant spaces, and obvious false positives
   */
  private static evaluateKeywordDirect(
    trigger: AutomationTrigger,
    event: RuleEngineEvent
  ): TriggerEvaluationResult {
    const rawContent = event.content || '';
    const normalizedContent = this.normalizeText(rawContent);

    if (!normalizedContent) {
      return {
        matched: false,
        triggerType: 'keyword_direct',
        reason: 'Mensagem sem conteúdo textual para correspondência de palavras-chave.',
      };
    }

    const config = trigger.config || {};
    let keywords: string[] = [];

    if (Array.isArray(config.keywords)) {
      keywords = config.keywords.map(k => String(k));
    } else if (typeof config.keyword === 'string') {
      keywords = [config.keyword];
    } else if (typeof (config as any).keywords === 'string') {
      keywords = [(config as any).keywords];
    }

    if (keywords.length === 0) {
      return {
        matched: false,
        triggerType: 'keyword_direct',
        reason: 'Nenhuma palavra-chave configurada no gatilho.',
      };
    }

    const matchType = (config.matchType as 'exact' | 'contains' | 'regex') || 'contains';

    for (const rawKeyword of keywords) {
      const normalizedKeyword = this.normalizeText(rawKeyword);
      if (!normalizedKeyword) continue;

      if (matchType === 'exact') {
        if (normalizedContent === normalizedKeyword) {
          return {
            matched: true,
            triggerType: 'keyword_direct',
            matchedKeyword: rawKeyword,
            reason: `Correspondência exata com a palavra-chave '${rawKeyword}'.`,
          };
        }
      } else if (matchType === 'regex') {
        try {
          const regex = new RegExp(rawKeyword, 'i');
          if (regex.test(rawContent)) {
            return {
              matched: true,
              triggerType: 'keyword_direct',
              matchedKeyword: rawKeyword,
              matchedPattern: rawKeyword,
              reason: `Correspondência por regex com padrão '${rawKeyword}'.`,
            };
          }
        } catch (regexErr) {
          logEngine('warn', 'INVALID_REGEX_PATTERN', {
            pattern: rawKeyword,
            error: String(regexErr),
          });
        }
      } else {
        // matchType === 'contains' (default)
        // Check if keyword is included. To avoid false positives (e.g. "in" matching inside "informações"):
        // If keyword has no spaces (single word), check if it exists as a distinct word token, or is equal
        const contentWords = normalizedContent.split(/[^a-z0-9áàâãéêíóôõúçü_-]+/i).filter(Boolean);
        const keywordWords = normalizedKeyword.split(/\s+/).filter(Boolean);

        if (keywordWords.length === 1) {
          // Single-word keyword: must match at least one distinct word in the message
          // OR if content equals keyword exactly
          const wordMatch = contentWords.includes(normalizedKeyword);
          if (wordMatch || normalizedContent === normalizedKeyword) {
            return {
              matched: true,
              triggerType: 'keyword_direct',
              matchedKeyword: rawKeyword,
              reason: `Correspondência de palavra contida: '${rawKeyword}'.`,
            };
          }
        } else {
          // Multi-word phrase keyword: check phrase inclusion in normalized content
          if (normalizedContent.includes(normalizedKeyword)) {
            return {
              matched: true,
              triggerType: 'keyword_direct',
              matchedKeyword: rawKeyword,
              reason: `Correspondência de frase contida: '${rawKeyword}'.`,
            };
          }
        }
      }
    }

    return {
      matched: false,
      triggerType: 'keyword_direct',
      reason: 'Nenhuma palavra-chave configurada correspondeu ao texto da mensagem.',
    };
  }

  /**
   * Evaluates first_contact trigger
   * Matches if contact has no prior messages in conversation history
   */
  private static evaluateFirstContact(
    _trigger: AutomationTrigger,
    _event: RuleEngineEvent,
    context: EvaluationContext
  ): TriggerEvaluationResult {
    // 1. Check explicit flag from context if provided
    if (context.isFirstContact === true) {
      return {
        matched: true,
        triggerType: 'first_contact',
        reason: 'Identificado como primeiro contato do usuário na conversa.',
      };
    }

    // 2. Check message history if available
    if (context.messagesHistory && Array.isArray(context.messagesHistory)) {
      const contactMessages = context.messagesHistory.filter(m => m.sender === 'contact');
      // If there are 0 or 1 contact messages (the current incoming message is the only one)
      if (contactMessages.length <= 1) {
        return {
          matched: true,
          triggerType: 'first_contact',
          reason: 'Histórico de mensagens confirma que este é o primeiro contato recebido.',
        };
      }
      return {
        matched: false,
        triggerType: 'first_contact',
        reason: `Contato já possui ${contactMessages.length} mensagens no histórico.`,
      };
    }

    // 3. Check conversation object creation/update
    if (context.conversation) {
      const conv = context.conversation;
      if (!conv.lastMessage || conv.lastMessage.id === _event.messageId) {
        return {
          matched: true,
          triggerType: 'first_contact',
          reason: 'Conversa recém-criada sem histórico prévio de mensagens.',
        };
      }
    }

    return {
      matched: false,
      triggerType: 'first_contact',
      reason: 'Não foi possível confirmar que este evento é um primeiro contato.',
    };
  }

  /**
   * Evaluates comment_post trigger
   */
  private static evaluateCommentPost(
    trigger: AutomationTrigger,
    event: RuleEngineEvent
  ): TriggerEvaluationResult {
    const isComment = Boolean(
      event.metadata?.isComment ||
      event.metadata?.item === 'comment' ||
      event.contentType === 'system_event'
    );

    if (!isComment) {
      return {
        matched: false,
        triggerType: 'comment_post',
        reason: 'O evento recebido não é um comentário de publicação.',
      };
    }

    // Optional post filtering
    const config = trigger.config || {};
    const expectedPostId = config.postId as string | undefined;
    const eventPostId = event.metadata?.postId as string | undefined;

    if (expectedPostId && eventPostId && expectedPostId !== eventPostId) {
      return {
        matched: false,
        triggerType: 'comment_post',
        reason: `Comentário destinado a post diferente (${eventPostId} !== ${expectedPostId}).`,
      };
    }

    return {
      matched: true,
      triggerType: 'comment_post',
      reason: 'Evento de comentário de publicação identificado com sucesso.',
    };
  }

  /**
   * Evaluates story_reply trigger
   */
  private static evaluateStoryReply(
    _trigger: AutomationTrigger,
    event: RuleEngineEvent
  ): TriggerEvaluationResult {
    const isStoryReply = Boolean(
      event.metadata?.isStoryReply ||
      event.metadata?.item === 'story_reply' ||
      event.metadata?.storyId
    );

    if (isStoryReply) {
      return {
        matched: true,
        triggerType: 'story_reply',
        reason: 'Evento identificado como resposta direta a um Story.',
      };
    }

    return {
      matched: false,
      triggerType: 'story_reply',
      reason: 'O evento não possui metadados de resposta a Story.',
    };
  }

  /**
   * Evaluates inactive_followup trigger
   */
  private static evaluateInactiveFollowup(
    trigger: AutomationTrigger,
    _event: RuleEngineEvent,
    context: EvaluationContext
  ): TriggerEvaluationResult {
    const config = trigger.config || {};
    const thresholdHours = Number(config.inactivityHours) || 24;
    const currentInactivity = context.inactivityHours ?? 0;

    if (currentInactivity >= thresholdHours) {
      return {
        matched: true,
        triggerType: 'inactive_followup',
        reason: `Inatividade de ${currentInactivity}h atingiu o limite de ${thresholdHours}h.`,
      };
    }

    return {
      matched: false,
      triggerType: 'inactive_followup',
      reason: `Tempo de inatividade (${currentInactivity}h) inferior ao limite configurado (${thresholdHours}h).`,
    };
  }
}
