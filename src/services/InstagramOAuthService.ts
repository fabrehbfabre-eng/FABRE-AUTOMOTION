/**
 * FABRE AUTOMATION - Instagram Business Login / OAuth Service
 * Release: Instagram Business Login / OAuth Foundation
 * 
 * Manages the Instagram Business Login OAuth handshake,
 * status inspection, multi-tenant state generation, and response parsing.
 * 
 * SECURITY COMPLIANCE:
 * - Never stores or handles App Secret on the client.
 * - Proxies authorization initialization through Supabase Edge Function 'instagram-oauth'.
 * - Uses exact canonical callback URI (never invented or non-HTTPS).
 * - Enforces multitenancy (bound to current workspace_id).
 */

import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { repositoryManager } from './repositories';

export interface InstagramOAuthStatus {
  configured: boolean;
  appIdConfigured: boolean;
  appIdMasked?: string;
  appSecretConfigured: boolean;
  callbackUrl: string;
  requiredScopes: string[];
  error?: string;
}

export interface InstagramAuthInitResult {
  success: boolean;
  authUrl?: string;
  authorizeUrl?: string;
  callbackUrl?: string;
  openedInNewTab?: boolean;
  error?: string;
  message?: string;
  configured?: boolean;
}

export interface OAuthReturnEvent {
  detected: boolean;
  status: 'success' | 'error' | null;
  channel: string | null;
  account: string | null;
  errorMessage: string | null;
}

const CANONICAL_SUPABASE_URL = 'https://aspnshujisacfnhgklrf.supabase.co';
const CANONICAL_CALLBACK_URL = `${CANONICAL_SUPABASE_URL}/functions/v1/instagram-oauth`;

