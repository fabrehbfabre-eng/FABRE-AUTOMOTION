/**
 * FABRE AUTOMATION - SUITE DE TESTES: INACTIVE FOLLOW-UP ENGINE
 * Release 15: Inactive Follow-Up Engine
 * 
 * Classificação Técnica: TESTES LOCAIS / SIMULAÇÃO COM REPOSITÓRIOS E MOCKS
 * 
 * Cobertura Completa dos 33 Casos de Teste Obrigatórios (Release 15):
 * 
 * PARTE 1: Configuração do Trigger & Validação (Testes 1 a 8)
 *  1. Rejeita inactivityMinutes negativo com AutomationValidationError
 *  2. Rejeita inactivityMinutes zero com AutomationValidationError
 *  3. Rejeita inactivityMinutes NaN com AutomationValidationError
 *  4. Rejeita inactivityMinutes não numérico (string) com AutomationValidationError
 *  5. Aceita inactivityMinutes válido e positivo (ex: 30 minutos)
 *  6. Converte e aceita inactivityHours válido (ex: 2h -> 120min)
 *  7. Rejeita inactivityMinutes superior ao limite máximo (ex: > 43200 minutos / 30 dias)
 *  8. Trigger inactive_followup avaliado como false se sender !== 'contact'
 * 
 * PARTE 2: Determinação da Atividade do Cliente (Testes 9 a 13)
 *  9. Identifica corretamente a última mensagem recebida do cliente (sender='contact')
 * 10. Ignora mensagens enviadas pelo bot (sender='bot') para cálculo de inatividade
 * 11. Ignora mensagens enviadas pelo operador humano (sender='user')
 * 12. Ignora mensagens enviadas pelo sistema (sender='system')
 * 13. Usa timestamp da última mensagem do cliente como marco zero de inatividade
 * 
 * PARTE 3: Agendamento Persistente & Idempotência (Testes 14 a 18)
 * 14. Disparo do evento armazena job do tipo 'inactive_followup' no DurableScheduler
 * 15. scheduled_at é calculado com exatidão (timestamp da mensagem + inactivityMinutes)
 * 16. NÃO usa setTimeout ou timers em memória (job gravado em banco/repositório)
 * 17. Idempotência por (automationId, conversationId, actionId, referenceMessageId) impede duplicidade
 * 18. Evento duplicado de entrada retorna o job já existente sem criar novo
 * 
 * PARTE 4: Cancelamento por Nova Mensagem do Cliente (Testes 19 a 23)
 * 19. Nova mensagem do cliente antes de scheduled_at invalida/cancela job pendente (status='cancelled')
 * 20. Job cancelado persiste com motivo explicativo no lastError
 * 21. Múltiplos jobs pendentes para a mesma conversa são cancelados atomicamente
 * 22. Job cancelado NÃO é executado pelo DurableScheduler nem pelo worker
 * 23. Mensagem do bot não cancela job pendente de follow-up
 * 
 * PARTE 5: Revalidação Pré-Execução (Momento da Execução) (Testes 24 a 29)
 * 24. Aborta e cancela job se a conversa vinculada não existir mais no banco
 * 25. Aborta e cancela job se a automação tiver sido desativada (enabled=false) antes da execução
 * 26. Aborta e cancela job se a ação tiver sido removida da automação
 * 27. Aborta e cancela job se o gatilho da automação não for mais inactive_followup
 * 28. Aborta e cancela job se o cliente enviou mensagem intermediária antes da execução
 * 29. Rejeita execução antecipada se a janela de inatividade ainda não tiver decorrido
 * 
 * PARTE 6: Execução Segura & Anti-Loop (Testes 30 a 33)
 * 30. Executa outbound seguro via ActionExecutor e AutomationOutboundDispatcher quando janela é cumprida
 * 31. Disparo utiliza estritamente o texto autoritativo cadastrado no banco (anti-injeção)
 * 32. Disparo para canal não certificado (Instagram/Messenger) é bloqueado com segurança
 * 33. A mensagem enviada pelo follow-up (sender='bot') NÃO gera novo follow-up (anti-loop garantido)
 */

import { repositoryManager } from '../src/services/repositories';
import { MockAutomationJobRepository } from '../src/services/repositories/mock/MockAutomationJobRepository';
import { InactiveFollowupEngine } from '../src/services/engine/InactiveFollowupEngine';
import { TriggerEvaluator } from '../src/services/engine/TriggerEvaluator';
import { validateTrigger, AutomationValidationError } from '../src/services/engine/validation';
import { RuleEngine } from '../src/services/engine/RuleEngine';
import { processDueAutomationJobs } from '../src/services/engine/DurableScheduler';
import { Automation, AutomationAction, Conversation, Message } from '../src/types';
import { RuleEngineEvent, EvaluationContext } from '../src/services/engine/types';

