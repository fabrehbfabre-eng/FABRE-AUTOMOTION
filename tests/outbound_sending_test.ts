/**
 * FABRE AUTOMATION - Security Hardening & Outbound Sending Test Suite
 * Release: Security Hardening | Correção de Autorização Real do Operador (Fail-Closed)
 * 
 * CLASSIFICAÇÃO DOS TESTES: TESTES LOCAIS / SIMULAÇÃO COM MOCKS EM MEMÓRIA
 * NOTA: Testes automatizados executados localmente sem tráfego real contra a Meta Graph API.
 * 
 * Regra Fundamental: AUTENTICADO NÃO SIGNIFICA AUTORIZADO.
 * Ausência de role explícita em app_metadata resulta em HTTP 403 (SEM PERMISSÃO).
 * user_metadata NUNCA concede privilégios.
 * NENHUM fallback automático para "operator".
 * 
 * Cobertura de Testes Obrigatórios (PARTE 10):
 *  1. Sem Authorization -> 401
 *  2. Apikey pública isolada -> 401
 *  3. Authorization sem Bearer -> 401
 *  4. Bearer vazio -> 401
 *  5. JWT inválido -> 401
 *  6. JWT expirado -> 401
 *  7. JWT válido sem role -> 403
 *  8. JWT válido com user_metadata.role = "operator" mas sem app_metadata.role autorizado -> 403
 *  9. JWT válido com app_metadata.role = "viewer" -> 403
 * 10. JWT válido com app_metadata.role desconhecido -> 403
 * 11. JWT válido com app_metadata.role = "operator" -> autorizado (200)
 * 12. JWT válido com app_metadata.role = "admin" -> autorizado (200)
 * 13. app_metadata.disabled = true -> 403
 * 14. app_metadata.can_send_outbound = false -> 403
 * 15. Em 401, Meta não é chamada
 * 16. Em 403, Meta não é chamada
 * 17. Em 401, banco não recebe mensagem outbound
 * 18. Em 403, banco não recebe mensagem outbound
 * 19. Operador autorizado mantém fluxo outbound existente
 * 20. operator_id continua sendo o user.id autenticado
 * + Preservação das regras de negócio (limite 4096 caracteres, rejeição Instagram/Messenger, erro 131030 Meta, etc.)
 */

interface MockMessage {
  id: string;
  conversation_id: string;
  sender: 'user' | 'contact' | 'bot' | 'system';
  channel: 'instagram' | 'messenger' | 'whatsapp';
  content: string;
  content_type: 'text' | 'image' | 'audio' | 'quick_reply' | 'template' | 'system_event';
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  external_event_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

interface MockConversation {
  id: string;
  contact_id: string;
  channel: 'instagram' | 'messenger' | 'whatsapp';
  status: 'open' | 'waiting_user' | 'resolved' | 'archived';
  handler: 'bot' | 'human';
  unread_count: number;
  updated_at: string;
}

interface MockProfile {
  id: string;
  name: string;
  username: string;
  channel: 'instagram' | 'messenger' | 'whatsapp';
  phone?: string;
  metadata?: Record<string, any>;
}

interface MockUser {
  id: string;
  email?: string;
  role: string; // 'authenticated' | 'anon'
  app_metadata?: Record<string, any>;
  user_metadata?: Record<string, any>;
}

// In-Memory Database Store for Testing
class TestDatabase {
  profiles: MockProfile[] = [];
  conversations: MockConversation[] = [];
  messages: MockMessage[] = [];

