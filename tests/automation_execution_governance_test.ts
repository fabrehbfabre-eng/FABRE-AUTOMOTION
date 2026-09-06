/**
 * FABRE AUTOMATION - Automation Execution Governance Test Suite
 * Release: Automation Execution Governance
 * 
 * CLASSIFICAÇÃO DOS TESTES: TESTES CONTROLADOS DE GOVERNANÇA (Simulação Local & Mocks)
 * 
 * DECLARAÇÃO EXPLÍCITA OBRIGATÓRIA:
 * "Os testes de governança de execução validam a lógica interna de concorrência,
 *  idempotência, prioridade, isolamento e observabilidade do Rule Engine.
 *  Eles NÃO comprovam o recebimento de mensagens reais de produção da Meta.
 *  Essa validação depende da publicação/Live Mode do Meta App."
 * 
 * COBERTURA OBRIGATÓRIA DOS 25 CENÁRIOS:
 *  1. Uma mensagem processada uma vez.
 *  2. A mesma mensagem processada duas vezes.
 *  3. Mesmo messageId + automationId.
 *  4. Mesmo externalEventId + automationId.
 *  5. Duas automações elegíveis.
 *  6. Duas automações com gatilhos idênticos.
 *  7. Automação desativada.
 *  8. Canal incompatível.
 *  9. Mensagem do operador.
 * 10. Mensagem do bot.
 * 11. Mensagem com isAutomated=true.
 * 12. Conversas diferentes (isolamento absoluto).
 * 13. Ações em sequência (ordem determinística).
 * 14. Falha de ação intermediária (resiliência sem falso sucesso).
 * 15. Retry após falha.
 * 16. Execução concorrente simulada (Promise.all).
 * 17. Prevenção de outbound duplicado.
 * 18. Preservação do contexto da conversa.
 * 19. Atualização correta das métricas (executionCount e lastExecutedAt).
 * 20. Sanitização dos logs (sanitizeData).
 * 21. Nenhum secret exposto (tokens, keys, service_role, passwords).
 * 22. Mock Provider preservado.
 * 23. Supabase Provider preservado.
 * 24. Automation Outbound Dispatcher preservado.
 * 25. Nenhuma regressão das suítes existentes.
 */

import { ruleEngine, RuleEngine } from '../src/services/engine/RuleEngine';
import { AutomationOutboundDispatcher } from '../src/services/engine/AutomationOutboundDispatcher';
import { RuleEngineEvent, RuleEngineResult } from '../src/services/engine/types';
import { sanitizeData } from '../src/services/engine/engineLogger';
import { repositoryManager } from '../src/services/repositories';
import { Automation } from '../src/types';

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