// ANSI colors for clean test reporting
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

let passedCount = 0;
let totalCount = 0;

function assert(condition: boolean, testNum: number, description: string, details?: string) {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`${colors.green}✅ [PASS]${colors.reset} ${testNum}. ${description}`);
  } else {
    console.error(`${colors.red}❌ [FAIL]${colors.reset} ${testNum}. ${description}`);
    if (details) {
      console.error(`   Detalhe do erro: ${details}`);
    }
  }
}

async function setupFixtures() {
  repositoryManager.setProvider('mock');
  const jobRepo = repositoryManager.job as MockAutomationJobRepository;
  jobRepo.clear();

  // Retrieve pre-seeded WhatsApp conversation
  const sampleConv = (await repositoryManager.conversation.getConversationById('conv_demo_02'))!;

  // Seed sample automation with inactive_followup trigger
  const sampleFollowupAuto: Automation = {
    id: 'auto_followup_1',
    title: 'Follow-up Inatividade 30m',
    description: 'Envia mensagem após 30 minutos sem resposta do cliente',
    enabled: true,
    channel: 'whatsapp',
    executionCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    trigger: {
      type: 'inactive_followup',
      name: 'Gatilho Inatividade 30m',
      description: 'Dispara quando conversa fica inativa por 30m',
      config: {
        inactivityMinutes: 30,
      },
    },
    actions: [
      {
        id: 'act_followup_msg',
        type: 'send_message',
        name: 'Mensagem de Retomada',
        description: 'Pergunta se o cliente ainda precisa de ajuda',
        config: {
          messageText: 'Olá! Notamos que não recebemos mais sua resposta. Ainda precisa de auxílio com seu pedido?',
        },
      },
    ],
  };

  await repositoryManager.automation.createAutomation(sampleFollowupAuto);

  return { sampleConv, sampleFollowupAuto };
}

