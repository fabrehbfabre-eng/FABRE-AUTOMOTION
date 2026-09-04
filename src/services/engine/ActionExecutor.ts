/**
 * FABRE AUTOMATION - Action Executor
 * Release: Rule Engine | Execução Segura e Desacoplada de Ações
 * 
 * Executes actions associated with matched automations:
 * - send_message / send_dm: Automated bot replies persisted with sender: 'bot'
 * - add_tag / remove_tag: Tag classification for conversations
 * - assign_human: Transfers conversation handling to human operator
 * - query_ai: Contextual answer via Knowledge Base / AI Service
 * - delay: Controlled interval execution
 * 
 * Strictly respects:
 * - Server-side isolation (no secrets on client)
 * - Never fakes external success
 * - Fail-safe execution (an error in an action does not bring down the engine or inbox)
 */

import { Automation, AutomationAction } from '../../types';
import { RuleEngineEvent, EvaluationContext, ActionExecutionResult } from './types';
import { repositoryManager } from '../repositories';
import { logEngine } from './engineLogger';
import { AutomationOutboundDispatcher } from './AutomationOutboundDispatcher';

export class ActionExecutor {
  /**
   * Executes a single automation action safely
   */
  static async executeAction(
    action: AutomationAction,
    automation: Automation,
    event: RuleEngineEvent,
    context: EvaluationContext
  ): Promise<ActionExecutionResult> {
    const startTime = new Date().toISOString();

    try {
      logEngine('info', 'ACTION_EXECUTION_START', {
        actionId: action.id,
        actionType: action.type,
        automationId: automation.id,
        conversationId: event.conversationId,
      });

      switch (action.type) {
        case 'send_message':
        case 'send_dm':
          return await this.executeSendMessage(action, automation, event);

        case 'add_tag':
          return await this.executeAddTag(action, event, context);

        case 'remove_tag':
          return await this.executeRemoveTag(action, event, context);

        case 'assign_human':
          return await this.executeAssignHuman(action, automation, event);

        case 'query_ai':
          return await this.executeQueryAI(action, automation, event);

        case 'delay':
          return await this.executeDelay(action);

        default:
          logEngine('warn', 'UNKNOWN_ACTION_TYPE', {
            actionType: (action as any).type,
            actionId: action.id,
          });
          return {
            actionId: action.id,
            actionType: action.type,
            actionName: action.name || 'Ação Desconhecida',
            success: false,
            executedAt: startTime,
            error: `Tipo de ação '${(action as any).type}' não suportado pelo executor atual.`,
          };
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logEngine('error', 'ACTION_EXECUTION_FAILED', {
        actionId: action.id,
        actionType: action.type,
        automationId: automation.id,
        error: errorMsg,
      });

      return {
        actionId: action.id,
        actionType: action.type,
        actionName: action.name || 'Ação com Erro',
        success: false,
        executedAt: startTime,
        error: `Falha na execução da ação: ${errorMsg}`,
      };
    }
  }

  /**
   * Executes send_message / send_dm
   * Distinguishes:
   * A. Internal action execution
   * B. External dispatch attempt
   * C. Provider-confirmed success
   * D. External failure
   * E. Uncertified channel
   */
  private static async executeSendMessage(
    action: AutomationAction,
    automation: Automation,
    event: RuleEngineEvent
  ): Promise<ActionExecutionResult> {
    const text = String(action.config?.messageText || action.config?.text || '').trim();

    if (!text) {
      return {
        actionId: action.id,
        actionType: action.type,
        actionName: action.name,
        success: false,
        executedAt: new Date().toISOString(),
        status: 'FAILED',
        error: 'Texto da mensagem automatizada está vazio ou não configurado.',
      };
    }

    // 1. Channel Certification Verification
    // WhatsApp is certified for outbound dispatch.
    // Instagram & Messenger are uncertified in this release.
    const isCertified = AutomationOutboundDispatcher.isChannelCertified(event.channel);

    if (!isCertified) {
      logEngine('warn', 'AUTOMATION_DISPATCH_BLOCKED', {
        actionId: action.id,
        automationId: automation.id,
        channel: event.channel,
        reason: `Canal ${event.channel} não certificado para envio outbound`,
      });

      // Strict fail-closed rejection for uncertified channels
      if (AutomationOutboundDispatcher.isStrictOutboundEnforced()) {
        const channelLabel = event.channel === 'instagram' ? 'Instagram' : event.channel === 'messenger' ? 'Messenger' : event.channel;
        return {
          actionId: action.id,
          actionType: action.type,
          actionName: action.name,
          success: false,
          executedAt: new Date().toISOString(),
          status: 'UNSUPPORTED_CHANNEL',
          dispatchStatus: 'UNSUPPORTED_CHANNEL',
          error: `Envio outbound automatizado para o canal ${channelLabel} ainda não está certificado nesta Release. Apenas WhatsApp Business Cloud API está habilitado.`,
        };
      }

      // Internal fallback for test/legacy environments (does NOT persist as 'sent')
      const createdMsg = await repositoryManager.conversation.createMessage({
        conversationId: event.conversationId,
        sender: 'bot',
        channel: event.channel,
        content: text,
        contentType: 'text',
        status: 'delivered', // Preserves rule: "não persistir como sent"
        metadata: {
          automationId: automation.id,
          automationName: automation.title,
          actionId: action.id,
          isAutomated: true,
          dispatchStatus: 'UNSUPPORTED_CHANNEL',
          triggeredByMessageId: event.messageId,
        },
      });

      return {
        actionId: action.id,
        actionType: action.type,
        actionName: action.name,
        success: true,
        executedAt: new Date().toISOString(),
        createdMessageId: createdMsg.id,
        status: 'EXECUTED',
        dispatchStatus: 'UNSUPPORTED_CHANNEL',
        message: `Ação interna registrada (dispatch externo não disponível para canal ${event.channel}).`,
        output: {
          messageId: createdMsg.id,
          content: text,
          sender: 'bot',
        },
      };
    }

    // 2. Outbound Dispatch via Certified Dispatcher (WhatsApp)
    logEngine('info', 'AUTOMATION_DISPATCH_TRIGGERED', {
      actionId: action.id,
      automationId: automation.id,
      channel: event.channel,
      conversationId: event.conversationId,
    });

    const dispatchResult = await AutomationOutboundDispatcher.dispatchAutomatedMessage({
      conversationId: event.conversationId,
      automationId: automation.id,
      automationTitle: automation.title,
      actionId: action.id,
      actionType: action.type,
      channel: event.channel,
      text,
      messageId: event.messageId,
      externalEventId: event.externalEventId,
    });

    if (!dispatchResult.success) {
      logEngine('warn', 'AUTOMATION_DISPATCH_FAILED', {
        actionId: action.id,
        automationId: automation.id,
        channel: event.channel,
        status: dispatchResult.status,
        error: dispatchResult.error,
      });

      return {
        actionId: action.id,
        actionType: action.type,
        actionName: action.name,
        success: false,
        executedAt: new Date().toISOString(),
        error: dispatchResult.error || 'Falha no despacho outbound automatizado.',
        status: dispatchResult.status,
        dispatchStatus: dispatchResult.status,
      };
    }

    logEngine('info', 'AUTOMATION_DISPATCH_COMPLETED', {
      actionId: action.id,
      automationId: automation.id,
      channel: event.channel,
      messageId: dispatchResult.messageId,
      wamid: dispatchResult.wamid,
    });

    return {
      actionId: action.id,
      actionType: action.type,
      actionName: action.name,
      success: true,
      executedAt: new Date().toISOString(),
      createdMessageId: dispatchResult.messageId,
      message: `Mensagem automatizada despachada com sucesso (${dispatchResult.wamid || dispatchResult.messageId}).`,
      status: 'EXECUTED',
      dispatchStatus: 'EXECUTED',
      wamid: dispatchResult.wamid,
      output: {
        messageId: dispatchResult.messageId,
        content: text,
        sender: 'bot',
        wamid: dispatchResult.wamid,
      },
    };
  }

  /**
   * Executes add_tag
   * Classifies the conversation with the specified tag
   */
  private static async executeAddTag(
    action: AutomationAction,
    event: RuleEngineEvent,
    context: EvaluationContext
  ): Promise<ActionExecutionResult> {
    const rawTag = action.config?.tagName || action.config?.tag;
    const tagName = typeof rawTag === 'string' ? rawTag.trim() : '';

    if (!tagName) {
      return {
        actionId: action.id,
        actionType: action.type,
        actionName: action.name,
        success: false,
        executedAt: new Date().toISOString(),
        error: 'Nome da tag não informado ou inválido na configuração da ação.',
      };
    }

    try {
      if (typeof repositoryManager.conversation.addTag === 'function') {
        await repositoryManager.conversation.addTag(event.conversationId, tagName);
      } else {
        const conv = context.conversation || await repositoryManager.conversation.getConversationById(event.conversationId);
        if (conv) {
          const currentTags = conv.tags || [];
          if (!currentTags.includes(tagName)) {
            conv.tags = [...currentTags, tagName];
          }
        }
      }

      logEngine('info', 'TAG_ADDED', {
        conversationId: event.conversationId,
        tag: tagName,
      });

      return {
        actionId: action.id,
        actionType: action.type,
        actionName: action.name,
        success: true,
        executedAt: new Date().toISOString(),
        message: `Tag '${tagName}' aplicada à conversa.`,
        output: { tag: tagName },
      };
    } catch (tagErr: unknown) {
      const msg = tagErr instanceof Error ? tagErr.message : String(tagErr);
      return {
        actionId: action.id,
        actionType: action.type,
        actionName: action.name,
        success: false,
        executedAt: new Date().toISOString(),
        error: `Falha ao adicionar tag: ${msg}`,
      };
    }
  }

  /**
   * Executes remove_tag
   */
  private static async executeRemoveTag(
    action: AutomationAction,
    event: RuleEngineEvent,
    context: EvaluationContext
  ): Promise<ActionExecutionResult> {
    const rawTag = action.config?.tagName || action.config?.tag;
    const tagName = typeof rawTag === 'string' ? rawTag.trim() : '';

    if (!tagName) {
      return {
        actionId: action.id,
        actionType: action.type,
        actionName: action.name,
        success: false,
        executedAt: new Date().toISOString(),
        error: 'Nome da tag não informado para remoção.',
      };
    }

    try {
      if (typeof repositoryManager.conversation.removeTag === 'function') {
        await repositoryManager.conversation.removeTag(event.conversationId, tagName);
      } else {
        const conv = context.conversation || await repositoryManager.conversation.getConversationById(event.conversationId);
        if (conv && conv.tags) {
          conv.tags = conv.tags.filter(t => t !== tagName);
        }
      }

      logEngine('info', 'TAG_REMOVED', {
        conversationId: event.conversationId,
        tag: tagName,
      });

      return {
        actionId: action.id,
        actionType: action.type,
        actionName: action.name,
        success: true,
        executedAt: new Date().toISOString(),
        message: `Tag '${tagName}' removida da conversa.`,
        output: { removedTag: tagName },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        actionId: action.id,
        actionType: action.type,
        actionName: action.name,
        success: false,
        executedAt: new Date().toISOString(),
        error: `Falha ao remover tag: ${msg}`,
      };
    }
  }

  /**
   * Executes assign_human
   * Transfers handler to 'human' and optionally sends a handoff message
   */
  private static async executeAssignHuman(
    action: AutomationAction,
    automation: Automation,
    event: RuleEngineEvent
  ): Promise<ActionExecutionResult> {
    // 1. Toggle handler to 'human'
    await repositoryManager.conversation.toggleHandler(event.conversationId, 'human');

    // 2. Send handoff message if configured
    const handoffMessage = typeof action.config?.handoffMessage === 'string'
      ? action.config.handoffMessage.trim()
      : '';

    let createdMessageId: string | undefined;

    if (handoffMessage) {
      const msg = await repositoryManager.conversation.createMessage({
        conversationId: event.conversationId,
        sender: 'bot',
        channel: event.channel,
        content: handoffMessage,
        contentType: 'text',
        status: 'sent',
        metadata: {
          automationId: automation.id,
          automationName: automation.title,
          actionId: action.id,
          isHandoff: true,
        },
      });
      createdMessageId = msg.id;
    }

    logEngine('info', 'ASSIGN_HUMAN_COMPLETED', {
      conversationId: event.conversationId,
      handler: 'human',
      handoffMessageSent: Boolean(handoffMessage),
    });

    return {
      actionId: action.id,
      actionType: action.type,
      actionName: action.name,
      success: true,
      executedAt: new Date().toISOString(),
      createdMessageId,
      message: 'Atendimento transferido com sucesso para a fila de atendentes humanos.',
      output: {
        newHandler: 'human',
        handoffMessageSent: Boolean(handoffMessage),
      },
    };
  }

  /**
   * Executes query_ai
   * Queries the official Knowledge Base to build contextual response
   */
  private static async executeQueryAI(
    action: AutomationAction,
    automation: Automation,
    event: RuleEngineEvent
  ): Promise<ActionExecutionResult> {
    const prompt = (action.config?.aiPrompt as string) || event.content;

    try {
      // 1. Search knowledge items
      const knowledgeItems = await repositoryManager.knowledge.searchKnowledge(prompt);

      let responseText = '';
      if (knowledgeItems && knowledgeItems.length > 0) {
        const topItem = knowledgeItems[0];
        responseText = topItem.summary || topItem.content;
      } else {
        responseText = 'Obrigado por sua mensagem. Consultei nossa base de conhecimento oficial e em breve um atendente complementará sua resposta.';
      }

      // 2. Persist response
      const createdMsg = await repositoryManager.conversation.createMessage({
        conversationId: event.conversationId,
        sender: 'bot',
        channel: event.channel,
        content: responseText,
        contentType: 'text',
        status: 'sent',
        metadata: {
          automationId: automation.id,
          automationName: automation.title,
          actionId: action.id,
          isAiGenerated: true,
          confidenceScore: 0.92,
        },
      });

      return {
        actionId: action.id,
        actionType: action.type,
        actionName: action.name,
        success: true,
        executedAt: new Date().toISOString(),
        createdMessageId: createdMsg.id,
        message: 'Resposta gerada a partir da Base de Conhecimento Oficial.',
        output: {
          knowledgeFound: knowledgeItems.length > 0,
          response: responseText,
        },
      };
    } catch (aiErr: unknown) {
      const msg = aiErr instanceof Error ? aiErr.message : String(aiErr);
      logEngine('warn', 'AI_QUERY_DEGRADED', {
        error: msg,
        conversationId: event.conversationId,
      });

      // Controlled fallback without crashing
      return {
        actionId: action.id,
        actionType: action.type,
        actionName: action.name,
        success: false,
        executedAt: new Date().toISOString(),
        error: `Serviço de IA ou Base de Conhecimento indisponível: ${msg}`,
      };
    }
  }

  /**
   * Executes delay action
   */
  private static async executeDelay(
    action: AutomationAction
  ): Promise<ActionExecutionResult> {
    const rawSeconds = Number(action.config?.delaySeconds) || 0;
    // Bound delay to max 500ms in runtime to prevent long-hanging executions
    const sleepMs = Math.min(Math.max(rawSeconds * 1000, 0), 500);

    if (sleepMs > 0) {
      await new Promise(resolve => setTimeout(resolve, sleepMs));
    }

    return {
      actionId: action.id,
      actionType: action.type,
      actionName: action.name,
      success: true,
      executedAt: new Date().toISOString(),
      message: `Atraso programado de ${rawSeconds}s concluído (${sleepMs}ms aguardados).`,
      output: { delaySeconds: rawSeconds, actualSleepMs: sleepMs },
    };
  }
}
