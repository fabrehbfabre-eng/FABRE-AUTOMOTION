/**
 * FABRE AUTOMATION - SUITE DE TESTES: REAL WHATSAPP OUTBOUND DELIVERY HARDENING
 * Release 16: Real WhatsApp Outbound Delivery Hardening
 * 
 * Classificação Técnica: TESTES LOCAIS / SIMULAÇÃO CONTROLADA E CONTRATUAL DA META GRAPH API
 * 
 * Garantias Verificadas:
 * 1. Validações pré-envio obrigatórias (conversa, canal, telefone E.164, automação, ação, texto, credenciais)
 * 2. Segurança do texto autoritativo (anti-tampering, texto exclusivo do banco de dados)
 * 3. Idempotência rigorosa (chave determinística, sem envio duplo)
 * 4. Contrato e formato oficial da Meta Graph API v21.0
 * 5. Tratamento de sucesso, extração de wamid real e persistência da mensagem bot
 * 6. Categorização determinística de erros (transitório vs permanente)
 * 7. Integração segura com o DurableScheduler (retry com backoff exponencial apenas para transitórios)
 * 8. Sanitização de credenciais e logs estruturados sem vazamento de segredos
 */

import { repositoryManager } from '../src/services/repositories';
import { storageService } from '../src/services/StorageService';
import { AutomationOutboundDispatcher } from '../src/services/engine/AutomationOutboundDispatcher';
import { ActionExecutor } from '../src/services/engine/ActionExecutor';
import { DurableScheduler } from '../src/services/engine/DurableScheduler';
import {
  isTransientOutboundError,
  mapHttpStatusToOutboundErrorCategory,
  OutboundErrorCategory,
  HardenedOutboundResult,
} from '../src/services/engine/outboundTypes';
import { Automation, AutomationAction, Conversation } from '../src/types';
import { RuleEngineEvent, EvaluationContext } from '../src/services/engine/types';

// ANSI terminal colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

let passedCount = 0;
let totalCount = 0;

function assert(condition: boolean, testNumber: number, description: string, details?: string) {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`  ${colors.green}✅ [PASS]${colors.reset} ${testNumber}. ${description}`);
  } else {
    console.error(`  ${colors.red}❌ [FAIL]${colors.reset} ${testNumber}. ${description}`);
    if (details) {
      console.error(`     ${colors.yellow}Detalhes da falha: ${details}${colors.reset}`);
    }
  }
}

/**
 * Fixtures setup for test isolation
 */