export class InstagramOAuthService {
  /**
   * Retorna a URL canônica do callback OAuth da Meta
   */
  getCallbackUrl(): string {
    const customUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL);
    if (customUrl && customUrl.startsWith('http')) {
      return `${customUrl.replace(/\/$/, '')}/functions/v1/instagram-oauth`;
    }
    return CANONICAL_CALLBACK_URL;
  }

  /**
   * Consulta o status técnico da infraestrutura OAuth no Edge Function
   */
  async getStatus(): Promise<InstagramOAuthStatus> {
    const callbackUrl = this.getCallbackUrl();

    if (!isSupabaseConfigured()) {
      return {
        configured: false,
        appIdConfigured: false,
        appSecretConfigured: false,
        callbackUrl,
        requiredScopes: ['instagram_business_basic', 'instagram_business_manage_messages'],
        error: 'Supabase não inicializado.',
      };
    }

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error('Cliente Supabase indisponível');
      }

      const { data, error } = await supabase.functions.invoke('instagram-oauth', {
        body: { action: 'status' },
      });

      if (error) {
        // Se a função ainda não foi deployada ou retornou erro
        return {
          configured: false,
          appIdConfigured: false,
          appSecretConfigured: false,
          callbackUrl,
          requiredScopes: ['instagram_business_basic', 'instagram_business_manage_messages'],
          error: error.message || 'Edge Function instagram-oauth pendente de deploy ou sem resposta.',
        };
      }

      return {
        configured: Boolean(data?.configured),
        appIdConfigured: Boolean(data?.app_id_configured),
        appIdMasked: data?.app_id_masked || undefined,
        appSecretConfigured: Boolean(data?.app_secret_configured),
        callbackUrl: data?.callback_url || callbackUrl,
        requiredScopes: data?.required_scopes || [
          'instagram_business_basic',
          'instagram_business_manage_messages',
        ],
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        configured: false,
        appIdConfigured: false,
        appSecretConfigured: false,
        callbackUrl,
        requiredScopes: ['instagram_business_basic', 'instagram_business_manage_messages'],
        error: `Erro ao consultar status OAuth: ${msg}`,
      };
    }
  }

  /**
   * Retorna a URL canônica de retorno ao frontend do FABRE AUTOMATION
   * Compatível tanto com o preview do Google AI Studio quanto com domínios de produção
   */
  getDefaultFrontendRedirectUrl(): string {
    if (typeof window === 'undefined') {
      return 'https://casalfabre.com.br/#settings';
    }
    const origin = window.location.origin;
    const pathname = window.location.pathname || '';
    return `${origin}${pathname}#settings`;
  }

  /**
   * Retorna a URL canônica do endpoint GET de autorização no Supabase Edge Function:
   * https://aspnshujisacfnhgklrf.supabase.co/functions/v1/instagram-oauth?action=authorize
   * 
   * O endpoint gera o state assinado via HMAC no servidor e encaminha (HTTP 302)
   * diretamente para a autorização oficial do Instagram na Meta.
   */
  getAuthorizeUrl(options?: {
    workspaceId?: string;
    userId?: string;
    redirectUrl?: string;
    redirect?: boolean;
  }): string {
    const callbackEndpoint = this.getCallbackUrl();
    const url = new URL(callbackEndpoint);
    url.searchParams.set('action', 'authorize');

    const workspaceId = options?.workspaceId || '00000000-0000-0000-0000-000000000001';
    const userId = options?.userId || 'admin_user';
    const redirectUrl = options?.redirectUrl || this.getDefaultFrontendRedirectUrl();

    url.searchParams.set('workspace_id', workspaceId);
    url.searchParams.set('user_id', userId);
    url.searchParams.set('redirect_url', redirectUrl);

    if (options?.redirect !== false) {
      url.searchParams.set('redirect', 'true');
    }

    return url.toString();
  }

  /**
   * Solicita ao Edge Function a geração da URL de autorização oficial da Meta
   * Vinculada ao workspace_id e user_id atual (Multitenant)
   * Realiza chamada GET canônica para instagram-oauth?action=authorize com redirect=false
   */
  async initiateAuthorization(options?: {
    workspaceId?: string;
    userId?: string;
    redirectUrl?: string;
  }): Promise<InstagramAuthInitResult> {
    const callbackUrl = this.getCallbackUrl();
    const authorizeEndpoint = this.getAuthorizeUrl({
      workspaceId: options?.workspaceId,
      userId: options?.userId,
      redirectUrl: options?.redirectUrl,
      redirect: false,
    });

    try {
      const response = await fetch(authorizeEndpoint, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok || !data?.success || !data?.auth_url) {
        return {
          success: false,
          configured: Boolean(data?.configured),
          error: data?.error || 'AUTH_URL_MISSING',
          message:
            data?.message ||
            'Não foi possível gerar a URL de autorização oficial da Meta.',
          callbackUrl: data?.callback_url || callbackUrl,
        };
      }

      return {
        success: true,
        configured: true,
        authUrl: data.auth_url,
        authorizeUrl: this.getAuthorizeUrl({
          workspaceId: options?.workspaceId,
          userId: options?.userId,
          redirectUrl: options?.redirectUrl,
          redirect: true,
        }),
        callbackUrl: data.callback_url || callbackUrl,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        configured: false,
        error: 'CLIENT_EXCEPTION',
        message: `Falha ao consultar endpoint de autorização: ${msg}`,
        callbackUrl,
      };
    }
  }

  /**
   * Inicia o fluxo OAuth oficial em contexto de navegação de nível superior (Top-Level),
   * garantindo que www.instagram.com NÃO seja carregado dentro de nenhum iframe (ex: preview do Google AI Studio).
   * 
   * Utiliza GET no endpoint oficial:
   * https://aspnshujisacfnhgklrf.supabase.co/functions/v1/instagram-oauth?action=authorize&redirect=true
   * que gera o state assinado por HMAC no servidor e redireciona (302) para a Meta.
   */
  startOAuthFlow(options?: {
    workspaceId?: string;
    userId?: string;
    redirectUrl?: string;
  }): InstagramAuthInitResult {
    const authorizeUrl = this.getAuthorizeUrl({
      workspaceId: options?.workspaceId,
      userId: options?.userId,
      redirectUrl: options?.redirectUrl,
      redirect: true,
    });

    try {
      // Abre em nova janela/aba de nível superior fora do iframe do preview
      const newWindow = window.open(authorizeUrl, '_blank', 'noopener,noreferrer');
      const openedInNewTab = Boolean(newWindow && !newWindow.closed);

      return {
        success: true,
        configured: true,
        authUrl: authorizeUrl,
        authorizeUrl,
        callbackUrl: this.getCallbackUrl(),
        openedInNewTab,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        configured: false,
        authUrl: authorizeUrl,
        authorizeUrl,
        callbackUrl: this.getCallbackUrl(),
        openedInNewTab: false,
        error: 'POPUP_BLOCKED_OR_ERROR',
        message: `Não foi possível abrir a nova aba automaticamente: ${msg}. Por favor, use o link direto de autorização.`,
      };
    }
  }

  /**
   * Detecta parâmetros de retorno do OAuth no endereço da página (URL / Hash)
   */
  parseOAuthReturnParams(): OAuthReturnEvent {
    const searchParams = new URLSearchParams(window.location.search);
    
    // Suporte a hash params (ex: /#settings?oauth_status=success...)
    let hashParams = new URLSearchParams();
    if (window.location.hash.includes('?')) {
      const queryPart = window.location.hash.split('?')[1];
      hashParams = new URLSearchParams(queryPart);
    }

    const oauthStatus = (searchParams.get('oauth_status') || hashParams.get('oauth_status')) as
      | 'success'
      | 'error'
      | null;
    const channel = searchParams.get('channel') || hashParams.get('channel');
    const account = searchParams.get('account') || hashParams.get('account');
    const errorMessage = searchParams.get('error_message') || hashParams.get('error_message');

    const detected = Boolean(oauthStatus && channel === 'instagram');

    return {
      detected,
      status: oauthStatus,
      channel,
      account,
      errorMessage,
    };
  }

  /**
   * Remove os parâmetros de retorno OAuth da barra de endereço para manter a URL limpa
   */
  clearOAuthReturnParams(): void {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('oauth_status');
      url.searchParams.delete('channel');
      url.searchParams.delete('account');
      url.searchParams.delete('error_message');

      if (url.hash.includes('?')) {
        const hashBase = url.hash.split('?')[0];
        url.hash = hashBase;
      }

      window.history.replaceState({}, document.title, url.toString());
    } catch {
      // Silent catch
    }
  }
}

export const instagramOAuthService = new InstagramOAuthService();