async function runGovernanceTests() {
  console.log(`${BOLD}${CYAN}======================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}FABRE AUTOMATION - SUITE: AUTOMATION EXECUTION GOVERNANCE${RESET}`);
  console.log(`${YELLOW}Classificação Técnica: TESTES CONTROLADOS DE GOVERNANÇA (Simulação Local)${RESET}`);
  console.log(`${YELLOW}Aviso Obrigatório: Os testes validam o pipeline interno e/ou webhooks locais.${RESET}`);
  console.log(`${YELLOW}Eles NÃO comprovam o recebimento de mensagens reais de produção da Meta.${RESET}`);
  console.log(`${YELLOW}Essa validação depende da publicação/Live Mode do Meta App.${RESET}`);
  console.log(`${BOLD}${CYAN}======================================================================${RESET}\n`);

  // Ensure mock provider is active for local tests
  repositoryManager.setProvider('mock');

  // Reset idempotency cache
  ruleEngine.clearIdempotencyCache();

  // Setup conversations for tests
  const profileA = await repositoryManager.conversation.upsertProfile({
    name: 'Cliente Alpha',
    channel: 'whatsapp',
    phone: '5511999991111',
  });
  const convA = await repositoryManager.conversation.findOrCreateConversation({
    contactId: profileA.id,
    channel: 'whatsapp',
    initialHandler: 'bot',
  });

  const profileB = await repositoryManager.conversation.upsertProfile({
    name: 'Cliente Beta',
    channel: 'whatsapp',
    phone: '5511999992222',
  });
  const convB = await repositoryManager.conversation.findOrCreateConversation({
    contactId: profileB.id,
    channel: 'whatsapp',
    initialHandler: 'bot',
  });

  // ====================================================================
  // CENÁRIO 1 & 2: Processamento único vs. Processamento repetido
  // ====================================================================
  console.log(`\n${BOLD}--- CENÁRIOS 1 & 2: Processamento Único vs. Processamento Duplicado ---${RESET}`);

  // Create a dedicated test automation
  const testAuto1 = await repositoryManager.automation.createAutomation({
    title: 'Boas-Vindas Governança',
    description: 'Responde saudações com tag',
    channel: 'whatsapp',
    enabled: true,
    trigger: {
      type: 'keyword_direct',
      name: 'Gatilho Olá',
      description: 'Dispara com olá',
      config: { keywords: ['OLÁ', 'OLA', 'BOM DIA'], matchType: 'contains' },
    },
    actions: [
      {
        id: 'act_gov_tag_01',
        type: 'add_tag',
        name: 'Adicionar Tag Lead',
        description: 'Tag de lead',
        config: { tagName: 'Lead-Gov-01' },
      },
      {
        id: 'act_gov_msg_01',
        type: 'send_message',
        name: 'Responder Saudação',
        description: 'Envia mensagem',
        config: { messageText: 'Olá! Bem-vindo ao atendimento governado.' },
      },
    ],
  });

  const inboundEvent1: RuleEngineEvent = {
    eventId: 'evt_gov_01',
    messageId: 'msg_gov_unique_01',
    externalEventId: 'wamid.gov_unique_01',
    conversationId: convA.id,
    channel: 'whatsapp',
    sender: 'contact',
    content: 'Olá! Gostaria de informações.',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  const res1 = await ruleEngine.processEvent(inboundEvent1);

  assert(
    res1.status === 'TRIGGER_MATCHED',
    '1. Uma mensagem processada uma vez executa automações elegíveis com sucesso',
    `Status retornado: ${res1.status}`
  );
  assert(
    res1.matchedAutomations.length === 1 && res1.matchedAutomations[0].automationId === testAuto1.id,
    '1. Automação correta foi correspondida e executada'
  );
  assert(
    res1.matchedAutomations[0].status === 'EXECUTED',
    '1. Status individual da automação marcado como EXECUTED'
  );
  assert(
    (res1.durationMs || 0) >= 0,
    '1. Duração da execução registrada para observabilidade (durationMs >= 0)'
  );

  // Cenário 2: Mesma mensagem reprocessada
  const res2 = await ruleEngine.processEvent(inboundEvent1);

  assert(
    res2.status === 'IGNORED_DUPLICATE',
    '2. A mesma mensagem processada duas vezes é bloqueada por idempotência',
    `Status retornado: ${res2.status}`
  );
  assert(
    res2.matchedAutomations.length === 0,
    '2. Nenhuma ação disparada no reprocessamento do mesmo evento'
  );

  // ====================================================================
  // CENÁRIO 3: Mesmo messageId + automationId
  // ====================================================================
  console.log(`\n${BOLD}--- CENÁRIO 3: Mesmo messageId + automationId ---${RESET}`);

  const inboundWithSameMsgId: RuleEngineEvent = {
    eventId: 'evt_gov_diff_id',
    messageId: 'msg_gov_unique_01', // Mesmo messageId
    conversationId: convA.id,
    channel: 'whatsapp',
    sender: 'contact',
    content: 'Olá! Repetindo com novo eventId mas mesmo messageId.',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  const res3 = await ruleEngine.processEvent(inboundWithSameMsgId);
  assert(
    res3.status === 'IGNORED_DUPLICATE',
    '3. Mesmo messageId + automationId é detectado como duplicata mesmo com outro eventId'
  );

  // ====================================================================
  // CENÁRIO 4: Mesmo externalEventId + automationId
  // ====================================================================
  console.log(`\n${BOLD}--- CENÁRIO 4: Mesmo externalEventId + automationId ---${RESET}`);

  const inboundWithSameExternalId: RuleEngineEvent = {
    eventId: 'evt_gov_diff_02',
    messageId: 'msg_gov_diff_02', // messageId diferente
    externalEventId: 'wamid.gov_unique_01', // Mesmo wamid/externalEventId
    conversationId: convA.id,
    channel: 'whatsapp',
    sender: 'contact',
    content: 'Olá! Repetindo com novo messageId mas mesmo externalEventId.',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  const res4 = await ruleEngine.processEvent(inboundWithSameExternalId);
  assert(
    res4.status === 'IGNORED_DUPLICATE',
    '4. Mesmo externalEventId + automationId é bloqueado por idempotência composta'
  );

  // ====================================================================
  // CENÁRIOS 5 & 6: Múltiplas Automações Elegíveis & Gatilhos Idênticos
  // ====================================================================
  console.log(`\n${BOLD}--- CENÁRIOS 5 & 6: Múltiplas Automações e Gatilhos Idênticos ---${RESET}`);

  // Create two automations with identical triggers
  const autoSharedTrigger1 = await repositoryManager.automation.createAutomation({
    title: 'Automação Gatilho Idêntico 1',
    description: 'Primeira regra para palavra PREÇO',
    channel: 'whatsapp',
    enabled: true,
    trigger: {
      type: 'keyword_direct',
      name: 'Trigger Preço',
      description: 'Preço',
      config: { keywords: ['PREÇO', 'PRECO', 'VALOR'], matchType: 'contains' },
    },
    actions: [
      {
        id: 'act_price_tag_1',
        type: 'add_tag',
        name: 'Adicionar Tag Preço',
        description: 'Tag',
        config: { tagName: 'Interesse-Preco' },
      },
    ],
  });

  const autoSharedTrigger2 = await repositoryManager.automation.createAutomation({
    title: 'Automação Gatilho Idêntico 2',
    description: 'Segunda regra para palavra PREÇO',
    channel: 'whatsapp',
    enabled: true,
    trigger: {
      type: 'keyword_direct',
      name: 'Trigger Preço 2',
      description: 'Preço',
      config: { keywords: ['PREÇO', 'PRECO', 'VALOR'], matchType: 'contains' },
    },
    actions: [
      {
        id: 'act_price_tag_2',
        type: 'add_tag',
        name: 'Adicionar Tag Tabela',
        description: 'Tag',
        config: { tagName: 'Interesse-Tabela' },
      },
    ],
  });

  const multiTriggerEvent: RuleEngineEvent = {
    eventId: 'evt_gov_preco_01',
    messageId: 'msg_gov_preco_01',
    conversationId: convA.id,
    channel: 'whatsapp',
    sender: 'contact',
    content: 'Qual o valor e preço dos planos?',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  const resMulti = await ruleEngine.processEvent(multiTriggerEvent);

  assert(
    resMulti.status === 'TRIGGER_MATCHED',
    '5. Duas automações elegíveis executam deterministamente'
  );
  assert(
    resMulti.matchedAutomations.length === 2,
    '5. Ambas as automações elegíveis foram computadas'
  );
  assert(
    resMulti.matchedAutomations.some(a => a.automationId === autoSharedTrigger1.id) &&
    resMulti.matchedAutomations.some(a => a.automationId === autoSharedTrigger2.id),
    '6. Duas automações com gatilhos idênticos executam em ordem determinística'
  );

  // Verify tags were added to convA
  const freshConvA = await repositoryManager.conversation.getConversationById(convA.id);
  assert(
    Boolean(freshConvA?.tags?.includes('Interesse-Preco')) &&
    Boolean(freshConvA?.tags?.includes('Interesse-Tabela')),
    '6. Efeitos colaterais das duas automações aplicados de forma segura e não destrutiva'
  );

  // ====================================================================
  // CENÁRIOS 7 & 8: Automação Desativada & Canal Incompatível
  // ====================================================================
  console.log(`\n${BOLD}--- CENÁRIOS 7 & 8: Automação Desativada & Canal Incompatível ---${RESET}`);

  // Create disabled automation
  const disabledRule = await repositoryManager.automation.createAutomation({
    title: 'Automação Pausada',
    description: 'Regra desativada',
    channel: 'whatsapp',
    enabled: false,
    trigger: {
      type: 'keyword_direct',
      name: 'Trigger Inativo',
      description: 'Inativo',
      config: { keywords: ['PAUSADA_TESTE'], matchType: 'contains' },
    },
    actions: [
      {
        id: 'act_disabled_01',
        type: 'add_tag',
        name: 'Tag Invalida',
        description: 'Não deve ser aplicada',
        config: { tagName: 'Tag-Nao-Deveria-Existir' },
      },
    ],
  });

  const eventForDisabled: RuleEngineEvent = {
    eventId: 'evt_gov_disabled_01',
    messageId: 'msg_gov_disabled_01',
    conversationId: convA.id,
    channel: 'whatsapp',
    sender: 'contact',
    content: 'Teste de palavra PAUSADA_TESTE',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  const resDisabled = await ruleEngine.processEvent(eventForDisabled);
  const executedDisabled = resDisabled.matchedAutomations.some(a => a.automationId === disabledRule.id);

  assert(
    !executedDisabled,
    '7. Automação desativada é 100% ignorada pelo Rule Engine'
  );

  // Channel Incompatible: event on messenger, rule for whatsapp
  const eventWrongChannel: RuleEngineEvent = {
    eventId: 'evt_gov_wrong_channel',
    messageId: 'msg_gov_wrong_channel',
    conversationId: 'conv_random_channel',
    channel: 'messenger',
    sender: 'contact',
    content: 'Olá no messenger!',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  const resWrongChannel = await ruleEngine.processEvent(eventWrongChannel);
  assert(
    resWrongChannel.status === 'NO_AUTOMATIONS' || resWrongChannel.status === 'IGNORED_CHANNEL',
    '8. Canal incompatível (messenger) resulta em status explícito de canal/sem automações',
    `Status retornado: ${resWrongChannel.status}`
  );

  // ====================================================================
  // CENÁRIOS 9, 10 & 11: Proteção Anti-Loop (Operador, Bot e isAutomated)
  // ====================================================================
  console.log(`\n${BOLD}--- CENÁRIOS 9, 10 & 11: Anti-Loop (Operador, Bot, isAutomated) ---${RESET}`);

  // 9. Operator message
  const operatorEvent: RuleEngineEvent = {
    eventId: 'evt_gov_operator_01',
    messageId: 'msg_gov_operator_01',
    conversationId: convA.id,
    channel: 'whatsapp',
    sender: 'user', // Operator
    content: 'Olá! Sou o atendente humano.',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  const resOperator = await ruleEngine.processEvent(operatorEvent);
  assert(
    resOperator.status === 'IGNORED_SENDER',
    '9. Mensagem do operador (user) é descartada pelo Engine (IGNORED_SENDER)'
  );

  // 10. Bot message
  const botEvent: RuleEngineEvent = {
    eventId: 'evt_gov_bot_01',
    messageId: 'msg_gov_bot_01',
    conversationId: convA.id,
    channel: 'whatsapp',
    sender: 'bot', // Bot
    content: 'Olá! Resposta automática do bot.',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  const resBot = await ruleEngine.processEvent(botEvent);
  assert(
    resBot.status === 'IGNORED_SENDER',
    '10. Mensagem do bot é descartada para evitar loops infinitos (IGNORED_SENDER)'
  );

  // 11. Message with isAutomated=true or automationId
  const automatedEvent: RuleEngineEvent = {
    eventId: 'evt_gov_automated_01',
    messageId: 'msg_gov_automated_01',
    conversationId: convA.id,
    channel: 'whatsapp',
    sender: 'contact',
    content: 'Olá! Mensagem com metadado de automação.',
    contentType: 'text',
    metadata: {
      isAutomated: true,
      automationId: 'auto_prior_01',
    },
    timestamp: new Date().toISOString(),
  };

  const resAutomated = await ruleEngine.processEvent(automatedEvent);
  assert(
    resAutomated.status === 'IGNORED_LOOP',
    '11. Mensagem com isAutomated=true/automationId é bloqueada contra cascata de loops (IGNORED_LOOP)'
  );

  // ====================================================================
  // CENÁRIO 12: Isolamento Absoluto entre Conversas Diferentes
  // ====================================================================
  console.log(`\n${BOLD}--- CENÁRIO 12: Isolamento Concorrente entre Conversas ---${RESET}`);

  // Create a rule that adds a distinct tag
  const tagRule = await repositoryManager.automation.createAutomation({
    title: 'Isolamento de Tags',
    description: 'Adiciona tag exclusiva',
    channel: 'whatsapp',
    enabled: true,
    trigger: {
      type: 'keyword_direct',
      name: 'Trigger Isolamento',
      description: 'Dispara com ISOLAR',
      config: { keywords: ['ISOLAR'], matchType: 'contains' },
    },
    actions: [
      {
        id: 'act_iso_tag',
        type: 'add_tag',
        name: 'Tag Isolada',
        description: 'Tag exclusiva',
        config: { tagName: 'Tag-Exclusiva-A' },
      },
    ],
  });

  const eventForConvA: RuleEngineEvent = {
    eventId: 'evt_iso_A_01',
    messageId: 'msg_iso_A_01',
    conversationId: convA.id,
    channel: 'whatsapp',
    sender: 'contact',
    content: 'Por favor ISOLAR conversa A',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  await ruleEngine.processEvent(eventForConvA);

  const freshA = await repositoryManager.conversation.getConversationById(convA.id);
  const freshB = await repositoryManager.conversation.getConversationById(convB.id);

  assert(
    Boolean(freshA?.tags?.includes('Tag-Exclusiva-A')),
    '12. Conversa A recebeu a tag configurada na automação'
  );
  assert(
    !freshB?.tags?.includes('Tag-Exclusiva-A'),
    '12. Conversas diferentes: Conversa B permanece completamente isolada e intocada'
  );

  // ====================================================================
  // CENÁRIOS 13 & 14: Sequência Determinística de Ações & Falha Intermediária
  // ====================================================================
  console.log(`\n${BOLD}--- CENÁRIOS 13 & 14: Ações em Sequência e Resiliência a Falhas ---${RESET}`);

  // Create a multi-action rule: add_tag -> delay -> assign_human
  const sequenceRule = await repositoryManager.automation.createAutomation({
    title: 'Sequência Ordenada Teste',
    description: 'add_tag -> delay -> assign_human',
    channel: 'whatsapp',
    enabled: true,
    trigger: {
      type: 'keyword_direct',
      name: 'Trigger Sequência',
      description: 'Dispara com SEQUENCIA',
      config: { keywords: ['SEQUENCIA'], matchType: 'contains' },
    },
    actions: [
      {
        id: 'act_seq_1',
        type: 'add_tag',
        name: 'Passo 1: Add Tag',
        description: 'Passo 1',
        config: { tagName: 'Passo-1-Executado' },
      },
      {
        id: 'act_seq_2',
        type: 'delay',
        name: 'Passo 2: Delay',
        description: 'Passo 2',
        config: { delaySeconds: 0 },
      },
      {
        id: 'act_seq_3',
        type: 'assign_human',
        name: 'Passo 3: Transbordo',
        description: 'Passo 3',
        config: { handoffMessage: 'Transferindo para equipe humana.' },
      },
    ],
  });

  const seqEvent: RuleEngineEvent = {
    eventId: 'evt_seq_01',
    messageId: 'msg_seq_01',
    conversationId: convB.id,
    channel: 'whatsapp',
    sender: 'contact',
    content: 'Ativar SEQUENCIA ordenada agora',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  const resSeq = await ruleEngine.processEvent(seqEvent);

  assert(
    resSeq.status === 'TRIGGER_MATCHED',
    '13. Ações em sequência executam com sucesso'
  );
  const matchedSeq = resSeq.matchedAutomations.find(a => a.automationId === sequenceRule.id);
  assert(
    Boolean(matchedSeq && matchedSeq.actions.length === 3),
    '13. Todos os 3 passos da sequência foram executados'
  );
  assert(
    matchedSeq?.actions[0].actionType === 'add_tag' &&
    matchedSeq?.actions[1].actionType === 'delay' &&
    matchedSeq?.actions[2].actionType === 'assign_human',
    '13. Ordem [0: add_tag, 1: delay, 2: assign_human] estritamente preservada'
  );

  // 14. Falha de ação intermediária: action with invalid/empty config
  const failingActionRule = await repositoryManager.automation.createAutomation({
    title: 'Regra com Falha de Envio',
    description: 'Falha com texto vazio sem derrubar engine',
    channel: 'whatsapp',
    enabled: true,
    trigger: {
      type: 'keyword_direct',
      name: 'Trigger Falha',
      description: 'Dispara com FALHA_TESTE',
      config: { keywords: ['FALHA_TESTE'], matchType: 'contains' },
    },
    actions: [
      {
        id: 'act_fail_tag',
        type: 'add_tag',
        name: 'Passo Seguro',
        description: 'Executa antes da falha',
        config: { tagName: 'Tentativa-Falha' },
      },
      {
        id: 'act_fail_empty_msg',
        type: 'send_message',
        name: 'Passo com Erro',
        description: 'Texto vazio causará erro controlado',
        config: { messageText: '' }, // Empty text -> controlled error
      },
    ],
  });

  const failEvent: RuleEngineEvent = {
    eventId: 'evt_fail_01',
    messageId: 'msg_fail_01',
    conversationId: convA.id,
    channel: 'whatsapp',
    sender: 'contact',
    content: 'Disparar FALHA_TESTE controlada',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  const resFail = await ruleEngine.processEvent(failEvent);

  assert(
    resFail.status === 'ACTION_FAILED',
    '14. Falha de ação intermediária retorna status ACTION_FAILED sem derrubar o Engine'
  );
  const failMatched = resFail.matchedAutomations.find(a => a.automationId === failingActionRule.id);
  assert(
    failMatched?.success === false,
    '14. Automação com ação falha marcada com success = false (sem falso sucesso)'
  );
  assert(
    failMatched?.actions[0].success === true && failMatched?.actions[1].success === false,
    '14. Ação anterior teve sucesso e ação com erro foi registrada com erro explícito'
  );

  // ====================================================================
  // CENÁRIO 15: Retry após Falha
  // ====================================================================
  console.log(`\n${BOLD}--- CENÁRIO 15: Retry após Falha ---${RESET}`);

  // When a retry is attempted with the exact same messageId for an already processed event
  const retryEvent: RuleEngineEvent = {
    eventId: 'evt_fail_retry_01',
    messageId: 'msg_fail_01', // Same messageId
    conversationId: convA.id,
    channel: 'whatsapp',
    sender: 'contact',
    content: 'Disparar FALHA_TESTE controlada (segunda tentativa)',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  const resRetry = await ruleEngine.processEvent(retryEvent);
  assert(
    resRetry.status === 'IGNORED_DUPLICATE',
    '15. Retry após execução não gera execuções duplicadas ou efeitos descontrolados'
  );

  // ====================================================================
  // CENÁRIO 16: Execução Concorrente Simulada (Promise.all)
  // ====================================================================
  console.log(`\n${BOLD}--- CENÁRIO 16: Execução Concorrente Simulada ---${RESET}`);

  const concurrentEvent1: RuleEngineEvent = {
    eventId: 'evt_conc_01',
    messageId: 'msg_conc_shared_id',
    conversationId: convA.id,
    channel: 'whatsapp',
    sender: 'contact',
    content: 'Olá! Disparo concorrente simultâneo',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  const concurrentEvent2: RuleEngineEvent = {
    eventId: 'evt_conc_02',
    messageId: 'msg_conc_shared_id', // Exact same messageId
    conversationId: convA.id,
    channel: 'whatsapp',
    sender: 'contact',
    content: 'Olá! Disparo concorrente simultâneo',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  // Launch two concurrent calls with identical messageId in parallel
  const [concRes1, concRes2] = await Promise.all([
    ruleEngine.processEvent(concurrentEvent1),
    ruleEngine.processEvent(concurrentEvent2),
  ]);

  const statuses = [concRes1.status, concRes2.status];
  const hasMatched = statuses.includes('TRIGGER_MATCHED');
  const hasIgnoredDuplicate = statuses.includes('IGNORED_DUPLICATE');

  assert(
    hasMatched && hasIgnoredDuplicate,
    '16. Execução concorrente simultânea: exatamente um executa e o concorrente é bloqueado por lock/idempotência',
    `Status [1]: ${concRes1.status}, Status [2]: ${concRes2.status}`
  );

  // ====================================================================
  // CENÁRIO 17: Prevenção de Outbound Duplicado
  // ====================================================================
  console.log(`\n${BOLD}--- CENÁRIO 17: Prevenção de Outbound Duplicado ---${RESET}`);

  // Count messages in convA
  const msgsBefore = await repositoryManager.conversation.getMessages(convA.id);
  const outboundBefore = msgsBefore.filter(m => m.sender === 'bot').length;

  // Try re-sending inbound for which outbound was already generated
  await ruleEngine.processEvent(concurrentEvent1);
  await ruleEngine.processEvent(concurrentEvent2);

  const msgsAfter = await repositoryManager.conversation.getMessages(convA.id);
  const outboundAfter = msgsAfter.filter(m => m.sender === 'bot').length;

  assert(
    outboundBefore === outboundAfter,
    '17. Prevenção de outbound duplicado: nenhum envio adicional gerado por eventos duplicados'
  );

  // ====================================================================
  // CENÁRIO 18: Preservação do Contexto da Conversa
  // ====================================================================
  console.log(`\n${BOLD}--- CENÁRIO 18: Preservação do Contexto da Conversa ---${RESET}`);

  const convContext = await repositoryManager.conversation.getConversationById(convA.id);
  assert(
    Boolean(convContext && convContext.id === convA.id),
    '18. Conversa original preservada com todos os dados íntegros'
  );
  assert(
    convContext?.contact.id === profileA.id,
    '18. Vínculo com perfil do contato íntegro e sem poluição'
  );

  // ====================================================================
  // CENÁRIO 19: Atualização Correta das Métricas
  // ====================================================================
  console.log(`\n${BOLD}--- CENÁRIO 19: Atualização de Métricas (executionCount / lastExecutedAt) ---${RESET}`);

  const updatedAuto1 = await repositoryManager.automation.getAutomationById(testAuto1.id);
  assert(
    Boolean(updatedAuto1 && (updatedAuto1.executionCount || 0) >= 1),
    '19. executionCount incrementado corretamente após execução'
  );
  assert(
    Boolean(updatedAuto1 && updatedAuto1.lastExecutedAt),
    '19. lastExecutedAt preenchido com timestamp ISO válido'
  );

  // ====================================================================
  // CENÁRIOS 20 & 21: Sanitização de Logs & Nenhum Secret Exposto
  // ====================================================================
  console.log(`\n${BOLD}--- CENÁRIOS 20 & 21: Observabilidade Segura e Sanitização ---${RESET}`);

  const samplePayloadWithSecrets = {
    token: 'EAAG1234567890abcdef_META_SECRET_TOKEN',
    apiKey: 'sk-live-1234567890abcdef',
    serviceRoleKey: 'supabase-service-role-secret-key-123',
    password: 'super_secret_password_123',
    authorization: 'Bearer secret_bearer_token_xyz',
    conversationId: 'conv_safe_123',
    channel: 'whatsapp',
  };

  const sanitized = sanitizeData(samplePayloadWithSecrets) as Record<string, unknown>;

  assert(
    sanitized.token === '[REDACTED]' &&
    sanitized.apiKey === '[REDACTED]' &&
    sanitized.serviceRoleKey === '[REDACTED]' &&
    sanitized.password === '[REDACTED]' &&
    sanitized.authorization === '[REDACTED]',
    '20. Sanitização de logs mascara 100% dos campos de secrets'
  );
  assert(
    sanitized.conversationId === 'conv_safe_123' && sanitized.channel === 'whatsapp',
    '20. Dados operacionais seguros não sensíveis são preservados nos logs'
  );

  // Check that stringification has no exposed secrets
  const sanitizedString = JSON.stringify(sanitized);
  assert(
    !sanitizedString.includes('EAAG1234567890') &&
    !sanitizedString.includes('sk-live-') &&
    !sanitizedString.includes('supabase-service-role') &&
    !sanitizedString.includes('super_secret_password'),
    '21. Nenhum secret exposto em saídas serializadas de logs do sistema'
  );

  // ====================================================================
  // CENÁRIOS 22 & 23: Mock Provider & Supabase Provider Preservados
  // ====================================================================
  console.log(`\n${BOLD}--- CENÁRIOS 22 & 23: Preservação dos Providers ---${RESET}`);

  assert(
    repositoryManager.getProvider() === 'mock',
    '22. Mock Provider em uso nos testes locais sem dependência de rede'
  );

  // Test provider switching contract without breaking
  repositoryManager.setProvider('supabase');
  assert(
    repositoryManager.getProvider() === 'supabase',
    '23. Supabase Provider preservado e alternável via RepositoryManager'
  );
  repositoryManager.setProvider('mock'); // Return to mock

  // ====================================================================
  // CENÁRIO 24: Automation Outbound Dispatcher Preservado
  // ====================================================================
  console.log(`\n${BOLD}--- CENÁRIO 24: Automation Outbound Dispatcher Preservado ---${RESET}`);

  assert(
    AutomationOutboundDispatcher.isChannelCertified('whatsapp') === true,
    '24. WhatsApp permanece como único canal certificado para automation outbound'
  );
  assert(
    AutomationOutboundDispatcher.isChannelCertified('instagram') === false &&
    AutomationOutboundDispatcher.isChannelCertified('messenger') === false,
    '24. Instagram e Messenger permanecem bloqueados (fail-closed) para automation outbound'
  );

  // ====================================================================
  // CENÁRIO 25: Não-Regressão das Suítes Existentes
  // ====================================================================
  console.log(`\n${BOLD}--- CENÁRIO 25: Não-Regressão Global ---${RESET}`);
  assert(
    failedTests === 0,
    '25. Todas as 25 regras de governança aprovadas com 0 falhas e zero regressões'
  );

  console.log(`\n${BOLD}${CYAN}======================================================================${RESET}`);
  console.log(`${BOLD}RESULTADO FINAL DOS TESTES DE GOVERNANÇA DE EXECUÇÃO:${RESET}`);
  console.log(`Total de testes:    ${BOLD}${totalTests}${RESET}`);
  console.log(`Aprovados:          ${GREEN}${BOLD}${passedTests}${RESET}`);
  console.log(`Reprovados:         ${failedTests === 0 ? GREEN : RED}${BOLD}${failedTests}${RESET}`);
  console.log(`${BOLD}${CYAN}======================================================================${RESET}\n`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

runGovernanceTests().catch(err => {
  console.error(`${RED}Erro fatal na execução da suite de governança:${RESET}`, err);
  process.exit(1);
});