async function runAllTests() {
  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}FABRE AUTOMATION - SUITE DE TESTES: INACTIVE FOLLOW-UP ENGINE${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}Release 15: Inactive Follow-Up Engine${colors.reset}`);
  console.log(`${colors.yellow}Classificação: TESTES LOCAIS / SIMULAÇÃO CONTROLADA COM MOCKS${colors.reset}`);
  console.log(`${colors.yellow}Regra de Ouro: Scheduler Durável + Revalidação Crítica na Execução${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================\n${colors.reset}`);

  const { sampleConv, sampleFollowupAuto } = await setupFixtures();
  const ruleEngine = new RuleEngine();

  // ---------------------------------------------------------------------------
  // PARTE 1: Configuração do Trigger & Validação (Testes 1 a 8)
  // ---------------------------------------------------------------------------
  console.log(`${colors.bold}--- PARTE 1: Configuração do Trigger & Validação (Testes 1 a 8) ---${colors.reset}`);

  // Test 1: Rejeita inactivityMinutes negativo com AutomationValidationError
  try {
    validateTrigger({
      type: 'inactive_followup',
      name: 'Negativo',
      description: '',
      config: { inactivityMinutes: -10 },
    });
    assert(false, 1, 'Rejeita inactivityMinutes negativo com AutomationValidationError', 'Não lançou exceção');
  } catch (err) {
    const isValErr = err instanceof AutomationValidationError;
    assert(isValErr, 1, 'Rejeita inactivityMinutes negativo com AutomationValidationError');
  }

  // Test 2: Rejeita inactivityMinutes zero com AutomationValidationError
  try {
    validateTrigger({
      type: 'inactive_followup',
      name: 'Zero',
      description: '',
      config: { inactivityMinutes: 0 },
    });
    assert(false, 2, 'Rejeita inactivityMinutes zero com AutomationValidationError', 'Não lançou exceção');
  } catch (err) {
    const isValErr = err instanceof AutomationValidationError;
    assert(isValErr, 2, 'Rejeita inactivityMinutes zero com AutomationValidationError');
  }

  // Test 3: Rejeita inactivityMinutes NaN com AutomationValidationError
  try {
    validateTrigger({
      type: 'inactive_followup',
      name: 'NaN',
      description: '',
      config: { inactivityMinutes: NaN },
    });
    assert(false, 3, 'Rejeita inactivityMinutes NaN com AutomationValidationError', 'Não lançou exceção');
  } catch (err) {
    const isValErr = err instanceof AutomationValidationError;
    assert(isValErr, 3, 'Rejeita inactivityMinutes NaN com AutomationValidationError');
  }

  // Test 4: Rejeita inactivityMinutes não numérico (string) com AutomationValidationError
  try {
    validateTrigger({
      type: 'inactive_followup',
      name: 'String',
      description: '',
      config: { inactivityMinutes: '30' as any },
    });
    assert(false, 4, 'Rejeita inactivityMinutes não numérico (string) com AutomationValidationError', 'Não lançou exceção');
  } catch (err) {
    const isValErr = err instanceof AutomationValidationError;
    assert(isValErr, 4, 'Rejeita inactivityMinutes não numérico (string) com AutomationValidationError');
  }

  // Test 5: Aceita inactivityMinutes válido e positivo (ex: 30 minutos)
  try {
    validateTrigger({
      type: 'inactive_followup',
      name: 'Valido Minutos',
      description: '',
      config: { inactivityMinutes: 30 },
    });
    const parsed = InactiveFollowupEngine.parseInactivityMinutes({
      type: 'inactive_followup',
      name: 'Valido',
      description: '',
      config: { inactivityMinutes: 30 },
    });
    assert(parsed.valid === true && parsed.minutes === 30, 5, 'Aceita inactivityMinutes válido e positivo (ex: 30 minutos)');
  } catch (err) {
    assert(false, 5, 'Aceita inactivityMinutes válido e positivo (ex: 30 minutos)', String(err));
  }

  // Test 6: Converte e aceita inactivityHours válido (ex: 2h -> 120min)
  try {
    validateTrigger({
      type: 'inactive_followup',
      name: 'Valido Horas',
      description: '',
      config: { inactivityHours: 2 },
    });
    const parsed = InactiveFollowupEngine.parseInactivityMinutes({
      type: 'inactive_followup',
      name: 'Valido Horas',
      description: '',
      config: { inactivityHours: 2 },
    });
    assert(parsed.valid === true && parsed.minutes === 120, 6, 'Converte e aceita inactivityHours válido (ex: 2h -> 120min)');
  } catch (err) {
    assert(false, 6, 'Converte e aceita inactivityHours válido (ex: 2h -> 120min)', String(err));
  }

  // Test 7: Rejeita inactivityMinutes superior ao limite máximo (ex: > 43200 minutos / 30 dias)
  try {
    validateTrigger({
      type: 'inactive_followup',
      name: 'Excesso',
      description: '',
      config: { inactivityMinutes: 50000 },
    });
    assert(false, 7, 'Rejeita inactivityMinutes superior ao limite máximo (ex: > 43200 minutos / 30 dias)', 'Não lançou exceção');
  } catch (err) {
    const isValErr = err instanceof AutomationValidationError;
    assert(isValErr, 7, 'Rejeita inactivityMinutes superior ao limite máximo (ex: > 43200 minutos / 30 dias)');
  }

  // Test 8: Trigger inactive_followup avaliado como false se sender !== 'contact'
  const nonContactEval = TriggerEvaluator.evaluate(
    sampleFollowupAuto.trigger,
    {
      conversationId: sampleConv.id,
      channel: 'whatsapp',
      messageId: 'msg_bot_01',
      sender: 'bot',
      content: 'Olá contato',
      contentType: 'text',
      timestamp: new Date().toISOString(),
    },
    { conversation: sampleConv, isFirstContact: false, depth: 1 }
  );
  assert(
    nonContactEval.matched === false && nonContactEval.reason.includes('contact'),
    8,
    "Trigger inactive_followup avaliado como false se sender !== 'contact'"
  );

  // ---------------------------------------------------------------------------
  // PARTE 2: Determinação da Atividade do Cliente (Testes 9 a 13)
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}--- PARTE 2: Determinação da Atividade do Cliente (Testes 9 a 13) ---${colors.reset}`);

  const testMessages: Message[] = [
    {
      id: 'msg_cust_1',
      conversationId: 'conv_1',
      sender: 'contact',
      content: 'Primeira mensagem do cliente',
      contentType: 'text',
      createdAt: '2026-09-10T10:00:00.000Z',
    },
    {
      id: 'msg_bot_1',
      conversationId: 'conv_1',
      sender: 'bot',
      content: 'Resposta automática do bot',
      contentType: 'text',
      createdAt: '2026-09-10T10:01:00.000Z',
    },
    {
      id: 'msg_user_1',
      conversationId: 'conv_1',
      sender: 'user',
      content: 'Intervenção do operador humano',
      contentType: 'text',
      createdAt: '2026-09-10T10:02:00.000Z',
    },
    {
      id: 'msg_cust_2',
      conversationId: 'conv_1',
      sender: 'contact',
      content: 'Segunda mensagem do cliente',
      contentType: 'text',
      createdAt: '2026-09-10T10:15:00.000Z',
    },
    {
      id: 'msg_sys_1',
      conversationId: 'conv_1',
      sender: 'system',
      content: 'Conversa transferida',
      contentType: 'text',
      createdAt: '2026-09-10T10:16:00.000Z',
    },
  ];

  // Test 9: Identifica corretamente a última mensagem recebida do cliente (sender='contact')
  const lastCust = InactiveFollowupEngine.getLastCustomerMessage(testMessages);
  assert(
    lastCust !== null && lastCust.id === 'msg_cust_2',
    9,
    "Identifica corretamente a última mensagem recebida do cliente (sender='contact')"
  );

  // Test 10: Ignora mensagens enviadas pelo bot (sender='bot') para cálculo de inatividade
  const messagesWithBotLast: Message[] = [
    ...testMessages,
    {
      id: 'msg_bot_2',
      conversationId: 'conv_1',
      sender: 'bot',
      content: 'Outro bot message',
      contentType: 'text',
      createdAt: '2026-09-10T10:20:00.000Z',
    },
  ];
  const lastWithBot = InactiveFollowupEngine.getLastCustomerMessage(messagesWithBotLast);
  assert(
    lastWithBot !== null && lastWithBot.id === 'msg_cust_2',
    10,
    "Ignora mensagens enviadas pelo bot (sender='bot') para cálculo de inatividade"
  );

  // Test 11: Ignora mensagens enviadas pelo operador humano (sender='user')
  const messagesWithUserLast: Message[] = [
    ...testMessages,
    {
      id: 'msg_user_2',
      conversationId: 'conv_1',
      sender: 'user',
      content: 'Outro operador message',
      contentType: 'text',
      createdAt: '2026-09-10T10:25:00.000Z',
    },
  ];
  const lastWithUser = InactiveFollowupEngine.getLastCustomerMessage(messagesWithUserLast);
  assert(
    lastWithUser !== null && lastWithUser.id === 'msg_cust_2',
    11,
    "Ignora mensagens enviadas pelo operador humano (sender='user')"
  );

  // Test 12: Ignora mensagens enviadas pelo sistema (sender='system')
  const messagesWithSysLast: Message[] = [
    ...testMessages,
    {
      id: 'msg_sys_2',
      conversationId: 'conv_1',
      sender: 'system',
      content: 'System event',
      contentType: 'text',
      createdAt: '2026-09-10T10:30:00.000Z',
    },
  ];
  const lastWithSys = InactiveFollowupEngine.getLastCustomerMessage(messagesWithSysLast);
  assert(
    lastWithSys !== null && lastWithSys.id === 'msg_cust_2',
    12,
    "Ignora mensagens enviadas pelo sistema (sender='system')"
  );

  // Test 13: Usa timestamp da última mensagem do cliente como marco zero de inatividade
  assert(
    lastCust?.createdAt === '2026-09-10T10:15:00.000Z',
    13,
    'Usa timestamp da última mensagem do cliente como marco zero de inatividade'
  );

  // ---------------------------------------------------------------------------
  // PARTE 3: Agendamento Persistente & Idempotência (Testes 14 a 18)
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}--- PARTE 3: Agendamento Persistente & Idempotência (Testes 14 a 18) ---${colors.reset}`);

  const jobRepo = repositoryManager.job as MockAutomationJobRepository;
  jobRepo.clear();

  const customerEventTimestamp = '2026-09-10T11:00:00.000Z';
  const customerInboundEvent: RuleEngineEvent = {
    conversationId: sampleConv.id,
    channel: 'whatsapp',
    messageId: 'msg_inbound_cust_100',
    sender: 'contact',
    content: 'Olá, gostaria de saber mais sobre o plano',
    contentType: 'text',
    timestamp: customerEventTimestamp,
  };

  // Dispatch through RuleEngine
  const dispatchRes = await ruleEngine.processEvent(customerInboundEvent);

  // Test 14: Disparo do evento armazena job do tipo 'inactive_followup' no DurableScheduler
  const allJobsAfterEvent = await jobRepo.listJobs({ conversationId: sampleConv.id });
  const followupJob = allJobsAfterEvent.find(j => j.jobType === 'inactive_followup');
  assert(
    Boolean(followupJob && followupJob.jobType === 'inactive_followup'),
    14,
    "Disparo do evento armazena job do tipo 'inactive_followup' no DurableScheduler"
  );

  // Test 15: scheduled_at é calculado com exatidão (timestamp da mensagem + inactivityMinutes)
  // 11:00:00 + 30 min = 11:30:00
  const expectedScheduledAt = new Date(new Date(customerEventTimestamp).getTime() + 30 * 60 * 1000).toISOString();
  assert(
    followupJob?.scheduledAt === expectedScheduledAt,
    15,
    'scheduled_at é calculado com exatidão (timestamp da mensagem + inactivityMinutes)',
    `Esperado: ${expectedScheduledAt}, Obtido: ${followupJob?.scheduledAt}`
  );

  // Test 16: NÃO usa setTimeout ou timers em memória (job gravado em banco/repositório)
  const jobInRepository = await jobRepo.getJobById(followupJob!.id);
  assert(
    Boolean(jobInRepository && jobInRepository.status === 'pending'),
    16,
    'NÃO usa setTimeout ou timers em memória (job gravado em banco/repositório com status pending)'
  );

  // Test 17: Idempotência por (automationId, conversationId, actionId, referenceMessageId) impede duplicidade
  const expectedIdempotencyKey = InactiveFollowupEngine.buildFollowupIdempotencyKey(
    sampleFollowupAuto.id,
    sampleConv.id,
    sampleFollowupAuto.actions[0].id,
    'msg_inbound_cust_100'
  );
  assert(
    followupJob?.idempotencyKey === expectedIdempotencyKey,
    17,
    'Idempotência por (automationId, conversationId, actionId, referenceMessageId) impede duplicidade'
  );

  // Test 18: Evento duplicado de entrada retorna o job já existente sem criar novo
  const initialJobCount = (await jobRepo.listJobs({ conversationId: sampleConv.id })).length;
  // Reprocess same event
  await ruleEngine.processEvent(customerInboundEvent);
  const finalJobCount = (await jobRepo.listJobs({ conversationId: sampleConv.id })).length;
  assert(
    initialJobCount === finalJobCount,
    18,
    'Evento duplicado de entrada retorna o job já existente sem criar novo'
  );

  // ---------------------------------------------------------------------------
  // PARTE 4: Cancelamento por Nova Mensagem do Cliente (Testes 19 a 23)
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}--- PARTE 4: Cancelamento por Nova Mensagem do Cliente (Testes 19 a 23) ---${colors.reset}`);

  // Customer sends a new message before scheduled_at
  const newCustomerEvent: RuleEngineEvent = {
    conversationId: sampleConv.id,
    channel: 'whatsapp',
    messageId: 'msg_inbound_cust_101',
    sender: 'contact',
    content: 'Esqueci de avisar, já sou cliente!',
    contentType: 'text',
    timestamp: '2026-09-10T11:10:00.000Z', // 10 minutes later (before 11:30:00)
  };

  await ruleEngine.processEvent(newCustomerEvent);

  // Test 19: Nova mensagem do cliente antes de scheduled_at invalida/cancela job pendente (status='cancelled')
  const originalJobAfterReply = await jobRepo.getJobById(followupJob!.id);
  assert(
    originalJobAfterReply?.status === 'cancelled',
    19,
    "Nova mensagem do cliente antes de scheduled_at invalida/cancela job pendente (status='cancelled')"
  );

  // Test 20: Job cancelado persiste com motivo explicativo no lastError
  assert(
    Boolean(originalJobAfterReply?.lastError && originalJobAfterReply.lastError.includes('cliente')),
    20,
    'Job cancelado persiste com motivo explicativo no lastError'
  );

  // Test 21: Múltiplos jobs pendentes para a mesma conversa são cancelados atomicamente
  // Setup two pending jobs
  const jobA = await jobRepo.createJob({
    automationId: sampleFollowupAuto.id,
    conversationId: 'conv_multi_cancel',
    actionId: 'act_1',
    jobType: 'inactive_followup',
    scheduledAt: '2026-09-10T12:00:00.000Z',
  });
  const jobB = await jobRepo.createJob({
    automationId: sampleFollowupAuto.id,
    conversationId: 'conv_multi_cancel',
    actionId: 'act_2',
    jobType: 'inactive_followup',
    scheduledAt: '2026-09-10T12:05:00.000Z',
  });

  const cancelledMulti = await InactiveFollowupEngine.cancelPendingFollowups('conv_multi_cancel', 'Teste múltiplo');
  const jobACancelled = await jobRepo.getJobById(jobA.id);
  const jobBCancelled = await jobRepo.getJobById(jobB.id);
  assert(
    cancelledMulti.length === 2 && jobACancelled?.status === 'cancelled' && jobBCancelled?.status === 'cancelled',
    21,
    'Múltiplos jobs pendentes para a mesma conversa são cancelados atomicamente'
  );

  // Test 22: Job cancelado NÃO é executado pelo DurableScheduler nem pelo worker
  // Advance time past scheduled_at and run worker
  const dueResult = await processDueAutomationJobs({
    now: new Date('2026-09-10T12:35:00.000Z'),
  });
  const jobACheck = await jobRepo.getJobById(jobA.id);
  assert(
    jobACheck?.status === 'cancelled' && jobACheck.attempts === 0,
    22,
    'Job cancelado NÃO é executado pelo DurableScheduler nem pelo worker'
  );

  // Test 23: Mensagem do bot não cancela job pendente de follow-up
  // Setup a pending follow-up job
  const pendingJobBeforeBot = await jobRepo.createJob({
    automationId: sampleFollowupAuto.id,
    conversationId: sampleConv.id,
    actionId: sampleFollowupAuto.actions[0].id,
    jobType: 'inactive_followup',
    scheduledAt: '2026-09-10T13:00:00.000Z',
  });
  // Simulate bot sending a message
  await ruleEngine.processEvent({
    conversationId: sampleConv.id,
    channel: 'whatsapp',
    messageId: 'msg_bot_outbound_test',
    sender: 'bot',
    content: 'Mensagem informativa do bot',
    contentType: 'text',
    timestamp: '2026-09-10T12:40:00.000Z',
  });
  const pendingJobAfterBot = await jobRepo.getJobById(pendingJobBeforeBot.id);
  assert(
    pendingJobAfterBot?.status === 'pending',
    23,
    'Mensagem do bot não cancela job pendente de follow-up'
  );

  // ---------------------------------------------------------------------------
  // PARTE 5: Revalidação Pré-Execução (Momento da Execução) (Testes 24 a 29)
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}--- PARTE 5: Revalidação Pré-Execução (Momento da Execução) (Testes 24 a 29) ---${colors.reset}`);

  // Test 24: Aborta e cancela job se a conversa vinculada não existir mais no banco
  const jobMissingConv = await jobRepo.createJob({
    automationId: sampleFollowupAuto.id,
    conversationId: 'conv_non_existent_999',
    actionId: sampleFollowupAuto.actions[0].id,
    jobType: 'inactive_followup',
    scheduledAt: '2026-09-10T10:00:00.000Z',
    payload: {
      referenceMessageId: 'msg_999',
      referenceMessageTimestamp: '2026-09-10T09:30:00.000Z',
      inactivityMinutes: 30,
    },
  });
  const revalMissingConv = await InactiveFollowupEngine.revalidateFollowupJob(jobMissingConv, {
    now: new Date('2026-09-10T10:01:00.000Z'),
  });
  const jobMissingConvUpdated = await jobRepo.getJobById(jobMissingConv.id);
  assert(
    revalMissingConv.valid === false && jobMissingConvUpdated?.status === 'cancelled',
    24,
    'Aborta e cancela job se a conversa vinculada não existir mais no banco'
  );

  // Test 25: Aborta e cancela job se a automação tiver sido desativada (enabled=false) antes da execução
  const disabledAuto: Automation = {
    ...sampleFollowupAuto,
    id: 'auto_followup_disabled',
    enabled: false,
  };
  await repositoryManager.automation.createAutomation(disabledAuto);
  const jobDisabledAuto = await jobRepo.createJob({
    automationId: 'auto_followup_disabled',
    conversationId: sampleConv.id,
    actionId: sampleFollowupAuto.actions[0].id,
    jobType: 'inactive_followup',
    scheduledAt: '2026-09-10T10:00:00.000Z',
    payload: {
      referenceMessageId: 'msg_1',
      referenceMessageTimestamp: '2026-09-10T09:30:00.000Z',
      inactivityMinutes: 30,
    },
  });
  const revalDisabled = await InactiveFollowupEngine.revalidateFollowupJob(jobDisabledAuto, {
    now: new Date('2026-09-10T10:01:00.000Z'),
  });
  const jobDisabledUpdated = await jobRepo.getJobById(jobDisabledAuto.id);
  assert(
    revalDisabled.valid === false && jobDisabledUpdated?.status === 'cancelled',
    25,
    'Aborta e cancela job se a automação tiver sido desativada (enabled=false) antes da execução'
  );

  // Test 26: Aborta e cancela job se a ação tiver sido removida da automação
  const jobMissingAction = await jobRepo.createJob({
    automationId: sampleFollowupAuto.id,
    conversationId: sampleConv.id,
    actionId: 'act_action_deleted_from_auto',
    jobType: 'inactive_followup',
    scheduledAt: '2026-09-10T10:00:00.000Z',
    payload: {
      referenceMessageId: 'msg_1',
      referenceMessageTimestamp: '2026-09-10T09:30:00.000Z',
      inactivityMinutes: 30,
    },
  });
  const revalMissingAction = await InactiveFollowupEngine.revalidateFollowupJob(jobMissingAction, {
    now: new Date('2026-09-10T10:01:00.000Z'),
  });
  const jobMissingActionUpdated = await jobRepo.getJobById(jobMissingAction.id);
  assert(
    revalMissingAction.valid === false && jobMissingActionUpdated?.status === 'cancelled',
    26,
    'Aborta e cancela job se a ação tiver sido removida da automação'
  );

  // Test 27: Aborta e cancela job se o gatilho da automação não for mais inactive_followup
  const modifiedTriggerAuto: Automation = {
    ...sampleFollowupAuto,
    id: 'auto_modified_trigger',
    trigger: {
      type: 'keyword_direct',
      name: 'Alterado',
      description: '',
      config: { keywords: ['teste'] },
    },
  };
  await repositoryManager.automation.createAutomation(modifiedTriggerAuto);
  const jobModifiedTrigger = await jobRepo.createJob({
    automationId: 'auto_modified_trigger',
    conversationId: sampleConv.id,
    actionId: sampleFollowupAuto.actions[0].id,
    jobType: 'inactive_followup',
    scheduledAt: '2026-09-10T10:00:00.000Z',
    payload: {
      referenceMessageId: 'msg_1',
      referenceMessageTimestamp: '2026-09-10T09:30:00.000Z',
      inactivityMinutes: 30,
    },
  });
  const revalModifiedTrigger = await InactiveFollowupEngine.revalidateFollowupJob(jobModifiedTrigger, {
    now: new Date('2026-09-10T10:01:00.000Z'),
  });
  const jobModifiedTriggerUpdated = await jobRepo.getJobById(jobModifiedTrigger.id);
  assert(
    revalModifiedTrigger.valid === false && jobModifiedTriggerUpdated?.status === 'cancelled',
    27,
    'Aborta e cancela job se o gatilho da automação não for mais inactive_followup'
  );

  // Test 28: Aborta e cancela job se o cliente enviou mensagem intermediária antes da execução
  // Add a new message from customer in conversation
  await repositoryManager.conversation.createMessage({
    id: 'msg_intermediate_reply_99',
    conversationId: sampleConv.id,
    sender: 'contact',
    channel: 'whatsapp',
    content: 'Opa, voltei!',
    contentType: 'text',
    createdAt: '2026-09-10T10:15:00.000Z',
  });
  const jobWithOlderRef = await jobRepo.createJob({
    automationId: sampleFollowupAuto.id,
    conversationId: sampleConv.id,
    actionId: sampleFollowupAuto.actions[0].id,
    jobType: 'inactive_followup',
    scheduledAt: '2026-09-10T10:30:00.000Z',
    payload: {
      referenceMessageId: 'msg_old_reference_1',
      referenceMessageTimestamp: '2026-09-10T10:00:00.000Z',
      inactivityMinutes: 30,
    },
  });
  const revalIntermediate = await InactiveFollowupEngine.revalidateFollowupJob(jobWithOlderRef, {
    now: new Date('2026-09-10T10:35:00.000Z'),
  });
  const jobIntermediateUpdated = await jobRepo.getJobById(jobWithOlderRef.id);
  assert(
    revalIntermediate.valid === false &&
      revalIntermediate.reason?.includes('Cliente respondeu') &&
      jobIntermediateUpdated?.status === 'cancelled',
    28,
    'Aborta e cancela job se o cliente enviou mensagem intermediária antes da execução'
  );

  // Test 29: Rejeita execução antecipada se a janela de inatividade ainda não tiver decorrido
  const jobEarlyCheck = await jobRepo.createJob({
    automationId: sampleFollowupAuto.id,
    conversationId: sampleConv.id,
    actionId: sampleFollowupAuto.actions[0].id,
    jobType: 'inactive_followup',
    scheduledAt: '2026-09-10T14:30:00.000Z',
    payload: {
      referenceMessageId: 'msg_intermediate_reply_99',
      referenceMessageTimestamp: '2026-09-10T14:00:00.000Z',
      inactivityMinutes: 30,
    },
  });
  // Test at 14:15:00 (only 15m elapsed, 30m required)
  const revalEarly = await InactiveFollowupEngine.revalidateFollowupJob(jobEarlyCheck, {
    now: new Date('2026-09-10T14:15:00.000Z'),
  });
  assert(
    revalEarly.valid === false && revalEarly.shouldCancel === false,
    29,
    'Rejeita execução antecipada se a janela de inatividade ainda não tiver decorrido (permanece elegível sem cancelamento indevido)'
  );

  // ---------------------------------------------------------------------------
  // PARTE 6: Execução Segura & Anti-Loop (Testes 30 a 33)
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}--- PARTE 6: Execução Segura & Anti-Loop (Testes 30 a 33) ---${colors.reset}`);

  // Test 30: Executa outbound seguro via ActionExecutor e AutomationOutboundDispatcher quando janela é cumprida
  // Set latest message for sampleConv matching job payload
  const validRefTime = '2026-09-10T15:00:00.000Z';
  await repositoryManager.conversation.createMessage({
    id: 'msg_valid_ref_30',
    conversationId: sampleConv.id,
    sender: 'contact',
    channel: 'whatsapp',
    content: 'Preciso de orçamento',
    contentType: 'text',
    createdAt: validRefTime,
  });

  const dueExecutionTime = '2026-09-10T15:30:00.000Z';
  const readyJob = await jobRepo.createJob({
    automationId: sampleFollowupAuto.id,
    conversationId: sampleConv.id,
    actionId: sampleFollowupAuto.actions[0].id,
    jobType: 'inactive_followup',
    scheduledAt: dueExecutionTime,
    payload: {
      referenceMessageId: 'msg_valid_ref_30',
      referenceMessageTimestamp: validRefTime,
      inactivityMinutes: 30,
    },
  });

  const execRes = await InactiveFollowupEngine.executeDueFollowup(readyJob, {
    now: new Date('2026-09-10T15:31:00.000Z'),
    isScheduledExecution: true,
  });
  const readyJobCompleted = await jobRepo.getJobById(readyJob.id);
  assert(
    execRes.success === true && readyJobCompleted?.status === 'completed',
    30,
    'Executa outbound seguro via ActionExecutor e AutomationOutboundDispatcher quando janela é cumprida'
  );

  // Test 31: Disparo utiliza estritamente o texto autoritativo cadastrado no banco (anti-injeção)
  // Check the message created in conversation
  const convMsgs = await repositoryManager.conversation.getMessages(sampleConv.id);
  const botFollowupMsg = convMsgs.find(m => m.sender === 'bot' && m.content === sampleFollowupAuto.actions[0].config.messageText);
  assert(
    Boolean(botFollowupMsg && botFollowupMsg.content === sampleFollowupAuto.actions[0].config.messageText),
    31,
    'Disparo utiliza estritamente o texto autoritativo cadastrado no banco (anti-injeção)'
  );

  // Test 32: Disparo para canal não certificado (Instagram/Messenger) é bloqueado com segurança
  const igAuto: Automation = {
    ...sampleFollowupAuto,
    id: 'auto_ig_followup',
    channel: 'instagram',
    actions: [
      {
        id: 'act_ig_followup',
        type: 'send_dm',
        name: 'IG DM',
        description: '',
        config: { messageText: 'Follow up IG' },
      },
    ],
  };
  await repositoryManager.automation.createAutomation(igAuto);

  // Retrieve Instagram conversation
  const igConv = (await repositoryManager.conversation.getConversationById('conv_demo_01'))!;
  await repositoryManager.conversation.createMessage({
    id: 'msg_ig_ref_32',
    conversationId: igConv.id,
    sender: 'contact',
    channel: 'instagram',
    content: 'Dúvida no insta',
    contentType: 'text',
    createdAt: '2026-09-10T16:00:00.000Z',
  });

  const igJob = await jobRepo.createJob({
    automationId: 'auto_ig_followup',
    conversationId: igConv.id,
    actionId: 'act_ig_followup',
    jobType: 'inactive_followup',
    scheduledAt: '2026-09-10T16:30:00.000Z',
    payload: {
      referenceMessageId: 'msg_ig_ref_32',
      referenceMessageTimestamp: '2026-09-10T16:00:00.000Z',
      inactivityMinutes: 30,
      channel: 'instagram',
    },
  });

  const igExecRes = await InactiveFollowupEngine.executeDueFollowup(igJob, {
    now: new Date('2026-09-10T16:35:00.000Z'),
  });
  assert(
    igExecRes.success === false && igExecRes.error?.includes('instagram não certificado'),
    32,
    'Disparo para canal não certificado (Instagram/Messenger) é bloqueado com segurança'
  );

  // Test 33: A mensagem enviada pelo follow-up (sender='bot') NÃO gera novo follow-up (anti-loop garantido)
  const botGeneratedEvent: RuleEngineEvent = {
    conversationId: sampleConv.id,
    channel: 'whatsapp',
    messageId: botFollowupMsg?.id || 'msg_bot_followup_auto',
    sender: 'bot',
    content: botFollowupMsg?.content || 'Olá! Notamos que não recebemos mais sua resposta.',
    contentType: 'text',
    timestamp: new Date().toISOString(),
    metadata: {
      isAutomated: true,
      automationId: sampleFollowupAuto.id,
    },
  };

  const loopRes = await ruleEngine.processEvent(botGeneratedEvent);
  assert(
    loopRes.status === 'IGNORED_SENDER' && loopRes.matchedAutomations.length === 0,
    33,
    "A mensagem enviada pelo follow-up (sender='bot') NÃO gera novo follow-up (anti-loop garantido)"
  );

  // ---------------------------------------------------------------------------
  // RESULTADO FINAL
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bold}${passedCount === totalCount ? colors.green : colors.red}RESULTADO FINAL: ${passedCount}/${totalCount} TESTES APROVADOS COM SUCESSO.${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================\n${colors.reset}`);

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Falha fatal na execução da suite de testes de follow-up:', err);
  process.exit(1);
});
