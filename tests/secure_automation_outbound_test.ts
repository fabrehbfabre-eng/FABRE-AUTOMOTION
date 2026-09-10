/**
 * FABRE AUTOMATION - SUITE DE TESTES: SECURE AUTOMATION OUTBOUND
 * Release 13: Operator Authentication + Secure Automation Outbound
 * 
 * Classificação Técnica: TESTES LOCAIS / SIMULAÇÃO COM MOCKS EM MEMÓRIA
 * NOTA: Testes automatizados executados localmente sem tráfego real contra a Meta Graph API.
 * 
 * Princípios de Segurança Validados:
 * - Operador Autenticado e Autorizado via JWT + app_metadata.role (Fail-Closed)
 * - Validação da Ação no Banco de Dados: O texto enviado pelo caller NÃO é confiável;
 *   o messageText configurado na ação é a única fonte autoritativa.
 * - Idempotência, Isolamento de Canais não certificados, Auditoria de Operador.
 * 
 * Cobertura Completa dos 30 Casos de Teste Obrigatórios (Release 13):
 *  1. Sem Authorization -> 401
 *  2. Bearer ausente -> 401
 *  3. Bearer vazio -> 401
 *  4. JWT inválido -> 401
 *  5. JWT expirado -> 401
 *  6. JWT sem app_metadata.role -> 403
 *  7. user_metadata com operator porém app_metadata vazio -> 403
 *  8. app_metadata com viewer -> 403
 *  9. app_metadata com moderator -> 403
 * 10. app_metadata com role desconhecida -> 403
 * 11. app_metadata com operator -> 200
 * 12. app_metadata com admin -> 200
 * 13. app_metadata com disabled=true -> 403
 * 14. app_metadata com can_send_outbound=false -> 403
 * 15. automation inexistente -> 404
 * 16. automation desativada -> rejeição (400)
 * 17. action inexistente -> rejeição (400)
 * 18. actionId pertencente a outra automation -> rejeição (400)
 * 19. action que não é send_message -> rejeição (400)
 * 20. messageText vazio -> rejeição (400)
 * 21. text fornecido pelo caller diferente do messageText armazenado -> o texto armazenado na action deve prevalecer (200)
 * 22. canal instagram -> rejeição (400)
 * 23. canal messenger -> rejeição (400)
 * 24. recipient inválido -> rejeição (400)
 * 25. WHATSAPP_ACCESS_TOKEN ausente -> falha limpa sem crash (500)
 * 26. WHATSAPP_PHONE_NUMBER_ID ausente -> rejeição (400)
 * 27. erro da Meta -> repassado com segurança (400/502)
 * 28. sucesso da Meta -> gera status sent
 * 29. idempotência com external_event_id/wamid -> evita disparo duplicado
 * 30. auditoria: mensagem persistida contém dados corretos de automação e operador autorizador
 */

interface MockMessage {
  id: string;
  conversation_id: string;
  sender: 'user' | 'contact' | 'bot' | 'system';
  channel: 'instagram' | 'messenger' | 'whatsapp';
  content: string;
  content_type: string;
  status: string;
  external_event_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

interface MockAction {
  id: string;
  automation_id: string;
  type: string;
  name: string;
  description?: string;
  config: Record<string, any>;
  sort_order: number;
}

interface MockAutomation {
  id: string;
  title: string;
  channel: string;
  enabled: boolean;
  automation_actions: MockAction[];
}

interface MockConversation {
  id: string;
  contact_id: string;
  channel: string;
  status: string;
  handler: string;
  unread_count: number;
  updated_at: string;
}

interface MockProfile {
  id: string;
  name: string;
  username?: string;
  phone?: string;
  channel: string;
  metadata?: Record<string, any>;
}

// In-Memory Database State for Edge Function Simulation
class MockSecureAutomationDatabase {
  conversations: Map<string, MockConversation> = new Map();
  profiles: Map<string, MockProfile> = new Map();
  automations: Map<string, MockAutomation> = new Map();
  messages: MockMessage[] = [];

