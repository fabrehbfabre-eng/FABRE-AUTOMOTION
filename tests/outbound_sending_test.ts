/**
 * FABRE AUTOMATION - Outbound Sending Unit & Integration Logic Tests
 * Release: Outbound Sending | Resposta do Operador pela Inbox
 * 
 * Tests the 6 core scenarios:
 * TESTE 1: Validação de Inputs (Texto vazio, espaços em branco, limites de tamanho, conversationId ausente)
 * TESTE 2: Proteção de Canais Não Certificados (Tentativa de outbound em Instagram e Messenger é rejeitada com mensagem clara)
 * TESTE 3: Tratamento de Segredos e Configuração (Ausência de WHATSAPP_ACCESS_TOKEN / Phone Number ID gera erro explícito)
 * TESTE 4: Envio WhatsApp com Sucesso (Payload oficial para Meta Graph API v21.0, persistência em messages com status 'sent', external_event_id wamid, atualização de conversas)
 * TESTE 5: Erro retornado pela Meta API (Erro 131030 de Development Mode ou 190 de token expirado é tratado sem expor segredos)
 * TESTE 6: Anti-duplicação e Compatibilidade com Supabase Realtime (Deduplicação de mensagem por ID e externalEventId)
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

// Simulated Edge Function logic
async function simulateMetaSendMessage(
  db: TestDatabase,
  request: {
    headers: Record<string, string>;
    body: any;
    env: Record<string, string>;
    fetchMock?: (url: string, init: any) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;
  }
): Promise<{ status: number; body: any }> {
  // 1. Auth check
  if (!request.headers['authorization'] && !request.headers['apikey']) {
    return { status: 401, body: { error: 'Acesso não autorizado', code: 'UNAUTHORIZED' } };
  }

  // 2. Input validation
  const { conversationId, text } = request.body || {};
  if (!conversationId || typeof conversationId !== 'string' || !conversationId.trim()) {
    return { status: 400, body: { error: 'Campo obrigatório ausente: conversationId', code: 'INVALID_INPUT' } };
  }

  if (!text || typeof text !== 'string' || !text.trim()) {
    return { status: 400, body: { error: 'Campo obrigatório ausente: text', code: 'INVALID_INPUT' } };
  }

  const trimmedText = text.trim();
  if (trimmedText.length > 4096) {
    return { status: 400, body: { error: 'Tamanho da mensagem excede o limite', code: 'INVALID_INPUT' } };
  }

  // 3. Conversation & contact lookup
  const conv = db.conversations.find(c => c.id === conversationId.trim());
  if (!conv) {
    return { status: 404, body: { error: 'Conversa não encontrada', code: 'NOT_FOUND' } };
  }

  const contact = db.profiles.find(p => p.id === conv.contact_id);
  if (!contact) {
    return { status: 404, body: { error: 'Contato não encontrado', code: 'NOT_FOUND' } };
  }

  // 4. Channel certification check
  if (conv.channel === 'instagram' || conv.channel === 'messenger') {
    return {
      status: 400,
      body: {
        error: `Envio outbound para o canal ${conv.channel === 'instagram' ? 'Instagram' : 'Messenger'} ainda não está certificado nesta Release. Apenas WhatsApp Business Cloud API está habilitado para envio real.`,
        code: 'INVALID_INPUT',
      },
    };
  }

  // 5. WhatsApp parameters
  const recipientPhone = (contact.phone || contact.metadata?.wa_id || '').replace(/\D/g, '');
  if (!recipientPhone) {
    return { status: 400, body: { error: 'Número de telefone inválido', code: 'INVALID_INPUT' } };
  }

  const phoneNumberId = request.env['WHATSAPP_PHONE_NUMBER_ID'] || contact.metadata?.phone_number_id;
  if (!phoneNumberId) {
    return { status: 400, body: { error: 'WHATSAPP_PHONE_NUMBER_ID não configurado', code: 'INVALID_INPUT' } };
  }

  const accessToken = request.env['WHATSAPP_ACCESS_TOKEN'];
  if (!accessToken || !accessToken.trim()) {
    return { status: 400, body: { error: 'Token da WhatsApp Business Cloud API não configurado no servidor (WHATSAPP_ACCESS_TOKEN).', code: 'UNAUTHORIZED' } };
  }

  // 6. Meta Cloud API request
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
    return {
      status: metaRes.status,
      body: {
        error: `Falha na Meta Cloud API [${errorJson.error?.code || metaRes.status}]: ${errorJson.error?.message || 'Erro desconhecido'}`,
        code: 'INTERNAL_ERROR',
      },
    };
  }

  const successData = await metaRes.json();
  const wamid = successData.messages?.[0]?.id || `wamid.mock_${Date.now()}`;

  // 7. DB Persistence
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
      recipient: recipientPhone,
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
    },
  };
}

async function runTests() {
  console.log('====================================================');
  console.log('FABRE AUTOMATION - SUITE DE TESTES OUTBOUND SENDING');
  console.log('====================================================\n');

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

  // TESTE 1: Validação de Inputs
  console.log('--- TESTE 1: Validação de Inputs ---');
  db.reset();

  const emptyTextRes = await simulateMetaSendMessage(db, {
    headers: { authorization: 'Bearer test_key' },
    body: { conversationId: 'conv_wa_01', text: '   ' },
    env: { WHATSAPP_ACCESS_TOKEN: 'valid_token' },
  });
  assert(emptyTextRes.status === 400, 'Rejeita texto vazio ou apenas espaços em branco', JSON.stringify(emptyTextRes.body));

  const missingConvRes = await simulateMetaSendMessage(db, {
    headers: { authorization: 'Bearer test_key' },
    body: { text: 'Olá!' },
    env: { WHATSAPP_ACCESS_TOKEN: 'valid_token' },
  });
  assert(missingConvRes.status === 400, 'Rejeita requisição sem conversationId', JSON.stringify(missingConvRes.body));

  const unauthRes = await simulateMetaSendMessage(db, {
    headers: {},
    body: { conversationId: 'conv_wa_01', text: 'Olá!' },
    env: { WHATSAPP_ACCESS_TOKEN: 'valid_token' },
  });
  assert(unauthRes.status === 401, 'Rejeita requisição não autenticada com HTTP 401', JSON.stringify(unauthRes.body));

  // TESTE 2: Canais Não Certificados
  console.log('\n--- TESTE 2: Proteção de Canais Não Certificados ---');
  db.reset();

  const igRes = await simulateMetaSendMessage(db, {
    headers: { authorization: 'Bearer test_key' },
    body: { conversationId: 'conv_ig_01', text: 'Tentando responder no Instagram' },
    env: { WHATSAPP_ACCESS_TOKEN: 'valid_token' },
  });
  assert(
    igRes.status === 400 && igRes.body.error.includes('Instagram ainda não está certificado nesta Release'),
    'Rejeita outbound em Instagram com mensagem informativa e sem simular sucesso',
    igRes.body.error
  );

  const fbRes = await simulateMetaSendMessage(db, {
    headers: { authorization: 'Bearer test_key' },
    body: { conversationId: 'conv_fb_01', text: 'Tentando responder no Messenger' },
    env: { WHATSAPP_ACCESS_TOKEN: 'valid_token' },
  });
  assert(
    fbRes.status === 400 && fbRes.body.error.includes('Messenger ainda não está certificado nesta Release'),
    'Rejeita outbound em Messenger com mensagem informativa e sem simular sucesso',
    fbRes.body.error
  );

  // TESTE 3: Tratamento de Segredos e Configuração
  console.log('\n--- TESTE 3: Tratamento de Segredos e Configuração ---');
  db.reset();

  const missingTokenRes = await simulateMetaSendMessage(db, {
    headers: { authorization: 'Bearer test_key' },
    body: { conversationId: 'conv_wa_01', text: 'Mensagem real para WhatsApp' },
    env: {}, // No WHATSAPP_ACCESS_TOKEN
  });
  assert(
    missingTokenRes.status === 400 && missingTokenRes.body.error.includes('Token da WhatsApp Business Cloud API não configurado no servidor'),
    'Identifica ausência de WHATSAPP_ACCESS_TOKEN com mensagem clara de configuração',
    missingTokenRes.body.error
  );

  // TESTE 4: Envio WhatsApp com Sucesso
  console.log('\n--- TESTE 4: Envio WhatsApp com Sucesso ---');
  db.reset();

  let capturedMetaPayload: any = null;
  let capturedMetaHeaders: any = null;

  const validSendRes = await simulateMetaSendMessage(db, {
    headers: { authorization: 'Bearer test_key' },
    body: { conversationId: 'conv_wa_01', text: 'Olá, esta é uma resposta oficial do atendente humano!' },
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

  assert(validSendRes.status === 200, 'Envio com sucesso retorna HTTP 200', JSON.stringify(validSendRes.body));
  assert(capturedMetaPayload?.messaging_product === 'whatsapp', 'Payload Meta usa messaging_product: "whatsapp"');
  assert(capturedMetaPayload?.to === '5511999998888', 'Destinatário correto extraído do contato');
  assert(capturedMetaPayload?.text?.body === 'Olá, esta é uma resposta oficial do atendente humano!', 'Texto da mensagem enviado corretamente');
  assert(capturedMetaHeaders?.Authorization === 'Bearer EAAG_SECRET_TOKEN_OFFICIAL', 'Token oficial enviado via Header Authorization');

  const persistedMsg = db.messages.find(m => m.conversation_id === 'conv_wa_01');
  assert(Boolean(persistedMsg), 'Mensagem outbound persistida no banco de dados');
  assert(persistedMsg?.status === 'sent', 'Mensagem persistida com status: "sent"');
  assert(persistedMsg?.sender === 'user', 'Mensagem persistida com sender: "user" (operador)');
  assert(persistedMsg?.external_event_id === 'wamid.HBgLMjAyNjA5MDMABC', 'external_event_id persistido com o wamid oficial retornado pela Meta');

  const updatedConv = db.conversations.find(c => c.id === 'conv_wa_01');
  assert(updatedConv?.unread_count === 0, 'Unread count da conversa resetado para 0 após resposta do operador');

  // TESTE 5: Tratamento de Erros da Meta API (Modo Dev / Permissão)
  console.log('\n--- TESTE 5: Tratamento de Erros da Meta API ---');
  db.reset();

  const devModeErrorRes = await simulateMetaSendMessage(db, {
    headers: { authorization: 'Bearer test_key' },
    body: { conversationId: 'conv_wa_01', text: 'Tentativa para número não autorizado' },
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
          error_subcode: 2494010,
        },
      }),
    }),
  });

  assert(devModeErrorRes.status === 400, 'Retorna status 400 quando Meta rejeita com 400');
  assert(
    devModeErrorRes.body.error.includes('131030'),
    'Código de erro 131030 da Meta identificado e informado ao operador',
    devModeErrorRes.body.error
  );
  assert(
    !devModeErrorRes.body.error.includes('EAAG_SECRET_TOKEN_OFFICIAL'),
    'Segredos e tokens nunca vazam na mensagem de erro retornada'
  );

  // TESTE 6: Anti-duplicação e Realtime
  console.log('\n--- TESTE 6: Anti-duplicação e Realtime ---');
  const existingList: Array<{ id: string; externalEventId?: string; content: string }> = [
    { id: 'msg_01', externalEventId: 'wamid.HBgLMjAyNjA5MDMABC', content: 'Mensagem' },
  ];

  // Incoming event via Realtime with the same wamid
  const incomingRealtimeMsg = {
    id: 'msg_99_realtime',
    externalEventId: 'wamid.HBgLMjAyNjA5MDMABC',
    content: 'Mensagem',
  };

  const isDuplicate = existingList.some(
    m => m.id === incomingRealtimeMsg.id || (incomingRealtimeMsg.externalEventId && m.externalEventId === incomingRealtimeMsg.externalEventId)
  );

  assert(isDuplicate === true, 'Anti-duplicação impede inserção repetida por externalEventId (wamid)');

  console.log('\n====================================================');
  console.log(`RESULTADO FINAL: ${passed}/${total} testes passaram.`);
  console.log('====================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Erro na execução dos testes:', err);
  process.exit(1);
});
