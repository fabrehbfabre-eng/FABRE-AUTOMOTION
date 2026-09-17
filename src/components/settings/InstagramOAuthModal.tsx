/**
 * FABRE AUTOMATION - Instagram OAuth Connection Modal
 * Release: Instagram Business Login / OAuth Foundation
 * 
 * Provides an intuitive, secure interface for initiating the Meta OAuth
 * flow or viewing technical requirements if Meta secrets are still pending.
 * Strictly adheres to security rules: no secrets in frontend, multitenant state.
 */

import React, { useState, useEffect } from 'react';
import { 
  Instagram, 
  ExternalLink, 
  ShieldCheck, 
  Copy, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  CheckCircle2, 
  Lock, 
  Layers,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { instagramOAuthService, InstagramOAuthStatus } from '../../services/InstagramOAuthService';
import { ChannelConnection } from '../../types';
import { repositoryManager } from '../../services/repositories';

interface InstagramOAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  connection?: ChannelConnection;
  onConnectionUpdated?: () => void;
}

export const InstagramOAuthModal: React.FC<InstagramOAuthModalProps> = ({
  isOpen,
  onClose,
  connection,
  onConnectionUpdated,
}) => {
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [oauthStatus, setOauthStatus] = useState<InstagramOAuthStatus | null>(null);
  const [initiatingAuth, setInitiatingAuth] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [copiedCallback, setCopiedCallback] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [oauthLaunched, setOauthLaunched] = useState(false);
  const [directAuthorizeUrl, setDirectAuthorizeUrl] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      checkStatus();
      setOauthLaunched(false);
    }
  }, [isOpen]);

  // Listener para quando o usuário retornar o foco para esta janela após autorizar no Instagram
  useEffect(() => {
    if (!isOpen) return;

    const handleWindowFocus = () => {
      checkStatus();
      if (onConnectionUpdated) {
        onConnectionUpdated();
      }
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [isOpen, onConnectionUpdated]);

  const checkStatus = async () => {
    setLoadingStatus(true);
    setAuthError(null);
    try {
      const status = await instagramOAuthService.getStatus();
      setOauthStatus(status);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAuthError(msg);
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleCopyCallback = () => {
    const callbackUrl = oauthStatus?.callbackUrl || instagramOAuthService.getCallbackUrl();
    navigator.clipboard.writeText(callbackUrl);
    setCopiedCallback(true);
    setTimeout(() => setCopiedCallback(false), 2500);
  };

  const handleStartOAuth = () => {
    setInitiatingAuth(true);
    setAuthError(null);
    try {
      const result = instagramOAuthService.startOAuthFlow();
      const url = result.authorizeUrl || instagramOAuthService.getAuthorizeUrl();
      setDirectAuthorizeUrl(url);

      if (!result.success) {
        setAuthError(result.message || result.error || 'Falha ao iniciar autenticação');
      } else {
        setOauthLaunched(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAuthError(msg);
    } finally {
      setInitiatingAuth(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await repositoryManager.channel.updateConnectionStatus(
        'instagram',
        'awaiting_connection',
        'Canal desconectado pelo usuário. Aguardando nova autorização.'
      );
      if (onConnectionUpdated) {
        onConnectionUpdated();
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAuthError(`Erro ao desconectar canal: ${msg}`);
    } finally {
      setDisconnecting(false);
    }
  };

  const isConnected = connection?.status === 'connected';
  const callbackUrl = oauthStatus?.callbackUrl || instagramOAuthService.getCallbackUrl();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isConnected ? 'Gerenciar Instagram Direct' : 'Conectar Instagram Direct'}
      subtitle="Autorização oficial Meta Graph API via Instagram Business Login"
    >
      <div className="space-y-5 p-1">
        {/* Cabeçalho de Status com Identidade Visual */}
        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-pink-950/30 shrink-0">
              <Instagram size={22} />
            </div>
            <div>
              <span className="text-xs text-neutral-400 block">Canal Oficial:</span>
              <span className="text-sm font-bold text-neutral-100 font-display">
                Instagram Direct (@casalfabre)
              </span>
            </div>
          </div>

          <div>
            {isConnected ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Conectado</span>
              </span>
            ) : oauthStatus?.configured ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <CheckCircle2 size={12} />
                <span>Pronto para Conectar</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertCircle size={12} />
                <span>Configuração Pendente</span>
              </span>
            )}
          </div>
        </div>

        {/* Feedback de Erro se houver */}
        {authError && (
          <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-800/40 text-xs text-rose-300 leading-relaxed flex items-start gap-2.5">
            <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Diagnóstico de Autorização:</span>
              <span>{authError}</span>
            </div>
          </div>
        )}

        {/* CONTEÚDO CASO 1: CONECTADO */}
        {isConnected && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-2">
              <span className="text-xs font-semibold text-neutral-300">Detalhes da Conexão Ativa</span>
              <p className="text-xs text-neutral-400 leading-relaxed">
                A conta profissional do Instagram está autorizada e sincronizada com a Meta Cloud API. O FABRE AUTOMATION está habilitado para receber mensagens diretas, responder clientes com IA e processar automações.
              </p>
              <div className="pt-2 flex flex-wrap gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-neutral-800 text-[11px] font-mono text-neutral-300 border border-neutral-700">
                  Permissão: instagram_business_basic
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-neutral-800 text-[11px] font-mono text-neutral-300 border border-neutral-700">
                  Permissão: instagram_business_manage_messages
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={handleStartOAuth}
                disabled={initiatingAuth}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={14} className={initiatingAuth ? 'animate-spin' : ''} />
                <span>Reconectar / Renovar Permissões</span>
              </button>

              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="py-2.5 px-4 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors cursor-pointer disabled:opacity-50"
              >
                {disconnecting ? 'Desconectando...' : 'Desconectar'}
              </button>
            </div>
          </div>
        )}

        {/* CONTEÚDO CASO 2: AGUARDANDO CONEXÃO / PRONTO OU PENDENTE DE SECRETS */}
        {!isConnected && (
          <div className="space-y-4">
            {/* Permissões Oficiais Requeridas */}
            <div className="p-3.5 rounded-xl bg-neutral-900/50 border border-neutral-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-pink-400" />
                  Permissões Meta Instagram Business Login
                </span>
                <span className="text-[10px] font-mono text-neutral-500">v19.0 Oficial</span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Este fluxo utiliza estritamente os escopos de autorização modernos exigidos pela Meta para contas profissionais:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <div className="p-2.5 rounded-lg bg-neutral-950/80 border border-neutral-800/80">
                  <span className="text-xs font-mono font-bold text-neutral-200 block">
                    instagram_business_basic
                  </span>
                  <span className="text-[11px] text-neutral-400 block mt-0.5">
                    Identificação da conta profissional, perfil e informações básicas.
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-neutral-950/80 border border-neutral-800/80">
                  <span className="text-xs font-mono font-bold text-neutral-200 block">
                    instagram_business_manage_messages
                  </span>
                  <span className="text-[11px] text-neutral-400 block mt-0.5">
                    Leitura e resposta de mensagens diretas de seguidores e clientes.
                  </span>
                </div>
              </div>
            </div>

            {/* SE SECRETS ESTIVEREM PENDENTES NO SUPABASE */}
            {!oauthStatus?.configured && (
              <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-amber-300 block">
                      Preparação de Chaves Meta no Supabase
                    </span>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      A fundação técnica e as rotas de callback já estão implementadas. Para habilitar o login oficial com a Meta, configure os seguintes segredos no painel do Supabase (Project Settings &rarr; Edge Functions Secrets):
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <div className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800/80 font-mono text-xs space-y-1">
                    <div className="flex items-center justify-between text-neutral-300">
                      <span>INSTAGRAM_APP_ID</span>
                      <span className="text-[10px] text-neutral-500">ID do App na Meta</span>
                    </div>
                    <div className="flex items-center justify-between text-neutral-300">
                      <span>INSTAGRAM_APP_SECRET</span>
                      <span className="text-[10px] text-neutral-500">Chave Secreta do App</span>
                    </div>
                  </div>

                  {/* URL de Redirecionamento Canônica para o Console da Meta */}
                  <div className="p-2.5 rounded-lg bg-neutral-950 border border-neutral-800/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-neutral-300">
                        URL de Redirecionamento OAuth (Meta Callback):
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyCallback}
                        className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        {copiedCallback ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                        <span>{copiedCallback ? 'Copiado!' : 'Copiar URL'}</span>
                      </button>
                    </div>
                    <p className="text-xs font-mono text-cyan-400 truncate bg-neutral-900 px-2 py-1 rounded border border-neutral-800">
                      {callbackUrl}
                    </p>
                    <span className="text-[10px] text-neutral-500 block">
                      Cadastre este endpoint HTTPS no painel da Meta em: <em>Instagram Login for Business &rarr; Valid OAuth Redirect URIs</em>.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* FEEDBACK DE ABERTURA TOP-LEVEL (NOVA ABA) */}
            {oauthLaunched && (
              <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-800/40 text-xs text-cyan-200 space-y-2">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-semibold block text-cyan-100">
                      Janela de autorização aberta em nova aba
                    </span>
                    <p className="text-neutral-300 text-xs leading-relaxed">
                      A tela oficial do Instagram foi aberta fora do iframe do preview. Clique em <strong>Permitir</strong> no Instagram para vincular a conta @casalfabre.
                    </p>
                  </div>
                </div>
                <div className="pt-1.5 border-t border-cyan-800/30 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-neutral-400">A nova aba não abriu ou foi bloqueada pelo navegador?</span>
                  <a
                    href={directAuthorizeUrl || instagramOAuthService.getAuthorizeUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-cyan-300 hover:text-cyan-200 underline text-xs cursor-pointer"
                  >
                    <span>Abrir autorização manualmente</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            )}

            {/* BOTÃO PRINCIPAL DE AÇÃO */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleStartOAuth}
                disabled={initiatingAuth}
                className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-pink-950/40 disabled:opacity-50"
              >
                {initiatingAuth ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Abrindo autorização...</span>
                  </>
                ) : (
                  <>
                    <Instagram size={16} />
                    <span>Conectar com Instagram (Meta Oficial)</span>
                    <ExternalLink size={14} />
                  </>
                )}
              </button>
              <span className="text-[11px] text-neutral-500 block text-center mt-2">
                Abre a autorização oficial em aba de nível superior, compatível com o preview e produção.
              </span>
            </div>
          </div>
        )}

        {/* Rodapé com Fechar */}
        <div className="pt-3 border-t border-neutral-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  );
};