  reset() {
    this.profiles = [
      {
        id: 'prof_wa_01',
        name: 'Cliente WhatsApp Teste',
        username: 'wa_5511999998888',
        channel: 'whatsapp',
        phone: '5511999998888',
        metadata: {
          wa_id: '5511999998888',
          phone_number_id: 'phone_num_123456',
        },
      },
      {
        id: 'prof_ig_01',
        name: 'Seguidor Instagram',
        username: 'seguidor_ig',
        channel: 'instagram',
      },
      {
        id: 'prof_fb_01',
        name: 'Usuário Messenger',
        username: 'fb_user_99',
        channel: 'messenger',
      },
    ];

    this.conversations = [
      {
        id: 'conv_wa_01',
        contact_id: 'prof_wa_01',
        channel: 'whatsapp',
        status: 'open',
        handler: 'human',
        unread_count: 2,
        updated_at: '2026-09-01T10:00:00Z',
      },
      {
        id: 'conv_ig_01',
        contact_id: 'prof_ig_01',
        channel: 'instagram',
        status: 'open',
        handler: 'human',
        unread_count: 1,
        updated_at: '2026-09-01T10:00:00Z',
      },
      {
        id: 'conv_fb_01',
        contact_id: 'prof_fb_01',
        channel: 'messenger',
        status: 'open',
        handler: 'human',
        unread_count: 1,
        updated_at: '2026-09-01T10:00:00Z',
      },
    ];

    this.messages = [];
  }
}

// Mock Supabase Auth getUser implementation with granular test users
async function mockGetUser(token: string): Promise<{ data: { user: MockUser | null }; error: { message: string } | null }> {
  if (token === 'valid_jwt_operator_123') {
    return {
      data: {
        user: {
          id: 'usr_op_fabre_01',
          email: 'operador@fabre.com.br',
          role: 'authenticated',
          app_metadata: { role: 'operator' },
          user_metadata: { name: 'Operador Fabre' },
        },
      },
      error: null,
    };
  }

  if (token === 'valid_jwt_admin_456') {
    return {
      data: {
        user: {
          id: 'usr_admin_fabre_99',
          email: 'admin@fabre.com.br',
          role: 'authenticated',
          app_metadata: { role: 'admin' },
          user_metadata: { name: 'Administrador Fabre' },
        },
      },
      error: null,
    };
  }

  if (token === 'valid_jwt_viewer_789') {
    return {
      data: {
        user: {
          id: 'usr_viewer_01',
          email: 'observador@fabre.com.br',
          role: 'authenticated',
          app_metadata: { role: 'viewer' },
        },
      },
      error: null,
    };
  }

  // User with valid JWT but NO role in app_metadata
  if (token === 'valid_jwt_no_role') {
    return {
      data: {
        user: {
          id: 'usr_no_role_01',
          email: 'semrole@fabre.com.br',
          role: 'authenticated',
          app_metadata: {},
          user_metadata: { name: 'Usuário Comum' },
        },
      },
      error: null,
    };
  }

  // User attempting privilege escalation via user_metadata (should be rejected)
  if (token === 'valid_jwt_spoofed_user_metadata') {
    return {
      data: {
        user: {
          id: 'usr_spoof_01',
          email: 'tentativa_escalacao@externo.com',
          role: 'authenticated',
          app_metadata: {}, // app_metadata is empty
          user_metadata: { role: 'operator', name: 'Atacante Spoofed' }, // user_metadata claims operator
        },
      },
      error: null,
    };
  }

  // User with unknown/unsupported role
  if (token === 'valid_jwt_unknown_role') {
    return {
      data: {
        user: {
          id: 'usr_unknown_role_01',
          email: 'moderador@fabre.com.br',
          role: 'authenticated',
          app_metadata: { role: 'moderator' },
        },
      },
      error: null,
    };
  }

  // User with disabled: true
  if (token === 'valid_jwt_disabled_user') {
    return {
      data: {
        user: {
          id: 'usr_disabled_01',
          email: 'bloqueado@fabre.com.br',
          role: 'authenticated',
          app_metadata: { role: 'operator', disabled: true },
        },
      },
      error: null,
    };
  }

  // User with can_send_outbound: false
  if (token === 'valid_jwt_cant_send_outbound') {
    return {
      data: {
        user: {
          id: 'usr_cant_send_01',
          email: 'restrito@fabre.com.br',
          role: 'authenticated',
          app_metadata: { role: 'operator', can_send_outbound: false },
        },
      },
      error: null,
    };
  }

  if (token === 'public_anon_key_123') {
    return {
      data: { user: null },
      error: { message: 'Invalid JWT: public anon key is not an authenticated user session' },
    };
  }

  if (token === 'expired_jwt_token') {
    return {
      data: { user: null },
      error: { message: 'JWT expired at 2026-09-01T00:00:00Z' },
    };
  }

  return {
    data: { user: null },
    error: { message: 'Invalid JWT signature or malformed token' },
  };
}

// Simulated Edge Function logic matching supabase/functions/meta-send-message/index.ts
async function simulateMetaSendMessage(
  db: TestDatabase,
  request: {
    headers: Record<string, string>;
    body: any;
    env: Record<string, string>;
    fetchMock?: (url: string, init: any) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;
  }
): Promise<{ status: number; body: any }> {
  // 1. CORS Preflight & Method check (assumed POST)

  // 2. Cryptographic JWT Authentication Check
  const authHeader = request.headers['authorization'] || request.headers['Authorization'];
  if (!authHeader || !authHeader.trim().toLowerCase().startsWith('bearer ')) {
    return {
      status: 401,
      body: { error: 'Usuário não autenticado ou sessão inválida.', code: 'UNAUTHORIZED' },
    };
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return {
      status: 401,
      body: { error: 'Usuário não autenticado ou sessão inválida.', code: 'UNAUTHORIZED' },
    };
  }

  const { data: authData, error: authError } = await mockGetUser(token);
  if (authError || !authData?.user || !authData.user.id) {
    return {
      status: 401,
      body: { error: 'Usuário não autenticado ou sessão inválida.', code: 'UNAUTHORIZED' },
    };
  }

  const user = authData.user;
  if (user.role !== 'authenticated') {
    return {
      status: 401,
      body: { error: 'Usuário não autenticado ou sessão inválida.', code: 'UNAUTHORIZED' },
    };
  }

  // 3. Operator Authorization Check (Fail-Closed)
  // Security Policy: Authenticated does NOT mean Authorized.
  // 1) We NEVER trust user.user_metadata for privileged actions (user-mutable).
  // 2) We NEVER use automatic fallback to "operator" or any default role.
  // 3) Role MUST be explicitly declared in server-managed app_metadata.
  // 4) Allowed roles: "operator", "admin".
  // 5) Explicitly reject: "viewer", unknown roles, missing roles, empty roles, disabled users.
  const appRole = typeof user.app_metadata?.role === 'string'
    ? user.app_metadata.role.trim().toLowerCase()
    : null;

  const isExplicitlyAuthorized = appRole === 'operator' || appRole === 'admin';
  const isDisabled = user.app_metadata?.disabled === true || user.app_metadata?.can_send_outbound === false;

  if (!isExplicitlyAuthorized || isDisabled) {
    return {
      status: 403,
      body: { error: 'Usuário autenticado, mas sem permissão para executar esta operação.', code: 'FORBIDDEN' },
    };
  }

  // 4. Request Body Parsing & Sanitization (Strictly after auth & authorization)
  const { conversationId, text } = request.body || {};
  if (!conversationId || typeof conversationId !== 'string' || !conversationId.trim()) {
    return { status: 400, body: { error: 'Campo obrigatório ausente ou inválido: conversationId.', code: 'INVALID_INPUT' } };
  }

  if (!text || typeof text !== 'string' || !text.trim()) {
    return { status: 400, body: { error: 'Campo obrigatório ausente ou inválido: text. Mensagens vazias não são permitidas.', code: 'INVALID_INPUT' } };
  }

  const trimmedText = text.trim();
  if (trimmedText.length > 4096) {
    return { status: 400, body: { error: 'O tamanho da mensagem excede o limite máximo permitido de 4096 caracteres.', code: 'INVALID_INPUT' } };
  }

  // 5. Conversation & Contact Profile Lookup
  const conv = db.conversations.find(c => c.id === conversationId.trim());
  if (!conv) {
    return { status: 404, body: { error: `Conversa não encontrada: ${conversationId}`, code: 'NOT_FOUND' } };
  }

  const contact = db.profiles.find(p => p.id === conv.contact_id);
  if (!contact) {
    return { status: 404, body: { error: `Contato associado à conversa não encontrado: ${conv.contact_id}`, code: 'NOT_FOUND' } };
  }

  // 6. Channel Certification Check
  if (conv.channel === 'instagram' || conv.channel === 'messenger') {
    return {
      status: 400,
      body: {
        error: `Envio outbound para o canal ${conv.channel === 'instagram' ? 'Instagram' : 'Messenger'} ainda não está certificado nesta Release. Apenas WhatsApp Business Cloud API está habilitado para envio real.`,
        code: 'INVALID_INPUT',
      },
    };
  }

  if (conv.channel !== 'whatsapp') {
    return { status: 400, body: { error: `Canal não suportado para envio outbound: ${conv.channel}`, code: 'INVALID_INPUT' } };
  }

  // 7. WhatsApp Outbound Parameters Resolution
  const recipientPhone = (contact.phone || contact.metadata?.wa_id || '').replace(/\D/g, '');
  if (!recipientPhone || recipientPhone.length < 8) {
    return { status: 400, body: { error: 'Número de telefone do destinatário inválido ou não cadastrado no perfil de contato.', code: 'INVALID_INPUT' } };
  }

  const phoneNumberId = request.env['WHATSAPP_PHONE_NUMBER_ID'] || contact.metadata?.phone_number_id;
  if (!phoneNumberId) {
    return { status: 400, body: { error: 'Identificador da linha WhatsApp (WHATSAPP_PHONE_NUMBER_ID) não configurado no servidor nem nos metadados da conexão.', code: 'INVALID_INPUT' } };
  }

  const accessToken = request.env['WHATSAPP_ACCESS_TOKEN'];
  if (!accessToken || !accessToken.trim()) {
    return { status: 400, body: { error: 'Token da WhatsApp Business Cloud API não configurado no servidor (WHATSAPP_ACCESS_TOKEN).', code: 'UNAUTHORIZED' } };
  }

  // 8. Meta Cloud API Request
  const fetchFn = request.fetchMock || (async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      messaging_product: 'whatsapp',
      contacts: [{ input: recipientPhone, wa_id: recipientPhone }],
      messages: [{ id: `wamid.test_${Date.now()}` }],
    }),
  }));

  const metaRes = await fetchFn(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhone,
      type: 'text',
      text: { preview_url: false, body: trimmedText },
    }),
  });

  if (!metaRes.ok) {
    const errorJson = await metaRes.json();
    const errCode = errorJson.error?.code || metaRes.status;
    let errMsg = `Falha na Meta Cloud API [${errCode}]: ${errorJson.error?.message || 'Erro desconhecido'}`;
    if (errCode === 131030) {
      errMsg = `Número de telefone não autorizado no modo de desenvolvimento Meta (Código 131030). Adicione este número como 'Test Number' no painel de desenvolvedores Meta.`;
    } else if (errCode === 190) {
      errMsg = `Token da WhatsApp Business Cloud API expirou ou é inválido (Código 190). Atualize a Secret WHATSAPP_ACCESS_TOKEN.`;
    }

    return {
      status: metaRes.status >= 500 ? 502 : 400,
      body: { error: errMsg, code: 'INTERNAL_ERROR', details: { metaCode: errCode } },
    };
  }

  const successData = await metaRes.json();
  const wamid = successData.messages?.[0]?.id || `wamid.mock_${Date.now()}`;

  // 9. PostgreSQL Persistence with Operator Attribution
  const newMsg: MockMessage = {
    id: `msg_wa_${Date.now()}`,
    conversation_id: conv.id,
    sender: 'user',
    channel: 'whatsapp',
    content: trimmedText,
    content_type: 'text',
    status: 'sent',
    external_event_id: wamid,
    metadata: {
      outbound: true,
      sent_by: 'operator',
      operator_id: user.id,
      operator_email: user.email || null,
      recipient: recipientPhone,
      phone_number_id: phoneNumberId,
      meta_message_id: wamid,
    },
    created_at: new Date().toISOString(),
  };

  db.messages.push(newMsg);
  conv.updated_at = newMsg.created_at;
  conv.unread_count = 0;

  return {
    status: 200,
    body: {
      status: 'SUCCESS',
      message: {
        id: newMsg.id,
        conversationId: newMsg.conversation_id,
        sender: newMsg.sender,
        channel: newMsg.channel,
        content: newMsg.content,
        contentType: newMsg.content_type,
        status: newMsg.status,
        externalEventId: newMsg.external_event_id,
        createdAt: newMsg.created_at,
      },
      externalId: wamid,
    },
  };
}

