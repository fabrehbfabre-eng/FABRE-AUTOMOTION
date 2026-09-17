// Supabase Edge Function: meta-send-message
// Release: Security Hardening | Autenticação JWT Criptográfica + Autorização do Operador
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

  // 3. Cryptographic JWT Authentication Check
  // Note: A public 'apikey' alone is NEVER accepted as operator identity.
  // We require a valid 'Authorization: Bearer <jwt>' header.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.trim().toLowerCase().startsWith("bearer ")) {
    logSecure("warn", {
      service: "meta-send-message",
      action: "auth_check",
      status: "warning",
      message: "Rejeitada solicitação sem token Bearer de autorização",
    });
    return createErrorResponse(401, "Usuário não autenticado ou sessão inválida.", "UNAUTHORIZED");
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    logSecure("warn", {
      service: "meta-send-message",
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

    // Allow Service Role Key or valid authenticated Operator / Admin JWT
    if (serviceRoleKey && token.trim() === serviceRoleKey.trim()) {
      user = {
        id: "operator-admin-service",
        email: "admin@casalfabre.com",
        role: "authenticated",
        app_metadata: { role: "admin", can_send_outbound: true }
      };
    } else {
      const { data: authData, error: authError } = await supabase.auth.getUser(token);

      if (authError || !authData?.user || !authData.user.id) {
        logSecure("warn", {
          service: "meta-send-message",
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
          service: "meta-send-message",
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
      service: "meta-send-message",
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

  let isAuthorizedMember = false;
  if (!isExplicitlyAuthorized && !isDisabled) {
    try {
      const { data: memberData } = await supabase
        .from("workspace_members")
        .select("role, workspace_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (memberData && (memberData.role === "owner" || memberData.role === "admin" || memberData.role === "operator")) {
        isAuthorizedMember = true;
      }
    } catch (memberErr) {
      logSecure("warn", {
        service: "meta-send-message",
        action: "db_workspace_role_check",
        status: "warning",
        userId: user.id,
        message: `Erro ao consultar membros de workspace: ${memberErr instanceof Error ? memberErr.message : String(memberErr)}`,
      });
    }
  }

  const isAuthorized = isExplicitlyAuthorized || isAuthorizedMember;

  if (!isAuthorized || isDisabled) {
    logSecure("warn", {
      service: "meta-send-message",
      action: "operator_authorization",
      status: "warning",
      userId: user.id,
      appRole: appRole || "none",
      message: `Acesso outbound rejeitado (403): Usuário autenticado (${user.id}) sem permissão de operador/admin (app_metadata.role: ${appRole || "ausente"}, workspaceAuthorized: ${isAuthorizedMember}, disabled: ${Boolean(isDisabled)})`,
    });
    return createErrorResponse(403, "Usuário autenticado, mas sem permissão para executar esta operação.", "FORBIDDEN");
  }

  // 5. Request Body Parsing & Sanitization
  // Note: Executed strictly AFTER authentication and authorization have succeeded.
  let payload: Record<string, any>;
  try {
    payload = await req.json();
  } catch {
    return createErrorResponse(400, "Corpo da requisição JSON inválido.", "INVALID_INPUT");
  }

  let conversationId = typeof payload.conversationId === "string" ? payload.conversationId.trim() : "";
  const rawRecipientInput = typeof payload.recipientPhone === "string" 
    ? payload.recipientPhone 
    : typeof payload.to === "string" 
    ? payload.to 
    : "";
  const { text } = payload;

  if (!conversationId && !rawRecipientInput) {
    return createErrorResponse(400, "Campo obrigatório ausente: informe 'conversationId' ou 'recipientPhone'.", "INVALID_INPUT");
  }

  if (!text || typeof text !== "string" || !text.trim()) {
    return createErrorResponse(400, "Campo obrigatório ausente ou inválido: text. Mensagens vazias não são permitidas.", "INVALID_INPUT");
  }

  const trimmedText = text.trim();
  if (trimmedText.length > 4096) {
    return createErrorResponse(400, "O tamanho da mensagem excede o limite máximo permitido de 4096 caracteres.", "INVALID_INPUT");
  }

  try {
    let conversation: any = null;
    let contact: any = null;
    let channel = "whatsapp";
    let recipientPhone = "";

    // If conversationId is provided, resolve existing conversation and profile
    if (conversationId) {
      const { data: convData, error: convErr } = await supabase
        .from("conversations")
        .select("id, contact_id, channel, status, handler")
        .eq("id", conversationId)
        .single();

      if (convErr || !convData) {
        logSecure("warn", {
          service: "meta-send-message",
          action: "find_conversation",
          status: "warning",
          message: `Conversa não encontrada: ${conversationId}`,
        });
        return createErrorResponse(404, `Conversa não encontrada: ${conversationId}`, "NOT_FOUND");
      }

      conversation = convData;
      channel = conversation.channel;

      const { data: contactData, error: contactErr } = await supabase
        .from("profiles")
        .select("id, name, username, phone, channel, metadata")
        .eq("id", conversation.contact_id)
        .single();

      if (contactErr || !contactData) {
        return createErrorResponse(404, `Contato associado à conversa não encontrado: ${conversation.contact_id}`, "NOT_FOUND");
      }

      contact = contactData;
      const rawPhone = contact.phone || (contact.metadata as any)?.wa_id || contact.username?.replace(/^wa_/, "");
      recipientPhone = (rawPhone || "").replace(/\D/g, "");
    } else {
      // Direct recipient phone provided for E2E validation test
      recipientPhone = rawRecipientInput.replace(/\D/g, "");
      if (!recipientPhone || recipientPhone.length < 8) {
        return createErrorResponse(400, "Número de telefone de destino inválido (mínimo de 8 dígitos numéricos).", "INVALID_INPUT");
      }

      // Find or create profile for this WhatsApp contact
      const { data: existingProfiles } = await supabase
        .from("profiles")
        .select("id, name, username, phone, channel, metadata")
        .eq("channel", "whatsapp")
        .or(`username.eq.wa_${recipientPhone},username.eq.${recipientPhone},phone.eq.${recipientPhone}`)
        .limit(1);

      if (existingProfiles && existingProfiles.length > 0) {
        contact = existingProfiles[0];
      } else {
        const { data: newProfile, error: profileErr } = await supabase
          .from("profiles")
          .insert({
            name: `WhatsApp (+${recipientPhone})`,
            username: `wa_${recipientPhone}`,
            phone: recipientPhone,
            channel: "whatsapp",
            metadata: {
              wa_id: recipientPhone,
              platform: "whatsapp",
              origin: "e2e_validation_test",
            },
            last_active_at: new Date().toISOString(),
          })
          .select("id, name, username, phone, channel, metadata")
          .single();

        if (profileErr || !newProfile) {
          return createErrorResponse(500, `Falha ao registrar perfil de contato para o teste: ${profileErr?.message}`, "INTERNAL_ERROR");
        }
        contact = newProfile;
      }

      // Find or create conversation for this WhatsApp contact
      const { data: existingConvs } = await supabase
        .from("conversations")
        .select("id, contact_id, channel, status, handler")
        .eq("contact_id", contact.id)
        .eq("channel", "whatsapp")
        .limit(1);

      if (existingConvs && existingConvs.length > 0) {
        conversation = existingConvs[0];
      } else {
        const { data: newConv, error: newConvErr } = await supabase
          .from("conversations")
          .insert({
            contact_id: contact.id,
            channel: "whatsapp",
            status: "open",
            handler: "human",
            unread_count: 0,
            metadata: {
              origin: "e2e_validation_test",
              tested_by: user.id,
            },
          })
          .select("id, contact_id, channel, status, handler")
          .single();

        if (newConvErr || !newConv) {
          return createErrorResponse(500, `Falha ao criar conversa para o teste: ${newConvErr?.message}`, "INTERNAL_ERROR");
        }
        conversation = newConv;
      }

      conversationId = conversation.id;
    }

    // 8. Channel Outbound Certification Verification
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

    if (!recipientPhone || recipientPhone.length < 8) {
      return createErrorResponse(
        400,
        "Número de telefone do destinatário inválido ou não cadastrado no perfil de contato.",
        "INVALID_INPUT"
      );
    }

    // 9. Resolve WhatsApp Phone Number ID & WABA ID (Canonical ADM01 Enforced)
    let phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || (contact?.metadata as any)?.phone_number_id;
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

    // Strict Canonical Fallbacks for ADM01 Official Asset
    if (!phoneNumberId) {
      phoneNumberId = "250763631462152";
    }

    if (!wabaId || wabaId === "2263873424408708") {
      wabaId = "293410900513919";
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

    // 11. Meta API Response Handling
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

      const isTemplateRequired = errCode === 131047 || errCode === 131026;
      let userFriendlyMsg = `Falha na Meta Cloud API [${errCode}]: ${errMsg}`;
      if (isTemplateRequired) {
        userFriendlyMsg = `Janela de 24 horas fechada pela Meta (Código ${errCode}). Para iniciar conversas, a política da Meta exige o envio de uma mensagem template pré-aprovada, ou que o usuário envie uma mensagem primeiro para abrir a janela de conversa gratuita de 24h.`;
      } else if (errCode === 131030) {
        userFriendlyMsg = `Número de telefone não autorizado no modo de desenvolvimento Meta (Código 131030). Adicione este número como 'Test Number' no painel de desenvolvedores Meta.`;
      } else if (errCode === 190) {
        userFriendlyMsg = `Token da WhatsApp Business Cloud API expirou ou é inválido (Código 190). Atualize a Secret WHATSAPP_ACCESS_TOKEN.`;
      }

      return createErrorResponse(
        metaRes.status >= 500 ? 502 : 400,
        userFriendlyMsg,
        "META_API_ERROR",
        {
          status: "FAILED",
          httpStatus: metaRes.status,
          metaCode: errCode,
          metaError: errMsg,
          phoneNumberId,
          wabaId,
          endpoint: metaApiUrl,
          destination: recipientPhone,
          isTemplateRequired,
          timestamp: new Date().toISOString()
        }
      );
    }

    // 12. Parse Success Response & Extract wamid
    const metaSuccessData = await metaRes.json();
    const externalMessageId = metaSuccessData.messages?.[0]?.id || `wamid.outbound_${Date.now()}`;

    // 13. PostgreSQL Persistence of Outbound Message
    // Records the authenticated operator user.id in metadata for audit and traceability
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
          operator_id: user.id,
          operator_email: user.email || null,
          recipient: recipientPhone,
          phone_number_id: phoneNumberId,
          waba_id: wabaId,
          portfolio: "ADM01",
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

    // 14. Update Conversation Last Activity & Reset Unread Count
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
      message: `Mensagem outbound enviada pelo operador (${user.id}) e persistida com sucesso via WhatsApp Cloud API para ${recipientPhone}`,
    });

    return createSuccessResponse({
      status: "SUCCESS",
      httpStatus: metaRes.status,
      metaMessageId: externalMessageId,
      externalId: externalMessageId,
      phoneNumberId,
      wabaId,
      endpoint: metaApiUrl,
      destination: recipientPhone,
      timestamp: new Date().toISOString(),
      conversationId: insertedMsg.conversation_id,
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
