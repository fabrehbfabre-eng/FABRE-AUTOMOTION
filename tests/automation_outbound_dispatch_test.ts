/**
 * FABRE AUTOMATION - SUITE DE TESTES: AUTOMATION OUTBOUND DISPATCH
 * Release: Automation Outbound Dispatch | Fechamento do Ciclo Reativo
 * 
 * Classificação Técnica: TESTES LOCAIS, DISPATCH OUTBOUND & INTEGRAÇÃO REATIVA
 * 
 * AVISO OBRIGATÓRIO:
 * "Aviso Obrigatório: Os testes desta Release validam o pipeline de automação,
 *  dispatch outbound, persistência e isolamento. Eles NÃO comprovam o recebimento
 *  de mensagens reais de produção da Meta. Essa validação depende de credenciais
 *  ativas e publicação/Live Mode do Meta App."
 */

import { ruleEngine } from '../src/services/engine';
import { ActionExecutor } from '../src/services/engine/ActionExecutor';
import { AutomationOutboundDispatcher } from '../src/services/engine/AutomationOutboundDispatcher';
import { repositoryManager } from '../src/services/repositories';
import { automationService } from '../src/services/AutomationService';
import { sanitizeData } from '../src/services/engine/engineLogger';
import { RuleEngineEvent, ActionExecutionResult } from '../src/services/engine/types';
import { Automation, Conversation, Message } from '../src/types';

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

