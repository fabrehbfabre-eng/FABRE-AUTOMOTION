// Supabase Edge Function: meta-automation-send-message
// Release 13: Operator Authentication + Secure Automation Outbound
// Secure server-side proxy for automated bot dispatch to Meta WhatsApp Business Cloud API.
// Validates operator JWT, app_metadata.role, database action definition, channel certification, and Meta response.
// Secrets (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID) remain strictly server-side.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { getServerSupabaseClient } from "../_shared/supabaseServer.ts";
import { createErrorResponse, createSuccessResponse } from "../_shared/errors.ts";
import { logSecure } from "../_shared/logger.ts";

serve(async (req: Request) => {
  const startTime = Date.now();

  // 1. CORS Preflight
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  // 2. HTTP Method Validation
  if (req.method !== "POST") {
    return createErrorResponse(405, "Método não permitido. Utilize POST.", "METHOD_NOT_ALLOWED");
  }

  // 3. Cryptographic JWT Authentication Check
  // A public 'apikey' alone is NEVER accepted as operator identity.
  // We require a valid 'Authorization: Bearer <jwt>' header.
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader || !authHeader.trim().toLowerCase().startsWith("bearer ")) {
    logSecure("warn", {
      service: "meta-automation-send-message",
      action: "auth_check",
      status: "warning",
      message: "Rejeitada solicitação sem token Bearer de autorização",
    });
    return createErrorResponse(401, "Usuário não autenticado ou sessão inválida.", "UNAUTHORIZED");
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    logSecure("warn", {
      service: "meta-automation-send-message",
      action: "auth_check",
      status: "warning",
      message: "Token Bearer vazio fornecido na requisição",
    });
    return createErrorResponse(401, "Usuário não autenticado ou sessão inválida.", "UNAUTHORIZED");
  }

  let user: any = null;
  let supabase: any = null;

  try {
    supabase = getServerSupabaseClient();
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    // Allow internal automation background worker authenticated via SUPABASE_SERVICE_ROLE_KEY
    if (serviceRoleKey && token === serviceRoleKey.trim()) {
      user = {
        id: "system_automation_worker",
        role: "authenticated",
        app_metadata: {
          role: "admin",
          is_system_worker: true,
        },
      };
      logSecure("info", {
        service: "meta-automation-send-message",
        action: "worker_jwt_auth",
        status: "success",
        message: "Autenticação via chave de serviço interna para execução agendada/worker",
      });
    } else {
      const { data: authData, error: authError } = await supabase.auth.getUser(token);

      if (authError || !authData?.user || !authData.user.id) {
        logSecure("warn", {
          service: "meta-automation-send-message",
          action: "jwt_validation",
          status: "warning",
          message: `Validação do JWT falhou ou sessão expirada: ${authError?.message || "Usuário não encontrado"}`,
        });
        return createErrorResponse(401, "Usuário não autenticado ou sessão inválida.", "UNAUTHORIZED");
      }

      user = authData.user;

      // Verify authenticated user role (reject 'anon' tokens or service tokens posing as users)
      if (user.role !== "authenticated") {
        logSecure("warn", {
          service: "meta-automation-send-message",
          action: "jwt_role_check",
          status: "warning",
          message: `Token com papel de usuário não autenticado: ${user.role}`,
        });
        return createErrorResponse(401, "Usuário não autenticado ou sessão inválida.", "UNAUTHORIZED");
      }
    }
  } catch (authException: unknown) {
    const errText = authException instanceof Error ? authException.message : String(authException);
    logSecure("error", {
      service: "meta-automation-send-message",
      action: "auth_exception",
      status: "error",
      message: `Erro interno ao validar sessão do usuário: ${errText}`,
    });
    return createErrorResponse(401, "Usuário não autenticado ou sessão inválida.", "UNAUTHORIZED");
  }

  // 4. Operator Authorization Check (Fail-Closed)
  // Security Policy: Authenticated does NOT mean Authorized.
  // 1) We NEVER trust user.user_metadata for privileged actions (user-mutable).
  // 2) We NEVER use automatic fallback to "operator" or any default role.
  // 3) Role MUST be explicitly declared in server-managed app_metadata.
  // 4) Allowed roles: "operator", "admin".
  // 5) Explicitly reject: "viewer", unknown roles, missing roles, empty roles, disabled users.
  const appRole = typeof user.app_metadata?.role === "string"
    ? user.app_metadata.role.trim().toLowerCase()
    : null;

  const isExplicitlyAuthorized = appRole === "operator" || appRole === "admin";
  const isDisabled = user.app_metadata?.disabled === true || user.app_metadata?.can_send_outbound === false;

  if (!isExplicitlyAuthorized || isDisabled) {
    logSecure("warn", {
      service: "meta-automation-send-message",
      action: "operator_authorization",
      status: "warning",
      userId: user.id,
      appRole: appRole || "none",
      message: `Acesso outbound automatizado rejeitado (403): Usuário autenticado (${user.id}) sem permissão de operador/admin (app_metadata.role: ${appRole || "ausente"}, disabled: ${Boolean(isDisabled)})`,
    });
    return createErrorResponse(403, "Usuário autenticado, mas sem permissão para executar esta operação.", "FORBIDDEN");
  }

  // 5. Payload Parsing & Sanitization
  // Note: Executed strictly AFTER authentication and authorization have succeeded.
  let payload: Record<string, any>;
  try {
    payload = await req.json();
  } catch {
    return createErrorResponse(400, "Corpo da requisição JSON inválido.", "INVALID_INPUT");
  }

  const { conversationId, automationId, actionId, messageId, externalEventId } = payload;

  if (!conversationId || typeof conversationId !== "string" || !conversationId.trim()) {
    return createErrorResponse(400, "Campo obrigatório ausente ou inválido: conversationId.", "INVALID_INPUT");
  }

  if (!automationId || typeof automationId !== "string" || !automationId.trim()) {
    return createErrorResponse(400, "Campo obrigatório ausente ou inválido: automationId.", "INVALID_INPUT");
  }

  if (!actionId || typeof actionId !== "string" || !actionId.trim()) {
    return createErrorResponse(400, "Campo obrigatório ausente ou inválido: actionId.", "INVALID_INPUT");
  }

  try {
    // 6. Fetch Target Conversation
    const { data: conversation, error: convErr } = await supabase
      .from("conversations")
      .select("id, contact_id, channel, status, handler")
      .eq("id", conversationId.trim())
      .single();

    if (convErr || !conversation) {
      logSecure("warn", {
        service: "meta-automation-send-message",
        action: "find_conversation",
        status: "warning",
        message: `Conversa não encontrada: ${conversationId}`,
      });
      return createErrorResponse(404, `Conversa não encontrada: ${conversationId}`, "NOT_FOUND");
    }

    const channel = conversation.channel;

    // 7. Channel Certification Verification
    // Instagram & Messenger are not yet certified for automated outbound dispatch
    if (channel === "instagram" || channel === "messenger") {
      logSecure("warn", {
        service: "meta-automation-send-message",
        action: "channel_certification_check",
        status: "warning",
        channel,
        message: `Envio outbound automatizado bloqueado para canal ${channel} (não certificado)`,
      });
      return createErrorResponse(
        400,
        `Envio outbound automatizado para o canal ${channel === "instagram" ? "Instagram" : "Messenger"} ainda não está certificado nesta Release. Apenas WhatsApp Business Cloud API está habilitado.`,
        "INVALID_INPUT",
        { status: "UNSUPPORTED_CHANNEL" }
      );
    }

    if (channel !== "whatsapp") {
      return createErrorResponse(400, `Canal não suportado para envio automatizado: ${channel}`, "INVALID_INPUT");
    }

    // 8. Fetch and Validate Contact Profile
    const { data: contact, error: contactErr } = await supabase
      .from("profiles")
      .select("id, name, username, phone, channel, metadata")
      .eq("id", conversation.contact_id)
      .single();

    if (contactErr || !contact) {
      logSecure("warn", {
        service: "meta-automation-send-message",
        action: "find_contact",
        status: "warning",
        message: `Perfil de contato não localizado: ${conversation.contact_id}`,
      });
      return createErrorResponse(404, `Contato associado à conversa não encontrado: ${conversation.contact_id}`, "NOT_FOUND");
    }

    const rawPhone = contact.phone || (contact.metadata as any)?.wa_id || contact.username?.replace(/^wa_/, "");
    const recipientPhone = (rawPhone || "").replace(/\D/g, "");

    // ITU-T E.164 phone format validation: minimum 8 digits, maximum 15 digits
    if (!recipientPhone || recipientPhone.length < 8 || recipientPhone.length > 15) {
      logSecure("warn", {
        service: "meta-automation-send-message",
        action: "OUTBOUND_FAILED",
        status: "warning",
        category: "VALIDATION_ERROR",
        recipient: recipientPhone,
        message: "Número de telefone do destinatário inválido ou não cadastrado no perfil de contato (deve conter entre 8 e 15 dígitos numéricos).",
      });
      return createErrorResponse(
        400,
        "Número de telefone do destinatário inválido ou não cadastrado no perfil de contato (deve conter entre 8 e 15 dígitos numéricos).",
        "VALIDATION_ERROR",
        { errorCategory: "VALIDATION_ERROR", isRetryable: false }
      );
    }

    // 9. Fetch and Validate Automation & Action from Database (Fail-Closed)
    // Security Mandate: The 'text' provided by the caller is UNTRUSTED.
    // The authoritative message text MUST be fetched directly from the database action record.
    const { data: automation, error: autoErr } = await supabase
      .from("automations")
      .select(`
        id,
        title,
        channel,
        enabled,
        automation_actions (
          id,
          automation_id,
          type,
          name,
          description,
          config,
          sort_order
        )
      `)
      .eq("id", automationId.trim())
      .single();

    if (autoErr || !automation) {
      logSecure("warn", {
        service: "meta-automation-send-message",
        action: "find_automation",
        status: "warning",
        automationId,
        message: `Automação não encontrada no banco de dados: ${automationId}`,
      });
      return createErrorResponse(404, `Automação não encontrada: ${automationId}`, "NOT_FOUND");
    }

    if (!automation.enabled) {
      logSecure("warn", {
        service: "meta-automation-send-message",
        action: "validate_automation_enabled",
        status: "warning",
        automationId,
        message: `Tentativa de disparo de automação desabilitada: ${automation.title}`,
      });
      return createErrorResponse(400, "A automação especificada está desabilitada no sistema.", "FORBIDDEN", {
        code: "AUTOMATION_DISABLED",
      });
    }

    if (automation.channel !== "whatsapp" && automation.channel !== "all") {
      return createErrorResponse(400, `O canal configurado na automação (${automation.channel}) não corresponde à conversa.`, "INVALID_INPUT");
    }

    // Validate Action in DB
    const rawActions = (automation as any).automation_actions;
    const actionsList: any[] = Array.isArray(rawActions) ? rawActions : [];

    const matchedAction = actionsList.find((a: any) => a.id === actionId.trim());
    if (!matchedAction) {
      logSecure("warn", {
        service: "meta-automation-send-message",
        action: "validate_action",
        status: "warning",
        actionId,
        automationId,
        message: "Ação não localizada na definição da automação",
      });
      return createErrorResponse(400, `Ação ${actionId} não encontrada na automação ${automationId}.`, "INVALID_INPUT");
    }

    // Validate that action belongs to this automation
    if (matchedAction.automation_id && matchedAction.automation_id !== automation.id) {
      return createErrorResponse(400, `Ação ${actionId} não pertence à automação ${automationId}.`, "INVALID_INPUT");
    }

    if (matchedAction.type !== "send_message" && matchedAction.type !== "send_dm") {
      return createErrorResponse(400, `Tipo de ação incompatível para envio de mensagem: ${matchedAction.type}`, "INVALID_INPUT");
    }

    // Extract authoritative messageText from validated database action configuration
    const actionConfig = (matchedAction.config && typeof matchedAction.config === "object")
      ? matchedAction.config
      : {};
    const dbActionText = String(actionConfig.messageText || actionConfig.text || "").trim();

    if (!dbActionText) {
      logSecure("warn", {
        service: "meta-automation-send-message",
        action: "validate_action_text",
        status: "warning",
        actionId,
        automationId,
        message: "Texto da ação de envio não configurado ou vazio no banco de dados",
      });
      return createErrorResponse(400, "A ação de automação não possui texto de mensagem configurado no banco de dados.", "INVALID_INPUT");
    }

    if (dbActionText.length > 4096) {
      return createErrorResponse(400, "O tamanho da mensagem configurado na automação excede o limite máximo permitido de 4096 caracteres.", "INVALID_INPUT");
    }

    const verifiedTextToSend = dbActionText;

    // 10. Idempotency Check: Prevent duplicate dispatch for the same event
    if (messageId && typeof messageId === "string") {
      const { data: existingMsg } = await supabase
        .from("messages")
        .select("id, external_event_id, status, created_at")
        .eq("conversation_id", conversationId)
        .eq("sender", "bot")
        .filter("metadata->>triggeredByMessageId", "eq", messageId)
        .filter("metadata->>actionId", "eq", actionId)
        .limit(1)
        .maybeSingle();

      if (existingMsg) {
        logSecure("info", {
          service: "meta-automation-send-message",
          action: "OUTBOUND_DUPLICATE_IGNORED",
          status: "success",
          category: "DUPLICATE_EXECUTION",
          messageId: existingMsg.id,
          triggeredBy: messageId,
          message: "Mensagem automatizada já despachada anteriormente para este evento. Reenvio impedido por idempotência.",
        });

        return createSuccessResponse({
          status: "DUPLICATE",
          code: "EVENT_ALREADY_PROCESSED",
          errorCategory: "DUPLICATE_EXECUTION",
          isRetryable: false,
          message: "Mensagem automatizada já despachada anteriormente para este evento.",
          existingMessageId: existingMsg.id,
          wamid: existingMsg.external_event_id,
        });
      }
    }

    // 11. Resolve WhatsApp Server-Side Credentials
    let phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || (contact.metadata as any)?.phone_number_id;
    let wabaId = Deno.env.get("WHATSAPP_BUSINESS_ACCOUNT_ID");

    if (!phoneNumberId || !wabaId) {
      const { data: channelConn } = await supabase
        .from("channel_connections")
        .select("metadata")
        .eq("channel", "whatsapp")
        .single();

      if (channelConn?.metadata && typeof channelConn.metadata === "object") {
        if (!phoneNumberId) {
          phoneNumberId = (channelConn.metadata as any).phone_number_id;
        }
        if (!wabaId) {
          wabaId = (channelConn.metadata as any).waba_id || (channelConn.metadata as any).business_account_id;
        }
      }
    }

    if (!wabaId) {
      wabaId = "293410900513919"; // Referência canônica ADM01
    }

    if (!phoneNumberId) {
      logSecure("warn", {
        service: "meta-automation-send-message",
        action: "resolve_phone_number_id",
        status: "error",
        channel: "whatsapp",
        message: "WHATSAPP_PHONE_NUMBER_ID não configurado no ambiente nem nos metadados",
      });
      return createErrorResponse(
        400,
        "Identificador da linha WhatsApp (WHATSAPP_PHONE_NUMBER_ID) não configurado no servidor.",
        "INVALID_INPUT"
      );
    }

    const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    if (!accessToken || !accessToken.trim()) {
      logSecure("error", {
        service: "meta-automation-send-message",
        action: "resolve_access_token",
        status: "error",
        channel: "whatsapp",
        message: "WHATSAPP_ACCESS_TOKEN ausente nas Secrets do servidor",
      });
      return createErrorResponse(
        500,
        "Configuração de acesso do WhatsApp Business Cloud API incompleta no servidor (WHATSAPP_ACCESS_TOKEN ausente).",
        "INTERNAL_ERROR"
      );
    }

    // 12. Official Meta WhatsApp Cloud API Request
    // Dispatches ONLY the verified database action text
    const metaApiUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
    const requestPayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientPhone,
      type: "text",
      text: {
        preview_url: false,
        body: verifiedTextToSend,
      },
    };

    let metaRes: Response;
    try {
      metaRes = await fetch(metaApiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });
    } catch (networkErr: unknown) {
      const errorMsg = networkErr instanceof Error ? networkErr.message : String(networkErr);
      logSecure("error", {
        service: "meta-automation-send-message",
        action: "OUTBOUND_FAILED",
        status: "error",
        channel: "whatsapp",
        category: "TRANSIENT_NETWORK_ERROR",
        message: `Falha de rede ao conectar com a Meta Cloud API: ${errorMsg}`,
      });
      return createErrorResponse(
        502,
        `Falha de comunicação de rede com a Meta Cloud API: ${errorMsg}`,
        "TRANSIENT_NETWORK_ERROR",
        { errorCategory: "TRANSIENT_NETWORK_ERROR", isRetryable: true, status: "FAILED" }
      );
    }

    // 13. Meta API Response Error Handling (Never simulate success on failure)
    if (!metaRes.ok) {
      let metaErrorData: Record<string, any> = {};
      try {
        metaErrorData = await metaRes.json();
      } catch {
        metaErrorData = { message: await metaRes.text() };
      }

      const errDetails = metaErrorData.error || {};
      const errCode = Number(errDetails.code) || metaRes.status;
      const errMsg = errDetails.message || "Erro retornado pela Meta Cloud API";

      let errorCategory = "META_API_ERROR";
      let isRetryable = false;
      let userFriendlyMsg = `Falha na Meta Cloud API [${errCode}]: ${errMsg}`;

      if (errCode === 131047) {
        errorCategory = "META_POLICY_ERROR";
        isRetryable = false;
        userFriendlyMsg = `Janela de 24 horas para envio de mensagem livre expirada (Código 131047). O cliente precisa enviar uma nova mensagem antes que mensagens livres possam ser entregues.`;
      } else if (errCode === 131030) {
        errorCategory = "META_POLICY_ERROR";
        isRetryable = false;
        userFriendlyMsg = `Número de telefone não autorizado no modo de desenvolvimento Meta (Código 131030). Adicione este número como 'Test Number' no painel de desenvolvedores Meta.`;
      } else if (errCode === 190) {
        errorCategory = "AUTHENTICATION_ERROR";
        isRetryable = false;
        userFriendlyMsg = `Token da WhatsApp Business Cloud API expirou ou é inválido (Código 190). Atualize a Secret WHATSAPP_ACCESS_TOKEN.`;
      } else if (metaRes.status === 429 || errCode === 130429) {
        errorCategory = "META_API_ERROR";
        isRetryable = true;
        userFriendlyMsg = `Limite de requisições da Meta Cloud API atingido (Rate Limit / 429).`;
      } else if (metaRes.status >= 500) {
        errorCategory = "META_API_ERROR";
        isRetryable = true;
        userFriendlyMsg = `Erro transitório no servidor da Meta Cloud API (HTTP ${metaRes.status}).`;
      }

      logSecure("error", {
        service: "meta-automation-send-message",
        action: "OUTBOUND_FAILED",
        status: "error",
        channel: "whatsapp",
        category: errorCategory,
        message: `Meta Cloud API rejeitou envio automatizado HTTP ${metaRes.status} [Código ${errCode}]: ${errMsg}`,
        details: {
          code: errCode,
          type: errDetails.type,
          subcode: errDetails.error_subcode,
          recipient: recipientPhone,
          automationId,
          actionId,
          isRetryable,
        },
      });

      return createErrorResponse(
        metaRes.status >= 500 ? 502 : (metaRes.status === 401 || metaRes.status === 403 ? metaRes.status : 400),
        userFriendlyMsg,
        errorCategory,
        {
          metaCode: errCode,
          errorCategory,
          isRetryable,
          status: "PROVIDER_REJECTED",
        }
      );
    }

    // 14. Parse Success Response & Extract wamid safely
    const metaSuccessData = await metaRes.json();
    const rawWamid = metaSuccessData.messages?.[0]?.id;

    // Safety Mandate: Never invent a fake wamid. If Meta returns success without wamid, treat as provider contract error.
    if (!rawWamid || typeof rawWamid !== "string" || !rawWamid.trim()) {
      logSecure("error", {
        service: "meta-automation-send-message",
        action: "OUTBOUND_FAILED",
        status: "error",
        channel: "whatsapp",
        category: "META_API_ERROR",
        message: "Meta Cloud API retornou status HTTP de sucesso, mas não forneceu o ID oficial da mensagem (wamid ausente)",
        rawResponse: metaSuccessData,
      });

      return createErrorResponse(
        502,
        "A Meta Cloud API confirmou a requisição, mas não retornou o identificador oficial da mensagem (wamid ausente). Envio não registrado como sent.",
        "META_API_ERROR",
        {
          status: "PROVIDER_REJECTED",
          errorCategory: "META_API_ERROR",
          isRetryable: true,
          code: "MISSING_WAMID",
        }
      );
    }

    const wamid = rawWamid.trim();

    logSecure("info", {
      service: "meta-automation-send-message",
      action: "OUTBOUND_SENT",
      status: "success",
      channel: "whatsapp",
      wamid,
      recipient: recipientPhone,
      automationId,
      actionId,
    });

    // 15. PostgreSQL Persistence of Automated Message
    // Records operator_authorized_by to maintain full cryptographic audit trail
    const { data: insertedMsg, error: insertErr } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender: "bot",
        channel: "whatsapp",
        content: verifiedTextToSend,
        content_type: "text",
        status: "sent",
        external_event_id: wamid,
        metadata: {
          automationId: automation.id,
          automationName: automation.title,
          actionId: matchedAction.id,
          actionType: matchedAction.type,
          isAutomated: true,
          recipient: recipientPhone,
          phone_number_id: phoneNumberId,
          waba_id: wabaId,
          portfolio: "ADM01",
          triggeredByMessageId: messageId || null,
          externalEventId: externalEventId || null,
          meta_message_id: wamid,
          wamid,
          sent_by: "automation_engine",
          operator_authorized_by: user.id,
        },
      })
      .select()
      .single();

    if (insertErr || !insertedMsg) {
      logSecure("error", {
        service: "meta-automation-send-message",
        action: "OUTBOUND_FAILED",
        status: "error",
        category: "PERSISTENCE_ERROR",
        channel: "whatsapp",
        message: `Mensagem automatizada despachada com ID ${wamid}, mas falhou ao gravar no Supabase: ${insertErr?.message}`,
      });
      return createErrorResponse(
        500,
        `Mensagem automatizada despachada com sucesso ao WhatsApp (ID: ${wamid}), mas falhou ao persistir no banco de dados.`,
        "PERSISTENCE_ERROR",
        { errorCategory: "PERSISTENCE_ERROR", isRetryable: false }
      );
    }

    logSecure("info", {
      service: "meta-automation-send-message",
      action: "OUTBOUND_PERSISTED",
      status: "success",
      channel: "whatsapp",
      messageId: insertedMsg.id,
      wamid,
    });

    // 16. Update Conversation Activity & Mark unread_count
    await supabase
      .from("conversations")
      .update({
        updated_at: new Date().toISOString(),
        unread_count: 0,
      })
      .eq("id", conversationId);

    logSecure("info", {
      service: "meta-automation-send-message",
      action: "automation_dispatch_success",
      status: "success",
      channel: "whatsapp",
      eventId: wamid,
      durationMs: Date.now() - startTime,
      message: `Mensagem de automação (${automation.title}) despachada e persistida com sucesso via WhatsApp Cloud API para ${recipientPhone}`,
    });

    return createSuccessResponse({
      status: "SUCCESS",
      message: insertedMsg,
      externalId: wamid,
      wamid,
      automationId: automation.id,
      actionId: matchedAction.id,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logSecure("error", {
      service: "meta-automation-send-message",
      action: "unexpected_exception",
      status: "error",
      message: `Exceção inesperada no despacho da automação: ${errorMsg}`,
    });
    return createErrorResponse(500, `Erro interno no servidor: ${errorMsg}`, "INTERNAL_ERROR");
  }
});
