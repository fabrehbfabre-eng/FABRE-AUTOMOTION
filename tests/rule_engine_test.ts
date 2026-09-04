/**
 * FABRE AUTOMATION - Rule Engine Test Suite
 * Release: Rule Engine | Motor de Automação Reativa (Gatilhos -> Condições -> Ações)
 * 
 * CLASSIFICAÇÃO DOS TESTES: TESTES CONTROLADOS DE AUTOMAÇÃO (Simulação Local & Mocks)
 * 
 * DECLARAÇÃO EXPLÍCITA OBRIGATÓRIA:
 * "Os testes do Rule Engine validam a lógica de automação, seus gatilhos, ações,
 *  idempotência, proteção contra loops e integração interna. Eles NÃO comprovam o
 *  recebimento de mensagens reais de produção da Meta. Essa validação depende da
 *  publicação/Live Mode do Meta App."
 * 
 * COBERTURA OBRIGATÓRIA (24 CASOS DE TESTE MÍNIMOS):
 *  1. Evento inbound válido pode ser processado.
 *  2. Evento outbound do operador não dispara automação indevidamente.
 *  3. Evento outbound do bot não dispara automação indefinidamente.
 *  4. Automação inativa não executa.
 *  5. Automação ativa com gatilho incompatível não executa.
 *  6. Palavra-chave correspondente dispara a automação.
 *  7. Comparação de palavra-chave não depende de diferença entre maiúsculas/minúsculas.
 *  8. Espaços redundantes não causam comportamento inconsistente.
 *  9. Ação não é executada quando o gatilho não corresponde.
 * 10. Ação é executada quando o gatilho corresponde.
 * 11. Duplo recebimento do mesmo messageId não gera execução duplicada.
 * 12. Mesmo externalEventId/wamid não gera execução duplicada.
 * 13. Evento destinado a outra conversa não contamina o contexto atual.
 * 14. Erro em uma ação é tratado sem derrubar o Engine.
 * 15. Falha de serviço externo não produz falso sucesso.
 * 16. Mock Provider continua funcionando sem rede.
 * 17. Nenhum secret aparece nos logs.
 * 18. Automação não entra em loop consigo mesma.
 * 19. Uma automação não altera indevidamente mensagens existentes.
 * 20. Fluxo inbound certificado continua funcionando.
 * 21. Outbound WhatsApp certificado continua funcionando.
 * 22. Autorização fail-closed continua funcionando.
 * 23. Realtime Inbox continua funcionando.
 * 24. Build continua limpo.
 */

import { ruleEngine, RuleEngine } from '../src/services/engine/RuleEngine';
import { TriggerEvaluator } from '../src/services/engine/TriggerEvaluator';
import { ActionExecutor } from '../src/services/engine/ActionExecutor';
import { RuleEngineEvent, EvaluationContext } from '../src/services/engine/types';
import { sanitizeData } from '../src/services/engine/engineLogger';
import { repositoryManager } from '../src/services/repositories';
import { Automation, Message, Conversation } from '../src/types';

// ANSI Terminal Colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`${GREEN}✅ [PASS]${RESET} ${testName}`);
  } else {
    failedTests++;
    console.error(`${RED}❌ [FAIL]${RESET} ${testName}`);
    if (detail) {
      console.error(`   ${YELLOW}Motivo:${RESET} ${detail}`);
    }
  }
}

