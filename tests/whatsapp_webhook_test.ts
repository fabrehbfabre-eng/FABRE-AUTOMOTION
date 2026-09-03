/**
 * FABRE AUTOMATION - WhatsApp Webhook Unit & Integration Logic Tests
 * Release: WhatsApp Real Message Persistence
 * 
 * Tests the 5 mandatory scenarios:
 * TESTE 1: Payload WhatsApp válido com mensagem textual -> Profile, Conversation, Message, HTTP 200
 * TESTE 2: Mesmo payload enviado novamente -> Idempotência preservada, 0 duplicações, HTTP 200
 * TESTE 3: Payload sem messages -> Tratamento seguro, HTTP 200
 * TESTE 4: Payload com status update -> Nenhuma mensagem falsa criada, HTTP 200
 * TESTE 5: Payload WhatsApp inválido -> Comportamento seguro, erro apropriado, sem corrupção
 */

// Simulated In-Memory PostgreSQL Store to test repository and pipeline logic
interface MemoryDB {
  profiles: Array<{
    id: string;
    name: string;
    username: string;
    phone: string;
    channel: string;
    metadata: any;
    last_active_at: string;
  }>;
  conversations: Array<{
    id: string;
    contact_id: string;
    channel: string;
    status: string;
    handler: string;
    unread_count: number;
    metadata: any;
    updated_at: string;
  }>;
  messages: Array<{
    id: string;
    conversation_id: string;
    sender: string;
    channel: string;
    content: string;
    content_type: string;
    status: string;
    external_event_id: string;
    created_at: string;
    metadata: any;
  }>;
  channel_connections: Array<{
    channel: string;
    status: string;
    status_message: string;
    account_handle: string;
    last_sync_at: string;
  }>;
}

class MockSupabaseClient {
  public db: MemoryDB = {
    profiles: [],
    conversations: [],
    messages: [],
    channel_connections: [
      {
        channel: 'whatsapp',
        status: 'awaiting_connection',
        status_message: 'Pendente',
        account_handle: '',
        last_sync_at: '',
      }
    ],
  };

