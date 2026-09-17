/**
 * FABRE AUTOMATION - Configurações Avançadas (Área Técnica / Administrador)
 * Release 9.1: Simplificação da Interface de Configurações
 * 
 * Preserva integralmente os componentes técnicos existentes:
 * - Auditoria de integridade do sistema em 3 camadas
 * - Status de persistência e conectividade com Supabase PostgreSQL
 * - Painel de ingestão e testes de idempotência do Instagram Direct
 * - Identificadores canônicos e disparo E2E da WhatsApp Cloud API
 * - Especificações das Edge Functions Deno e diretrizes de chaves secretas
 */

import React from 'react';
import { 
  Server, 
  Database, 
  Radio, 
  PhoneCall, 
  Terminal, 
  ShieldCheck, 
  Activity, 
  RefreshCw, 
  Play, 
  Copy, 
  Check, 
  Key, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  AlertTriangle, 
  ShieldAlert,
  Layers,
  Wrench,
  Instagram,
  ExternalLink
} from 'lucide-react';
import { ComprehensiveHealthReport } from '../../services/HealthCheckService';
import { IngestionResult } from '../../services/InstagramIngestionService';
import { ChannelConnection } from '../../types';
import { instagramOAuthService, InstagramOAuthStatus } from '../../services/InstagramOAuthService';

interface AdvancedSettingsSectionProps {
  healthReport: ComprehensiveHealthReport | null;
  runningHealthCheck: boolean;
  onRunFullHealthCheck: () => void;
  isConnected: boolean;
  supabaseConfig: { url: string; hasKey: boolean };
  testingSupabase: boolean;
  supabaseTestFeedback: { success: boolean; message: string } | null;
  onTestSupabase: () => void;
  instagramConn: ChannelConnection | null;
  webhookUrl: string;
  copiedWebhook: boolean;
  onCopyWebhookUrl: () => void;
  testingIngestion: boolean;
  testingIdempotency: boolean;
  ingestionLog: IngestionResult | null;
  onRunIngestionTest: () => void;
  onRunIdempotencyTest: () => void;
  onOpenWhatsAppE2EModal: () => void;
  onOpenDeployModal: () => void;
  onOpenSpecModal: () => void;
  onOpenSchemaModal: () => void;
}