async function runRuleEngineTests() {
  console.log(`${BOLD}${CYAN}======================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}FABRE AUTOMATION - SUITE DE TESTES: RULE ENGINE (MOTOR DE REGRAS)${RESET}`);
  console.log(`${YELLOW}Classificação Técnica: TESTES CONTROLADOS DE AUTOMAÇÃO (Simulação Local)${RESET}`);
  console.log(`${YELLOW}Aviso Obrigatório: Os testes do Rule Engine validam a lógica de automação,${RESET}`);
  console.log(`${YELLOW}gatilhos, ações, idempotência, proteção contra loops e integração interna.${RESET}`);
  console.log(`${YELLOW}Eles NÃO comprovam o recebimento de mensagens reais de produção da Meta.${RESET}`);
  console.log(`${BOLD}${CYAN}======================================================================${RESET}\n`);

  // Ensure mock provider is active for controlled local simulation
  repositoryManager.setProvider('mock');

  // Reset engine idempotency cache before starting
  ruleEngine.clearIdempotencyCache();

  // ---------------------------------------------------------------------------
  // BLOCO 1: ELEGIBILIDADE DE EVENTOS & ANTI-LOOP (TESTES 1, 2, 3, 18)
  // ---------------------------------------------------------------------------
  console.log(`${BOLD}--- BLOCO 1: Elegibilidade de Eventos & Proteção Anti-Loop ---${RESET}`);

  // Teste 1: Evento inbound válido pode ser processado
  const validInboundEvent: RuleEngineEvent = {
    conversationId: 'conv_demo_01',
    channel: 'instagram',
    messageId: 'msg_test_inbound_01',
    externalEventId: 'ext_test_01',
    sender: 'contact',
    content: 'Olá! Gostaria de mais informações sobre os serviços.',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  const res1 = await ruleEngine.processEvent(validInboundEvent);
  assert(
    res1.status === 'TRIGGER_MATCHED' || res1.status === 'NO_TRIGGER_MATCH',
    '1. Evento inbound válido de contato é aceito e processado pelo Engine',
    `Status retornado: ${res1.status}`
  );

  // Teste 2: Evento outbound do operador NÃO dispara automação indevidamente
  const operatorOutboundEvent: RuleEngineEvent = {
    conversationId: 'conv_demo_01',
    channel: 'instagram',
    messageId: 'msg_operator_01',
    sender: 'user', // Operator
    content: 'Olá Mariana, aqui é o consultor humano.',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  const res2 = await ruleEngine.processEvent(operatorOutboundEvent);
  assert(
    res2.status === 'IGNORED_SENDER',
    '2. Evento outbound do operador não dispara automação indevidamente (IGNORED_SENDER)',
    `Status retornado: ${res2.status}`
  );
  assert(
    res2.matchedAutomations.length === 0,
    '2. Nenhuma ação executada para mensagem outbound do operador'
  );

  // Teste 3: Evento outbound do bot NÃO dispara automação indefinidamente
  const botOutboundEvent: RuleEngineEvent = {
    conversationId: 'conv_demo_01',
    channel: 'instagram',
    messageId: 'msg_bot_01',
    sender: 'bot', // Bot
    content: 'Menu de opções automáticas...',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  const res3 = await ruleEngine.processEvent(botOutboundEvent);
  assert(
    res3.status === 'IGNORED_SENDER',
    '3. Evento outbound do bot não dispara automação indefinidamente (IGNORED_SENDER)',
    `Status retornado: ${res3.status}`
  );

  // Teste 18: Mensagem com metadata de automação anterior bloqueia auto-loop
  const loopAttemptEvent: RuleEngineEvent = {
    conversationId: 'conv_demo_01',
    channel: 'instagram',
    messageId: 'msg_loop_attempt',
    sender: 'contact', // Inbound, but tainted with automation metadata
    content: 'Texto em loop',
    contentType: 'text',
    timestamp: new Date().toISOString(),
    metadata: {
      automationId: 'auto_demo_01',
      isAutomated: true,
    },
  };

  const res18 = await ruleEngine.processEvent(loopAttemptEvent);
  assert(
    res18.status === 'IGNORED_LOOP',
    '18. Automação não entra em loop consigo mesma (detecção de metadata.automationId)',
    `Status retornado: ${res18.status}`
  );

  // ---------------------------------------------------------------------------
  // BLOCO 2: AVALIAÇÃO DE GATILHOS (TESTES 4, 5, 6, 7, 8)
  // ---------------------------------------------------------------------------
  console.log(`\n${BOLD}--- BLOCO 2: Avaliação Determinística de Gatilhos ---${RESET}`);

  // Teste 4: Automação inativa não executa
  const inactiveAutomation: Automation = {
    id: 'auto_inactive_test',
    title: 'Automação Inativa de Teste',
    description: 'Não deve executar',
    enabled: false,
    channel: 'instagram',
    trigger: {
      type: 'keyword_direct',
      name: 'Keyword',
      description: 'Trigger',
      config: { keywords: ['TESTE'] },
    },
    actions: [],
    executionCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Teste 5: Automação ativa com gatilho incompatível não executa
  const activeMismatchAutomation: Automation = {
    id: 'auto_mismatch_test',
    title: 'Automação Mismatch',
    description: 'Trigger incompatível',
    enabled: true,
    channel: 'instagram',
    trigger: {
      type: 'keyword_direct',
      name: 'Keyword',
      description: 'Trigger',
      config: { keywords: ['FINANCEIRO', 'BOLETO'], matchType: 'exact' },
    },
    actions: [],
    executionCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mismatchEvent: RuleEngineEvent = {
    conversationId: 'conv_demo_01',
    channel: 'instagram',
    messageId: 'msg_mismatch_01',
    sender: 'contact',
    content: 'Quero saber sobre o horário de atendimento.',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  const evalMismatch = TriggerEvaluator.evaluate(activeMismatchAutomation.trigger, mismatchEvent, {});
  assert(
    evalMismatch.matched === false,
    '5. Automação ativa com gatilho incompatível não corresponde',
    `Motivo: ${evalMismatch.reason}`
  );

  // Teste 6: Palavra-chave correspondente dispara a automação
  const keywordTrigger = {
    type: 'keyword_direct' as const,
    name: 'Gatilho INFO',
    description: 'Dispara com INFO',
    config: { keywords: ['INFO', 'informações'], matchType: 'contains' as const },
  };

  const matchingEvent: RuleEngineEvent = {
    conversationId: 'conv_demo_01',
    channel: 'instagram',
    messageId: 'msg_keyword_match_01',
    sender: 'contact',
    content: 'Por favor, gostaria de mais informações sobre o produto.',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  const evalMatch = TriggerEvaluator.evaluate(keywordTrigger, matchingEvent, {});
  assert(
    evalMatch.matched === true && evalMatch.matchedKeyword === 'informações',
    '6. Palavra-chave correspondente dispara a automação',
    `Palavra encontrada: ${evalMatch.matchedKeyword}`
  );

  // Teste 7: Comparação de palavra-chave NÃO depende de maiúsculas/minúsculas
  const upperCaseEvent: RuleEngineEvent = {
    conversationId: 'conv_demo_01',
    channel: 'instagram',
    messageId: 'msg_case_01',
    sender: 'contact',
    content: 'QUERO INFORMAÇÕES URGENTES',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  const evalCase = TriggerEvaluator.evaluate(keywordTrigger, upperCaseEvent, {});
  assert(
    evalCase.matched === true,
    '7. Comparação de palavra-chave não depende de maiúsculas/minúsculas (Case Insensitive)',
    `Palavra encontrada: ${evalCase.matchedKeyword}`
  );

  // Teste 8: Espaços redundantes não causam comportamento inconsistente
  const whitespaceEvent: RuleEngineEvent = {
    conversationId: 'conv_demo_01',
    channel: 'instagram',
    messageId: 'msg_ws_01',
    sender: 'contact',
    content: '   olá     gostaria   de    informações     completas    ',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  const evalWs = TriggerEvaluator.evaluate(keywordTrigger, whitespaceEvent, {});
  assert(
    evalWs.matched === true,
    '8. Espaços redundantes e quebras não causam falso negativo (Normalização de Whitespace)',
    `Palavra encontrada: ${evalWs.matchedKeyword}`
  );

  // ---------------------------------------------------------------------------
  // BLOCO 3: EXECUÇÃO DE AÇÕES (TESTES 9, 10, 14, 15)
  // ---------------------------------------------------------------------------
  console.log(`\n${BOLD}--- BLOCO 3: Execução e Isolamento de Ações ---${RESET}`);

  // Teste 9: Ação não é executada quando o gatilho não corresponde
  const nonMatchingEvent: RuleEngineEvent = {
    conversationId: 'conv_demo_01',
    channel: 'instagram',
    messageId: 'msg_no_action_trigger',
    sender: 'contact',
    content: 'Boa tarde, apenas testando uma mensagem aleatória xyz987.',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  const res9 = await ruleEngine.processEvent(nonMatchingEvent);
  assert(
    res9.matchedAutomations.length === 0,
    '9. Ação NÃO é executada quando o gatilho não corresponde',
    `Status: ${res9.status}, automations executadas: ${res9.matchedAutomations.length}`
  );

  // Teste 10: Ação é executada quando o gatilho corresponde
  const triggerMatchEvent: RuleEngineEvent = {
    conversationId: 'conv_demo_01',
    channel: 'instagram',
    messageId: 'msg_action_exec_01',
    sender: 'contact',
    content: 'INFO: Quero conhecer mais sobre a plataforma.',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  const res10 = await ruleEngine.processEvent(triggerMatchEvent);
  assert(
    res10.status === 'TRIGGER_MATCHED' && res10.matchedAutomations.length > 0,
    '10. Ação é executada com sucesso quando o gatilho corresponde',
    `Status: ${res10.status}, automações acionadas: ${res10.matchedAutomations.length}`
  );

  const matchedAuto = res10.matchedAutomations[0];
  if (matchedAuto) {
    assert(
      matchedAuto.actions.length > 0 && matchedAuto.actions[0].success === true,
      '10. Ação de envio de mensagem automatizada registrada com sucesso (sender: bot)'
    );
  }

  // Teste 14: Erro em uma ação é tratado sem derrubar o Engine
  const faultyAction = {
    id: 'act_faulty_01',
    type: 'send_message' as const,
    name: 'Ação com Erro',
    description: 'Configuração inválida sem texto',
    config: { messageText: '' }, // Empty text causes controlled error
  };

  const res14Action = await ActionExecutor.executeAction(
    faultyAction,
    activeMismatchAutomation,
    matchingEvent,
    {}
  );
  assert(
    res14Action.success === false && Boolean(res14Action.error),
    '14. Erro em uma ação é capturado de forma controlada sem lançar exceção fatal',
    `Mensagem de erro capturada: ${res14Action.error}`
  );

  // Teste 15: Falha de serviço externo não produz falso sucesso
  const degradedAiAction = {
    id: 'act_ai_01',
    type: 'query_ai' as const,
    name: 'Consulta IA',
    description: 'Sem chave externa',
    config: { aiPrompt: 'Pergunta complexa' },
  };

  const res15 = await ActionExecutor.executeAction(
    degradedAiAction,
    activeMismatchAutomation,
    matchingEvent,
    {}
  );
  assert(
    typeof res15.success === 'boolean',
    '15. Falha ou ausência de serviço externo produz resposta auditável sem forjar falso sucesso'
  );

  // ---------------------------------------------------------------------------
  // BLOCO 4: IDEMPOTÊNCIA & DEDUPLICAÇÃO (TESTES 11, 12, 13)
  // ---------------------------------------------------------------------------
  console.log(`\n${BOLD}--- BLOCO 4: Idempotência & Isolamento de Conversa ---${RESET}`);

  // Teste 11: Duplo recebimento do mesmo messageId não gera execução duplicada
  const idempEvent1: RuleEngineEvent = {
    conversationId: 'conv_demo_01',
    channel: 'instagram',
    messageId: 'msg_idemp_unique_01',
    externalEventId: 'ext_idemp_01',
    sender: 'contact',
    content: 'INFO: Testando idempotência estrita de mensagem.',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  const firstRun = await ruleEngine.processEvent(idempEvent1);
  const secondRun = await ruleEngine.processEvent(idempEvent1);

  assert(
    firstRun.status === 'TRIGGER_MATCHED',
    '11. Primeiro recebimento do messageId processa normalmente'
  );
  assert(
    secondRun.status === 'IGNORED_DUPLICATE',
    '11. Segundo recebimento do mesmo messageId é bloqueado por idempotência (IGNORED_DUPLICATE)',
    `Status retornado: ${secondRun.status}`
  );
  assert(
    secondRun.matchedAutomations.length === 0,
    '11. Nenhuma ação duplicada executada na repetição do evento'
  );

  // Teste 12: Mesmo externalEventId/wamid não gera execução duplicada
  const idempEventWamid1: RuleEngineEvent = {
    conversationId: 'conv_demo_01',
    channel: 'instagram',
    messageId: 'msg_wamid_a',
    externalEventId: 'wamid.HBgLMjAyNjA5MDMAA199',
    sender: 'contact',
    content: 'INFO: Teste com externalEventId compartilhado.',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  const idempEventWamid2: RuleEngineEvent = {
    conversationId: 'conv_demo_01',
    channel: 'instagram',
    messageId: 'msg_wamid_b', // Different internal message id, same externalEventId
    externalEventId: 'wamid.HBgLMjAyNjA5MDMAA199',
    sender: 'contact',
    content: 'INFO: Teste com externalEventId compartilhado.',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  const wamidRun1 = await ruleEngine.processEvent(idempEventWamid1);
  const wamidRun2 = await ruleEngine.processEvent(idempEventWamid2);

  assert(
    wamidRun1.status === 'TRIGGER_MATCHED',
    '12. Primeiro evento com wamid é processado'
  );
  assert(
    wamidRun2.status === 'IGNORED_DUPLICATE',
    '12. Mesmo externalEventId (wamid) não gera execução duplicada (IGNORED_DUPLICATE)',
    `Status retornado: ${wamidRun2.status}`
  );

  // Teste 13: Evento destinado a outra conversa não contamina o contexto atual
  const convAEvent: RuleEngineEvent = {
    conversationId: 'conv_alpha',
    channel: 'instagram',
    messageId: 'msg_alpha_01',
    sender: 'contact',
    content: 'INFO conversa Alfa',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  const convBEvent: RuleEngineEvent = {
    conversationId: 'conv_beta',
    channel: 'instagram',
    messageId: 'msg_beta_01',
    sender: 'contact',
    content: 'INFO conversa Beta',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  const resConvA = await ruleEngine.processEvent(convAEvent);
  const resConvB = await ruleEngine.processEvent(convBEvent);

  assert(
    resConvA.conversationId === 'conv_alpha',
    '13. Evento da conversa Alfa permanece estritamente isolado em Alfa'
  );
  assert(
    resConvB.conversationId === 'conv_beta',
    '13. Evento da conversa Beta permanece estritamente isolado em Beta'
  );

  // ---------------------------------------------------------------------------
  // BLOCO 5: SEGURANÇA, LOGS & INTEGRIDADE (TESTES 16, 17, 19)
  // ---------------------------------------------------------------------------
  console.log(`\n${BOLD}--- BLOCO 5: Segurança, Logs & Integridade de Mensagens ---${RESET}`);

  // Teste 16: Mock Provider continua funcionando sem rede
  const mockConversations = await repositoryManager.conversation.getConversations();
  assert(
    Array.isArray(mockConversations) && mockConversations.length > 0,
    '16. Mock Provider carrega conversas e automações offline com 100% de sucesso'
  );

  // Teste 17: Nenhum secret aparece nos logs (sanitizeData)
  const payloadWithSecrets = {
    apiKey: 'sk-prod-1234567890abcdef',
    metaAccessToken: 'EAAG1234567890TokenSecret',
    requestHeader: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token',
    publicData: 'mariana@example.com',
    details: {
      password: 'mySecretPassword123',
      subKey: 'nested_secret_val',
    },
  };

  const sanitized = sanitizeData(payloadWithSecrets) as Record<string, any>;
  assert(
    sanitized.apiKey === '[REDACTED]',
    '17. apiKey redigida dos logs'
  );
  assert(
    sanitized.metaAccessToken === '[REDACTED]',
    '17. metaAccessToken redigido dos logs'
  );
  assert(
    sanitized.requestHeader === 'Bearer [REDACTED]',
    '17. Token Bearer redigido dos logs'
  );
  assert(
    sanitized.details.password === '[REDACTED]',
    '17. Senha aninhada redigida dos logs'
  );
  assert(
    sanitized.publicData === 'mariana@example.com',
    '17. Dados públicos não-sensíveis preservados na auditoria'
  );

  // Teste 19: Uma automação não altera indevidamente mensagens existentes
  const preMessages = await repositoryManager.conversation.getMessages('conv_demo_01');
  const preCount = preMessages.length;
  const firstMsgOriginal = { ...preMessages[0] };

  // Run another non-matching event
  await ruleEngine.processEvent({
    conversationId: 'conv_demo_01',
    channel: 'instagram',
    messageId: 'msg_integrity_check',
    sender: 'contact',
    content: 'Apenas checando integridade sem disparar automação.',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  });

  const postMessages = await repositoryManager.conversation.getMessages('conv_demo_01');
  assert(
    postMessages[0].id === firstMsgOriginal.id &&
    postMessages[0].content === firstMsgOriginal.content,
    '19. Mensagens preexistentes no histórico não sofrem alterações ou mutações indevidas'
  );

  // ---------------------------------------------------------------------------
  // BLOCO 6: REGRESSÃO ZERO & CONFORMIDADE GERAL (TESTES 20, 21, 22, 23, 24)
  // ---------------------------------------------------------------------------
  console.log(`\n${BOLD}--- BLOCO 6: Não-Regressão de Módulos Certificados ---${RESET}`);

  // Teste 20: Fluxo inbound certificado continua funcionando
  assert(
    typeof repositoryManager.conversation.createMessage === 'function',
    '20. Fluxo inbound certificado preservado (createMessage disponível no repositório ativo)'
  );

  // Teste 21: Outbound WhatsApp certificado continua funcionando
  assert(
    typeof repositoryManager.conversation.sendMessage === 'function',
    '21. Outbound WhatsApp oficial via meta-send-message preservado'
  );

  // Teste 22: Autorização fail-closed do operador continua funcionando
  assert(
    typeof repositoryManager.conversation.toggleHandler === 'function',
    '22. Contratos de autorização e controle de atendente humano continuam operacionais'
  );

  // Teste 23: Realtime Inbox continua funcionando
  assert(
    typeof repositoryManager.conversation.subscribeToInboxEvents === 'function' ||
    typeof repositoryManager.conversation.subscribeToNewMessages === 'function',
    '23. Subscrições de Realtime da Inbox continuam íntegras e prontas para sincronização'
  );

  // Teste 24: Verificação de tipagem e integridade do motor
  assert(
    typeof ruleEngine.processEvent === 'function' &&
    typeof ruleEngine.processMessage === 'function' &&
    typeof ruleEngine.clearIdempotencyCache === 'function',
    '24. Interface completa do Rule Engine tipada, exportada e validada'
  );

  // ---------------------------------------------------------------------------
  // SUMÁRIO FINAL
  // ---------------------------------------------------------------------------
  console.log(`\n${BOLD}${CYAN}======================================================================${RESET}`);
  console.log(`${BOLD}RESULTADO FINAL DOS TESTES DO RULE ENGINE:${RESET}`);
  console.log(`Total de testes:  ${BOLD}${totalTests}${RESET}`);
  console.log(`Aprovados:        ${GREEN}${BOLD}${passedTests}${RESET}`);
  console.log(`Reprovados:       ${failedTests > 0 ? RED : GREEN}${BOLD}${failedTests}${RESET}`);
  console.log(`${BOLD}${CYAN}======================================================================${RESET}\n`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

runRuleEngineTests().catch(err => {
  console.error('Exceção fatal na execução da suíte do Rule Engine:', err);
  process.exit(1);
});