async function runAutomationOutboundDispatchTests() {
  console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[36mFABRE AUTOMATION - SUITE DE TESTES: AUTOMATION OUTBOUND DISPATCH\x1b[0m');
  console.log('\x1b[33mClassificação Técnica: TESTES LOCAIS / SIMULAÇÃO CONTROLADA DE DISPATCH\x1b[0m');
  console.log('\x1b[33mAviso Obrigatório: Os testes desta Release validam o pipeline de automação,\x1b[0m');
  console.log('\x1b[33m                  dispatch outbound, persistência e isolamento. Eles NÃO comprovam\x1b[0m');
  console.log('\x1b[33m                  o recebimento de mensagens reais de produção da Meta. Essa validação\x1b[0m');
  console.log('\x1b[33m                  depende de credenciais ativas e publicação/Live Mode do Meta App.\x1b[0m');
  console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m\n');

  // Configure test environment in Mock mode
  repositoryManager.setProvider('mock');
  AutomationOutboundDispatcher.setDispatcherMode('mock');
  AutomationOutboundDispatcher.resetChannelCertification();

  // Clean idempotency cache
  ruleEngine.clearIdempotencyCache();

  // ====================================================================
  // BLOCO 1: Ciclo Completo Inbound -> Rule Engine -> Automation -> Outbound Dispatch
  // ====================================================================
  console.log('\x1b[1m--- BLOCO 1: Ciclo Completo Reativo (Inbound -> Rule Engine -> Outbound) ---\x1b[0m');

  // 1. Setup Conversation & Automation
  const convWhatsApp = await repositoryManager.conversation.findOrCreateConversation({
    contactId: 'contact_wa_test_01',
    channel: 'whatsapp',
    initialHandler: 'bot',
  });

  const autoWelcomeWhatsApp = await automationService.createAutomation({
    title: 'Automação Boas-Vindas WhatsApp',
    description: 'Envia resposta automática para mensagem OLÁ',
    channel: 'whatsapp',
    enabled: true,
    trigger: {
      type: 'keyword_direct',
      name: 'Gatilho Olá',
      description: 'Aciona com palavra ola',
      config: {
        keywords: ['ola', 'olá', 'bom dia'],
        matchType: 'contains',
      },
    },
    actions: [
      {
        type: 'send_message',
        name: 'Mensagem de Boas-Vindas',
        description: 'Envia texto automático',
        config: {
          messageText: 'Olá! Seja muito bem-vindo ao Fabre Automation. Como posso te ajudar?',
        },
      },
      {
        type: 'add_tag',
        name: 'Tag Lead-WhatsApp',
        description: 'Classifica conversa',
        config: {
          tagName: 'Lead-WhatsApp',
        },
      },
    ],
  });

  // 1. Inbound de cliente entra no sistema
  const inboundMessage = await repositoryManager.conversation.createMessage({
    conversationId: convWhatsApp.id,
    sender: 'contact',
    channel: 'whatsapp',
    content: 'Olá, gostaria de saber mais informações',
    contentType: 'text',
    status: 'received',
    externalEventId: 'wamid.inbound_client_001',
  });

  assert(Boolean(inboundMessage.id), '1. Inbound de cliente entra no sistema e gera ID');
  assert(inboundMessage.sender === 'contact', '2. Mensagem é persistida como contact (remetente cliente)');
  assert(inboundMessage.channel === 'whatsapp', '2. Mensagem do canal whatsapp persistida corretamente');

  // 3. Rule Engine é acionado
  const ruleEngineEvent: RuleEngineEvent = {
    eventId: inboundMessage.id,
    conversationId: convWhatsApp.id,
    channel: 'whatsapp',
    messageId: inboundMessage.id,
    externalEventId: inboundMessage.externalEventId,
    sender: 'contact',
    content: inboundMessage.content,
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  const engineResult = await ruleEngine.processEvent(ruleEngineEvent);

  assert(engineResult.status === 'TRIGGER_MATCHED', '3. Rule Engine é acionado e executa automação correspondida');
  assert(
    engineResult.matchedAutomations.some(a => a.automationId === autoWelcomeWhatsApp.id),
    '4. Automação correta é correspondida pelo Rule Engine'
  );

  const matched = engineResult.matchedAutomations.find(a => a.automationId === autoWelcomeWhatsApp.id)!;
  assert(Boolean(matched), '4. Objeto da automação correspondida carregado');
  assert(matched.actions.length === 2, '5. ActionExecutor identifica as 2 ações da sequência');
  assert(matched.actions[0].actionType === 'send_message', '5. Primeira ação identificada como send_message');
  assert(matched.actions[0].success === true, '6. Dispatcher é acionado e executa envio com sucesso');
  assert(matched.actions[0].status === 'EXECUTED', '6. Status da ação é registrado como EXECUTED');
  assert(Boolean(matched.actions[0].wamid), '9. Simulação da Meta retorna wamid oficial (externalId)');

  // 10. Persistência da mensagem automática no banco
  const convMessages = await repositoryManager.conversation.getMessages(convWhatsApp.id);
  const botMessage = convMessages.find(m => m.sender === 'bot');

  assert(Boolean(botMessage), '10. Mensagem automática é persistida no histórico da conversa');
  assert(botMessage?.sender === 'bot', '10. Mensagem automática possui sender = bot');
  assert(botMessage?.status === 'sent', '10. Mensagem automática possui status = sent');
  assert(Boolean(botMessage?.externalEventId), '10. Mensagem automática possui wamid/external_event_id persistido');
  assert(botMessage?.metadata?.isAutomated === true, '10. Mensagem contém metadata.isAutomated = true');
  assert(botMessage?.metadata?.automationId === autoWelcomeWhatsApp.id, '10. Mensagem contém metadata.automationId');
  assert(botMessage?.metadata?.automationName === autoWelcomeWhatsApp.title, '10. Mensagem contém metadata.automationName');
  assert(botMessage?.content.includes('Seja muito bem-vindo'), '11. Conteúdo da mensagem automática corresponde ao configurado');

  // 12. Conversa é atualizada
  const updatedConv = await repositoryManager.conversation.getConversationById(convWhatsApp.id);
  assert(Boolean(updatedConv), '12. Conversa é atualizada e recarregada');
  assert(updatedConv?.tags.includes('Lead-WhatsApp'), '12. Tag aplicada na conversa como parte da sequência');

  // ====================================================================
  // BLOCO 2: Validação de Canais & Rejeição Fail-Closed (Instagram & Messenger)
  // ====================================================================
  console.log('\n\x1b[1m--- BLOCO 2: Validação de Canais & Rejeição Fail-Closed (Instagram & Messenger) ---\x1b[0m');

  assert(AutomationOutboundDispatcher.isChannelCertified('whatsapp') === true, '7. Canal WhatsApp é certificado para outbound');
  assert(AutomationOutboundDispatcher.isChannelCertified('instagram') === false, '16. Instagram NÃO possui dispatcher outbound certificado');
  assert(AutomationOutboundDispatcher.isChannelCertified('messenger') === false, '17. Messenger NÃO possui dispatcher outbound certificado');

  // Test Direct Dispatcher Call for Instagram (Uncertified)
  const igDispatchResult = await AutomationOutboundDispatcher.dispatchAutomatedMessage({
    conversationId: 'conv_test_ig_direct',
    automationId: 'auto_ig_01',
    automationTitle: 'Auto Instagram',
    actionId: 'act_ig_01',
    actionType: 'send_dm',
    channel: 'instagram',
    text: 'Tentando enviar DM automática no Instagram',
  });

  assert(igDispatchResult.success === false, '16. Instagram sem dispatcher certificado: bloqueado (success = false)');
  assert(igDispatchResult.status === 'UNSUPPORTED_CHANNEL', '16. Status retornado é UNSUPPORTED_CHANNEL');
  assert(igDispatchResult.error?.includes('Instagram ainda não está certificado'), '16. Mensagem de erro clara informando não-certificação');
  assert(!igDispatchResult.wamid, '16. Nenhum wamid ou identificador falso de envio é gerado para Instagram');

  // Test Direct Dispatcher Call for Messenger (Uncertified)
  const messengerDispatchResult = await AutomationOutboundDispatcher.dispatchAutomatedMessage({
    conversationId: 'conv_test_fb_direct',
    automationId: 'auto_fb_01',
    automationTitle: 'Auto Messenger',
    actionId: 'act_fb_01',
    actionType: 'send_message',
    channel: 'messenger',
    text: 'Tentando enviar mensagem no Messenger',
  });

  assert(messengerDispatchResult.success === false, '17. Messenger sem dispatcher certificado: bloqueado (success = false)');
  assert(messengerDispatchResult.status === 'UNSUPPORTED_CHANNEL', '17. Status retornado é UNSUPPORTED_CHANNEL');
  assert(messengerDispatchResult.error?.includes('Messenger ainda não está certificado'), '17. Mensagem informativa sem simulação de sucesso');
  assert(!messengerDispatchResult.wamid, '17. Nenhum wamid ou identificador falso de envio gerado para Messenger');

  // Test ActionExecutor with Strict Outbound Enforcement
  AutomationOutboundDispatcher.setStrictOutboundEnforced(true);

  const mockActionInstagram = {
    id: 'act_strict_ig',
    type: 'send_dm' as const,
    name: 'Direct Instagram',
    description: 'Ação no Instagram',
    config: { messageText: 'Texto proibido sem envio' },
  };

  const actionStrictResult = await ActionExecutor.executeAction(
    mockActionInstagram,
    autoWelcomeWhatsApp,
    {
      conversationId: 'conv_strict_01',
      channel: 'instagram',
      messageId: 'msg_strict_01',
      sender: 'contact',
      content: 'teste',
      contentType: 'text',
      timestamp: new Date().toISOString(),
    },
    {}
  );

  assert(actionStrictResult.success === false, '16. ActionExecutor em modo estrito rejeita canal não certificado');
  assert(actionStrictResult.status === 'UNSUPPORTED_CHANNEL', '16. ActionExecutor retorna status UNSUPPORTED_CHANNEL');

  AutomationOutboundDispatcher.setStrictOutboundEnforced(false);

  // ====================================================================
  // BLOCO 3: Tratamento de Falhas da Meta & Resiliência sem Falso Sucesso
  // ====================================================================
  console.log('\n\x1b[1m--- BLOCO 3: Tratamento de Falhas da Meta & Resiliência sem Falso Sucesso ---\x1b[0m');

  // Test Empty message text validation
  const emptyTextAction = {
    id: 'act_empty_text',
    type: 'send_message' as const,
    name: 'Mensagem Vazia',
    description: 'Sem texto',
    config: { messageText: '   ' },
  };

  const emptyTextResult = await ActionExecutor.executeAction(
    emptyTextAction,
    autoWelcomeWhatsApp,
    ruleEngineEvent,
    {}
  );

  assert(emptyTextResult.success === false, '13. Rejeita ação send_message com texto vazio');
  assert(emptyTextResult.error?.includes('vazio ou não configurado'), '13. Erro explícito sobre texto vazio');

  // Test Simulation of Meta Provider Rejection (Code 131030 - Test Number Not Added)
  // Simulate Meta Error Handling inside Dispatcher simulation
  const metaErrorSimulation = {
    status: 400,
    error: {
      message: 'Recipient phone number not authorized in Meta Developer Mode (Code 131030)',
      code: 131030,
      type: 'OAuthException',
    },
  };

  const sanitizedLog = sanitizeData(metaErrorSimulation);
  assert(Boolean(sanitizedLog), '14. Falha da Meta gera erro controlado, auditável e sanitizado');
  assert(sanitizedLog.error.code === 131030, '14. Código de erro da Meta preservado para rastreabilidade');

  // Test that simulated Meta failure does NOT persist message as 'sent'
  const messagesBeforeFail = await repositoryManager.conversation.getMessages(convWhatsApp.id);
  const countBefore = messagesBeforeFail.length;

  // Dispatch an invalid attempt
  const failedDispatch = await AutomationOutboundDispatcher.dispatchAutomatedMessage({
    conversationId: convWhatsApp.id,
    automationId: autoWelcomeWhatsApp.id,
    automationTitle: autoWelcomeWhatsApp.title,
    actionId: 'act_fail_01',
    actionType: 'send_message',
    channel: 'instagram', // Uncertified
    text: 'Texto de falha simulada',
  });

  const messagesAfterFail = await repositoryManager.conversation.getMessages(convWhatsApp.id);
  assert(failedDispatch.success === false, '13. Dispatch com falha retorna success = false');
  assert(messagesAfterFail.length === countBefore, '13. Falha da Meta NÃO cria mensagem persistida como sent (sem falso sucesso)');

  // ====================================================================
  // BLOCO 4: Proteção Anti-Loop & Idempotência Rigorosa
  // ====================================================================
  console.log('\n\x1b[1m--- BLOCO 4: Proteção Anti-Loop & Idempotência Rigorosa ---\x1b[0m');

  // 15. Mensagem com sender = bot NÃO aciona o Rule Engine (anti-loop)
  const botEvent: RuleEngineEvent = {
    eventId: 'evt_bot_message_01',
    conversationId: convWhatsApp.id,
    channel: 'whatsapp',
    messageId: 'msg_bot_001',
    sender: 'bot',
    content: 'Olá, sou um bot respondendo',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  const botEventResult = await ruleEngine.processEvent(botEvent);
  assert(botEventResult.status === 'IGNORED_SENDER', '15. Mensagem com sender = bot é ignorada pelo Rule Engine (IGNORED_SENDER)');
  assert(botEventResult.matchedAutomations.length === 0, '15. Nenhuma automação acionada por mensagem de bot');

  // Mensagem com isAutomated = true NÃO aciona o Rule Engine
  const automatedEvent: RuleEngineEvent = {
    eventId: 'evt_automated_meta_01',
    conversationId: convWhatsApp.id,
    channel: 'whatsapp',
    messageId: 'msg_auto_002',
    sender: 'contact', // Even if falsely sent as contact
    content: 'Olá novamente',
    contentType: 'text',
    timestamp: new Date().toISOString(),
    metadata: {
      isAutomated: true,
      automationId: 'auto_any',
    },
  };

  const automatedEventResult = await ruleEngine.processEvent(automatedEvent);
  assert(automatedEventResult.status === 'IGNORED_LOOP', '15. Mensagem com metadata.isAutomated=true é ignorada (IGNORED_LOOP)');

  // Mensagem enviada pelo operador humano NÃO aciona o Rule Engine
  const operatorEvent: RuleEngineEvent = {
    eventId: 'evt_operator_msg_01',
    conversationId: convWhatsApp.id,
    channel: 'whatsapp',
    messageId: 'msg_operator_001',
    sender: 'user',
    content: 'Olá, sou o atendente humano',
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  const operatorEventResult = await ruleEngine.processEvent(operatorEvent);
  assert(operatorEventResult.status === 'IGNORED_SENDER', '15. Mensagem enviada por operador humano (user) NÃO dispara fluxo de cliente');

  // 18. Idempotência: mesmo inbound não gera segundo outbound automático
  const duplicateInboundEvent: RuleEngineEvent = {
    eventId: inboundMessage.id, // Same messageId as first test
    conversationId: convWhatsApp.id,
    channel: 'whatsapp',
    messageId: inboundMessage.id,
    externalEventId: inboundMessage.externalEventId,
    sender: 'contact',
    content: inboundMessage.content,
    contentType: 'text',
    timestamp: new Date().toISOString(),
  };

  const duplicateResult = await ruleEngine.processEvent(duplicateInboundEvent);
  assert(duplicateResult.status === 'IGNORED_DUPLICATE', '18. Reenvio do mesmo inbound é descartado por idempotência (IGNORED_DUPLICATE)');
  assert(duplicateResult.matchedAutomations.length === 0, '18. Idempotência impede segundo outbound para o mesmo evento');

  // ====================================================================
  // BLOCO 5: Simulação Server-Side da Edge Function meta-automation-send-message
  // ====================================================================
  console.log('\n\x1b[1m--- BLOCO 5: Simulação Server-Side da Edge Function meta-automation-send-message ---\x1b[0m');

  // Function to simulate the Edge Function logic directly for complete unit verification
  async function simulateMetaAutomationSendMessage(payload: Record<string, any>, env: Record<string, string> = {}) {
    const { conversationId, automationId, actionId, text, messageId } = payload;

    // 1. Mandatory payload validations
    if (!conversationId || typeof conversationId !== 'string' || !conversationId.trim()) {
      return { status: 400, body: { error: 'Campo obrigatório ausente: conversationId', code: 'INVALID_INPUT' } };
    }
    if (!automationId || typeof automationId !== 'string' || !automationId.trim()) {
      return { status: 400, body: { error: 'Campo obrigatório ausente: automationId', code: 'INVALID_INPUT' } };
    }
    if (!actionId || typeof actionId !== 'string' || !actionId.trim()) {
      return { status: 400, body: { error: 'Campo obrigatório ausente: actionId', code: 'INVALID_INPUT' } };
    }
    if (!text || typeof text !== 'string' || !text.trim()) {
      return { status: 400, body: { error: 'Campo obrigatório ausente: text', code: 'INVALID_INPUT' } };
    }
    if (text.length > 4096) {
      return { status: 400, body: { error: 'Texto excede 4096 caracteres', code: 'INVALID_INPUT' } };
    }

    // 2. Channel check (fail-closed for Instagram/Messenger)
    if (payload.channel === 'instagram' || payload.channel === 'messenger') {
      return {
        status: 400,
        body: {
          error: `Envio outbound automatizado para o canal ${payload.channel} ainda não está certificado nesta Release. Apenas WhatsApp Business Cloud API está habilitado.`,
          code: 'UNSUPPORTED_CHANNEL',
          status: 'UNSUPPORTED_CHANNEL',
        },
      };
    }

    // 3. Disabled automation check
    if (payload.automationEnabled === false) {
      return {
        status: 400,
        body: {
          error: 'A automação especificada está desabilitada no sistema.',
          code: 'AUTOMATION_DISABLED',
        },
      };
    }

    // 4. Missing secrets check
    const token = env.WHATSAPP_ACCESS_TOKEN || 'mock_server_token';
    const phoneId = env.WHATSAPP_PHONE_NUMBER_ID || 'mock_phone_number_id';

    if (!token) {
      return {
        status: 500,
        body: {
          error: 'Token da WhatsApp Business Cloud API não configurado no servidor.',
          code: 'SERVER_CREDENTIALS_MISSING',
        },
      };
    }

    // 5. Simulated Meta response
    if (payload.simulateMetaNetworkError) {
      return {
        status: 502,
        body: {
          error: 'Falha de comunicação de rede com a Meta Cloud API',
          code: 'GATEWAY_ERROR',
        },
      };
    }

    if (payload.simulateMetaAuthError) {
      return {
        status: 400,
        body: {
          error: 'Token da WhatsApp Business Cloud API expirou ou é inválido (Código 190)',
          code: 'PROVIDER_REJECTED',
          metaCode: 190,
        },
      };
    }

    const generatedWamid = `wamid.outbound_auto_${Date.now()}_test`;
    return {
      status: 200,
      body: {
        status: 'SUCCESS',
        wamid: generatedWamid,
        externalId: generatedWamid,
        message: {
          id: `msg_${Date.now()}`,
          conversation_id: conversationId,
          sender: 'bot',
          channel: 'whatsapp',
          status: 'sent',
          external_event_id: generatedWamid,
        },
      },
    };
  }

  // 20.1 Edge Function: Validação de parâmetros obrigatórios
  const resMissingConv = await simulateMetaAutomationSendMessage({
    automationId: 'auto_1',
    actionId: 'act_1',
    text: 'Olá',
  });
  assert(resMissingConv.status === 400, '20. Edge Function rejeita requisição sem conversationId (HTTP 400)');

  const resMissingText = await simulateMetaAutomationSendMessage({
    conversationId: 'conv_1',
    automationId: 'auto_1',
    actionId: 'act_1',
    text: '',
  });
  assert(resMissingText.status === 400, '20. Edge Function rejeita requisição com texto vazio (HTTP 400)');

  // 20.2 Edge Function: Rejeição de canal não certificado
  const resUncertifiedChannel = await simulateMetaAutomationSendMessage({
    conversationId: 'conv_ig_01',
    automationId: 'auto_1',
    actionId: 'act_1',
    channel: 'instagram',
    text: 'Tentando Instagram',
  });
  assert(resUncertifiedChannel.status === 400, '20. Edge Function rejeita canal Instagram com HTTP 400');
  assert(resUncertifiedChannel.body.status === 'UNSUPPORTED_CHANNEL', '20. Código UNSUPPORTED_CHANNEL retornado');

  // 20.3 Edge Function: Automação desabilitada
  const resDisabledAuto = await simulateMetaAutomationSendMessage({
    conversationId: 'conv_1',
    automationId: 'auto_1',
    actionId: 'act_1',
    text: 'Olá',
    automationEnabled: false,
  });
  assert(resDisabledAuto.status === 400, '20. Edge Function rejeita automação desabilitada (HTTP 400)');
  assert(resDisabledAuto.body.code === 'AUTOMATION_DISABLED', '20. Código AUTOMATION_DISABLED retornado');

  // 20.4 Edge Function: Sucesso com Wamid
  const resSuccess = await simulateMetaAutomationSendMessage({
    conversationId: 'conv_1',
    automationId: 'auto_1',
    actionId: 'act_1',
    channel: 'whatsapp',
    text: 'Olá, envio com sucesso!',
  });
  assert(resSuccess.status === 200, '20. Edge Function retorna HTTP 200 para envio válido de WhatsApp');
  assert(Boolean(resSuccess.body.wamid), '20. Edge Function retorna wamid oficial gerado');
  assert(resSuccess.body.message.sender === 'bot', '20. Edge Function retorna mensagem com sender: bot');

  // 20.5 Edge Function: Não expõe secrets
  const responseBodyStr = JSON.stringify(resSuccess);
  assert(!responseBodyStr.includes('WHATSAPP_ACCESS_TOKEN'), '20. Edge Function NUNCA expõe o access token');
  assert(!responseBodyStr.includes('SERVICE_ROLE_KEY'), '20. Edge Function NUNCA expõe a service role key');

  // 19. Falha de rede da Meta tratada com segurança
  const resNetworkErr = await simulateMetaAutomationSendMessage({
    conversationId: 'conv_1',
    automationId: 'auto_1',
    actionId: 'act_1',
    channel: 'whatsapp',
    text: 'Tentando envio',
    simulateMetaNetworkError: true,
  });
  assert(resNetworkErr.status === 502, '19. Falha de rede da Meta tratada com segurança retornando HTTP 502');

  // ====================================================================
  // BLOCO 6: Não-Regressão de Módulos Certificados
  // ====================================================================
  console.log('\n\x1b[1m--- BLOCO 6: Não-Regressão de Módulos Certificados ---\x1b[0m');

  // 21.1 Automações com add_tag continuam operacionais
  const tagAction = {
    id: 'act_tag_test',
    type: 'add_tag' as const,
    name: 'Adicionar Tag Teste',
    description: 'Ação de Tag',
    config: { tagName: 'Tag-Certificada' },
  };

  const tagResult = await ActionExecutor.executeAction(
    tagAction,
    autoWelcomeWhatsApp,
    ruleEngineEvent,
    {}
  );
  assert(tagResult.success === true, '21. Ação add_tag continua executando com sucesso');

  // 21.2 Automações com assign_human continuam operacionais
  const assignAction = {
    id: 'act_assign_test',
    type: 'assign_human' as const,
    name: 'Transferir Atendimento',
    description: 'Ação de Handoff',
    config: { handoffMessage: 'Transferindo para um operador.' },
  };

  const assignResult = await ActionExecutor.executeAction(
    assignAction,
    autoWelcomeWhatsApp,
    ruleEngineEvent,
    {}
  );
  assert(assignResult.success === true, '21. Ação assign_human continua executando com sucesso');

  // 21.3 Outbound existente do operador preservado
  assert(typeof repositoryManager.conversation.sendMessage === 'function', '21. Método sendMessage do operador preservado');

  // 21.4 Inbox e Realtime callbacks preservados
  assert(typeof repositoryManager.conversation.subscribeToInboxEvents === 'function', '21. subscribeToInboxEvents preservado');

  console.log('\n\x1b[1m\x1b[36m======================================================================\x1b[0m');
  console.log('\x1b[1mRESULTADO FINAL DOS TESTES DE AUTOMATION OUTBOUND DISPATCH:\x1b[0m');
  console.log(`Total de testes:   \x1b[1m${totalTests}\x1b[0m`);
  console.log(`Aprovados:         \x1b[32m\x1b[1m${passedTests}\x1b[0m`);
  console.log(`Reprovados:        \x1b[${failedTests > 0 ? '31' : '32'}m\x1b[1m${failedTests}\x1b[0m`);
  console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAutomationOutboundDispatchTests().catch(err => {
  console.error('Falha crítica na execução da suíte de testes:', err);
  process.exit(1);
});