export const AdvancedSettingsSection: React.FC<AdvancedSettingsSectionProps> = ({
  healthReport,
  runningHealthCheck,
  onRunFullHealthCheck,
  isConnected,
  supabaseConfig,
  testingSupabase,
  supabaseTestFeedback,
  onTestSupabase,
  instagramConn,
  webhookUrl,
  copiedWebhook,
  onCopyWebhookUrl,
  testingIngestion,
  testingIdempotency,
  ingestionLog,
  onRunIngestionTest,
  onRunIdempotencyTest,
  onOpenWhatsAppE2EModal,
  onOpenDeployModal,
  onOpenSpecModal,
  onOpenSchemaModal,
}) => {
  const [oauthStatus, setOauthStatus] = React.useState<InstagramOAuthStatus | null>(null);
  const [checkingOauth, setCheckingOauth] = React.useState(false);
  const [copiedOauthCallback, setCopiedOauthCallback] = React.useState(false);

  const oauthCallbackUrl = instagramOAuthService.getCallbackUrl();

  const handleCheckOauth = async () => {
    setCheckingOauth(true);
    try {
      const st = await instagramOAuthService.getStatus();
      setOauthStatus(st);
    } finally {
      setCheckingOauth(false);
    }
  };

  const handleCopyOauthCallback = () => {
    navigator.clipboard.writeText(oauthCallbackUrl);
    setCopiedOauthCallback(true);
    setTimeout(() => setCopiedOauthCallback(false), 2000);
  };

  React.useEffect(() => {
    handleCheckOauth();
  }, []);
  return (
    <div className="space-y-6 pt-2">
      {/* Banner de Aviso da Área Técnica */}
      <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
            <Wrench size={18} />
          </div>
          <div>
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider block font-mono">
              Configurações Avançadas • Modo Técnico / Infraestrutura
            </span>
            <p className="text-xs text-neutral-400 mt-0.5">
              Esta seção reúne ferramentas de desenvolvedor, diagnósticos de banco de dados, endpoints de webhooks e especificações de deploy.
            </p>
          </div>
        </div>

        {/* Atalhos para Modais Técnicos */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenWhatsAppE2EModal}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <PhoneCall size={13} className="text-emerald-400" />
            <span>Teste E2E</span>
          </button>

          <button
            type="button"
            onClick={onOpenDeployModal}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Terminal size={13} className="text-purple-400" />
            <span>CLI Deploy</span>
          </button>

          <button
            type="button"
            onClick={onOpenSpecModal}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ShieldCheck size={13} className="text-cyan-400" />
            <span>Especificação</span>
          </button>

          <button
            type="button"
            onClick={onOpenSchemaModal}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-neutral-950 transition-colors flex items-center gap-1.5 cursor-pointer font-bold"
          >
            <Database size={13} />
            <span>Schema SQL</span>
          </button>
        </div>
      </div>

      {/* 3-TIER ARCHITECTURE HEALTH MONITOR */}
      <div className="p-6 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Server size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-100 font-display flex items-center gap-2">
                Status do Sistema em 3 Camadas
              </h3>
              <p className="text-xs text-neutral-400">
                Auditoria de integridade entre Frontend, Supabase PostgreSQL e Edge Functions Server-Side
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenDeployModal}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Terminal size={13} className="text-purple-400" />
              <span>Instruções CLI</span>
            </button>
            <button
              type="button"
              onClick={onRunFullHealthCheck}
              disabled={runningHealthCheck}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-md shadow-purple-950/40"
            >
              <RefreshCw size={13} className={runningHealthCheck ? 'animate-spin text-white' : 'text-white'} />
              <span>{runningHealthCheck ? 'Auditando...' : 'Auditar Sistema'}</span>
            </button>
          </div>
        </div>

        {/* 3 Cards: Frontend, Database, Edge Functions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Frontend */}
          <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-neutral-300">1. FRONTEND (SPA)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                <CheckCircle2 size={10} />
                Conectado
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              React 18 + Vite com chave pública anon e isolamento estrito de código server-side.
            </p>
          </div>

          {/* 2. Database */}
          <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-neutral-300">2. SUPABASE POSTGRESQL</span>
              {healthReport?.database.connected ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                  <CheckCircle2 size={10} />
                  Conectado
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 flex items-center gap-1">
                  <AlertCircle size={10} />
                  Schema Preparado
                </span>
              )}
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              {healthReport?.database.message || '15 tabelas relacionais com RLS, índices e triggers de auditoria.'}
            </p>
          </div>

          {/* 3. Edge Functions */}
          <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-neutral-300">3. EDGE FUNCTIONS</span>
              {healthReport?.backend.status === 'deployed' ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1 font-semibold">
                  <CheckCircle2 size={10} />
                  Publicado
                </span>
              ) : healthReport?.backend.status === 'error' ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 flex items-center gap-1 font-semibold">
                  <AlertCircle size={10} />
                  Erro
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-purple-300 border border-neutral-700 flex items-center gap-1 font-semibold">
                  <Clock size={10} />
                  Pronto para Deploy
                </span>
              )}
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              {healthReport?.backend.message || '4 Edge Functions estruturadas em /supabase/functions/, aguardando deploy via CLI.'}
            </p>
          </div>
        </div>
      </div>

      {/* DEDICATED SUPABASE POSTGRESQL PERSISTENCE PANEL */}
      <div className="p-6 rounded-2xl bg-neutral-900/70 border border-neutral-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Database size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-100 font-display flex items-center gap-2">
                Persistência Oficial com Supabase PostgreSQL
              </h3>
              <p className="text-xs text-neutral-400">
                Padrão Provider/Repository integrado para chaveamento automático entre Mock e Banco Oficial
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isConnected ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                <CheckCircle2 size={13} className="text-emerald-400" />
                Supabase PostgreSQL: CONECTADO
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-800 text-neutral-400 border border-neutral-700 font-mono">
                <AlertCircle size={13} className="text-neutral-400" />
                Supabase: NÃO CONFIGURADO (.env)
              </span>
            )}
          </div>
        </div>

        {/* Credentials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-neutral-300">VITE_SUPABASE_URL</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${supabaseConfig.url ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-neutral-800 text-neutral-400'}`}>
                {supabaseConfig.url ? 'Configurado' : 'Pendente (.env)'}
              </span>
            </div>
            <p className="text-xs font-mono text-neutral-400 truncate">
              {supabaseConfig.url || 'https://seu-projeto.supabase.co'}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-neutral-300">VITE_SUPABASE_PUBLISHABLE_KEY</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${supabaseConfig.hasKey ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-neutral-800 text-neutral-400'}`}>
                {supabaseConfig.hasKey ? 'Configurado' : 'Pendente (.env)'}
              </span>
            </div>
            <p className="text-xs font-mono text-neutral-400">
              {supabaseConfig.hasKey ? '•••••••••••••••••••••••• (Chave Pública Anon com RLS)' : 'Chave Anon/Publishable necessária para persistência'}
            </p>
          </div>
        </div>

        {/* Action Buttons & Tester */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-800/80">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onTestSupabase}
              disabled={testingSupabase}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Activity size={14} className={testingSupabase ? 'animate-spin text-cyan-400' : 'text-cyan-400'} />
              <span>{testingSupabase ? 'Testando Conexão...' : 'Testar Conexão Supabase'}</span>
            </button>

            {supabaseTestFeedback && (
              <span className={`text-xs font-medium ${supabaseTestFeedback.success ? 'text-emerald-400' : 'text-amber-400'}`}>
                {supabaseTestFeedback.message}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenSchemaModal}
            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 font-medium cursor-pointer"
          >
            <span>Ver script SQL de 15 tabelas com idempotência</span>
            <span>&rarr;</span>
          </button>
        </div>
      </div>

      {/* INSTAGRAM DIRECT INTEGRATION PANEL */}
      <div className="p-6 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400">
              <Radio size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-100 font-display flex items-center gap-2">
                Integração Instagram Direct (Ingestão Técnica)
              </h3>
              <p className="text-xs text-neutral-400">
                Recebimento via Webhook Meta, validação HMAC-SHA256, normalização, idempotência e persistência
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-pink-500/20 text-pink-300 border border-pink-500/40 font-mono">
              <CheckCircle2 size={13} className="text-pink-400" />
              {instagramConn?.status === 'connected' ? 'Webhook Conectado & Ativo' : 'Ingestão Pronta'}
            </span>
          </div>
        </div>

        {/* Webhook Endpoint URL */}
        <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-neutral-300">URL DO WEBHOOK META</span>
            <button
              type="button"
              onClick={onCopyWebhookUrl}
              className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 flex items-center gap-1 cursor-pointer transition-colors"
              title="Copiar URL"
            >
              {copiedWebhook ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
              <span>{copiedWebhook ? 'Copiado!' : 'Copiar'}</span>
            </button>
          </div>
          <p className="text-xs font-mono text-cyan-400 truncate bg-neutral-900 px-2.5 py-1.5 rounded-lg border border-neutral-800">
            {webhookUrl}
          </p>
        </div>

        {/* Diagnostic Testing Suite */}
        <div className="p-4 rounded-xl bg-neutral-950/90 border border-neutral-800/90 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-mono font-bold text-neutral-200 block">
                DIAGNÓSTICO E VALIDAÇÃO DA PIPELINE DE INGESTÃO
              </span>
              <span className="text-[11px] text-neutral-400">
                Simula evento real da Meta com verificação estrita de idempotência
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onRunIngestionTest}
                disabled={testingIngestion || testingIdempotency}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-neutral-950 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Play size={13} className={testingIngestion ? 'animate-spin' : ''} />
                <span>{testingIngestion ? 'Ingerindo...' : 'Testar Ingestão Real'}</span>
              </button>

              <button
                type="button"
                onClick={onRunIdempotencyTest}
                disabled={testingIngestion || testingIdempotency}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck size={13} className={testingIdempotency ? 'animate-spin text-purple-400' : 'text-purple-400'} />
                <span>{testingIdempotency ? 'Validando...' : 'Testar Idempotência'}</span>
              </button>
            </div>
          </div>

          {/* Test Feedback Log */}
          {ingestionLog && (
            <div className={`p-3.5 rounded-xl border text-xs font-mono space-y-1.5 ${
              ingestionLog.status === 'INGESTED' 
                ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                : ingestionLog.status === 'DUPLICATE_SKIPPED'
                ? 'bg-purple-950/30 border-purple-800/60 text-purple-300'
                : 'bg-rose-950/30 border-rose-800/60 text-rose-300'
            }`}>
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1.5">
                  {ingestionLog.status === 'INGESTED' && <CheckCircle2 size={14} className="text-emerald-400" />}
                  {ingestionLog.status === 'DUPLICATE_SKIPPED' && <ShieldCheck size={14} className="text-purple-400" />}
                  {ingestionLog.status === 'ERROR' && <AlertCircle size={14} className="text-rose-400" />}
                  STATUS: {ingestionLog.status}
                </span>
                <span className="text-[10px] opacity-75">ID: {ingestionLog.externalEventId}</span>
              </div>
              <p className="text-[11px] font-sans text-neutral-300">{ingestionLog.message}</p>
            </div>
          )}
        </div>
      </div>

      {/* INSTAGRAM BUSINESS LOGIN / OAUTH FOUNDATION PANEL */}
      <div className="p-6 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 text-white shadow-md shadow-pink-950/30">
              <Instagram size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-100 font-display flex items-center gap-2">
                Instagram Business Login (Meta OAuth Foundation)
              </h3>
              <p className="text-xs text-neutral-400">
                Infraestrutura multitenant de autorização OAuth para o Instagram Direct via Edge Function dedicada
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {oauthStatus?.configured ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                <CheckCircle2 size={13} className="text-emerald-400" />
                OAuth Configurado & Ativo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                <AlertCircle size={13} className="text-amber-400" />
                Secrets Pendentes no Supabase
              </span>
            )}
          </div>
        </div>

        {/* OAuth Callback URI */}
        <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold text-neutral-300">
              URL CANÔNICA DE CALLBACK OAUTH (META REDIRECT URI)
            </span>
            <button
              type="button"
              onClick={handleCopyOauthCallback}
              className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 flex items-center gap-1 cursor-pointer transition-colors"
              title="Copiar URL de Redirecionamento"
            >
              {copiedOauthCallback ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
              <span>{copiedOauthCallback ? 'Copiado!' : 'Copiar'}</span>
            </button>
          </div>
          <p className="text-xs font-mono text-cyan-400 truncate bg-neutral-900 px-2.5 py-1.5 rounded-lg border border-neutral-800">
            {oauthCallbackUrl}
          </p>
          <span className="text-[11px] text-neutral-400 block leading-relaxed">
            Cadastre este endpoint no Meta Developer Portal em: <em>Instagram Login for Business &rarr; Settings &rarr; Valid OAuth Redirect URIs</em>.
          </span>
        </div>

        {/* Status das Chaves e Permissões */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-2">
            <span className="text-xs font-mono font-semibold text-neutral-300 block">
              SECRETS NO SUPABASE (SERVER-SIDE ONLY)
            </span>
            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex items-center justify-between p-2 rounded bg-neutral-900 border border-neutral-800">
                <span className="text-neutral-300">INSTAGRAM_APP_ID</span>
                <span className={`text-[10px] px-2 py-0.5 rounded ${oauthStatus?.appIdConfigured ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-neutral-800 text-neutral-400'}`}>
                  {oauthStatus?.appIdConfigured ? (oauthStatus.appIdMasked || 'Configurado') : 'Pendente'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-neutral-900 border border-neutral-800">
                <span className="text-neutral-300">INSTAGRAM_APP_SECRET</span>
                <span className={`text-[10px] px-2 py-0.5 rounded ${oauthStatus?.appSecretConfigured ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-neutral-800 text-neutral-400'}`}>
                  {oauthStatus?.appSecretConfigured ? '•••••••• (Configurado)' : 'Pendente'}
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-2">
            <span className="text-xs font-mono font-semibold text-neutral-300 block">
              PERMISSÕES META EXIGIDAS (v19.0)
            </span>
            <div className="space-y-1.5 font-mono text-xs">
              <div className="p-2 rounded bg-neutral-900 border border-neutral-800 flex items-center justify-between">
                <span className="text-cyan-300">instagram_business_basic</span>
                <span className="text-[10px] text-neutral-400">Perfil & Ativo</span>
              </div>
              <div className="p-2 rounded bg-neutral-900 border border-neutral-800 flex items-center justify-between">
                <span className="text-cyan-300">instagram_business_manage_messages</span>
                <span className="text-[10px] text-neutral-400">Direct Inbound/Outbound</span>
              </div>
            </div>
          </div>
        </div>

        {/* Ações de Teste Técnico */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-800/80">
          <button
            type="button"
            onClick={handleCheckOauth}
            disabled={checkingOauth}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={checkingOauth ? 'animate-spin text-pink-400' : 'text-pink-400'} />
            <span>{checkingOauth ? 'Verificando Edge Function...' : 'Verificar Status da Função instagram-oauth'}</span>
          </button>

          <span className="text-[11px] text-neutral-500 font-mono">
            Edge Function: /functions/v1/instagram-oauth • Multitenant: SIM
          </span>
        </div>
      </div>

      {/* WHATSAPP CLOUD API INTEGRATION PANEL */}
      <div className="p-6 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <PhoneCall size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-100 font-display flex items-center gap-2">
                WhatsApp Oficial Casal Fabre (Ativos Canônicos)
              </h3>
              <p className="text-xs text-neutral-400">
                Ativo canônico consolidado no Meta Business Portfolio ADM01
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenWhatsAppE2EModal}
            className="px-4 py-2 rounded-xl text-xs font-bold font-display uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-neutral-950 transition-colors flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/40 shrink-0"
          >
            <PhoneCall size={14} />
            <span>Abrir Painel de Teste E2E</span>
          </button>
        </div>

        {/* Canonical Identifiers Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800">
            <span className="text-neutral-500 block text-[10px]">PORTFÓLIO META</span>
            <span className="font-bold text-neutral-200">ADM01</span>
          </div>
          <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800">
            <span className="text-neutral-500 block text-[10px]">WABA ID OFICIAL</span>
            <span className="font-bold text-neutral-200">293410900513919</span>
          </div>
          <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800">
            <span className="text-neutral-500 block text-[10px]">PHONE NUMBER ID</span>
            <span className="font-bold text-emerald-400">250763631462152</span>
          </div>
          <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800">
            <span className="text-neutral-500 block text-[10px]">NÚMERO OFICIAL</span>
            <span className="font-bold text-emerald-400">+55 14 98840-3642</span>
          </div>
        </div>
      </div>

      {/* Security Isolation Card */}
      <div className="p-5 rounded-2xl bg-neutral-900/60 border border-cyan-800/40 space-y-2">
        <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs font-display">
          <Key size={15} className="text-cyan-400" />
          <span>DIRETRIZ DE SEGURANÇA E ISOLAMENTO DE CHAVES SECRETAS</span>
        </div>
        <p className="text-xs text-neutral-300 leading-relaxed">
          O frontend React utiliza estritamente chaves públicas com Row Level Security (RLS). Chaves secretas como <code>SUPABASE_SERVICE_ROLE_KEY</code>, <code>OPENAI_API_KEY</code>, <code>META_APP_SECRET</code> e <code>WHATSAPP_ACCESS_TOKEN</code> nunca são expostas no cliente.
        </p>
      </div>
    </div>
  );
};