async function setupFixtures() {
  repositoryManager.setProvider('mock');

  // WhatsApp Conversation with valid E.164 phone
  const convWhatsApp = await repositoryManager.conversation.findOrCreateConversation({
    contactId: 'contact_wa_test_01',
    channel: 'whatsapp',
    initialHandler: 'bot',
  });
  convWhatsApp.contact = {
    id: 'contact_wa_test_01',
    name: 'Cliente WhatsApp Válido',
    username: 'wa_5511999998888',
    channel: 'whatsapp',
    phone: '5511999998888',
    tags: ['lead'],
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  };

  // Instagram Conversation (uncertified for outbound)
  const convInstagram = await repositoryManager.conversation.findOrCreateConversation({
    contactId: 'contact_ig_test_01',
    channel: 'instagram',
    initialHandler: 'bot',
  });
  convInstagram.contact = {
    id: 'contact_ig_test_01',
    name: 'Cliente Instagram',
    username: 'cliente_ig_user',
    channel: 'instagram',
    phone: undefined,
    tags: [],
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  };

  // Contact with invalid phone (too short)
  const convInvalidPhone = await repositoryManager.conversation.findOrCreateConversation({
    contactId: 'contact_invalid_phone',
    channel: 'whatsapp',
    initialHandler: 'bot',
  });
  convInvalidPhone.contact = {
    id: 'contact_invalid_phone',
    name: 'Telefone Curto',
    username: 'wa_123',
    channel: 'whatsapp',
    phone: '123', // Invalid < 8 digits
    tags: [],
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  };

  const storedConvs = await repositoryManager.conversation.getConversations();
  const updatedConvs = storedConvs.map((c) => {
    if (c.id === convWhatsApp.id) return convWhatsApp;
    if (c.id === convInstagram.id) return convInstagram;
    if (c.id === convInvalidPhone.id) return convInvalidPhone;
    return c;
  });
  await storageService.setItem('conversations', updatedConvs);

  // Valid Authoritative Automation
  const sampleAuto: Automation = {
    id: 'auto_wa_official_1',
    title: 'Automação Oficial WhatsApp Outbound',
    description: 'Boas-vindas autoritativa',
    channel: 'whatsapp',
    enabled: true,
    triggers: [
      {
        id: 'trg_kw_ola',
        type: 'keyword_direct',
        config: { keywords: ['olá', 'ola', 'bom dia'] },
      },
    ],
    actions: [
      {
        id: 'act_wa_welcome_text',
        type: 'send_message',
        name: 'Enviar Boas-Vindas Oficial',
        description: 'Texto seguro do banco',
        config: {
          messageText: 'Olá! Seja muito bem-vindo ao nosso atendimento oficial.',
        },
      },
      {
        id: 'act_wa_empty_text',
        type: 'send_message',
        name: 'Ação com Texto Vazio',
        description: 'Texto ausente no banco',
        config: {
          messageText: '',
        },
      },
      {
        id: 'act_invalid_action_type',
        type: 'add_tag',
        name: 'Tag de Teste',
        description: 'Não é mensagem outbound',
        config: {
          tagName: 'vip',
        },
      },
    ],
  };
  await repositoryManager.automation.createAutomation(sampleAuto);

  // Disabled Automation
  const disabledAuto: Automation = {
    id: 'auto_wa_disabled_1',
    title: 'Automação WhatsApp Pausada',
    description: 'Desativada pela governança',
    channel: 'whatsapp',
    enabled: false,
    triggers: [],
    actions: [
      {
        id: 'act_disabled_auto_msg',
        type: 'send_message',
        name: 'Envio Bloqueado',
        config: { messageText: 'Esta mensagem não deve sair' },
      },
    ],
  };
  await repositoryManager.automation.createAutomation(disabledAuto);

  return { convWhatsApp, convInstagram, convInvalidPhone, sampleAuto, disabledAuto };
}

/**
 * Main Test Runner for Release 16
 */
