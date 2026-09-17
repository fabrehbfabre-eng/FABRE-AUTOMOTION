// Supabase Edge Function: instagram-oauth
// Release: Instagram Business Login / OAuth Foundation
// Handles Meta Instagram Business Login OAuth initiation, callback, token exchange,
// multitenant workspace persistence in public.channel_connections, and safe returns.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { getServerSupabaseClient } from "../_shared/supabaseServer.ts";
import { createErrorResponse, createSuccessResponse } from "../_shared/errors.ts";
import { logSecure } from "../_shared/logger.ts";

const INSTAGRAM_APP_ID = Deno.env.get("INSTAGRAM_APP_ID") || Deno.env.get("META_APP_ID");
const INSTAGRAM_APP_SECRET = Deno.env.get("INSTAGRAM_APP_SECRET") || Deno.env.get("META_APP_SECRET");
const DEFAULT_SUPABASE_URL = "https://aspnshujisacfnhgklrf.supabase.co";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || DEFAULT_SUPABASE_URL;

// Permissões atuais exigidas pela Meta para Instagram Login
const REQUIRED_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
];

function getCallbackUrl(): string {
  const customRedirect = Deno.env.get("INSTAGRAM_OAUTH_REDIRECT_URI");
  if (customRedirect && customRedirect.startsWith("http")) {
    return customRedirect;
  }
  return `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/instagram-oauth`;
}

function getSigningSecret(): string {
  return (
    INSTAGRAM_APP_SECRET ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    "fabre_instagram_oauth_secret_fallback"
  );
}

/**
 * Assina o state criptograficamente usando HMAC-SHA256
 */
async function signState(data: Record<string, unknown>, secret: string): Promise<string> {
  const payload = JSON.stringify(data);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const sigHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Base64 encode do payload
  const b64Payload = btoa(unescape(encodeURIComponent(payload)));
  return `${b64Payload}.${sigHex}`;
}

/**
 * Valida a integridade e expiração do state
 */
async function verifyState(
  stateStr: string,
  secret: string
): Promise<{ valid: boolean; data: any; reason?: string }> {
  try {
    if (!stateStr || typeof stateStr !== "string") {
      return { valid: false, data: null, reason: "State ausente ou em formato inválido" };
    }
    const parts = stateStr.split(".");
    if (parts.length !== 2) {
      return { valid: false, data: null, reason: "Formato de assinatura de state incorreto" };
    }
    const [b64Payload, sigHex] = parts;
    const payload = decodeURIComponent(escape(atob(b64Payload)));
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const matches = sigHex.match(/.{1,2}/g);
    if (!matches) {
      return { valid: false, data: null, reason: "Assinatura hexadecimal corrompida" };
    }
    const sigBytes = new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(payload));
    if (!valid) {
      return { valid: false, data: null, reason: "Assinatura HMAC inválida" };
    }

    const data = JSON.parse(payload);
    // Limite de 15 minutos para prevenir ataques de repetição (replay)
    if (data.timestamp && Date.now() - data.timestamp > 15 * 60 * 1000) {
      return { valid: false, data: null, reason: "State expirado (limite de 15 minutos excedido)" };
    }

    return { valid: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, data: null, reason: `Erro ao decodificar state: ${msg}` };
  }
}

