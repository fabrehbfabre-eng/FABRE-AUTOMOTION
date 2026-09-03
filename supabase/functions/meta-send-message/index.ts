// Supabase Edge Function: meta-send-message
// Release: Outbound Sending | Resposta do Operador pela Inbox
// Secure server-side proxy for official Meta Graph & WhatsApp Business Cloud API outbound messages.
// Secrets (WHATSAPP_ACCESS_TOKEN, etc.) remain strictly server-side.

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

  // 3. Authentication & Authorization Check
  const authHeader = req.headers.get("Authorization") || req.headers.get("apikey");
  if (!authHeader) {
    logSecure("warn", {
      service: "meta-send-message",
      action: "auth_check",
      status: "warning",
      message: "Rejeitada solicitação sem cabeçalho de autorização",
    });
    return createErrorResponse(401, "Acesso não autorizado. Cabeçalho de autorização ausente.", "UNAUTHORIZED");
  }

  // 4. Request Body Parsing & Sanitization
  let payload: Record<string, any>;
  try {
    payload = await req.json();
  } catch {
    return createErrorResponse(400, "Corpo da requisição JSON inválido.", "INVALID_INPUT");
  }

  const { conversationId, text } = payload;

  if (!conversationId || typeof conversationId !== "string" || !conversationId.trim()) {
    return createErrorResponse(400, "Campo obrigatório ausente ou inválido: conversationId.", "INVALID_INPUT");
  }

  if (!text || typeof text !== "string" || !text.trim()) {
    return createErrorResponse(400, "Campo obrigatório ausente ou inválido: text. Mensagens vazias não são permitidas.", "INVALID_INPUT");
  }

  const trimmedText = text.trim();
  if (trimmedText.length > 4096) {
    return createErrorResponse(400, "O tamanho da mensagem excede o limite máximo permitido de 4096 caracteres.", "INVALID_INPUT");
  }

  try {
    const supabase = getServerSupabaseClient();

    // 5. Fetch Target Conversation
    const { data: conversation, error: convErr } = await supabase
      .from("conversations")
      .select("id, contact_id, channel, status, handler")
      .eq("id", conversationId.trim())
      .single();

    if (convErr || !conversation) {
      logSecure("warn", {
        service: "meta-send-message",
        action: "find_conversation",
        status: "warning",
        message: `Conversa não encontrada: ${conversationId}`,
      });
      return createErrorResponse(404, `Conversa não encontrada: ${conversationId}`, "NOT_FOUND");
    }

    // 6. Fetch Contact Profile
    const { data: contact, error: contactErr } = await supabase
      .from("profiles")
      .select("id, name, username, phone, channel, metadata")
      .eq("id", conversation.contact_id)
      .single();

    if (contactErr || !contact) {
      logSecure("warn", {
        service: "meta-send-message",
        action: "find_contact",
        status: "warning",
        message: `Perfil de contato não localizado: ${conversation.contact_id}`,
      });
      return createErrorResponse(404, `Contato associado à conversa não encontrado: ${conversation.contact_id}`, "NOT_FOUND");
    }

    const channel = conversation.channel;

    // 7. Channel Outbound Certification Verification
    // Instagram & Messenger are not yet certified for outbound in this release
    if (channel === "instagram" || channel === "messenger") {
      logSecure("info", {
        service: "meta-send-message",
        action: "channel_certification_check",
        status: "warning",
        channel,
        message: `Envio outbound para ${channel} pendente de certificação oficial`,
      });
      return createErrorResponse(
        400,
        `Envio outbound para o canal ${channel === "instagram" ? "Instagram" : "Messenger"} ainda não está certificado nesta Release. Apenas WhatsApp Business Cloud API está habilitado para envio real.`,
        "INVALID_INPUT"
      );
    }

    if (channel !== "whatsapp") {
      return createErrorResponse(400, `Canal não suportado para envio outbound: ${channel}`, "INVALID_INPUT");
    }

    // 8. WhatsApp Outbound Parameters Resolution
    const rawPhone = contact.phone || (contact.metadata as any)?.wa_id || contact.username?.replace(/^wa_/, "");
    const recipientPhone = (rawPhone || "").replace(/\D/g, "");

    if (!recipientPhone || recipientPhone.length < 8) {
      return createErrorResponse(
        400,
        "Número de telefone do destinatário inválido ou não cadastrado no perfil de contato.",
        "INVALID_INPUT"
      );
    }

    // Resolve WhatsApp Phone Number ID (from env or channel connection metadata)
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
        service: "meta-send-message",
        action: "resolve_phone_number_id",
        status: "error",
        channel: "whatsapp",
        message: "WHATSAPP_PHONE_NUMBER_ID não encontrado no ambiente server-side nem nos metadados",
      });
      return createErrorResponse(
        400,
        "Identificador da linha WhatsApp (WHATSAPP_PHONE_NUMBER_ID) não configurado no servidor nem nos metadados da conexão.",
        "INVALID_INPUT"
      );
    }

    // Resolve WhatsApp Cloud API Access Token
    const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    if (!accessToken || !accessToken.trim()) {
      logSecure("error", {
        service: "meta-send-message",
        action: "resolve_access_token",
        status: "error",
        channel: "whatsapp",
        message: "WHATSAPP_ACCESS_TOKEN não configurado nas Secrets do Supabase",
      });
      return createErrorResponse(
        400,
        "Token da WhatsApp Business Cloud API não configurado no servidor (WHATSAPP_ACCESS_TOKEN).",
        "UNAUTHORIZED"
      );
    }

    // 9. Official Meta WhatsApp Cloud API Request
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
        service: "meta-send-message",
        action: "fetch_meta_api",
        status: "error",
        channel: "whatsapp",
        message: `Falha de rede ao conectar com a Meta Cloud API: ${errorMsg}`,
      });
      return createErrorResponse(
        502,
        `Falha de comunicação com a Meta Cloud API: ${errorMsg}`,
        "INTERNAL_ERROR"
      );
    }

    // 10. Meta API Response Handling
    if (!metaRes.ok) {
      let metaErrorData: Record<string, any> = {};
      try {
        metaErrorData = await metaRes.json();
      } catch {
        metaErrorData = { message: await metaRes.text() };
      }

      const errDetails = metaErrorData.error || {};
      const errCode = errDetails.code || metaRes.status;
      const errMsg = errDetails.message || "Erro desconhecido retornado pela Meta Cloud API";

      logSecure("error", {
        service: "meta-send-message",
        action: "meta_api_response",
        status: "error",
        channel: "whatsapp",
        message: `Meta Cloud API retornou erro HTTP ${metaRes.status} [Código ${errCode}]: ${errMsg}`,
        details: {
          code: errCode,
          type: errDetails.type,
          subcode: errDetails.error_subcode,
          recipient: recipientPhone,
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
        { metaCode: errCode }
      );
    }

    // 11. Parse Success Response & Extract wamid
    const metaSuccessData = await metaRes.json();
    const externalMessageId = metaSuccessData.messages?.[0]?.id || `wamid.outbound_${Date.now()}`;

    // 12. PostgreSQL Persistence of Outbound Message
    const { data: insertedMsg, error: insertErr } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender: "user",
        channel: "whatsapp",
        content: trimmedText,
        content_type: "text",
        status: "sent",
        external_event_id: externalMessageId,
        metadata: {
          outbound: true,
          sent_by: "operator",
          recipient: recipientPhone,
          phone_number_id: phoneNumberId,
          meta_message_id: externalMessageId,
        },
      })
      .select()
      .single();

    if (insertErr || !insertedMsg) {
      logSecure("error", {
        service: "meta-send-message",
        action: "persist_outbound_message",
        status: "error",
        channel: "whatsapp",
        message: `Mensagem enviada à Meta com ID ${externalMessageId}, mas falhou ao gravar no Supabase: ${insertErr?.message}`,
      });
      return createErrorResponse(
        500,
        `Mensagem enviada com sucesso ao WhatsApp (ID: ${externalMessageId}), mas ocorreu falha ao persistir no banco de dados.`,
        "INTERNAL_ERROR"
      );
    }

    // 13. Update Conversation Last Activity & Reset Unread Count
    await supabase
      .from("conversations")
      .update({
        updated_at: new Date().toISOString(),
        unread_count: 0,
      })
      .eq("id", conversationId);

    logSecure("info", {
      service: "meta-send-message",
      action: "send_outbound_success",
      status: "success",
      channel: "whatsapp",
      eventId: externalMessageId,
      durationMs: Date.now() - startTime,
      message: `Mensagem outbound do operador enviada e persistida com sucesso via WhatsApp Cloud API para ${recipientPhone}`,
    });

    return createSuccessResponse({
      status: "SUCCESS",
      message: {
        id: insertedMsg.id,
        conversationId: insertedMsg.conversation_id,
        sender: insertedMsg.sender,
        channel: insertedMsg.channel,
        content: insertedMsg.content,
        contentType: insertedMsg.content_type,
        status: insertedMsg.status,
        externalEventId: insertedMsg.external_event_id,
        createdAt: insertedMsg.created_at,
      },
      externalId: externalMessageId,
    });
  } catch (unexpectedErr: unknown) {
    const errorMsg = unexpectedErr instanceof Error ? unexpectedErr.message : String(unexpectedErr);
    logSecure("error", {
      service: "meta-send-message",
      action: "unhandled_exception",
      status: "error",
      message: `Exceção inesperada na função meta-send-message: ${errorMsg}`,
    });
    return createErrorResponse(500, `Erro interno no envio de mensagem: ${errorMsg}`, "INTERNAL_ERROR");
  }
});