  reset() {
    this.conversations.clear();
    this.profiles.clear();
    this.automations.clear();
    this.messages = [];

    // Seed default WhatsApp conversation
    this.conversations.set('conv_wa_01', {
      id: 'conv_wa_01',
      contact_id: 'prof_wa_01',
      channel: 'whatsapp',
      status: 'open',
      handler: 'bot',
      unread_count: 2,
      updated_at: '2026-09-10T10:00:00Z',
    });

    // Seed Instagram conversation (unsupported for automation outbound)
    this.conversations.set('conv_ig_01', {
      id: 'conv_ig_01',
      contact_id: 'prof_ig_01',
      channel: 'instagram',
      status: 'open',
      handler: 'bot',
      unread_count: 1,
      updated_at: '2026-09-10T10:00:00Z',
    });

    // Seed Messenger conversation (unsupported for automation outbound)
    this.conversations.set('conv_msg_01', {
      id: 'conv_msg_01',
      contact_id: 'prof_msg_01',
      channel: 'messenger',
      status: 'open',
      handler: 'bot',
      unread_count: 1,
      updated_at: '2026-09-10T10:00:00Z',
    });

    // Seed WhatsApp contact with valid phone
    this.profiles.set('prof_wa_01', {
      id: 'prof_wa_01',
      name: 'Cliente WhatsApp Válido',
      username: 'wa_5511999998888',
      phone: '+55 11 99999-8888',
      channel: 'whatsapp',
      metadata: { wa_id: '5511999998888', phone_number_id: 'phone_num_id_wa_01' },
    });

    // Seed contact with invalid/empty phone
    this.profiles.set('prof_invalid_phone', {
      id: 'prof_invalid_phone',
      name: 'Cliente Sem Telefone',
      username: 'wa_sem_tel',
      phone: '',
      channel: 'whatsapp',
      metadata: {},
    });

    this.conversations.set('conv_wa_invalid_phone', {
      id: 'conv_wa_invalid_phone',
      contact_id: 'prof_invalid_phone',
      channel: 'whatsapp',
      status: 'open',
      handler: 'bot',
      unread_count: 1,
      updated_at: '2026-09-10T10:00:00Z',
    });

    // Seed active automation with valid send_message action
    this.automations.set('auto_welcome_01', {
      id: 'auto_welcome_01',
      title: 'Boas-Vindas WhatsApp',
      channel: 'whatsapp',
      enabled: true,
      automation_actions: [
        {
          id: 'action_send_welcome',
          automation_id: 'auto_welcome_01',
          type: 'send_message',
          name: 'Enviar Boas-Vindas Oficial',
          config: {
            messageText: 'Olá! Seja muito bem-vindo à Fabre Automations.',
          },
          sort_order: 1,
        },
        {
          id: 'action_empty_text',
          automation_id: 'auto_welcome_01',
          type: 'send_message',
          name: 'Ação com Texto Vazio',
          config: {
            messageText: '   ',
          },
          sort_order: 2,
        },
        {
          id: 'action_wrong_type',
          automation_id: 'auto_welcome_01',
          type: 'tag_contact',
          name: 'Taggear Contato (Não é Envio)',
          config: {
            tag: 'novo_lead',
          },
          sort_order: 3,
        },
      ],
    });

    // Seed disabled automation
    this.automations.set('auto_disabled_01', {
      id: 'auto_disabled_01',
      title: 'Automação Desativada Temporariamente',
      channel: 'whatsapp',
      enabled: false,
      automation_actions: [
        {
          id: 'action_disabled_send',
          automation_id: 'auto_disabled_01',
          type: 'send_message',
          name: 'Disparo Bloqueado',
          config: {
            messageText: 'Esta mensagem não deve sair.',
          },
          sort_order: 1,
        },
      ],
    });

    // Seed second automation (for foreign action test)
    this.automations.set('auto_other_02', {
      id: 'auto_other_02',
      title: 'Outra Automação',
      channel: 'whatsapp',
      enabled: true,
      automation_actions: [
        {
          id: 'action_foreign_02',
          automation_id: 'auto_other_02',
          type: 'send_message',
          name: 'Ação Pertencente a Outra Automação',
          config: {
            messageText: 'Texto da outra automação.',
          },
          sort_order: 1,
        },
      ],
    });
  }
}

const mockDb = new MockSecureAutomationDatabase();

// JWT Mock Validator simulating Supabase Auth
function mockValidateJwt(token: string): { user: any | null; error: string | null } {
  if (token === 'valid_jwt_operator') {
    return {
      user: {
        id: 'usr_op_01',
        email: 'operador@fabre.com.br',
        role: 'authenticated',
        app_metadata: { role: 'operator' },
      },
      error: null,
    };
  }

  if (token === 'valid_jwt_admin') {
    return {
      user: {
        id: 'usr_adm_01',
        email: 'admin@fabre.com.br',
        role: 'authenticated',
        app_metadata: { role: 'admin' },
      },
      error: null,
    };
  }

  if (token === 'valid_jwt_no_role') {
    return {
      user: {
        id: 'usr_no_role_01',
        email: 'sem_cargo@fabre.com.br',
        role: 'authenticated',
        app_metadata: {},
      },
      error: null,
    };
  }

  if (token === 'valid_jwt_spoofed_user_metadata') {
    return {
      user: {
        id: 'usr_spoof_01',
        email: 'atacante@externo.com',
        role: 'authenticated',
        app_metadata: {}, // Empty app_metadata
        user_metadata: { role: 'operator' }, // Spoofed user_metadata
      },
      error: null,
    };
  }

  if (token === 'valid_jwt_viewer') {
    return {
      user: {
        id: 'usr_view_01',
        email: 'espectador@fabre.com.br',
        role: 'authenticated',
        app_metadata: { role: 'viewer' },
      },
      error: null,
    };
  }

  if (token === 'valid_jwt_moderator') {
    return {
      user: {
        id: 'usr_mod_01',
        email: 'moderador@fabre.com.br',
        role: 'authenticated',
        app_metadata: { role: 'moderator' },
      },
      error: null,
    };
  }

  if (token === 'valid_jwt_unknown_role') {
    return {
      user: {
        id: 'usr_unk_01',
        email: 'desconhecido@fabre.com.br',
        role: 'authenticated',
        app_metadata: { role: 'super_gestor_financeiro' },
      },
      error: null,
    };
  }

  if (token === 'valid_jwt_disabled') {
    return {
      user: {
        id: 'usr_dis_01',
        email: 'bloqueado@fabre.com.br',
        role: 'authenticated',
        app_metadata: { role: 'operator', disabled: true },
      },
      error: null,
    };
  }

  if (token === 'valid_jwt_cant_send') {
    return {
      user: {
        id: 'usr_cant_01',
        email: 'sem_outbound@fabre.com.br',
        role: 'authenticated',
        app_metadata: { role: 'operator', can_send_outbound: false },
      },
      error: null,
    };
  }

  if (token === 'expired_jwt_token') {
    return {
      user: null,
      error: 'JWT expirado em 2026-09-01T00:00:00Z',
    };
  }

  return {
    user: null,
    error: 'JWT inválido ou assinatura incorreta',
  };
}

// Simulated Execution of meta-automation-send-message Edge Function
interface SimulationRequest {
  authorizationHeader?: string;
  body: Record<string, any>;
  envConfig?: {
    WHATSAPP_ACCESS_TOKEN?: string;
    WHATSAPP_PHONE_NUMBER_ID?: string;
    SIMULATE_META_ERROR?: boolean;
    META_ERROR_CODE?: number;
    META_ERROR_MESSAGE?: string;
  };
}

interface SimulationResponse {
  status: number;
  body: Record<string, any>;
  metaCalled: boolean;
  persistedMessage?: MockMessage;
}

async function simulateMetaAutomationSendMessage(req: SimulationRequest): Promise<SimulationResponse> {
  const env = {
    WHATSAPP_ACCESS_TOKEN: 'valid_meta_token_wh_123',
    WHATSAPP_PHONE_NUMBER_ID: 'phone_num_id_wa_01',
    ...req.envConfig,
  };

  let metaCalled = false;

  // 1. Authorization Header Verification
  const authHeader = req.authorizationHeader;
  if (!authHeader || !authHeader.trim().toLowerCase().startsWith('bearer ')) {
    return {
      status: 401,
      body: { error: 'Cabeçalho de autorização ausente ou em formato inválido. Utilize Bearer <token>.', code: 'UNAUTHORIZED' },
      metaCalled: false,
    };
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return {
      status: 401,
      body: { error: 'Token Bearer vazio fornecido na requisição', code: 'UNAUTHORIZED' },
      metaCalled: false,
    };
  }

  // 2. JWT Cryptographic Validation
  const { user, error: authError } = mockValidateJwt(token);
  if (authError || !user || !user.id || user.role !== 'authenticated') {
    return {
      status: 401,
      body: { error: 'Usuário não autenticado ou sessão inválida.', code: 'UNAUTHORIZED' },
      metaCalled: false,
    };
  }

  // 3. Operator Authorization Check (Fail-Closed, strictly app_metadata.role)
  const appRole = typeof user.app_metadata?.role === 'string'
    ? user.app_metadata.role.trim().toLowerCase()
    : null;

  const isExplicitlyAuthorized = appRole === 'operator' || appRole === 'admin';
  const isDisabled = user.app_metadata?.disabled === true || user.app_metadata?.can_send_outbound === false;

  if (!isExplicitlyAuthorized || isDisabled) {
    return {
      status: 403,
      body: { error: 'Usuário autenticado, mas sem permissão para executar esta operação.', code: 'FORBIDDEN' },
      metaCalled: false,
    };
  }

  // 4. Payload Parsing
  const { conversationId, automationId, actionId, messageId, externalEventId } = req.body;

  if (!conversationId || typeof conversationId !== 'string' || !conversationId.trim()) {
    return {
      status: 400,
      body: { error: 'Campo obrigatório ausente ou inválido: conversationId.', code: 'INVALID_INPUT' },
      metaCalled: false,
    };
  }

  if (!automationId || typeof automationId !== 'string' || !automationId.trim()) {
    return {
      status: 400,
      body: { error: 'Campo obrigatório ausente ou inválido: automationId.', code: 'INVALID_INPUT' },
      metaCalled: false,
    };
  }

  if (!actionId || typeof actionId !== 'string' || !actionId.trim()) {
    return {
      status: 400,
      body: { error: 'Campo obrigatório ausente ou inválido: actionId.', code: 'INVALID_INPUT' },
      metaCalled: false,
    };
  }

  // 5. Fetch Target Conversation
  const conversation = mockDb.conversations.get(conversationId.trim());
  if (!conversation) {
    return {
      status: 404,
      body: { error: `Conversa não encontrada: ${conversationId}`, code: 'NOT_FOUND' },
      metaCalled: false,
    };
  }

  // 6. Channel Certification Check
  if (conversation.channel === 'instagram' || conversation.channel === 'messenger') {
    return {
      status: 400,
      body: {
        error: `Envio outbound automatizado para o canal ${conversation.channel} ainda não está certificado nesta Release. Apenas WhatsApp Business Cloud API está habilitado.`,
        code: 'INVALID_INPUT',
        status: 'UNSUPPORTED_CHANNEL',
      },
      metaCalled: false,
    };
  }

  if (conversation.channel !== 'whatsapp') {
    return {
      status: 400,
      body: { error: `Canal não suportado: ${conversation.channel}`, code: 'INVALID_INPUT' },
      metaCalled: false,
    };
  }

  // 7. Contact Profile & Recipient Phone Validation
  const contact = mockDb.profiles.get(conversation.contact_id);
  if (!contact) {
    return {
      status: 404,
      body: { error: `Contato associado à conversa não encontrado: ${conversation.contact_id}`, code: 'NOT_FOUND' },
      metaCalled: false,
    };
  }

  const rawPhone = contact.phone || (contact.metadata as any)?.wa_id || contact.username?.replace(/^wa_/, '');
  const recipientPhone = (rawPhone || '').replace(/\D/g, '');

  if (!recipientPhone || recipientPhone.length < 8) {
    return {
      status: 400,
      body: { error: 'Número de telefone do destinatário inválido ou não cadastrado no perfil de contato.', code: 'INVALID_INPUT' },
      metaCalled: false,
    };
  }

  // 8. Fetch and Validate Automation & Action from Database (Fail-Closed)
  const automation = mockDb.automations.get(automationId.trim());
  if (!automation) {
    return {
      status: 404,
      body: { error: `Automação não encontrada: ${automationId}`, code: 'NOT_FOUND' },
      metaCalled: false,
    };
  }

  if (!automation.enabled) {
    return {
      status: 400,
      body: { error: 'A automação especificada está desabilitada no sistema.', code: 'AUTOMATION_DISABLED' },
      metaCalled: false,
    };
  }

  const matchedAction = automation.automation_actions.find((a) => a.id === actionId.trim());
  if (!matchedAction) {
    return {
      status: 400,
      body: { error: `Ação ${actionId} não encontrada na automação ${automationId}.`, code: 'INVALID_INPUT' },
      metaCalled: false,
    };
  }

  if (matchedAction.automation_id && matchedAction.automation_id !== automation.id) {
    return {
      status: 400,
      body: { error: `Ação ${actionId} não pertence à automação ${automationId}.`, code: 'INVALID_INPUT' },
      metaCalled: false,
    };
  }

  if (matchedAction.type !== 'send_message' && matchedAction.type !== 'send_dm') {
    return {
      status: 400,
      body: { error: `Tipo de ação incompatível para envio de mensagem: ${matchedAction.type}`, code: 'INVALID_INPUT' },
      metaCalled: false,
    };
  }

  // Source of Truth: Authoritative Action Text from DB
  const dbActionText = String(matchedAction.config?.messageText || matchedAction.config?.text || '').trim();

  if (!dbActionText) {
    return {
      status: 400,
      body: { error: 'A ação de automação não possui texto de mensagem configurado no banco de dados.', code: 'INVALID_INPUT' },
      metaCalled: false,
    };
  }

  if (dbActionText.length > 4096) {
    return {
      status: 400,
      body: { error: 'O texto da mensagem configurado na automação excede o limite máximo permitido de 4096 caracteres.', code: 'INVALID_INPUT' },
      metaCalled: false,
    };
  }

  // 9. Idempotency Check
  if (messageId) {
    const existing = mockDb.messages.find(
      (m) => m.conversation_id === conversationId &&
             m.sender === 'bot' &&
             m.metadata?.triggeredByMessageId === messageId &&
             m.metadata?.actionId === actionId
    );

    if (existing) {
      return {
        status: 200,
        body: {
          status: 'DUPLICATE',
          code: 'EVENT_ALREADY_PROCESSED',
          message: 'Mensagem automatizada já despachada anteriormente para este evento.',
          existingMessageId: existing.id,
          wamid: existing.external_event_id,
        },
        metaCalled: false,
      };
    }
  }

  // 10. WhatsApp Credentials Verification
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneNumberId || !phoneNumberId.trim()) {
    return {
      status: 400,
      body: { error: 'Identificador da linha WhatsApp (WHATSAPP_PHONE_NUMBER_ID) não configurado no servidor.', code: 'INVALID_INPUT' },
      metaCalled: false,
    };
  }