serve(async (req: Request) => {
  const startTime = Date.now();

  // 1. CORS Pre-flight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);
  const callbackUrl = getCallbackUrl();
  const signingSecret = getSigningSecret();

  try {
    // --------------------------------------------------------------------------
    // FLUXO A: Status / Verificação de Configuração
    // --------------------------------------------------------------------------
    if (
      url.searchParams.get("action") === "status" ||
      (req.method === "POST" && (await cloneBody(req))?.action === "status")
    ) {
      const isConfigured = Boolean(INSTAGRAM_APP_ID && INSTAGRAM_APP_SECRET);
      return new Response(
        JSON.stringify({
          success: true,
          configured: isConfigured,
          app_id_configured: Boolean(INSTAGRAM_APP_ID),
          app_id_masked: INSTAGRAM_APP_ID
            ? `${INSTAGRAM_APP_ID.slice(0, 4)}••••••••`
            : null,
          app_secret_configured: Boolean(INSTAGRAM_APP_SECRET),
          callback_url: callbackUrl,
          required_scopes: REQUIRED_SCOPES,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // --------------------------------------------------------------------------
    // FLUXO B: Início da Autorização (Geração de URL e State)
    // --------------------------------------------------------------------------
    if (
      url.searchParams.get("action") === "authorize" ||
      (req.method === "POST" && (await cloneBody(req))?.action === "authorize")
    ) {
      let body: any = {};
      if (req.method === "POST") {
        try {
          body = await req.json();
        } catch {
          body = {};
        }
      }

      const workspaceId =
        body.workspace_id ||
        url.searchParams.get("workspace_id") ||
        "00000000-0000-0000-0000-000000000001";
      const userId = body.user_id || url.searchParams.get("user_id") || "anonymous_admin";
      const redirectUrl =
        body.redirect_url ||
        url.searchParams.get("redirect_url") ||
        req.headers.get("origin") ||
        req.headers.get("referer") ||
        "https://casalfabre.com.br";

      if (!INSTAGRAM_APP_ID || !INSTAGRAM_APP_SECRET) {
        logSecure("warn", {
          service: "instagram-oauth",
          action: "initiate_auth",
          status: "warning",
          message:
            "Credenciais Meta não configuradas no Supabase Secrets (INSTAGRAM_APP_ID ou INSTAGRAM_APP_SECRET)",
        });

        if (req.method === "GET") {
          const errorRedirect = new URL(redirectUrl);
          errorRedirect.searchParams.set("oauth_status", "error");
          errorRedirect.searchParams.set("channel", "instagram");
          errorRedirect.searchParams.set(
            "error_message",
            "Credenciais Meta não configuradas no Supabase Secrets. Configure INSTAGRAM_APP_ID e INSTAGRAM_APP_SECRET."
          );
          return Response.redirect(errorRedirect.toString(), 302);
        }

        return new Response(
          JSON.stringify({
            success: false,
            configured: false,
            error: "META_CREDENTIALS_MISSING",
            message:
              "Credenciais Meta não configuradas nos Secrets do Supabase (INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET).",
            callback_url: callbackUrl,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Constrói o state com isolamento multitenant
      const statePayload = {
        workspace_id: workspaceId,
        user_id: userId,
        redirect_url: redirectUrl,
        timestamp: Date.now(),
        nonce: crypto.randomUUID(),
      };
      const signedState = await signState(statePayload, signingSecret);

      // URL de autorização oficial do Instagram Business Login
      const authUrl = new URL("https://www.instagram.com/oauth/authorize");
      authUrl.searchParams.set("enable_fb_login", "0");
      authUrl.searchParams.set("force_authentication", "1");
      authUrl.searchParams.set("client_id", INSTAGRAM_APP_ID);
      authUrl.searchParams.set("redirect_uri", callbackUrl);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", REQUIRED_SCOPES.join(","));
      authUrl.searchParams.set("state", signedState);

      logSecure("info", {
        service: "instagram-oauth",
        action: "initiate_auth",
        status: "success",
        channel: "instagram",
        message: "URL de autorização Instagram gerada com sucesso para tenant",
        details: { workspace_id: workspaceId },
      });

      if (req.method === "GET" && url.searchParams.get("redirect") === "true") {
        return Response.redirect(authUrl.toString(), 302);
      }

      return new Response(
        JSON.stringify({
          success: true,
          auth_url: authUrl.toString(),
          callback_url: callbackUrl,
          scopes: REQUIRED_SCOPES,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // --------------------------------------------------------------------------
    // FLUXO C: Recebimento do Callback da Meta (GET)
    // --------------------------------------------------------------------------
    if (req.method === "GET") {
      const code = url.searchParams.get("code");
      const stateStr = url.searchParams.get("state");
      const error = url.searchParams.get("error");
      const errorReason = url.searchParams.get("error_reason");
      const errorDescription = url.searchParams.get("error_description");

      // C1: Se a Meta retornou erro ou cancelamento do usuário
      if (error || errorReason) {
        logSecure("warn", {
          service: "instagram-oauth",
          action: "oauth_callback_error",
          status: "warning",
          channel: "instagram",
          message: `Meta OAuth retornou erro: ${error || errorReason}`,
          details: { errorReason, errorDescription },
        });

        let targetRedirect = "https://casalfabre.com.br";
        if (stateStr) {
          const verification = await verifyState(stateStr, signingSecret);
          if (verification.valid && verification.data?.redirect_url) {
            targetRedirect = verification.data.redirect_url;
          }
        }

        const returnUrl = buildFrontendRedirectUrl(targetRedirect, {
          oauth_status: "error",
          channel: "instagram",
          error_message:
            errorDescription ||
            errorReason ||
            "Autorização cancelada ou recusada pelo usuário no Instagram.",
        });

        return Response.redirect(returnUrl, 302);
      }

      // C2: Verificação da presença de code e state
      if (!code || !stateStr) {
        return new Response(
          JSON.stringify({
            error: "MISSING_OAUTH_PARAMS",
            message:
              "Parâmetros code ou state não encontrados na requisição de callback da Meta.",
            callback_url: callbackUrl,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // C3: Validação estrita do state (integridade HMAC + expiração)
      const stateVerification = await verifyState(stateStr, signingSecret);
      if (!stateVerification.valid) {
        logSecure("error", {
          service: "instagram-oauth",
          action: "verify_state",
          status: "error",
          channel: "instagram",
          message: `Rejeição de state OAuth: ${stateVerification.reason}`,
        });

        return createErrorResponse(
          400,
          `Parâmetro state inválido ou expirado: ${stateVerification.reason}`,
          "INVALID_STATE"
        );
      }

      const tenantState = stateVerification.data;
      const workspaceId =
        tenantState.workspace_id || "00000000-0000-0000-0000-000000000001";
      const frontendRedirect =
        tenantState.redirect_url || "https://casalfabre.com.br";

      // C4: Troca do Authorization Code por Short-Lived Access Token
      if (!INSTAGRAM_APP_SECRET || !INSTAGRAM_APP_ID) {
        throw new Error(
          "Configurações INSTAGRAM_APP_ID ou INSTAGRAM_APP_SECRET ausentes no servidor."
        );
      }

      const tokenFormData = new URLSearchParams();
      tokenFormData.append("client_id", INSTAGRAM_APP_ID);
      tokenFormData.append("client_secret", INSTAGRAM_APP_SECRET);
      tokenFormData.append("grant_type", "authorization_code");
      tokenFormData.append("redirect_uri", callbackUrl);
      tokenFormData.append("code", code);

      logSecure("info", {
        service: "instagram-oauth",
        action: "exchange_code",
        status: "received",
        channel: "instagram",
        message: "Trocando authorization code por access token no Instagram Graph API",
      });

      const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenFormData.toString(),
      });

      if (!tokenRes.ok) {
        const errBody = await tokenRes.text();
        logSecure("error", {
          service: "instagram-oauth",
          action: "exchange_code_error",
          status: "error",
          channel: "instagram",
          message: "Erro na troca do authorization code na Meta",
          details: { httpStatus: tokenRes.status },
        });

        const returnUrl = buildFrontendRedirectUrl(frontendRedirect, {
          oauth_status: "error",
          channel: "instagram",
          error_message: `Falha ao trocar código de autorização com a Meta (Status ${tokenRes.status}).`,
        });
        return Response.redirect(returnUrl, 302);
      }

      const tokenData = await tokenRes.json();
      const shortLivedToken = tokenData.access_token;
      const igUserId = tokenData.user_id;

      // C5: Troca por Long-Lived Access Token (60 dias de validade)
      let longLivedToken = shortLivedToken;
      let expiresInSeconds = 5184000; // 60 dias padrão

      try {
        const longLivedUrl = new URL("https://graph.instagram.com/access_token");
        longLivedUrl.searchParams.set("grant_type", "ig_exchange_token");
        longLivedUrl.searchParams.set("client_secret", INSTAGRAM_APP_SECRET);
        longLivedUrl.searchParams.set("access_token", shortLivedToken);

        const longLivedRes = await fetch(longLivedUrl.toString());
        if (longLivedRes.ok) {
          const longLivedData = await longLivedRes.json();
          if (longLivedData.access_token) {
            longLivedToken = longLivedData.access_token;
            expiresInSeconds = longLivedData.expires_in || 5184000;
          }
        }
      } catch (tokenExchangeErr: unknown) {
        logSecure("warn", {
          service: "instagram-oauth",
          action: "long_lived_token_fallback",
          status: "warning",
          message: "Falha ao obter long-lived token, prosseguindo com token inicial",
        });
      }

      // C6: Identificar a Conta Profissional do Instagram
      let accountHandle = `@instagram_${igUserId}`;
      let accountName = "Instagram Business Account";
      let accountType = "BUSINESS";

      try {
        const meUrl = new URL("https://graph.instagram.com/v19.0/me");
        meUrl.searchParams.set(
          "fields",
          "id,username,name,account_type"
        );
        meUrl.searchParams.set("access_token", longLivedToken);

        const meRes = await fetch(meUrl.toString());
        if (meRes.ok) {
          const profileData = await meRes.json();
          if (profileData.username) {
            accountHandle = `@${profileData.username}`;
          }
          if (profileData.name) {
            accountName = profileData.name;
          }
          if (profileData.account_type) {
            accountType = profileData.account_type;
          }
        }
      } catch {
        // Fallback mantém os identificadores básicos
      }

      // C7: Persistência no Supabase com isolamento Multitenant
      const supabase = getServerSupabaseClient();
      const tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

      const connectionPayload = {
        workspace_id: workspaceId,
        channel: "instagram",
        name: accountName || "Instagram Direct API",
        account_handle: accountHandle,
        status: "connected",
        status_message: `Conectado via Instagram Business Login (${accountHandle})`,
        connected_at: new Date().toISOString(),
        last_sync_at: new Date().toISOString(),
        metadata: {
          instagram_business_id: String(igUserId),
          username: accountHandle.replace(/^@/, ""),
          name: accountName,
          account_type: accountType,
          scopes: REQUIRED_SCOPES,
          token_type: "bearer",
          token_expires_at: tokenExpiresAt,
          authorized_by_user_id: tenantState.user_id,
          connected_at: new Date().toISOString(),
          // Token armazenado com segurança no banco com RLS restrito a admin
          access_token: longLivedToken,
        },
      };

      const { error: upsertError } = await supabase
        .from("channel_connections")
        .upsert(connectionPayload, { onConflict: "workspace_id,channel" });

      if (upsertError) {
        logSecure("error", {
          service: "instagram-oauth",
          action: "persist_connection",
          status: "error",
          channel: "instagram",
          message: `Erro ao persistir conexão no Supabase: ${upsertError.message}`,
        });

        const returnUrl = buildFrontendRedirectUrl(frontendRedirect, {
          oauth_status: "error",
          channel: "instagram",
          error_message: "Erro ao salvar credenciais do canal no banco de dados.",
        });
        return Response.redirect(returnUrl, 302);
      }

      logSecure("info", {
        service: "instagram-oauth",
        action: "oauth_success",
        status: "success",
        channel: "instagram",
        message: `Instagram @${accountHandle.replace(/^@/, "")} autorizado e persistido com sucesso`,
        durationMs: Date.now() - startTime,
        details: {
          workspace_id: workspaceId,
          account: accountHandle,
        },
      });

      // C8: Redirecionamento seguro de volta ao Frontend
      const successReturnUrl = buildFrontendRedirectUrl(frontendRedirect, {
        oauth_status: "success",
        channel: "instagram",
        account: accountHandle.replace(/^@/, ""),
      });

      return Response.redirect(successReturnUrl, 302);
    }

    return createErrorResponse(405, "Método não suportado", "METHOD_NOT_ALLOWED");
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logSecure("error", {
      service: "instagram-oauth",
      action: "unhandled_exception",
      status: "error",
      message: `Exceção não tratada no fluxo OAuth: ${errorMsg}`,
    });

    return createErrorResponse(500, `Erro interno no servidor: ${errorMsg}`, "SERVER_ERROR");
  }
});

/**
 * Constrói URL de retorno ao frontend anexando parâmetros no fragmento hash ou query
 */
function buildFrontendRedirectUrl(
  base: string,
  params: Record<string, string>
): string {
  try {
    const url = new URL(base);
    // Se o frontend usa SPA hash router (#settings)
    if (url.hash && url.hash.includes("settings")) {
      const hashParams = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        hashParams.set(k, v);
      }
      const separator = url.hash.includes("?") ? "&" : "?";
      url.hash = `${url.hash}${separator}${hashParams.toString()}`;
    } else {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }
    return url.toString();
  } catch {
    const query = new URLSearchParams(params).toString();
    return `${base}?${query}`;
  }
}

async function cloneBody(req: Request): Promise<any> {
  try {
    const clone = req.clone();
    return await clone.json();
  } catch {
    return null;
  }
}