async function runTests() {
  console.log('======================================================================');
  console.log('FABRE AUTOMATION - SUITE DE TESTES: CORREÇÃO DE AUTORIZAÇÃO OUTBOUND');
  console.log('Classificação Técnica: TESTES LOCAIS / SIMULAÇÃO COM MOCKS');
  console.log('Princípio: AUTENTICADO NÃO SIGNIFICA AUTORIZADO (Fail-Closed)');
  console.log('======================================================================\n');

  const db = new TestDatabase();
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name}`);
      if (detail) console.error(`   Detalhe: ${detail}`);
    }
  }

  // -------------------------------------------------------------------------
  // PARTE 1: AUTENTICAÇÃO JWT CRIPTOGRÁFICA
  // -------------------------------------------------------------------------
  console.log('--- PARTE 1: Autenticação JWT Criptográfica ---');
  db.reset();

  // 1. Sem Authorization -> 401
  const noAuthRes = await simulateMetaSendMessage(db, {
    headers: {},
    body: { conversationId: 'conv_wa_01', text: 'Mensagem sem auth' },
    env: { WHATSAPP_ACCESS_TOKEN: 'valid_token' },
  });
  assert(noAuthRes.status === 401, '1. Rejeita requisição sem Authorization com HTTP 401', JSON.stringify(noAuthRes.body));
  assert(noAuthRes.body.error === 'Usuário não autenticado ou sessão inválida.', '1. Retorna mensagem padronizada de erro 401');

  // 2. Apikey pública isolada -> 401
  const anonKeyOnlyRes = await simulateMetaSendMessage(db, {
    headers: { apikey: 'public_anon_key_123' },
    body: { conversationId: 'conv_wa_01', text: 'Tentativa apenas com apikey pública' },
    env: { WHATSAPP_ACCESS_TOKEN: 'valid_token' },
  });
  assert(anonKeyOnlyRes.status === 401, '2. Rejeita apikey pública isolada sem token Bearer de sessão (HTTP 401)');

  // 3. Authorization sem Bearer -> 401
  const malformedAuthHeaderRes = await simulateMetaSendMessage(db, {
    headers: { Authorization: 'Basic some_user_pass' },
    body: { conversationId: 'conv_wa_01', text: 'Header sem Bearer' },
    env: { WHATSAPP_ACCESS_TOKEN: 'valid_token' },
  });
  assert(malformedAuthHeaderRes.status === 401, '3. Rejeita header de autorização sem prefixo Bearer (HTTP 401)');

  // 4. Bearer vazio -> 401
  const emptyBearerRes = await simulateMetaSendMessage(db, {
    headers: { Authorization: 'Bearer   ' },
    body: { conversationId: 'conv_wa_01', text: 'Bearer vazio' },
    env: { WHATSAPP_ACCESS_TOKEN: 'valid_token' },
  });
  assert(emptyBearerRes.status === 401, '4. Rejeita token Bearer vazio (HTTP 401)');

  // 5. JWT inválido -> 401
  const invalidJwtRes = await simulateMetaSendMessage(db, {
    headers: { Authorization: 'Bearer invalid_signature_token_xyz' },
    body: { conversationId: 'conv_wa_01', text: 'JWT inválido' },
    env: { WHATSAPP_ACCESS_TOKEN: 'valid_token' },
  });
  assert(invalidJwtRes.status === 401, '5. Rejeita JWT inválido ou assinatura incorreta (HTTP 401)');

  // 6. JWT expirado -> 401
  const expiredJwtRes = await simulateMetaSendMessage(db, {
    headers: { Authorization: 'Bearer expired_jwt_token' },
    body: { conversationId: 'conv_wa_01', text: 'JWT expirado' },
    env: { WHATSAPP_ACCESS_TOKEN: 'valid_token' },
  });
  assert(expiredJwtRes.status === 401, '6. Rejeita sessão JWT expirada (HTTP 401)');

  // -------------------------------------------------------------------------
  // PARTE 2: AUTORIZAÇÃO REAL DO OPERADOR (FAIL-CLOSED)
  // -------------------------------------------------------------------------
  console.log('\n--- PARTE 2: Autorização Real do Operador (Fail-Closed) ---');
  db.reset();

  // 7. JWT válido sem role -> 403
  const noRoleRes = await simulateMetaSendMessage(db, {
    headers: { Authorization: 'Bearer valid_jwt_no_role' },
    body: { conversationId: 'conv_wa_01', text: 'Tentativa por usuário sem role' },
    env: { WHATSAPP_ACCESS_TOKEN: 'valid_token' },
  });
  assert(noRoleRes.status === 403, '7. JWT válido sem role em app_metadata é rejeitado com HTTP 403 (Sem fallback)');
  assert(
    noRoleRes.body.error === 'Usuário autenticado, mas sem permissão para executar esta operação.',
    '7. Retorna mensagem informativa padronizada de 403'
  );

  // 8. JWT válido com user_metadata.role = "operator" mas sem app_metadata.role autorizado -> 403
  const spoofedMetadataRes = await simulateMetaSendMessage(db, {
    headers: { Authorization: 'Bearer valid_jwt_spoofed_user_metadata' },
    body: { conversationId: 'conv_wa_01', text: 'Tentativa de escalação via user_metadata' },
    env: { WHATSAPP_ACCESS_TOKEN: 'valid_token' },
  });
  assert(
    spoofedMetadataRes.status === 403,
    '8. JWT com user_metadata.role="operator" é rejeitado com HTTP 403 (user_metadata não concede privilégios)'
  );

  // 9. JWT válido com app_metadata.role = "viewer" -> 403
  const viewerRes = await simulateMetaSendMessage(db, {
    headers: { Authorization: 'Bearer valid_jwt_viewer_789' },
    body: { conversationId: 'conv_wa_01', text: 'Tentativa de envio por viewer' },
    env: { WHATSAPP_ACCESS_TOKEN: 'valid_token' },
  });
  assert(viewerRes.status === 403, '9. JWT válido com app_metadata.role="viewer" é rejeitado com HTTP 403');

  // 10. JWT válido com app_metadata.role desconhecido -> 403
  const unknownRoleRes = await simulateMetaSendMessage(db, {
    headers: { Authorization: 'Bearer valid_jwt_unknown_role' },
    body: { conversationId: 'conv_wa_01', text: 'Tentativa com role desconhecida' },
    env: { WHATSAPP_ACCESS_TOKEN: 'valid_token' },
  });
  assert(unknownRoleRes.status === 403, '10. JWT válido com role desconhecida ("moderator") é rejeitado com HTTP 403');

  // 11. JWT válido com app_metadata.role = "operator" -> autorizado
  const operatorRes = await simulateMetaSendMessage(db, {
    headers: { Authorization: 'Bearer valid_jwt_operator_123' },
    body: { conversationId: 'conv_wa_01', text: 'Mensagem válida de operador' },
    env: {
      WHATSAPP_ACCESS_TOKEN: 'valid_token',
      WHATSAPP_PHONE_NUMBER_ID: 'phone_num_123456',
    },
  });
  assert(operatorRes.status === 200, '11. JWT válido com app_metadata.role="operator" autorizado com sucesso (HTTP 200)');

  // 12. JWT válido com app_metadata.role = "admin" -> autorizado
  db.reset();
  const adminRes = await simulateMetaSendMessage(db, {
    headers: { Authorization: 'Bearer valid_jwt_admin_456' },
    body: { conversationId: 'conv_wa_01', text: 'Mensagem válida de administrador' },
    env: {
      WHATSAPP_ACCESS_TOKEN: 'valid_token',
      WHATSAPP_PHONE_NUMBER_ID: 'phone_num_123456',
    },
  });
  assert(adminRes.status === 200, '12. JWT válido com app_metadata.role="admin" autorizado com sucesso (HTTP 200)');

  // 13. app_metadata.disabled = true -> 403
  const disabledUserRes = await simulateMetaSendMessage(db, {
    headers: { Authorization: 'Bearer valid_jwt_disabled_user' },
    body: { conversationId: 'conv_wa_01', text: 'Tentativa por usuário desabilitado' },
    env: { WHATSAPP_ACCESS_TOKEN: 'valid_token' },
  });
  assert(disabledUserRes.status === 403, '13. Usuário com app_metadata.disabled=true é rejeitado com HTTP 403');

  // 14. app_metadata.can_send_outbound = false -> 403
  const cantSendRes = await simulateMetaSendMessage(db, {
    headers: { Authorization: 'Bearer valid_jwt_cant_send_outbound' },
    body: { conversationId: 'conv_wa_01', text: 'Tentativa com can_send_outbound false' },
    env: { WHATSAPP_ACCESS_TOKEN: 'valid_token' },
  });
  assert(cantSendRes.status === 403, '14. Usuário com app_metadata.can_send_outbound=false é rejeitado com HTTP 403');

  // -------------------------------------------------------------------------
  // PARTE 3: ISOLAMENTO TOTAL DE AÇÕES NÃO AUTORIZADAS
  // -------------------------------------------------------------------------
  console.log('\n--- PARTE 3: Isolamento Total de Ações Não Autorizadas ---');
  db.reset();

  let metaCalledOn401 = false;
  await simulateMetaSendMessage(db, {
    headers: {},
    body: { conversationId: 'conv_wa_01', text: 'Não deve chamar a Meta' },
    env: { WHATSAPP_ACCESS_TOKEN: 'valid_token' },
    fetchMock: async () => {
      metaCalledOn401 = true;
      return { ok: true, status: 200, json: async () => ({}) };
    },
  });
  assert(metaCalledOn401 === false, '15. Em 401, a Meta Graph API NUNCA é invocada');
  assert(db.messages.length === 0, '17. Em 401, o banco NUNCA recebe mensagem outbound');

  let metaCalledOn403 = false;
  await simulateMetaSendMessage(db, {
    headers: { Authorization: 'Bearer valid_jwt_no_role' },
    body: { conversationId: 'conv_wa_01', text: 'Não deve chamar a Meta' },
    env: { WHATSAPP_ACCESS_TOKEN: 'valid_token' },
    fetchMock: async () => {
      metaCalledOn403 = true;
      return { ok: true, status: 200, json: async () => ({}) };
    },
  });
  assert(metaCalledOn403 === false, '16. Em 403, a Meta Graph API NUNCA é invocada');
  assert(db.messages.length === 0, '18. Em 403, o banco NUNCA recebe mensagem outbound');

  // -------------------------------------------------------------------------
  // PARTE 4: FLUXO OUTBOUND DO OPERADOR AUTORIZADO & OPERATOR_ID
  // -------------------------------------------------------------------------
  console.log('\n--- PARTE 4: Fluxo Outbound do Operador Autorizado & Rastreabilidade ---');
  db.reset();

  let capturedMetaHeaders: any = null;
  let capturedMetaPayload: any = null;

  const validSendRes = await simulateMetaSendMessage(db, {
    headers: { Authorization: 'Bearer valid_jwt_operator_123' },
    body: { conversationId: 'conv_wa_01', text: 'Resposta autorizada do operador' },
    env: {
      WHATSAPP_ACCESS_TOKEN: 'EAAG_SECRET_TOKEN_OFFICIAL',
      WHATSAPP_PHONE_NUMBER_ID: 'phone_num_123456',
    },
    fetchMock: async (url, init) => {
      capturedMetaHeaders = init.headers;
      capturedMetaPayload = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          messaging_product: 'whatsapp',
          contacts: [{ input: '5511999998888', wa_id: '5511999998888' }],
          messages: [{ id: 'wamid.HBgLMjAyNjA5MDMABC' }],
        }),
      };
    },
  });

  assert(validSendRes.status === 200, '19. Operador autorizado mantém fluxo outbound existente com sucesso (HTTP 200)');
  assert(capturedMetaPayload?.messaging_product === 'whatsapp', '19. Payload Meta usa messaging_product: "whatsapp"');
  assert(capturedMetaPayload?.to === '5511999998888', '19. Destinatário correto extraído do contato');
  assert(capturedMetaPayload?.text?.body === 'Resposta autorizada do operador', '19. Texto da mensagem preservado');
  assert(capturedMetaHeaders?.Authorization === 'Bearer EAAG_SECRET_TOKEN_OFFICIAL', '19. Token oficial despachado no cabeçalho Authorization');

  const persistedMsg = db.messages.find(m => m.conversation_id === 'conv_wa_01');
  assert(Boolean(persistedMsg), '19. Mensagem outbound persistida no banco de dados');
  assert(persistedMsg?.status === 'sent', '19. Mensagem persistida com status "sent"');
  assert(persistedMsg?.sender === 'user', '19. Mensagem persistida com sender "user" (operador)');
  assert(persistedMsg?.metadata?.operator_id === 'usr_op_fabre_01', '20. operator_id continua sendo exatamente o user.id autenticado');
  assert(persistedMsg?.external_event_id === 'wamid.HBgLMjAyNjA5MDMABC', '20. external_event_id persistido com o wamid oficial retornado pela Meta');

  const updatedConv = db.conversations.find(c => c.id === 'conv_wa_01');
  assert(updatedConv?.unread_count === 0, '19. Unread count resetado para 0 após envio do operador');

  // -------------------------------------------------------------------------
  // PARTE 5: PRESERVAÇÃO DE REGRAS DE NEGÓCIO & RESILIÊNCIA
  // -------------------------------------------------------------------------
  console.log('\n--- PARTE 5: Preservação de Regras de Negócio & Resiliência ---');
  db.reset();

  const emptyTextRes = await simulateMetaSendMessage(db, {
    headers: { Authorization: 'Bearer valid_jwt_operator_123' },
    body: { conversationId: 'conv_wa_01', text: '   ' },
    env: { WHATSAPP_ACCESS_TOKEN: 'valid_token' },
  });
  assert(emptyTextRes.status === 400, 'Regra: Rejeita texto vazio ou apenas espaços em branco (HTTP 400)');

  const missingConvRes = await simulateMetaSendMessage(db, {
    headers: { Authorization: 'Bearer valid_jwt_operator_123' },
    body: { text: 'Olá!' },
    env: { WHATSAPP_ACCESS_TOKEN: 'valid_token' },
  });
  assert(missingConvRes.status === 400, 'Regra: Rejeita requisição sem conversationId (HTTP 400)');

  const longTextRes = await simulateMetaSendMessage(db, {
    headers: { Authorization: 'Bearer valid_jwt_operator_123' },
    body: { conversationId: 'conv_wa_01', text: 'a'.repeat(4097) },
    env: { WHATSAPP_ACCESS_TOKEN: 'valid_token' },
  });
  assert(longTextRes.status === 400, 'Regra: Rejeita texto que exceda o limite de 4096 caracteres (HTTP 400)');

  const igRes = await simulateMetaSendMessage(db, {
    headers: { Authorization: 'Bearer valid_jwt_operator_123' },
    body: { conversationId: 'conv_ig_01', text: 'Tentando responder no Instagram' },
    env: { WHATSAPP_ACCESS_TOKEN: 'valid_token' },
  });
  assert(
    igRes.status === 400 && igRes.body.error.includes('Instagram ainda não está certificado nesta Release'),
    'Regra: Rejeita outbound em Instagram com mensagem informativa e sem simular sucesso'
  );

  const fbRes = await simulateMetaSendMessage(db, {
    headers: { Authorization: 'Bearer valid_jwt_operator_123' },
    body: { conversationId: 'conv_fb_01', text: 'Tentando responder no Messenger' },
    env: { WHATSAPP_ACCESS_TOKEN: 'valid_token' },
  });
  assert(
    fbRes.status === 400 && fbRes.body.error.includes('Messenger ainda não está certificado nesta Release'),
    'Regra: Rejeita outbound em Messenger com mensagem informativa e sem simular sucesso'
  );

  const devModeErrorRes = await simulateMetaSendMessage(db, {
    headers: { Authorization: 'Bearer valid_jwt_operator_123' },
    body: { conversationId: 'conv_wa_01', text: 'Tentativa para número fora da lista' },
    env: {
      WHATSAPP_ACCESS_TOKEN: 'EAAG_SECRET_TOKEN_OFFICIAL',
      WHATSAPP_PHONE_NUMBER_ID: 'phone_num_123456',
    },
    fetchMock: async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          message: 'Recipient phone number not in allowed list',
          type: 'OAuthException',
          code: 131030,
        },
      }),
    }),
  });
  assert(
    devModeErrorRes.status === 400 && devModeErrorRes.body.error.includes('131030'),
    'Regra: Tratamento amigável do erro 131030 da Meta sem expor segredos'
  );

  console.log('\n======================================================================');
  console.log(`RESULTADO FINAL: ${passed}/${total} TESTES PASSARAM COM SUCESSO.`);
  console.log('======================================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Erro na execução dos testes:', err);
  process.exit(1);
});
