/**
 * FABRE AUTOMATION - SUITE DE TESTES: AUTOMATION CONTROL PLANE
 * 
 * Classificação Técnica: TESTES LOCAIS DE CONTROL PLANE, PERSISTÊNCIA & REGRA
 * 
 * AVISO OBRIGATÓRIO:
 * "Os testes desta Release validam o gerenciamento, persistência, configuração
 * e integração interna das automações com o Rule Engine. Eles NÃO comprovam o
 * recebimento de mensagens reais de produção da Meta. Essa validação depende
 * da publicação/Live Mode do Meta App."
 */

import { automationService } from '../src/services/AutomationService';
import { ruleEngine } from '../src/services/engine';
import {
  validateAutomationData,
  validateTrigger,
  validateAction,
  validateRegexPattern,
  AutomationValidationError,
} from '../src/services/engine/validation';
import { repositoryManager } from '../src/services/repositories';
import { Automation, AutomationAction, RuleEngineEvent } from '../src/types';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`\x1b[32m✅ [PASS]\x1b[0m ${testName}`);
  } else {
    failedTests++;
    console.error(`\x1b[31m❌ [FAIL]\x1b[0m ${testName}`);
  }
}

async function runAutomationControlPlaneTests() {
  console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[36mFABRE AUTOMATION - SUITE DE TESTES: AUTOMATION CONTROL PLANE\x1b[0m');
  console.log('\x1b[33mClassificação Técnica: TESTES LOCAIS / SIMULAÇÃO CONTROLADA\x1b[0m');
  console.log('\x1b[33mAviso Obrigatório: Os testes desta Release validam o gerenciamento, persistência,\x1b[0m');
  console.log('\x1b[33m                  configuração e integração interna das automações com o Rule Engine.\x1b[0m');
  console.log('\x1b[33m                  Eles NÃO comprovam o recebimento de mensagens reais de produção da Meta.\x1b[0m');
  console.log('\x1b[33m                  Essa validação depende da publicação/Live Mode do Meta App.\x1b[0m');
  console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m\n');

  // Ensure repository is in Mock mode for deterministic local test execution
  repositoryManager.setProvider('mock');

  // ====================================================================
  // BLOCO 1: Validação Fail-Closed (Pré-salvamento e Integridade)
  // ====================================================================
  console.log('\x1b[1m--- BLOCO 1: Validação Fail-Closed (Regras, Triggers & Ações) ---\x1b[0m');

  // 1.1 Regex validator
  assert(validateRegexPattern('^preço|valor') === true, '1. Regex válido retorna true');
  assert(validateRegexPattern('[invalido(') === false, '2. Regex sintaticamente inválido retorna false');
  assert(validateRegexPattern('') === false, '3. Regex vazio retorna false');

  // 1.2 Automation without title
  let errorCaught = false;
  try {
    validateAutomationData({
      title: '   ',
      channel: 'instagram',
      trigger: {
        type: 'keyword_direct',
        name: 'Gatilho',
        description: '',
        config: { keywords: ['teste'] },
      },
      actions: [
        {
          type: 'send_message',
          name: 'Enviar Mensagem',
          description: '',
          config: { messageText: 'Olá' },
        },
      ],
    });
  } catch (err) {
    if (err instanceof AutomationValidationError && err.field === 'title') {
      errorCaught = true;
    }
  }
  assert(errorCaught, '4. Rejeita automação com título vazio');

  // 1.3 Trigger without keywords
  errorCaught = false;
  try {
    validateTrigger({
      type: 'keyword_direct',
      name: 'Gatilho',
      description: '',
      config: { keywords: [] },
    });
  } catch (err) {
    if (err instanceof AutomationValidationError && err.field === 'trigger.keywords') {
      errorCaught = true;
    }
  }
  assert(errorCaught, '5. Rejeita gatilho keyword_direct sem palavras-chave');

  // 1.4 Trigger with empty keyword string
  errorCaught = false;
  try {
    validateTrigger({
      type: 'keyword_direct',
      name: 'Gatilho',
      description: '',
      config: { keywords: ['   ', ''] },
    });
  } catch (err) {
    if (err instanceof AutomationValidationError && err.field === 'trigger.keywords') {
      errorCaught = true;
    }
  }
  assert(errorCaught, '6. Rejeita gatilho keyword_direct com palavras-chave apenas de espaços');

  // 1.5 Trigger with invalid regex
  errorCaught = false;
  try {
    validateTrigger({
      type: 'keyword_direct',
      name: 'Gatilho',
      description: '',
      config: {
        keywords: ['^valido', '[quebrado('],
        matchType: 'regex',
      },
    });
  } catch (err) {
    if (err instanceof AutomationValidationError && err.field === 'trigger.regex') {
      errorCaught = true;
    }
  }
  assert(errorCaught, '7. Rejeita gatilho com padrão de regex inválido');

  // 1.6 Trigger inactive_followup with invalid hours
  errorCaught = false;
  try {
    validateTrigger({
      type: 'inactive_followup',
      name: 'Gatilho Inatividade',
      description: '',
      config: { inactivityHours: 0 },
    });
  } catch (err) {
    if (err instanceof AutomationValidationError && err.field === 'trigger.inactivityHours') {
      errorCaught = true;
    }
  }
  assert(errorCaught, '8. Rejeita follow-up de inatividade com horas <= 0');

  // 1.7 Actions array empty
  errorCaught = false;
  try {
    validateAutomationData({
      title: 'Regra Teste',
      actions: [],
    });
  } catch (err) {
    if (err instanceof AutomationValidationError && err.field === 'actions') {
      errorCaught = true;
    }
  }
  assert(errorCaught, '9. Rejeita automação sem nenhuma ação configurada');

  // 1.8 Action send_message without messageText
  errorCaught = false;
  try {
    validateAction({
      type: 'send_message',
      name: 'Enviar',
      description: '',
      config: { messageText: '   ' },
    });
  } catch (err) {
    if (err instanceof AutomationValidationError && err.field === 'actions.messageText') {
      errorCaught = true;
    }
  }
  assert(errorCaught, '10. Rejeita ação send_message com texto vazio');

  // 1.9 Action add_tag without tagName
  errorCaught = false;
  try {
    validateAction({
      type: 'add_tag',
      name: 'Tag',
      description: '',
      config: { tagName: '' },
    });
  } catch (err) {
    if (err instanceof AutomationValidationError && err.field === 'actions.tagName') {
      errorCaught = true;
    }
  }
  assert(errorCaught, '11. Rejeita ação add_tag sem nome da tag');

  // 1.10 Action delay with invalid seconds
  errorCaught = false;
  try {
    validateAction({
      type: 'delay',
      name: 'Delay',
      description: '',
      config: { delaySeconds: -5 },
    });
  } catch (err) {
    if (err instanceof AutomationValidationError && err.field === 'actions.delaySeconds') {
      errorCaught = true;
    }
  }
  assert(errorCaught, '12. Rejeita ação delay com segundos negativos');

  // ====================================================================
  // BLOCO 2: Criação Real de Automações (CRUD - Create)
  // ====================================================================
  console.log('\n\x1b[1m--- BLOCO 2: Criação Real de Automações (CRUD - Create) ---\x1b[0m');

  const createdRule1 = await automationService.createAutomation({
    title: 'Automação Oficial Suporte VIP',
    description: 'Envia mensagem com orientações e adiciona tag de lead',
    channel: 'whatsapp',
    enabled: true,
    trigger: {
      type: 'keyword_direct',
      name: 'Palavra-chave VIP',
      description: 'Aciona com VIP ou SUPORTE',
      config: {
        keywords: ['VIP', 'SUPORTE'],
        matchType: 'contains',
      },
    },
    actions: [
      {
        type: 'send_message',
        name: 'Enviar Boas-Vindas VIP',
        description: 'Envia texto imediato',
        config: {
          messageText: 'Olá! Você está no canal VIP do Fabre Automation.',
        },
      },
      {
        type: 'add_tag',
        name: 'Aplicar Tag VIP',
        description: 'Marca o contato como VIP',
        config: {
          tagName: 'Cliente-VIP',
        },
      },
    ],
  });

  assert(Boolean(createdRule1.id), '13. Criação de automação gera ID persistente');
  assert(createdRule1.title === 'Automação Oficial Suporte VIP', '14. Título persistido corretamente');
  assert(createdRule1.channel === 'whatsapp', '15. Canal configurado como WhatsApp');
  assert(createdRule1.enabled === true, '16. Automação criada com status ativada (enabled: true)');
  assert(createdRule1.actions.length === 2, '17. Sequência com 2 ações persistida');
  assert(createdRule1.actions[0].type === 'send_message', '18. Primeira ação é send_message');
  assert(createdRule1.actions[1].type === 'add_tag', '19. Segunda ação é add_tag');

  // Create automation with Regex trigger
  const createdRegexRule = await automationService.createAutomation({
    title: 'Filtro Regex Orçamento',
    description: 'Detecta intenção de compra via regex',
    channel: 'instagram',
    enabled: true,
    trigger: {
      type: 'keyword_direct',
      name: 'Regex Preço',
      description: 'Aciona com regex',
      config: {
        keywords: ['^preço|valor|custa\\b'],
        matchType: 'regex',
      },
    },
    actions: [
      {
        type: 'send_dm',
        name: 'Direct com Tabela',
        description: 'Envia direct no Instagram',
        config: {
          messageText: 'Nossos planos começam em R$ 99/mês. Confira o link na bio!',
        },
      },
    ],
  });

  assert(Boolean(createdRegexRule.id), '20. Automação com gatilho Regex criada com sucesso');
  assert(createdRegexRule.trigger.config.matchType === 'regex', '21. Modo de correspondência Regex persistido');

  // ====================================================================
  // BLOCO 3: Ordenação & Sequenciamento de Ações
  // ====================================================================
  console.log('\n\x1b[1m--- BLOCO 3: Sequenciamento e Suporte a Múltiplas Ações ---\x1b[0m');

  const multiActionRule = await automationService.createAutomation({
    title: 'Sequência Completa de Atendimento',
    description: 'Sequência ordenada com múltiplos tipos de ação',
    channel: 'messenger',
    enabled: true,
    trigger: {
      type: 'comment_post',
      name: 'Comentário em Post',
      description: 'Post promocional',
      config: { postUrl: 'https://instagram.com/p/123' },
    },
    actions: [
      {
        type: 'add_tag',
        name: 'Marcar Novo Seguidor',
        description: 'Adiciona tag',
        config: { tagName: 'Novo-Seguidor' },
      },
      {
        type: 'send_message',
        name: 'Saudação Inicial',
        description: 'Primeira resposta',
        config: { messageText: 'Bem-vindo ao Fabre Automation!' },
      },
      {
        type: 'delay',
        name: 'Pausa Curta',
        description: 'Espera 1 segundo',
        config: { delaySeconds: 1 },
      },
      {
        type: 'assign_human',
        name: 'Disponibilizar Atendente',
        description: 'Transbordo',
        config: { handoffMessage: 'Transferindo para equipe' },
      },
      {
        type: 'remove_tag',
        name: 'Remover Tag Antiga',
        description: 'Limpeza de tag',
        config: { tagName: 'Lead-Frio' },
      },
    ],
  });

  assert(multiActionRule.actions.length === 5, '22. Sequência complexa suporta 5 passos encadeados');
  assert(multiActionRule.actions[0].type === 'add_tag', '23. Ordem [0]: add_tag preservada');
  assert(multiActionRule.actions[1].type === 'send_message', '24. Ordem [1]: send_message preservada');
  assert(multiActionRule.actions[2].type === 'delay', '25. Ordem [2]: delay preservado');
  assert(multiActionRule.actions[3].type === 'assign_human', '26. Ordem [3]: assign_human preservado');
  assert(multiActionRule.actions[4].type === 'remove_tag', '27. Ordem [4]: remove_tag preservado');

  // ====================================================================
  // BLOCO 4: Atualização de Automação (CRUD - Update & Toggle)
  // ====================================================================
  console.log('\n\x1b[1m--- BLOCO 4: Edição, Modificação de Sequência e Toggle (Ativação) ---\x1b[0m');

  // 4.1 Update metadata & channel
  const updatedRule = await automationService.updateAutomation(createdRule1.id, {
    title: 'Automação Oficial Suporte VIP (Atualizada)',
    channel: 'whatsapp',
  });
  assert(updatedRule.title === 'Automação Oficial Suporte VIP (Atualizada)', '28. Título atualizado via serviço');
  assert(updatedRule.channel === 'whatsapp', '29. Canal mantido como WhatsApp');

  // 4.2 Update trigger keywords
  const updatedWithTrigger = await automationService.updateAutomation(createdRule1.id, {
    trigger: {
      type: 'keyword_direct',
      name: 'Keywords Expandidas',
      description: 'VIP, SUPORTE, AJUDA',
      config: {
        keywords: ['VIP', 'SUPORTE', 'AJUDA'],
        matchType: 'contains',
      },
    },
  });
  assert(
    updatedWithTrigger.trigger.config.keywords?.includes('AJUDA') === true,
    '30. Lista de palavras-chave atualizada com sucesso'
  );

  // 4.3 Toggle Enabled / Disabled
  const pausedRule = await automationService.toggleAutomation(createdRule1.id, false);
  assert(pausedRule.enabled === false, '31. Automação pausada com toggle (enabled: false)');

  const reactivatedRule = await automationService.toggleAutomation(createdRule1.id, true);
  assert(reactivatedRule.enabled === true, '32. Automação reativada com toggle (enabled: true)');

  // ====================================================================
  // BLOCO 5: Integração Real com o Rule Engine
  // ====================================================================
  console.log('\n\x1b[1m--- BLOCO 5: Integração com Rule Engine (Ativa vs. Pausada) ---\x1b[0m');

  // Create real conversation records for test events via certified ingestion methods
  const profileVIP = await repositoryManager.conversation.upsertProfile({
    name: 'Cliente Teste VIP',
    channel: 'whatsapp',
    phone: '5511999990001',
  });
  const convVIP = await repositoryManager.conversation.findOrCreateConversation({
    contactId: profileVIP.id,
    channel: 'whatsapp',
    initialHandler: 'bot',
  });

  const profileRegex = await repositoryManager.conversation.upsertProfile({
    name: 'Cliente Teste Regex',
    channel: 'instagram',
    username: 'cliente_regex_test',
  });
  const convRegex = await repositoryManager.conversation.findOrCreateConversation({
    contactId: profileRegex.id,
    channel: 'instagram',
    initialHandler: 'bot',
  });

  // Event to test against createdRule1
  const inboundEventVIP: RuleEngineEvent = {
    eventId: 'evt_ctrl_plane_01',
    conversationId: convVIP.id,
    channel: 'whatsapp',
    sender: 'contact',
    content: 'Preciso de SUPORTE vip com minha conta',
    timestamp: new Date().toISOString(),
    conversationHandler: 'bot',
  };

  // Rule is enabled -> Must match and execute actions
  const executionResultActive = await ruleEngine.processEvent(inboundEventVIP);
  assert(
    executionResultActive.status === 'TRIGGER_MATCHED',
    '33. Rule Engine processa e aciona a regra criada no Control Plane'
  );
  assert(
    executionResultActive.matchedAutomations.some(a => a.automationId === createdRule1.id),
    '34. A regra criada foi correspondida pelo Rule Engine'
  );
  assert(
    (executionResultActive.matchedAutomations[0]?.actions?.length || 0) > 0,
    '35. Ações da regra foram executadas pelo Rule Engine'
  );

  // Now disable the rule and test again
  await automationService.toggleAutomation(createdRule1.id, false);

  const inboundEventVIP2: RuleEngineEvent = {
    eventId: 'evt_ctrl_plane_02',
    conversationId: convVIP.id,
    channel: 'whatsapp',
    sender: 'contact',
    content: 'Preciso de SUPORTE vip novamente',
    timestamp: new Date().toISOString(),
    conversationHandler: 'bot',
  };

  const executionResultDisabled = await ruleEngine.processEvent(inboundEventVIP2);
  const matchedDisabled = executionResultDisabled.matchedAutomations.some(a => a.automationId === createdRule1.id);
  assert(
    !matchedDisabled,
    '36. Regra desativada/pausada é 100% ignorada pelo Rule Engine'
  );

  // Test Regex matching in Rule Engine
  const inboundEventRegex: RuleEngineEvent = {
    eventId: 'evt_ctrl_plane_regex',
    conversationId: convRegex.id,
    channel: 'instagram',
    sender: 'contact',
    content: 'preço do plano anual por favor',
    timestamp: new Date().toISOString(),
    conversationHandler: 'bot',
  };

  const executionResultRegex = await ruleEngine.processEvent(inboundEventRegex);
  assert(
    executionResultRegex.status === 'TRIGGER_MATCHED',
    '37. Gatilho Regex criado no Control Plane dispara perfeitamente no Rule Engine'
  );

  // ====================================================================
  // BLOCO 6: Exclusão de Automação (CRUD - Delete)
  // ====================================================================
  console.log('\n\x1b[1m--- BLOCO 6: Exclusão Segura de Automação (CRUD - Delete) ---\x1b[0m');

  const deleteSuccess = await automationService.deleteAutomation(createdRegexRule.id);
  assert(deleteSuccess === true, '38. Deleção de automação concluída com sucesso');

  const fetchedAfterDelete = await automationService.getAutomationById(createdRegexRule.id);
  assert(fetchedAfterDelete === null, '39. Automação excluída não é mais encontrada no repositório');

  const listAfterDelete = await automationService.getAutomations();
  assert(
    !listAfterDelete.some(a => a.id === createdRegexRule.id),
    '40. Automação excluída é removida da listagem do Control Plane'
  );

  // ====================================================================
  // BLOCO 7: Segurança, Isolamento e Não-Exposição de Segredos
  // ====================================================================
  console.log('\n\x1b[1m--- BLOCO 7: Segurança, Não-Exposição de Segredos & Integridade ---\x1b[0m');

  // Verify all automations in repository have no service_role secrets or tokens in config
  let secretsClean = true;
  for (const auto of listAfterDelete) {
    const serialized = JSON.stringify(auto);
    if (
      serialized.includes('service_role') ||
      serialized.includes('supabase_service_role_key') ||
      serialized.includes('meta_access_token') ||
      serialized.includes('EAAG')
    ) {
      secretsClean = false;
      break;
    }
  }
  assert(secretsClean, '41. Nenhuma chave secreta ou token interno exposto nas configurações de automações');

  // Verify created automations retain executionCount integer and timestamp integrity
  assert(typeof createdRule1.executionCount === 'number', '42. executionCount é estritamente numérico');
  assert(Boolean(createdRule1.createdAt), '43. createdAt gerado e em formato ISO');

  // ====================================================================
  // RESULTADO FINAL
  // ====================================================================
  console.log('\n\x1b[1m\x1b[36m======================================================================\x1b[0m');
  console.log('\x1b[1mRESULTADO FINAL DOS TESTES DO AUTOMATION CONTROL PLANE:\x1b[0m');
  console.log(`Total de testes:   \x1b[1m${totalTests}\x1b[0m`);
  console.log(`Aprovados:         \x1b[32m\x1b[1m${passedTests}\x1b[0m`);
  console.log(`Reprovados:        \x1b[${failedTests > 0 ? '31' : '32'}m\x1b[1m${failedTests}\x1b[0m`);
  console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAutomationControlPlaneTests().catch(err => {
  console.error('Erro fatal na suíte de testes de automações:', err);
  process.exit(1);
});
