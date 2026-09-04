// Supabase Edge Function: meta-automation-send-message
// Release: Automation Outbound Dispatch | Fechamento do Ciclo Reativo
// Secure server-side proxy for automated bot dispatch to Meta WhatsApp Business Cloud API.
// Validates conversation, contact, automation rules, channel certification and Meta response.
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

  // 3. Payload Parsing & Validation
  let payload: Record<string, any>;
  try {
    payload = await req.json();
  } catch {
    return createErrorResponse(400, "Corpo da requisição JSON inválido.", "INVALID_INPUT");
  }

  const { conversationId, automationId, actionId, text, messageId, externalEventId } = payload;

  if (!conversationId || typeof conversationId !== "string" || !conversationId.trim()) {
    return createErrorResponse(400, "Campo obrigatório ausente ou inválido: conversationId.", "INVALID_INPUT");
  }

  if (!automationId || typeof automationId !== "string" || !automationId.trim()) {
    return createErrorResponse(400, "Campo obrigatório ausente ou inválido: automationId.", "INVALID_INPUT");
  }

  if (!actionId || typeof actionId !== "string" || !actionId.trim()) {
    return createErrorResponse(400, "Campo obrigatório ausente ou inválido: actionId.", "INVALID_INPUT");
  }

  if (!text || typeof text !== "string" || !text.trim()) {
    return createErrorResponse(400, "Campo obrigatório ausente ou inválido: text. Mensagens vazias não são permitidas.", "INVALID_INPUT");
  }

  const trimmedText = text.trim();
  if (trimmedText.length > 4096) {
    return createErrorResponse(400, "O tamanho da mensagem excede o limite máximo permitido de 4096 caracteres.", "INVALID_INPUT");
  }

  let supabase: any;
  try {
    supabase = getServerSupabaseClient();
  } catch (clientErr: unknown) {
    const msg = clientErr instanceof Error ? clientErr.message : String(clientErr);
    logSecure("error", {
      service: "meta-automation-send-message",
      action: "init_supabase_client",
      status: "error",
      message: `Falha ao instanciar cliente server-side: ${msg}`,
    });
    return createErrorResponse(500, "Falha interna de configuração do servidor de dados.", "INTERNAL_ERROR");
  }

  try {
    // 4. Fetch Target Conversation
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

    // 5. Channel Certification Verification
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

    // 6. Fetch and Validate Contact Profile
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

    if (!recipientPhone || recipientPhone.length < 8) {
      return createErrorResponse(
        400,
        "Número de telefone do destinatário inválido ou não cadastrado no perfil de contato.",
        "INVALID_INPUT"
      );
    }

    // 7. Fetch and Validate Automation & Action (Fail-Closed)
    const { data: automation, error: autoErr } = await supabase
      .from("automations")
      .select("id, title, channel, enabled, actions")
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

    // Validate Action
    let actionsList: any[] = [];
    if (Array.isArray(automation.actions)) {
      actionsList = automation.actions;
    } else if (typeof automation.actions === "string") {
      try {
        actionsList = JSON.parse(automation.actions);
      } catch {
        actionsList = [];
      }
    }

    const matchedAction = actionsList.find((a: any) => a.id === actionId);
    if (!matchedAction) {
      logSecure("warn", {
        service: "meta-automation-send-message",
        action: "validate_action",
        status: "warning",
        actionId,
        automationId,
        message: `Ação não localizada na definição da automação`,
      });
      return createErrorResponse(400, `Ação ${actionId} não encontrada na automação ${automationId}.`, "INVALID_INPUT");
    }

    if (matchedAction.type !== "send_message" && matchedAction.type !== "send_dm") {
      return createErrorResponse(400, `Tipo de ação incompatível para envio de mensagem: ${matchedAction.type}`, "INVALID_INPUT");
    }

    // 8. Idempotency Check: Prevent duplicate dispatch for the same event
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
          action: "idempotency_check",
          status: "success",
          messageId: existingMsg.id,
          triggeredBy: messageId,
          message: "Mensagem automatizada já despachada anteriormente para este evento. Reenvio impedido por idempotência.",
        });

        return createSuccessResponse({
          status: "DUPLICATE",
          code: "EVENT_ALREADY_PROCESSED",
          message: "Mensagem automatizada já despachada anteriormente para este evento.",
          existingMessageId: existingMsg.id,
          wamid: existingMsg.external_event_id,
        });
      }
    }

    // 9. Resolve WhatsApp Server-Side Credentials
    let phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || (contact.metadata as any)?.phone_number_id;

    if (!phoneNumberId) {
      const { data: channelConn } = await supabase
        .from("channel_connections")
        .select("metadata")
        .eq("channel", "whatsapp")
        .single();

      if (channelConn?.metadata && typeof channelConn.metadata === "object") {
        phoneNumberId = (channelConn.metadata as any).phone_number_id;
      }
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

    // 10. Official Meta WhatsApp Cloud API Request
    const metaApiUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
    const requestPayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientPhone,
      type: "text",
      text: {
        preview_url: false,
        body: trimmedText,
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
        action: "fetch_meta_api",
        status: "error",
        channel: "whatsapp",
        message: `Falha de rede ao conectar com a Meta Cloud API: ${errorMsg}`,
      });
      return createErrorResponse(
        502,
        `Falha de comunicação de rede com a Meta Cloud API: ${errorMsg}`,
        "INTERNAL_ERROR"
      );
    }

    // 11. Meta API Response Error Handling (Never simulate success on failure)
    if (!metaRes.ok) {
      let metaErrorData: Record<string, any> = {};
      try {
        metaErrorData = await metaRes.json();
      } catch {
        metaErrorData = { message: await metaRes.text() };
      }

      const errDetails = metaErrorData.error || {};
      const errCode = errDetails.code || metaRes.status;
      const errMsg = errDetails.message || "Erro retornado pela Meta Cloud API";

      logSecure("error", {
        service: "meta-automation-send-message",
        action: "meta_api_response",
        status: "error",
        channel: "whatsapp",
        message: `Meta Cloud API rejeitou envio automatizado HTTP ${metaRes.status} [Código ${errCode}]: ${errMsg}`,
        details: {
          code: errCode,
          type: errDetails.type,
          subcode: errDetails.error_subcode,
          recipient: recipientPhone,
          automationId,
          actionId,
        },
      });

      let userFriendlyMsg = `Falha na Meta Cloud API [${errCode}]: ${errMsg}`;
      if (errCode === 131030) {
        userFriendlyMsg = `Número de telefone não autorizado no modo de desenvolvimento Meta (Código 131030). Adicione este número como 'Test Number' no painel de desenvolvedores Meta.`;
      } else if (errCode === 190) {
        userFriendlyMsg = `Token da WhatsApp Business Cloud API expirou ou é inválido (Código 190). Atualize a Secret WHATSAPP_ACCESS_TOKEN.`;
      }

      return createErrorResponse(
        metaRes.status >= 500 ? 502 : 400,
        userFriendlyMsg,
        "INTERNAL_ERROR",
        { metaCode: errCode, status: "PROVIDER_REJECTED" }
      );
    }

    // 12. Parse Success Response & Extract wamid
    const metaSuccessData = await metaRes.json();
    const wamid = metaSuccessData.messages?.[0]?.id || `wamid.auto_${Date.now()}`;

    // 13. PostgreSQL Persistence of Automated Message
    const { data: insertedMsg, error: insertErr } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender: "bot",
        channel: "whatsapp",
        content: trimmedText,
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
          triggeredByMessageId: messageId || null,
          external_event_id: externalEventId || null,
          meta_message_id: wamid,
          sent_by: "automation_engine",
        },
      })
      .select()
      .single();

    if (insertErr || !insertedMsg) {
      logSecure("error", {
        service: "meta-automation-send-message",
        action: "persist_automated_message",
        status: "error",
        channel: "whatsapp",
        message: `Mensagem automatizada despachada com ID ${wamid}, mas falhou ao gravar no Supabase: ${insertErr?.message}`,
      });
      return createErrorResponse(
        500,
        `Mensagem automatizada despachada com sucesso ao WhatsApp (ID: ${wamid}), mas falhou ao persistir no banco de dados.`,
        "INTERNAL_ERROR"
      );
    }

    // 14. Update Conversation Activity & Mark unread_count
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