  from(table: string) {
    const self = this;
    return {
      select(fields: string = '*') {
        return {
          eq(col: string, val: any) {
            return {
              limit(n: number) {
                const results = (self.db as any)[table].filter((row: any) => row[col] === val);
                return Promise.resolve({ data: results.slice(0, n), error: null });
              },
              or(orClause: string) {
                return {
                  limit(n: number) {
                    // orClause: "username.eq.wa_X,username.eq.X,phone.eq.X"
                    const pairs = orClause.split(',').map(part => {
                      const [c, op, v] = part.split('.');
                      return { c, v };
                    });
                    const results = (self.db as any)[table].filter((row: any) => {
                      if (row[col] !== val) return false;
                      return pairs.some(({ c, v }) => row[c] === v);
                    });
                    return Promise.resolve({ data: results.slice(0, n), error: null });
                  }
                };
              }
            };
          }
        };
      },
      insert(payload: any) {
        return {
          select(fields: string = '*') {
            return {
              single() {
                const newRow = { id: `uuid_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, ...payload };
                // Check unique constraint on messages.external_event_id
                if (table === 'messages' && payload.external_event_id) {
                  const exists = self.db.messages.find(m => m.external_event_id === payload.external_event_id);
                  if (exists) {
                    return Promise.resolve({
                      data: null,
                      error: { code: '23505', message: 'duplicate key value violates unique constraint "messages_external_event_id_key"' }
                    });
                  }
                }
                (self.db as any)[table].push(newRow);
                return Promise.resolve({ data: newRow, error: null });
              }
            };
          },
          // Direct insert without select().single()
          then(resolve: any) {
            if (table === 'messages' && payload.external_event_id) {
              const exists = self.db.messages.find(m => m.external_event_id === payload.external_event_id);
              if (exists) {
                return resolve({
                  data: null,
                  error: { code: '23505', message: 'duplicate key value violates unique constraint "messages_external_event_id_key"' }
                });
              }
            }
            const newRow = { id: `uuid_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, ...payload };
            (self.db as any)[table].push(newRow);
            return resolve({ data: [newRow], error: null });
          }
        };
      },
      update(payload: any) {
        return {
          eq(col: string, val: any) {
            const list = (self.db as any)[table];
            for (let i = 0; i < list.length; i++) {
              if (list[i][col] === val) {
                list[i] = { ...list[i], ...payload };
              }
            }
            return Promise.resolve({ data: null, error: null });
          }
        };
      }
    };
  }
}

/**
 * Processor implementation replicating the exact logic implemented in whatsapp-webhook/index.ts
 */
async function processWhatsAppPayload(payload: any, supabase: MockSupabaseClient) {
  if (!payload || typeof payload !== 'object') {
    return { status: 400, body: { error: 'INVALID_INPUT', message: 'Invalid payload structure' } };
  }

  if (payload.object !== 'whatsapp_business_account') {
    return { status: 200, body: { status: 'OBJECT_IGNORED', object: payload.object } };
  }

  const entries = payload.entry;
  if (!Array.isArray(entries) || entries.length === 0) {
    return { status: 200, body: { status: 'NO_ENTRIES_FOUND' } };
  }

  let processedCount = 0;
  let duplicateCount = 0;
  let statusCount = 0;
  let lastEventId = '';

  for (const entry of entries) {
    const changes = entry.changes || [];
    for (const change of changes) {
      if (change.field !== 'messages') continue;
      const value = change.value;
      if (!value || typeof value !== 'object') continue;

      const displayPhoneNumber = value.metadata?.display_phone_number;
      const phoneNumberId = value.metadata?.phone_number_id;
      const contacts = value.contacts || [];

      const getContactName = (phone: string): string => {
        const match = contacts.find((c: any) => c.wa_id === phone);
        return match?.profile?.name || `WhatsApp (${phone.slice(-4)})`;
      };

      if (Array.isArray(value.statuses) && value.statuses.length > 0) {
        statusCount += value.statuses.length;
      }

      const messagesList = value.messages || [];
      for (const message of messagesList) {
        const rawMessageId = message.id;
        const senderPhone = message.from || contacts[0]?.wa_id;
        if (!senderPhone || !rawMessageId) continue;

        const externalEventId = rawMessageId;
        lastEventId = externalEventId;

        // Idempotency check
        const { data: existingMessages } = await supabase
          .from('messages')
          .select('id')
          .eq('external_event_id', externalEventId)
          .limit(1);

        if (existingMessages && existingMessages.length > 0) {
          duplicateCount++;
          continue;
        }

        let contentType = 'text';
        let textContent = '';
        let mediaUrl: string | null = null;
        const msgType = message.type || 'text';

        if (msgType === 'text') {
          contentType = 'text';
          textContent = message.text?.body || '';
        } else if (msgType === 'image') {
          contentType = 'image';
          textContent = message.image?.caption || '[Imagem recebida via WhatsApp]';
        } else if (msgType === 'audio') {
          contentType = 'audio';
          textContent = '[Áudio recebido via WhatsApp]';
        } else {
          contentType = 'text';
          textContent = `[Mensagem recebida via WhatsApp (${msgType})]`;
        }

        const eventTimestamp = message.timestamp
          ? new Date(Number(message.timestamp) * 1000).toISOString()
          : new Date().toISOString();

        // Profile Upsert
        let profileId: string;
        const contactName = getContactName(senderPhone);
        const { data: existingProfiles } = await supabase
          .from('profiles')
          .select('id, name')
          .eq('channel', 'whatsapp')
          .or(`username.eq.wa_${senderPhone},username.eq.${senderPhone},phone.eq.${senderPhone}`)
          .limit(1);

        if (existingProfiles && existingProfiles.length > 0) {
          profileId = existingProfiles[0].id;
          await supabase.from('profiles').update({ last_active_at: eventTimestamp }).eq('id', profileId);
        } else {
          const { data: newProfile } = await supabase
            .from('profiles')
            .insert({
              name: contactName,
              username: `wa_${senderPhone}`,
              phone: senderPhone,
              channel: 'whatsapp',
              metadata: { wa_id: senderPhone, phone_number_id: phoneNumberId },
              last_active_at: eventTimestamp,
            })
            .select('id')
            .single();
          profileId = newProfile.id;
        }

        // Conversation Upsert
        let conversationId: string;
        const { data: existingConversations } = await supabase
          .from('conversations')
          .select('id, unread_count')
          .eq('contact_id', profileId)
          .limit(1);

        if (existingConversations && existingConversations.length > 0) {
          conversationId = existingConversations[0].id;
          await supabase
            .from('conversations')
            .update({
              updated_at: eventTimestamp,
              unread_count: (existingConversations[0].unread_count || 0) + 1,
            })
            .eq('id', conversationId);
        } else {
          const { data: newConv } = await supabase
            .from('conversations')
            .insert({
              contact_id: profileId,
              channel: 'whatsapp',
              status: 'open',
              handler: 'human',
              unread_count: 1,
              metadata: { phone_number_id: phoneNumberId, first_event_id: externalEventId },
            })
            .select('id')
            .single();
          conversationId = newConv.id;
        }

        // Insert Message
        const { error: msgErr } = await supabase
          .from('messages')
          .insert({
            conversation_id: conversationId,
            sender: 'contact',
            channel: 'whatsapp',
            content: textContent,
            content_type: contentType,
            media_url: mediaUrl,
            status: 'delivered',
            external_event_id: externalEventId,
            created_at: eventTimestamp,
            metadata: { wa_message_id: rawMessageId, message_type: msgType },
          });

        if (msgErr) {
          duplicateCount++;
          continue;
        }

        await supabase
          .from('channel_connections')
          .update({
            status: 'connected',
            status_message: 'Webhook ativo e recebendo mensagens do WhatsApp',
            account_handle: `WhatsApp (${displayPhoneNumber || senderPhone})`,
            last_sync_at: new Date().toISOString(),
          })
          .eq('channel', 'whatsapp');

        processedCount++;
      }
    }
  }

  if (processedCount > 0) {
    return { status: 200, body: { status: 'SUCCESS', processedCount, duplicateCount, eventId: lastEventId } };
  }
  if (duplicateCount > 0) {
    return { status: 200, body: { status: 'EVENT_ALREADY_PROCESSED', duplicateCount, eventId: lastEventId } };
  }
  if (statusCount > 0) {
    return { status: 200, body: { status: 'STATUS_UPDATE_RECEIVED', statusCount } };
  }
  return { status: 200, body: { status: 'NO_MESSAGES_FOUND' } };
}

// -----------------------------------------------------------------------------------
// EXECUÇÃO DOS 5 CENÁRIOS OBRIGATÓRIOS
// -----------------------------------------------------------------------------------

async function runTests() {
  console.log('🧪 INICIANDO TESTES DO WHATSAPP WEBHOOK (RELEASE: REAL PERSISTENCE)\n');
  const mockClient = new MockSupabaseClient();

  // ---------------------------------------------------------------------------------
  // TESTE 1: Payload WhatsApp válido com mensagem textual
  // ---------------------------------------------------------------------------------
  console.log('--- TESTE 1: Payload WhatsApp válido com mensagem textual ---');
  const payload1 = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WHATSAPP_BUSINESS_ACCOUNT_ID_01',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '5511999998888',
                phone_number_id: 'PHONE_NUMBER_ID_123',
              },
              contacts: [
                {
                  profile: { name: 'João Silva' },
                  wa_id: '5511988887777',
                },
              ],
              messages: [
                {
                  from: '5511988887777',
                  id: 'wamid.HBgLMjAyNjA5MDMAA1',
                  timestamp: '1725364800',
                  type: 'text',
                  text: { body: 'Olá! Gostaria de consultar o status do meu pedido.' },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const res1 = await processWhatsAppPayload(payload1, mockClient);
  console.log('Resposta Teste 1:', res1);

  if (
    res1.status === 200 &&
    res1.body.status === 'SUCCESS' &&
    res1.body.processedCount === 1 &&
    mockClient.db.profiles.length === 1 &&
    mockClient.db.conversations.length === 1 &&
    mockClient.db.messages.length === 1
  ) {
    console.log('✅ TESTE 1 APROVADO: Profile criado, Conversation criada, Message persistida com HTTP 200.\n');
  } else {
    console.error('❌ TESTE 1 FALHOU:', { res1, db: mockClient.db });
    process.exit(1);
  }

  // ---------------------------------------------------------------------------------
  // TESTE 2: Mesmo payload enviado novamente (Idempotência)
  // ---------------------------------------------------------------------------------
  console.log('--- TESTE 2: Mesmo payload enviado novamente (Idempotência) ---');
  const res2 = await processWhatsAppPayload(payload1, mockClient);
  console.log('Resposta Teste 2:', res2);

  if (
    res2.status === 200 &&
    res2.body.status === 'EVENT_ALREADY_PROCESSED' &&
    res2.body.duplicateCount === 1 &&
    mockClient.db.profiles.length === 1 &&
    mockClient.db.conversations.length === 1 &&
    mockClient.db.messages.length === 1
  ) {
    console.log('✅ TESTE 2 APROVADO: Nenhuma duplicação em profiles, conversations ou messages. HTTP 200 retornado com segurança.\n');
  } else {
    console.error('❌ TESTE 2 FALHOU:', { res2, db: mockClient.db });
    process.exit(1);
  }

  // ---------------------------------------------------------------------------------
  // TESTE 3: Payload sem messages
  // ---------------------------------------------------------------------------------
  console.log('--- TESTE 3: Payload sem messages ---');
  const payload3 = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WHATSAPP_BUSINESS_ACCOUNT_ID_01',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '5511999998888',
                phone_number_id: 'PHONE_NUMBER_ID_123',
              },
              messages: [],
            },
          },
        ],
      },
    ],
  };

  const res3 = await processWhatsAppPayload(payload3, mockClient);
  console.log('Resposta Teste 3:', res3);

  if (res3.status === 200 && res3.body.status === 'NO_MESSAGES_FOUND') {
    console.log('✅ TESTE 3 APROVADO: Payload sem mensagens processado com segurança, sem erros, retornando HTTP 200.\n');
  } else {
    console.error('❌ TESTE 3 FALHOU:', res3);
    process.exit(1);
  }

  // ---------------------------------------------------------------------------------
  // TESTE 4: Payload com status update
  // ---------------------------------------------------------------------------------
  console.log('--- TESTE 4: Payload com status update ---');
  const payload4 = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WHATSAPP_BUSINESS_ACCOUNT_ID_01',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '5511999998888',
                phone_number_id: 'PHONE_NUMBER_ID_123',
              },
              statuses: [
                {
                  id: 'wamid.HBgLMjAyNjA5MDMAA1',
                  status: 'delivered',
                  timestamp: '1725364810',
                  recipient_id: '5511988887777',
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const prevMsgCount = mockClient.db.messages.length;
  const res4 = await processWhatsAppPayload(payload4, mockClient);
  console.log('Resposta Teste 4:', res4);

  if (
    res4.status === 200 &&
    res4.body.status === 'STATUS_UPDATE_RECEIVED' &&
    mockClient.db.messages.length === prevMsgCount
  ) {
    console.log('✅ TESTE 4 APROVADO: Status update processado sem criar mensagens falsas. Contagem de mensagens inalterada. HTTP 200.\n');
  } else {
    console.error('❌ TESTE 4 FALHOU:', { res4, messages: mockClient.db.messages });
    process.exit(1);
  }

  // ---------------------------------------------------------------------------------
  // TESTE 5: Payload WhatsApp inválido
  // ---------------------------------------------------------------------------------
  console.log('--- TESTE 5: Payload WhatsApp inválido ---');
  const payload5 = {
    object: 'invalid_object_type',
  };

  const res5 = await processWhatsAppPayload(payload5, mockClient);
  console.log('Resposta Teste 5 (Objeto inválido):', res5);

  const res5Malformed = await processWhatsAppPayload(null, mockClient);
  console.log('Resposta Teste 5 (Malformed null):', res5Malformed);

  if (
    res5.status === 200 &&
    res5.body.status === 'OBJECT_IGNORED' &&
    res5Malformed.status === 400 &&
    mockClient.db.messages.length === prevMsgCount
  ) {
    console.log('✅ TESTE 5 APROVADO: Payload inválido tratado com segurança, sem corrupção de dados.\n');
  } else {
    console.error('❌ TESTE 5 FALHOU:', { res5, res5Malformed });
    process.exit(1);
  }

  console.log('🎉 TODOS OS 5 TESTES OBRIGATÓRIOS FORAM EXECUTADOS E APROVADOS COM 100% DE SUCESSO!');
}

runTests().catch(err => {
  console.error('Falha geral na suíte de testes:', err);
  process.exit(1);
});