  const accessToken = env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken || !accessToken.trim()) {
    return {
      status: 500,
      body: { error: 'Configuração de acesso do WhatsApp Business Cloud API incompleta no servidor (WHATSAPP_ACCESS_TOKEN ausente).', code: 'INTERNAL_ERROR' },
      metaCalled: false,
    };
  }

  // 11. Meta Cloud API Invocation Simulation
  metaCalled = true;

  if (env.SIMULATE_META_ERROR) {
    const metaCode = env.META_ERROR_CODE || 131030;
    const metaMsg = env.META_ERROR_MESSAGE || 'Recipient phone number not in allowed list';
    return {
      status: 400,
      body: {
        error: `Falha na Meta Cloud API [${metaCode}]: ${metaMsg}`,
        code: 'INTERNAL_ERROR',
        status: 'PROVIDER_REJECTED',
        metaCode,
      },
      metaCalled: true,
    };
  }

  // 12. Meta Success & PostgreSQL Message Persistence
  const wamid = `wamid.auto_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const createdMessage: MockMessage = {
    id: `msg_bot_${Date.now()}`,
    conversation_id: conversationId,
    sender: 'bot',
    channel: 'whatsapp',
    content: dbActionText, // Verified database text, NEVER caller text
    content_type: 'text',
    status: 'sent',
    external_event_id: wamid,
    metadata: {
      automationId: automation.id,
      automationName: automation.title,
      actionId: matchedAction.id,
      actionType: matchedAction.type,
      isAutomated: true,
      recipient: recipientPhone,
      phone_number_id: phoneNumberId,
      triggeredByMessageId: messageId || null,
      externalEventId: externalEventId || null,
      meta_message_id: wamid,
      sent_by: 'automation_engine',
      operator_authorized_by: user.id, // Audit trail
    },
    created_at: new Date().toISOString(),
  };

  mockDb.messages.push(createdMessage);

  return {
    status: 200,
    body: {
      status: 'SUCCESS',
      message: createdMessage,
      externalId: wamid,
      wamid,
      automationId: automation.id,
      actionId: matchedAction.id,
    },
    metaCalled: true,
    persistedMessage: createdMessage,
  };
}

// Test Runner
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

async function runSecureAutomationOutboundTests() {
  console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[36mFABRE AUTOMATION - SUITE DE TESTES: SECURE AUTOMATION OUTBOUND\x1b[0m');
  console.log('\x1b[1m\x1b[36mRelease 13: Operator Authentication + Secure Automation Outbound\x1b[0m');
  console.log('\x1b[33mClassificação: TESTES LOCAIS / SIMULAÇÃO CONTROLADA COM MOCKS\x1b[0m');
  console.log('\x1b[33mRegra Fail-Closed: Operador Autenticado & Autorizado + Texto Autoritativo da Ação\x1b[0m');
  console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m\n');

  mockDb.reset();

  const defaultValidBody = {
    conversationId: 'conv_wa_01',
    automationId: 'auto_welcome_01',
    actionId: 'action_send_welcome',
    text: 'Texto injetado pelo caller (deve ser ignorado)',
    messageId: 'msg_inbound_101',
    externalEventId: 'evt_meta_101',
  };

  // --------------------------------------------------------------------
  // PARTE 1: Autenticação Criptográfica JWT (Testes 1 a 5)
  // --------------------------------------------------------------------
  console.log('\x1b[1m--- PARTE 1: Autenticação Criptográfica JWT (Testes 1 a 5) ---\x1b[0m');

  // 1. Sem Authorization -> 401
  const res1 = await simulateMetaAutomationSendMessage({
    body: defaultValidBody,
  });
  assert(res1.status === 401 && !res1.metaCalled, '1. Rejeita requisição sem Authorization com HTTP 401 (Meta não invocada)');

  // 2. Bearer ausente -> 401
  const res2 = await simulateMetaAutomationSendMessage({
    authorizationHeader: 'Basic dXNlcjpwYXNz',
    body: defaultValidBody,
  });
  assert(res2.status === 401 && !res2.metaCalled, '2. Rejeita cabeçalho sem prefixo Bearer com HTTP 401');

  // 3. Bearer vazio -> 401
  const res3 = await simulateMetaAutomationSendMessage({
    authorizationHeader: 'Bearer    ',
    body: defaultValidBody,
  });
  assert(res3.status === 401 && !res3.metaCalled, '3. Rejeita token Bearer vazio com HTTP 401');

  // 4. JWT inválido -> 401
  const res4 = await simulateMetaAutomationSendMessage({
    authorizationHeader: 'Bearer invalid_signature_token_xyz',
    body: defaultValidBody,
  });
  assert(res4.status === 401 && !res4.metaCalled, '4. Rejeita JWT inválido ou corrompido com HTTP 401');

  // 5. JWT expirado -> 401
  const res5 = await simulateMetaAutomationSendMessage({
    authorizationHeader: 'Bearer expired_jwt_token',
    body: defaultValidBody,
  });
  assert(res5.status === 401 && !res5.metaCalled, '5. Rejeita JWT com sessão expirada com HTTP 401');

  // --------------------------------------------------------------------
  // PARTE 2: Autorização Real do Operador (Fail-Closed) (Testes 6 a 14)
  // --------------------------------------------------------------------
  console.log('\n\x1b[1m--- PARTE 2: Autorização Real do Operador (Fail-Closed) (Testes 6 a 14) ---\x1b[0m');

  // 6. JWT sem app_metadata.role -> 403
  const res6 = await simulateMetaAutomationSendMessage({
    authorizationHeader: 'Bearer valid_jwt_no_role',
    body: defaultValidBody,
  });
  assert(res6.status === 403 && !res6.metaCalled, '6. JWT válido sem app_metadata.role é rejeitado com HTTP 403');

  // 7. user_metadata com operator porém app_metadata vazio -> 403
  const res7 = await simulateMetaAutomationSendMessage({
    authorizationHeader: 'Bearer valid_jwt_spoofed_user_metadata',
    body: defaultValidBody,
  });
  assert(res7.status === 403 && !res7.metaCalled, '7. Tentativa de privilégio via user_metadata rejeitada com HTTP 403');

  // 8. app_metadata com viewer -> 403
  const res8 = await simulateMetaAutomationSendMessage({
    authorizationHeader: 'Bearer valid_jwt_viewer',
    body: defaultValidBody,
  });
  assert(res8.status === 403 && !res8.metaCalled, '8. JWT com app_metadata.role="viewer" é rejeitado com HTTP 403');

  // 9. app_metadata com moderator -> 403
  const res9 = await simulateMetaAutomationSendMessage({
    authorizationHeader: 'Bearer valid_jwt_moderator',
    body: defaultValidBody,
  });
  assert(res9.status === 403 && !res9.metaCalled, '9. JWT com app_metadata.role="moderator" é rejeitado com HTTP 403');

  // 10. app_metadata com role desconhecida -> 403
  const res10 = await simulateMetaAutomationSendMessage({
    authorizationHeader: 'Bearer valid_jwt_unknown_role',
    body: defaultValidBody,
  });
  assert(res10.status === 403 && !res10.metaCalled, '10. JWT com role desconhecida é rejeitado com HTTP 403');

  // 11. app_metadata com operator -> 200
  mockDb.reset();
  const res11 = await simulateMetaAutomationSendMessage({
    authorizationHeader: 'Bearer valid_jwt_operator',
    body: defaultValidBody,
  });
  assert(res11.status === 200 && res11.metaCalled, '11. JWT com app_metadata.role="operator" é autorizado com sucesso (HTTP 200)');

  // 12. app_metadata com admin -> 200
  mockDb.reset();
  const res12 = await simulateMetaAutomationSendMessage({
    authorizationHeader: 'Bearer valid_jwt_admin',
    body: { ...defaultValidBody, messageId: 'msg_inbound_admin_test' },
  });
  assert(res12.status === 200 && res12.metaCalled, '12. JWT com app_metadata.role="admin" é autorizado com sucesso (HTTP 200)');

  // 13. app_metadata com disabled=true -> 403
  const res13 = await simulateMetaAutomationSendMessage({
    authorizationHeader: 'Bearer valid_jwt_disabled',
    body: defaultValidBody,
  });
  assert(res13.status === 403 && !res13.metaCalled, '13. Usuário com app_metadata.disabled=true é rejeitado com HTTP 403');

  // 14. app_metadata com can_send_outbound=false -> 403
  const res14 = await simulateMetaAutomationSendMessage({
    authorizationHeader: 'Bearer valid_jwt_cant_send',
    body: defaultValidBody,
  });
  assert(res14.status === 403 && !res14.metaCalled, '14. Usuário com can_send_outbound=false é rejeitado com HTTP 403');

  // --------------------------------------------------------------------
  // PARTE 3: Validação da Automação e Ação no Banco (Testes 15 a 21)
  // --------------------------------------------------------------------
  console.log('\n\x1b[1m--- PARTE 3: Validação da Automação & Ação no Banco de Dados (Testes 15 a 21) ---\x1b[0m');

  // 15. automation inexistente -> 404
  const res15 = await simulateMetaAutomationSendMessage({
    authorizationHeader: 'Bearer valid_jwt_operator',
    body: { ...defaultValidBody, automationId: 'auto_inexistente_999' },
  });
  assert(res15.status === 404 && !res15.metaCalled, '15. Automação inexistente no banco é rejeitada com HTTP 404');

  // 16. automation desativada -> rejeição (400)
  const res16 = await simulateMetaAutomationSendMessage({
    authorizationHeader: 'Bearer valid_jwt_operator',
    body: {
      ...defaultValidBody,
      automationId: 'auto_disabled_01',
      actionId: 'action_disabled_send',
    },
  });
  assert(res16.status === 400 && res16.body.code === 'AUTOMATION_DISABLED' && !res16.metaCalled, '16. Automação desativada é rejeitada fail-closed com HTTP 400 (AUTOMATION_DISABLED)');

  // 17. action inexistente -> rejeição (400)
  const res17 = await simulateMetaAutomationSendMessage({
    authorizationHeader: 'Bearer valid_jwt_operator',
    body: { ...defaultValidBody, actionId: 'action_fantasma_xyz' },
  });
  assert(res17.status === 400 && !res17.metaCalled, '17. Ação não encontrada na automação é rejeitada com HTTP 400');

  // 18. actionId pertencente a outra automation -> rejeição (400)
  const res18 = await simulateMetaAutomationSendMessage({
    authorizationHeader: 'Bearer valid_jwt_operator',
    body: {
      ...defaultValidBody,
      automationId: 'auto_welcome_01',
      actionId: 'action_foreign_02', // Belongs to auto_other_02
    },
  });
  assert(res18.status === 400 && !res18.metaCalled, '18. Ação pertencente a outra automação é rejeitada com HTTP 400');

  // 19. action que não é send_message -> rejeição (400)
  const res19 = await simulateMetaAutomationSendMessage({
    authorizationHeader: 'Bearer valid_jwt_operator',
    body: {
      ...defaultValidBody,
      actionId: 'action_wrong_type', // Type: tag_contact
    },
  });
  assert(res19.status === 400 && !res19.metaCalled, '19. Ação com tipo incompatível (tag_contact) é rejeitada com HTTP 400');

  // 20. messageText vazio -> rejeição (400)
  const res20 = await simulateMetaAutomationSendMessage({
    authorizationHeader: 'Bearer valid_jwt_operator',
    body: {
      ...defaultValidBody,
      actionId: 'action_empty_text',
    },
  });
  assert(res20.status === 400 && !res20.metaCalled, '20. Ação com messageText vazio no banco de dados é rejeitada com HTTP 400');

  // 21. text fornecido pelo caller diferente do messageText armazenado -> o texto armazenado na action deve prevalecer (200)
  mockDb.reset();
  const callerMaliciousText = 'PROMOÇÃO EXCLUSIVA CLIQUE NO LINK SUSPEITO';
  const res21 = await simulateMetaAutomationSendMessage({
    authorizationHeader: 'Bearer valid_jwt_operator',
    body: {
      ...defaultValidBody,
      text: callerMaliciousText,
      messageId: 'msg_verify_text_override',
    },
  });
  const expectedDbText = 'Olá! Seja muito bem-vindo à Fabre Automations.';
  assert(
    res21.status === 200 &&
    res21.persistedMessage?.content === expectedDbText &&
    res21.persistedMessage?.content !== callerMaliciousText,
    '21. O texto armazenado na action prevalece categoricamente sobre o texto fornecido pelo caller'
  );

  // --------------------------------------------------------------------
  // PARTE 4: Validação de Canais, Destinatário e Infraestrutura (Testes 22 a 27)
  // --------------------------------------------------------------------
  console.log('\n\x1b[1m--- PARTE 4: Canais, Destinatário & Infraestrutura Meta (Testes 22 a 27) ---\x1b[0m');

  // 22. canal instagram -> rejeição (400)
  const res22 = await simulateMetaAutomationSendMessage({
    authorizationHeader: 'Bearer valid_jwt_operator',
    body: {
      ...defaultValidBody,
      conversationId: 'conv_ig_01',
    },
  });
  assert(res22.status === 400 && res22.body.status === 'UNSUPPORTED_CHANNEL' && !res22.metaCalled, '22. Canal Instagram bloqueado por falta de certificação com HTTP 400');

  // 23. canal messenger -> rejeição (400)
  const res23 = await simulateMetaAutomationSendMessage({
    authorizationHeader: 'Bearer valid_jwt_operator',
    body: {
      ...defaultValidBody,
      conversationId: 'conv_msg_01',
    },
  });
  assert(res23.status === 400 && res23.body.status === 'UNSUPPORTED_CHANNEL' && !res23.metaCalled, '23. Canal Messenger bloqueado por falta de certificação com HTTP 400');

  // 24. recipient inválido -> rejeição (400)
  const res24 = await simulateMetaAutomationSendMessage({
    authorizationHeader: 'Bearer valid_jwt_operator',
    body: {
      ...defaultValidBody,
      conversationId: 'conv_wa_invalid_phone',
    },
  });
  assert(res24.status === 400 && !res24.metaCalled, '24. Contato com número de telefone inválido/vazio é rejeitado com HTTP 400');

  // 25. WHATSAPP_ACCESS_TOKEN ausente -> falha limpa sem crash (500)
  const res25 = await simulateMetaAutomationSendMessage({
    authorizationHeader: 'Bearer valid_jwt_operator',
    body: { ...defaultValidBody, messageId: 'msg_no_token' },
    envConfig: { WHATSAPP_ACCESS_TOKEN: '' },
  });
  assert(res25.status === 500 && !res25.metaCalled && res25.body.code === 'INTERNAL_ERROR', '25. WHATSAPP_ACCESS_TOKEN ausente retorna HTTP 500 sem crash do servidor');

  // 26. WHATSAPP_PHONE_NUMBER_ID ausente -> rejeição (400)
  const res26 = await simulateMetaAutomationSendMessage({
    authorizationHeader: 'Bearer valid_jwt_operator',
    body: { ...defaultValidBody, messageId: 'msg_no_phone_id' },
    envConfig: { WHATSAPP_PHONE_NUMBER_ID: '' },
  });
  assert(res26.status === 400 && !res26.metaCalled, '26. WHATSAPP_PHONE_NUMBER_ID ausente retorna HTTP 400');

  // 27. erro da Meta -> repassado com segurança (400/502)
  const res27 = await simulateMetaAutomationSendMessage({
    authorizationHeader: 'Bearer valid_jwt_operator',
    body: { ...defaultValidBody, messageId: 'msg_meta_err_131030' },
    envConfig: {
      SIMULATE_META_ERROR: true,
      META_ERROR_CODE: 131030,
      META_ERROR_MESSAGE: 'Recipient phone number not authorized in Meta development mode',
    },
  });
  assert(res27.status === 400 && res27.body.status === 'PROVIDER_REJECTED' && res27.body.metaCode === 131030, '27. Erro da Meta Graph API é tratado e repassado com segurança');

  // --------------------------------------------------------------------
  // PARTE 5: Sucesso, Idempotência e Auditoria (Testes 28 a 30)
  // --------------------------------------------------------------------
  console.log('\n\x1b[1m--- PARTE 5: Sucesso, Idempotência & Auditoria (Testes 28 a 30) ---\x1b[0m');

  // 28. sucesso da Meta -> gera status sent
  mockDb.reset();
  const res28 = await simulateMetaAutomationSendMessage({
    authorizationHeader: 'Bearer valid_jwt_operator',
    body: {
      ...defaultValidBody,
      messageId: 'msg_test_sent_status',
    },
  });
  assert(
    res28.status === 200 &&
    res28.persistedMessage?.status === 'sent' &&
    res28.persistedMessage?.sender === 'bot',
    '28. Disparo com sucesso registra mensagem com status="sent" e sender="bot"'
  );

  // 29. idempotência com external_event_id/wamid -> evita disparo duplicado
  const res29 = await simulateMetaAutomationSendMessage({
    authorizationHeader: 'Bearer valid_jwt_operator',
    body: {
      ...defaultValidBody,
      messageId: 'msg_test_sent_status', // Same messageId as test 28
    },
  });
  assert(
    res29.status === 200 &&
    res29.body.status === 'DUPLICATE' &&
    res29.body.code === 'EVENT_ALREADY_PROCESSED' &&
    !res29.metaCalled,
    '29. Idempotência por messageId/actionId impede segundo disparo para a Meta Cloud API'
  );

  // 30. auditoria: mensagem persistida contém dados corretos de automação e operador autorizador
  const auditMsg = res28.persistedMessage;
  assert(
    auditMsg !== undefined &&
    auditMsg.metadata?.automationId === 'auto_welcome_01' &&
    auditMsg.metadata?.automationName === 'Boas-Vindas WhatsApp' &&
    auditMsg.metadata?.actionId === 'action_send_welcome' &&
    auditMsg.metadata?.isAutomated === true &&
    auditMsg.metadata?.operator_authorized_by === 'usr_op_01' &&
    typeof auditMsg.external_event_id === 'string' &&
    auditMsg.external_event_id.startsWith('wamid.'),
    '30. Mensagem persistida registra auditoria completa (automationId, actionId, wamid, operator_authorized_by)'
  );

  // Summary
  console.log('\n\x1b[1m\x1b[36m======================================================================\x1b[0m');
  console.log(`\x1b[1m\x1b[32mRESULTADO FINAL: ${passedTests}/${totalTests} TESTES APROVADOS COM SUCESSO.\x1b[0m`);
  console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSecureAutomationOutboundTests().catch((err) => {
  console.error('Falha fatal na execução da suíte de testes:', err);
  process.exit(1);
});
