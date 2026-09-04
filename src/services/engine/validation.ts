/**
 * FABRE AUTOMATION - Automation Validation Logic
 * Release: Automation Control Plane
 * 
 * Strict fail-closed validation for triggers, actions, keywords, regex patterns,
 * and automation payloads across UI and Service layers.
 */

import { Automation, AutomationTrigger, AutomationAction, ChannelType } from '../../types';

export class AutomationValidationError extends Error {
  public field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'AutomationValidationError';
    this.field = field;
  }
}

/**
 * Validates whether a string is a syntactically valid regular expression
 */
export function validateRegexPattern(pattern: string): boolean {
  if (!pattern || typeof pattern !== 'string') return false;
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates trigger configuration against supported engine types
 */
export function validateTrigger(trigger: AutomationTrigger): void {
  if (!trigger) {
    throw new AutomationValidationError('Gatilho não configurado.', 'trigger');
  }

  const validTriggerTypes = [
    'keyword_direct',
    'first_contact',
    'comment_post',
    'story_reply',
    'inactive_followup',
  ];

  if (!validTriggerTypes.includes(trigger.type)) {
    throw new AutomationValidationError(
      `Tipo de gatilho desconhecido ou inválido: ${trigger.type}`,
      'trigger.type'
    );
  }

  if (trigger.type === 'keyword_direct') {
    const keywords = trigger.config?.keywords;
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      throw new AutomationValidationError(
        'Gatilho por palavra-chave exige ao menos uma palavra-chave configurada.',
        'trigger.keywords'
      );
    }

    const cleanKeywords = keywords
      .map(k => (typeof k === 'string' ? k.trim() : ''))
      .filter(Boolean);

    if (cleanKeywords.length === 0) {
      throw new AutomationValidationError(
        'Palavras-chave não podem ser vazias.',
        'trigger.keywords'
      );
    }

    const matchType = trigger.config?.matchType || 'contains';
    if (!['exact', 'contains', 'regex'].includes(matchType)) {
      throw new AutomationValidationError(
        `Modo de correspondência '${matchType}' é inválido. Use exact, contains ou regex.`,
        'trigger.matchType'
      );
    }

    if (matchType === 'regex') {
      for (const pattern of cleanKeywords) {
        if (!validateRegexPattern(pattern)) {
          throw new AutomationValidationError(
            `Expressão regular inválida no gatilho: "${pattern}". Verifique a sintaxe.`,
            'trigger.regex'
          );
        }
      }
    }
  }

  if (trigger.type === 'inactive_followup') {
    const hours = trigger.config?.inactivityHours;
    if (
      hours === undefined ||
      hours === null ||
      typeof hours !== 'number' ||
      hours <= 0 ||
      isNaN(hours)
    ) {
      throw new AutomationValidationError(
        'Gatilho de inatividade exige tempo de inatividade maior que zero.',
        'trigger.inactivityHours'
      );
    }
  }
}

/**
 * Validates individual action configuration against supported engine types
 */
export function validateAction(action: AutomationAction, index?: number): void {
  if (!action) {
    throw new AutomationValidationError('Ação inválida.', 'actions');
  }

  const validActionTypes = [
    'send_message',
    'send_dm',
    'assign_human',
    'add_tag',
    'remove_tag',
    'query_ai',
    'delay',
  ];

  const prefix = index !== undefined ? `Ação #${index + 1}` : 'Ação';

  if (!validActionTypes.includes(action.type)) {
    throw new AutomationValidationError(
      `${prefix}: tipo de ação desconhecido ou inválido (${action.type}).`,
      'actions.type'
    );
  }

  if (action.type === 'send_message' || action.type === 'send_dm') {
    const text = action.config?.messageText;
    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new AutomationValidationError(
        `${prefix} (${action.name || action.type}): o texto da mensagem é obrigatório e não pode ser vazio.`,
        'actions.messageText'
      );
    }
  }

  if (action.type === 'add_tag' || action.type === 'remove_tag') {
    const tag = action.config?.tagName;
    if (!tag || typeof tag !== 'string' || !tag.trim()) {
      throw new AutomationValidationError(
        `${prefix} (${action.name || action.type}): o nome da etiqueta (tag) é obrigatório.`,
        'actions.tagName'
      );
    }
  }

  if (action.type === 'delay') {
    const seconds = action.config?.delaySeconds;
    if (
      seconds === undefined ||
      seconds === null ||
      typeof seconds !== 'number' ||
      seconds <= 0 ||
      isNaN(seconds)
    ) {
      throw new AutomationValidationError(
        `${prefix}: o tempo de espera (delay) deve ser um número positivo de segundos.`,
        'actions.delaySeconds'
      );
    }
  }
}

/**
 * Validates a complete or partial automation payload
 */
export function validateAutomationData(data: Partial<Automation>): void {
  if (data.title !== undefined) {
    if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
      throw new AutomationValidationError(
        'O nome da regra de automação é obrigatório.',
        'title'
      );
    }
  }

  if (data.channel !== undefined) {
    const validChannels: Array<ChannelType | 'all'> = [
      'instagram',
      'whatsapp',
      'messenger',
      'all',
    ];
    if (!validChannels.includes(data.channel)) {
      throw new AutomationValidationError(
        `Canal '${data.channel}' inválido.`,
        'channel'
      );
    }
  }

  if (data.trigger !== undefined) {
    validateTrigger(data.trigger);
  }

  if (data.actions !== undefined) {
    if (!Array.isArray(data.actions) || data.actions.length === 0) {
      throw new AutomationValidationError(
        'A regra deve conter pelo menos uma ação configurada.',
        'actions'
      );
    }
    data.actions.forEach((act, idx) => validateAction(act, idx));
  }
}