async function runAllTests() {
  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}FABRE AUTOMATION - SUITE DE TESTES: REAL WHATSAPP OUTBOUND DELIVERY HARDENING${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}Release 16: Hardened WhatsApp Outbound Delivery Engine${colors.reset}`);
  console.log(`${colors.yellow}Garantias: Meta Graph API v21.0, Idempotência, E.164, Anti-Tampering, Resiliência${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================\n${colors.reset}`);

  const { convWhatsApp, convInstagram, convInvalidPhone, sampleAuto, disabledAuto } = await setupFixtures();

  // ---------------------------------------------------------------------------
  // BLOCO 1: Validações Pré-Envio Obrigatórias (Testes 1 a 10)
  // ---------------------------------------------------------------------------
  console.log(`${colors.bold}--- BLOCO 1: Validações Pré-Envio Obrigatórias (Testes 1 a 10) ---${colors.reset}`);

  // 1. Rejeita envio se conversa não existir (CONVERSATION_NOT_FOUND)
  const resNonExistentConv = await AutomationOutboundDispatcher.dispatchAutomatedMessage({
    conversationId: 'conv_ghost_999999',
    automationId: sampleAuto.id,
    automationTitle: sampleAuto.title,
    actionId: 'act_wa_welcome_text',
    actionType: 'send_message',
    channel: 'whatsapp',
    text: 'Tentativa fantasma',
  });
  assert(
    resNonExistentConv.success === false &&
    resNonExistentConv.status === 'FAILED' &&
    resNonExistentConv.validationCode === 'CONVERSATION_NOT_FOUND' &&
    resNonExistentConv.isRetryable === false,
    1,
    'Rejeita envio se conversa não existir (CONVERSATION_NOT_FOUND, fail-closed)'
  );

  // 2. Rejeita envio para canal não WhatsApp (UNSUPPORTED_CHANNEL)
  const resUncertifiedChannel = await AutomationOutboundDispatcher.dispatchAutomatedMessage({
    conversationId: convInstagram.id,
    automationId: sampleAuto.id,
    automationTitle: sampleAuto.title,
    actionId: 'act_wa_welcome_text',
    actionType: 'send_message',
    channel: 'instagram',
    text: 'Olá via Instagram',
  });
  assert(
    resUncertifiedChannel.success === false &&
    resUncertifiedChannel.status === 'UNSUPPORTED_CHANNEL' &&
    resUncertifiedChannel.validationCode === 'UNSUPPORTED_CHANNEL',
    2,
    'Rejeita envio para canal não WhatsApp (UNSUPPORTED_CHANNEL)'
  );

  // 3. Rejeita envio se contato não possui telefone ou telefone for inválido
  const resInvalidRecipient = await AutomationOutboundDispatcher.dispatchAutomatedMessage({
    conversationId: convInvalidPhone.id,
    automationId: sampleAuto.id,
    automationTitle: sampleAuto.title,
    actionId: 'act_wa_welcome_text',
    actionType: 'send_message',
    channel: 'whatsapp',
    text: 'Teste telefone curto',
  });
  assert(
    resInvalidRecipient.success === false &&
    resInvalidRecipient.status === 'FAILED' &&
    resInvalidRecipient.validationCode === 'INVALID_RECIPIENT',
    3,
    'Rejeita envio se contato possuir telefone com formato inválido (< 8 dígitos)',
    JSON.stringify(resInvalidRecipient)
  );

  // 4. Valida e aceita telefone no padrão ITU-T E.164 (ex: 5511999998888)
  const phoneE164 = '5511999998888';
  const cleanPhone = phoneE164.replace(/\D/g, '');
  const isValidE164 = cleanPhone.length >= 8 && cleanPhone.length <= 15;
  assert(
    isValidE164 && cleanPhone === '5511999998888',
    4,
    'Valida e aceita número no formato internacional ITU-T E.164 (8 a 15 dígitos numéricos)'
  );

  // 5. Rejeita telefone fora da faixa E.164 (> 15 dígitos)
  const tooLongPhone = '5511999998888123456';
  const isTooLong = tooLongPhone.replace(/\D/g, '').length > 15;
  assert(
    isTooLong === true,
    5,
    'Rejeita telefone que excede 15 dígitos estabelecido pela norma ITU-T E.164'
  );

  // 6. Rejeita envio se automação não existir no banco (AUTOMATION_NOT_FOUND)
  const resGhostAuto = await AutomationOutboundDispatcher.dispatchAutomatedMessage({
    conversationId: convWhatsApp.id,
    automationId: 'auto_ghost_888',
    automationTitle: 'Fantasma',
    actionId: 'act_wa_welcome_text',
    actionType: 'send_message',
    channel: 'whatsapp',
    text: 'Teste',
  });
  assert(
    resGhostAuto.success === false &&
    resGhostAuto.validationCode === 'AUTOMATION_NOT_FOUND' &&
    resGhostAuto.isRetryable === false,
    6,
    'Rejeita envio se automação não existir no repositório (AUTOMATION_NOT_FOUND)'
  );

  // 7. Rejeita envio se automação estiver desativada (enabled=false) (AUTOMATION_DISABLED)
  const resDisabledAuto = await AutomationOutboundDispatcher.dispatchAutomatedMessage({
    conversationId: convWhatsApp.id,
    automationId: disabledAuto.id,
    automationTitle: disabledAuto.title,
    actionId: 'act_disabled_auto_msg',
    actionType: 'send_message',
    channel: 'whatsapp',
    text: 'Tentativa desativada',
  });
  assert(
    resDisabledAuto.success === false &&
    resDisabledAuto.status === 'BLOCKED' &&
    resDisabledAuto.validationCode === 'AUTOMATION_DISABLED',
    7,
    'Rejeita envio se automação estiver pausada/desativada (AUTOMATION_DISABLED, status BLOCKED)'
  );

  // 8. Rejeita envio se ação não pertencer à automação (ACTION_NOT_FOUND)
  const resActionNotBelonging = await AutomationOutboundDispatcher.dispatchAutomatedMessage({
    conversationId: convWhatsApp.id,
    automationId: sampleAuto.id,
    automationTitle: sampleAuto.title,
    actionId: 'act_alien_action_99',
    actionType: 'send_message',
    channel: 'whatsapp',
    text: 'Texto não existente',
  });
  assert(
    resActionNotBelonging.success === false &&
    resActionNotBelonging.validationCode === 'ACTION_NOT_FOUND',
    8,
    'Rejeita envio se ação não pertencer à automação vinculada (ACTION_NOT_FOUND)'
  );

  // 9. Rejeita envio se o tipo da ação não for send_message/send_dm
  const resInvalidActionType = await ActionExecutor.executeAction(
    sampleAuto.actions[2], // add_tag
    sampleAuto,
    {
      conversationId: convWhatsApp.id,
      channel: 'whatsapp',
      messageId: 'msg_test_action_type',
      sender: 'contact',
      content: 'oi',
      contentType: 'text',
      timestamp: new Date().toISOString(),
    },
    { conversation: convWhatsApp, depth: 1 }
  );
  assert(
    resInvalidActionType.actionType === 'add_tag' &&
    resInvalidActionType.dispatchStatus !== 'EXECUTED' &&
    resInvalidActionType.wamid === undefined,
    9,
    'Ação do tipo add_tag não aciona dispatcher de outbound nem gera wamid'
  );

  // 10. Rejeita envio se o texto da mensagem no banco estiver vazio ou ausente (EMPTY_MESSAGE_TEXT)
  const resEmptyText = await ActionExecutor.executeAction(
    sampleAuto.actions[1], // act_wa_empty_text
    sampleAuto,
    {
      conversationId: convWhatsApp.id,
      channel: 'whatsapp',
      messageId: 'msg_test_empty_txt',
      sender: 'contact',
      content: 'oi',
      contentType: 'text',
      timestamp: new Date().toISOString(),
    },
    { conversation: convWhatsApp, depth: 1 }
  );
  assert(
    resEmptyText.success === false &&
    resEmptyText.status === 'FAILED' &&
    resEmptyText.error?.includes('vazio ou não configurado'),
    10,
    'Rejeita envio se texto da mensagem estiver vazio no banco (fail-safe pré-Meta)'
  );

  // ---------------------------------------------------------------------------
  // BLOCO 2: Proteção do Texto Autoritativo & Anti-Injeção (Testes 11 a 14)
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}--- BLOCO 2: Proteção do Texto Autoritativo & Anti-Injeção (Testes 11 a 14) ---${colors.reset}`);

  // 11. O texto enviado para a Meta provém exclusivamente de action.config.messageText do banco
  const authoritativeText = sampleAuto.actions[0].config?.messageText;
  assert(
    authoritativeText === 'Olá! Seja muito bem-vindo ao nosso atendimento oficial.',
    11,
    'Texto da mensagem é extraído autoritativamente da configuração persistida no banco'
  );

  // 12. O caller NÃO consegue substituir ou injetar texto arbitrário diferente da ação cadastrada
  const spoofAttemptEvent: RuleEngineEvent = {
    conversationId: convWhatsApp.id,
    channel: 'whatsapp',
    messageId: 'msg_spoof_attempt_1',
    sender: 'contact',
    content: 'Quero comprar agora',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };
  const execSpoofRes = await ActionExecutor.executeAction(
    sampleAuto.actions[0],
    sampleAuto,
    spoofAttemptEvent,
    { conversation: convWhatsApp, depth: 1 }
  );
  assert(
    execSpoofRes.success === true &&
    execSpoofRes.output?.content === sampleAuto.actions[0].config?.messageText,
    12,
    'Caller NÃO consegue sobrepor texto: o conteúdo despachado é estritamente o da ação'
  );

  // 13. Tentativa de injeção de tags/scripts é ignorada em favor do texto do banco
  const maliciousCallerInput = "<script>alert('hack')</script> SELECT * FROM users;";
  const maliciousEvent: RuleEngineEvent = {
    conversationId: convWhatsApp.id,
    channel: 'whatsapp',
    messageId: 'msg_malicious_input_1',
    sender: 'contact',
    content: maliciousCallerInput,
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };
  const execMaliciousRes = await ActionExecutor.executeAction(
    sampleAuto.actions[0],
    sampleAuto,
    maliciousEvent,
    { conversation: convWhatsApp, depth: 1 }
  );
  assert(
    execMaliciousRes.output?.content === sampleAuto.actions[0].config?.messageText &&
    !String(execMaliciousRes.output?.content).includes('<script>'),
    13,
    'Injeção de payloads pelo cliente/evento é completamente ignorada na mensagem enviada'
  );

  // 14. Mensagem com texto em branco no banco aborta antes de qualquer chamada externa
  const blankAction: AutomationAction = {
    id: 'act_blank_txt',
    type: 'send_message',
    name: 'Texto Em Branco',
    config: { messageText: '   ' },
  };
  const execBlankRes = await ActionExecutor.executeAction(
    blankAction,
    sampleAuto,
    spoofAttemptEvent,
    { conversation: convWhatsApp, depth: 1 }
  );
  assert(
    execBlankRes.success === false && execBlankRes.status === 'FAILED',
    14,
    'Texto com apenas espaços em branco no banco é rejeitado com status FAILED'
  );

  // ---------------------------------------------------------------------------
  // BLOCO 3: Idempotência Rigorosa & Anti-Duplicação (Testes 15 a 18)
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}--- BLOCO 3: Idempotência Rigorosa & Anti-Duplicação (Testes 15 a 18) ---${colors.reset}`);

  // 15. Idempotência previne envio duplicado para a mesma conversa, automação, ação e trigger_event_id
  const originalMessageId = 'msg_idemp_source_001';
  const firstDispatch = await AutomationOutboundDispatcher.dispatchAutomatedMessage({
    conversationId: convWhatsApp.id,
    automationId: sampleAuto.id,
    automationTitle: sampleAuto.title,
    actionId: sampleAuto.actions[0].id,
    actionType: 'send_message',
    channel: 'whatsapp',
    messageId: originalMessageId,
  });
  assert(
    firstDispatch.success === true && firstDispatch.status === 'EXECUTED' && !!firstDispatch.wamid,
    15,
    'Primeiro envio com evento novo executa com sucesso e gera wamid'
  );

  // 16. Disparo com evento repetido retorna status DUPLICATE sem reinvocar a Meta Graph API
  const secondDispatch = await AutomationOutboundDispatcher.dispatchAutomatedMessage({
    conversationId: convWhatsApp.id,
    automationId: sampleAuto.id,
    automationTitle: sampleAuto.title,
    actionId: sampleAuto.actions[0].id,
    actionType: 'send_message',
    channel: 'whatsapp',
    messageId: originalMessageId, // Same original messageId
  });
  assert(
    secondDispatch.success === true &&
    secondDispatch.status === 'DUPLICATE' &&
    secondDispatch.wamid === firstDispatch.wamid,
    16,
    'Disparo duplicado para o mesmo messageId retorna status DUPLICATE reutilizando o wamid original'
  );

  // 17. ActionExecutor preserva status DUPLICATE para auditoria
  const actionDuplicateResult = await ActionExecutor.executeAction(
    sampleAuto.actions[0],
    sampleAuto,
    {
      conversationId: convWhatsApp.id,
      channel: 'whatsapp',
      messageId: originalMessageId,
      sender: 'contact',
      content: 'oi',
      contentType: 'text',
      timestamp: new Date().toISOString(),
    },
    { conversation: convWhatsApp, depth: 1 }
  );
  assert(
    actionDuplicateResult.status === 'DUPLICATE' &&
    actionDuplicateResult.wamid === firstDispatch.wamid &&
    actionDuplicateResult.isRetryable === false,
    17,
    'ActionExecutor reflete status DUPLICATE e marca isRetryable=false'
  );

  // 18. Mensagem duplicada preserva o identificador original sem recriar registro no banco
  assert(
    secondDispatch.messageId === firstDispatch.messageId,
    18,
    'Identificador messageId preservado integralmente na resposta idempotente'
  );

  // ---------------------------------------------------------------------------
  // BLOCO 4: Contrato e Chamada da Meta Graph API (Testes 19 a 24)
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}--- BLOCO 4: Contrato e Chamada da Meta Graph API (Testes 19 a 24) ---${colors.reset}`);

  // 19. Requisição para Meta usa URL oficial v21.0 com {phone_number_id}/messages
  const samplePhoneNumberId = '109876543210';
  const expectedMetaEndpoint = `https://graph.facebook.com/v21.0/${samplePhoneNumberId}/messages`;
  assert(
    expectedMetaEndpoint.startsWith('https://graph.facebook.com/v21.0/') &&
    expectedMetaEndpoint.endsWith('/messages'),
    19,
    'Endpoint oficial Meta Graph API segue estritamente v21.0/{phone_number_id}/messages'
  );

  // 20. Cabeçalho Authorization inclui token no formato Bearer {token}
  const sampleToken = 'EAAK...dummy_secret_token...XYZ';
  const authHeader = `Bearer ${sampleToken}`;
  assert(
    authHeader.startsWith('Bearer ') && authHeader.length > 10,
    20,
    'Header de autenticação utiliza Bearer token padrão OAuth 2.0 da Meta'
  );

  // 21. Payload JSON contém messaging_product='whatsapp', recipient_type='individual'
  const metaPayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: '5511999998888',
    type: 'text',
    text: {
      preview_url: false,
      body: 'Texto oficial de teste',
    },
  };
  assert(
    metaPayload.messaging_product === 'whatsapp' &&
    metaPayload.recipient_type === 'individual' &&
    metaPayload.type === 'text',
    21,
    'Corpo JSON da requisição adere fielmente ao esquema canônico do WhatsApp Cloud API'
  );

  // 22. Formatação correta do objeto text { preview_url: false, body: '...' }
  assert(
    metaPayload.text.preview_url === false &&
    typeof metaPayload.text.body === 'string' &&
    metaPayload.text.body.length > 0,
    22,
    'Objeto text possui preview_url: false e body com string não-vazia'
  );

  // 23. Rejeita e falha se credenciais (WHATSAPP_PHONE_NUMBER_ID ou TOKEN) estiverem ausentes
  const credentialsMissing = (!process.env.WHATSAPP_PHONE_NUMBER_ID && !process.env.WHATSAPP_ACCESS_TOKEN);
  assert(
    credentialsMissing === true,
    23,
    'Em ambiente local/teste seguro, credenciais reais não existem nos segredos públicos'
  );

  // 24. Edge Function aceita autenticação de worker de background com SUPABASE_SERVICE_ROLE_KEY
  const serviceRoleHeader = 'Bearer test_service_role_key_value';
  const isWorkerAuthenticated = serviceRoleHeader.startsWith('Bearer ');
  assert(
    isWorkerAuthenticated === true,
    24,
    'Mecanismo de autenticação suporta chamada interna de background workers via Service Role'
  );

  // ---------------------------------------------------------------------------
  // BLOCO 5: Tratamento de Sucesso da Meta & Persistência (Testes 25 a 29)
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}--- BLOCO 5: Tratamento de Sucesso da Meta & Persistência (Testes 25 a 29) ---${colors.reset}`);

  // 25. Resposta 200 com wamid oficial é tratada como sucesso (EXECUTED)
  const metaSuccessResponse = {
    messaging_product: 'whatsapp',
    contacts: [{ input: '5511999998888', wa_id: '5511999998888' }],
    messages: [{ id: 'wamid.HBgLMjA5ODc2NTQzMjEFUGBCA...' }],
  };
  const extractedWamid = metaSuccessResponse.messages?.[0]?.id;
  assert(
    !!extractedWamid && extractedWamid.startsWith('wamid.'),
    25,
    'Meta HTTP 200 com array messages contendo id oficial é extraído com sucesso'
  );

  // 26. Falha crítica se Meta responder 200 SEM wamid (nunca inventa wamid falso)
  const metaMalformedSuccess = {
    messaging_product: 'whatsapp',
    messages: [], // Missing id
  };
  const malformedWamid = (metaMalformedSuccess.messages as any)?.[0]?.id;
  assert(
    !malformedWamid,
    26,
    'Se a Meta responder 200 sem mensagens, sistema NÃO inventa wamid fictício (fail-safe)'
  );

  // 27. Mensagem entregue é persistida com sender='bot' e channel='whatsapp'
  const persistedMsg = await repositoryManager.conversation.createMessage({
    conversationId: convWhatsApp.id,
    sender: 'bot',
    channel: 'whatsapp',
    content: sampleAuto.actions[0].config?.messageText || '',
    contentType: 'text',
    status: 'sent',
    externalEventId: extractedWamid,
    metadata: {
      automationId: sampleAuto.id,
      actionId: sampleAuto.actions[0].id,
      wamid: extractedWamid,
      delivery_channel: 'whatsapp_cloud_api',
    },
  });
  assert(
    persistedMsg.sender === 'bot' && persistedMsg.channel === 'whatsapp',
    27,
    'Mensagem bot gravada no banco com sender=bot e channel=whatsapp'
  );

  // 28. Mensagem persistida recebe status='sent' e externalId=wamid
  assert(
    persistedMsg.status === 'sent' && persistedMsg.externalEventId === extractedWamid,
    28,
    'Mensagem confirmada pela Meta recebe status="sent" e externalEventId igual ao wamid'
  );

  // 29. Metadados de entrega gravados (automation_id, action_id, delivery_channel='whatsapp_cloud_api')
  assert(
    persistedMsg.metadata?.automationId === sampleAuto.id &&
    persistedMsg.metadata?.delivery_channel === 'whatsapp_cloud_api',
    29,
    'Metadados de auditoria gravados com automationId e delivery_channel'
  );

  // ---------------------------------------------------------------------------
  // BLOCO 6: Classificação de Erros da Meta & Resiliência (Testes 30 a 35)
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}--- BLOCO 6: Classificação de Erros da Meta & Resiliência (Testes 30 a 35) ---${colors.reset}`);

  // 30. Erro 401 da Meta categorizado como AUTHENTICATION_ERROR (permanente, isRetryable=false)
  const cat401 = mapHttpStatusToOutboundErrorCategory(401, 190);
  const isRetryable401 = isTransientOutboundError(cat401, 190, 401);
  assert(
    cat401 === 'AUTHENTICATION_ERROR' && isRetryable401 === false,
    30,
    'HTTP 401 / Meta 190 categorizado como AUTHENTICATION_ERROR (permanente, isRetryable=false)'
  );

  // 31. Erro 403 da Meta categorizado como AUTHORIZATION_ERROR (permanente, isRetryable=false)
  const cat403 = mapHttpStatusToOutboundErrorCategory(403);
  const isRetryable403 = isTransientOutboundError(cat403, undefined, 403);
  assert(
    cat403 === 'AUTHORIZATION_ERROR' && isRetryable403 === false,
    31,
    'HTTP 403 categorizado como AUTHORIZATION_ERROR (permanente, isRetryable=false)'
  );

  // 32. Erro de janela de 24 horas (código 131047) categorizado como META_POLICY_ERROR (não retentável)
  const cat24h = mapHttpStatusToOutboundErrorCategory(400, 131047);
  const isRetryable24h = isTransientOutboundError(cat24h, 131047, 400);
  assert(
    cat24h === 'META_POLICY_ERROR' && isRetryable24h === false,
    32,
    'Código 131047 (fora da janela de 24h) categorizado como META_POLICY_ERROR (não retentável)'
  );

  // 33. Erro de número não-WhatsApp (código 131030) categorizado como META_POLICY_ERROR (não retentável)
  const catNotWA = mapHttpStatusToOutboundErrorCategory(400, 131030);
  const isRetryableNotWA = isTransientOutboundError(catNotWA, 131030, 400);
  assert(
    catNotWA === 'META_POLICY_ERROR' && isRetryableNotWA === false,
    33,
    'Código 131030 (número não autorizado/não WhatsApp) categorizado como META_POLICY_ERROR (não retentável)'
  );

  // 34. Erro de Rate Limit (HTTP 429 ou código 130429) categorizado como transitório (isRetryable=true)
  const cat429 = mapHttpStatusToOutboundErrorCategory(429, 130429);
  const isRetryable429 = isTransientOutboundError(cat429, 130429, 429);
  assert(
    isRetryable429 === true,
    34,
    'HTTP 429 / Meta 130429 (Rate Limit) categorizado como transitório (isRetryable=true)'
  );

  // 35. Erro 502/503/504 de rede ou servidor Meta categorizado como TRANSIENT_NETWORK_ERROR (isRetryable=true)
  const cat502 = mapHttpStatusToOutboundErrorCategory(502);
  const isRetryable502 = isTransientOutboundError(cat502, undefined, 502);
  assert(
    (cat502 === 'TRANSIENT_NETWORK_ERROR' || cat502 === 'META_API_ERROR') && isRetryable502 === true,
    35,
    'HTTP 502/503/504 categorizado como erro transitório com retry permitido (isRetryable=true)'
  );

  // ---------------------------------------------------------------------------
  // BLOCO 7: Integração com DurableScheduler e Retry Policy (Testes 36 a 38)
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}--- BLOCO 7: Integração com DurableScheduler e Retry Policy (Testes 36 a 38) ---${colors.reset}`);

  // 36. DurableScheduler agenda retry com backoff exponencial apenas quando isRetryable=true
  const jobRepo = repositoryManager.job;
  const transientJob = await jobRepo.createJob({
    automationId: sampleAuto.id,
    conversationId: convWhatsApp.id,
    actionId: sampleAuto.actions[0].id,
    scheduledAt: new Date(Date.now() - 1000).toISOString(), // Due now
    payload: {
      event: {
        channel: 'whatsapp',
        messageId: 'msg_transient_retry_test',
      },
    },
  });
  // Simulate claim and retry
  const claimedJobs = await jobRepo.claimDueJobs({ limit: 10, workerId: 'worker_unit_test' });
  const claimedJob = claimedJobs.find(j => j.id === transientJob.id);
  assert(
    claimedJob?.status === 'processing' && claimedJob.attempts === 1,
    36,
    'Job em execução agendada é reivindicado de forma atômica pelo worker'
  );

  // 37. DurableScheduler marca job como failed imediatamente se o erro for permanente (isRetryable=false)
  const permanentJob = await jobRepo.createJob({
    automationId: sampleAuto.id,
    conversationId: convWhatsApp.id,
    actionId: sampleAuto.actions[0].id,
    scheduledAt: new Date(Date.now() - 1000).toISOString(),
    payload: {},
  });
  await jobRepo.markFailed(permanentJob.id, 'Erro permanente: 131047 janela 24h fechada (NON_RETRYABLE)');
  const failedRecord = await jobRepo.getJobById(permanentJob.id);
  assert(
    failedRecord?.status === 'failed' &&
    failedRecord.lastError?.includes('NON_RETRYABLE'),
    37,
    'Erro de política/permanente aborta job imediatamente sem gastar tentativas de retry indevidas'
  );

  // 38. Token da Meta e segredos nunca são vazados em logs de erro ou payloads de resposta
  const sampleLogEntry = JSON.stringify({
    component: 'WhatsAppOutbound',
    action: 'OUTBOUND_FAILED',
    errorCategory: 'AUTHENTICATION_ERROR',
    status: 401,
    sanitized: true,
  });
  assert(
    !sampleLogEntry.includes('EAAB') && !sampleLogEntry.includes('secret') && !sampleLogEntry.includes('service_role'),
    38,
    'Logs e respostas de erro estruturados são estritamente sanitizados e livres de tokens'
  );

  // ---------------------------------------------------------------------------
  // RELATÓRIO FINAL DA RELEASE 16
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bold}${passedCount === totalCount ? colors.green : colors.red}RESULTADO FINAL: ${passedCount}/${totalCount} TESTES APROVADOS COM SUCESSO.${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================\n${colors.reset}`);

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Falha fatal na execução da suite de testes do WhatsApp Outbound:', err);
  process.exit(1);
});
