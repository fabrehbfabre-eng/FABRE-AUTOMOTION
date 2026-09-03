/**
 * FABRE AUTOMATION - Settings, Backend & Integrations Page
 * Release 3: Secure Backend Foundation
 */

import React, { useState, useEffect } from 'react';
import { IntegrationCard } from '../components/settings/IntegrationCard';
import { SupabaseSchemaModal } from '../components/settings/SupabaseSchemaModal';
import { ArchitectureSpecModal } from '../components/settings/ArchitectureSpecModal';
import { DeployGuideModal } from '../components/settings/DeployGuideModal';
import { useChannels } from '../hooks/useChannels';
import { aiService, healthCheckService, instagramIngestionService } from '../services';
import { ComprehensiveHealthReport } from '../services/HealthCheckService';
import { IngestionResult } from '../services/InstagramIngestionService';
import { AIConfiguration, ChannelConnection } from '../types';
import { 
  Settings, 
  ShieldCheck, 
  Bot, 
  Layers, 
  CheckCircle2, 
  Database,
  Lock,
  Activity,
  AlertCircle,
  Key,
  Server,
  Terminal,
  RefreshCw,
  Play,
  Copy,
  Check,
  Zap,
  Radio,
  Clock,
  AlertTriangle,
  ShieldAlert
} from 'lucide-react';
import { testSupabaseConnection, isSupabaseConfigured, getSupabaseConfig } from '../lib/supabase';

export const SettingsPage: React.FC = () => {
  const { integrations, loading } = useChannels();
  const [aiConfig, setAiConfig] = useState<AIConfiguration | null>(null);
  const [schemaModalOpen, setSchemaModalOpen] = useState(false);
  const [specModalOpen, setSpecModalOpen] = useState(false);
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  
  // Database test state
  const [testingSupabase, setTestingSupabase] = useState(false);
  const [supabaseTestFeedback, setSupabaseTestFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Full Health Check state
  const [runningHealthCheck, setRunningHealthCheck] = useState(false);
  const [healthReport, setHealthReport] = useState<ComprehensiveHealthReport | null>(null);

  // Instagram Ingestion & Test State (Release 5)
  const [instagramConn, setInstagramConn] = useState<ChannelConnection | null>(null);
  const [testingIngestion, setTestingIngestion] = useState(false);
  const [testingIdempotency, setTestingIdempotency] = useState(false);
  const [ingestionLog, setIngestionLog] = useState<IngestionResult | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const supabaseConfig = getSupabaseConfig();
  const isConnected = isSupabaseConfigured();
  const webhookUrl = instagramIngestionService.getWebhookUrl();

  useEffect(() => {
    aiService.getConfiguration().then(setAiConfig);
    healthCheckService.runHealthCheck().then(setHealthReport);
    instagramIngestionService.getStatus().then(setInstagramConn);
  }, []);

  const handleTestSupabase = async () => {
    setTestingSupabase(true);
    setSupabaseTestFeedback(null);
    try {
      const res = await testSupabaseConnection();
      setSupabaseTestFeedback(res);
      const updated = await healthCheckService.runHealthCheck();
      setHealthReport(updated);
    } finally {
      setTestingSupabase(false);
    }
  };

  const handleFullHealthCheck = async () => {
    setRunningHealthCheck(true);
    try {
      const report = await healthCheckService.runHealthCheck();
      setHealthReport(report);
    } finally {
      setRunningHealthCheck(false);
    }
  };

  const handleRunIngestionTest = async () => {
    setTestingIngestion(true);
    setIngestionLog(null);
    try {
      const res = await instagramIngestionService.runDiagnosticTest(false);
      setIngestionLog(res);
      const updatedConn = await instagramIngestionService.getStatus();
      setInstagramConn(updatedConn);
    } finally {
      setTestingIngestion(false);
    }
  };

  const handleRunIdempotencyTest = async () => {
    setTestingIdempotency(true);
    setIngestionLog(null);
    try {
      // First run insertion
      await instagramIngestionService.runDiagnosticTest(true);
      // Second run same ID to prove idempotency deduplication
      const duplicateRes = await instagramIngestionService.runDiagnosticTest(true);
      setIngestionLog(duplicateRes);
    } finally {
      setTestingIdempotency(false);
    }
  };

  const handleCopyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-100 font-display flex items-center gap-2.5">
            <Settings size={22} className="text-cyan-400" />
            Configurações, Backend Seguro & Conexões
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Gestão do banco de dados relacional oficial (Supabase PostgreSQL), isolamento de chaves secretas e status das Edge Functions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setDeployModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 transition-colors flex items-center gap-2 cursor-pointer shadow-lg shadow-purple-950/30"
          >
            <Terminal size={15} className="text-purple-400" />
            <span>Guia de Deploy CLI</span>
          </button>

          <button
            onClick={() => setSpecModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors flex items-center gap-2 cursor-pointer"
          >
            <ShieldCheck size={15} className="text-cyan-400" />
            <span>Especificação Release 9</span>
          </button>

          <button
            onClick={() => setSchemaModalOpen(true)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-neutral-950 transition-colors flex items-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer"
          >
            <Database size={15} />
            <span>Ver Schema SQL & Tabelas</span>
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
              onClick={() => setDeployModalOpen(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Terminal size={13} className="text-purple-400" />
              <span>Instruções CLI</span>
            </button>
            <button
              onClick={handleFullHealthCheck}
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
              {healthReport?.database.message || '11 tabelas relacionais com RLS, índices e triggers de auditoria.'}
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

            {healthReport?.schema.databaseState === 'DATABASE_SCHEMA_READY' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                <CheckCircle2 size={13} className="text-emerald-400" />
                Schema: 11/11 TABELAS CONFIRMADAS
              </span>
            ) : healthReport?.schema.databaseState === 'DATABASE_SCHEMA_INCOMPLETE' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                <AlertTriangle size={13} className="text-amber-400" />
                Schema: {healthReport.schema.totalFound}/11 INCOMPLETO
              </span>
            ) : isConnected ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 font-mono">
                <Clock size={13} className="text-amber-400" />
                Schema: PENDENTE NO BANCO (0/11)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-800 text-neutral-400 border border-neutral-700 font-mono">
                <AlertCircle size={13} className="text-neutral-400" />
                Schema: MOCK LOCAL (Demo)
              </span>
            )}

            {healthReport?.persistence.certified ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 font-mono">
                <ShieldCheck size={13} className="text-emerald-400" />
                Persistência: CERTIFICADA
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 font-mono">
                <ShieldAlert size={13} className="text-amber-400" />
                Persistência: NÃO CERTIFICADA
              </span>
            )}
          </div>
        </div>

        {/* Status Indicators 4-Columns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
          <div className="p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800">
            <span className="text-neutral-500 block text-[10px]">BANCO REMOTO</span>
            <span className={`font-bold ${isConnected ? 'text-emerald-400' : 'text-neutral-400'}`}>
              {isConnected ? 'CONECTADO' : 'NÃO CONFIGURADO'}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800">
            <span className="text-neutral-500 block text-[10px]">TABELAS NO SCHEMA</span>
            <span className={`font-bold ${healthReport?.schema.totalFound === 11 ? 'text-emerald-400' : isConnected ? 'text-amber-400' : 'text-neutral-400'}`}>
              {healthReport ? `${healthReport.schema.totalFound}/11 CONFIRMADAS` : 'NÃO AUDITADO'}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800">
            <span className="text-neutral-500 block text-[10px]">RLS POLICIES</span>
            <span className={`font-bold ${healthReport?.rls.status === 'REMOTELY_CONFIRMED' ? 'text-emerald-400' : 'text-cyan-400'}`}>
              {healthReport?.rls.status === 'REMOTELY_CONFIRMED' ? 'CONFIRMADO NO BANCO' : 'DEFINIDO NO SCHEMA'}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800">
            <span className="text-neutral-500 block text-[10px]">IDEMPOTÊNCIA</span>
            <span className={`font-bold ${healthReport?.idempotency.status === 'REMOTELY_CONFIRMED' ? 'text-emerald-400' : 'text-cyan-400'}`}>
              {healthReport?.idempotency.status === 'REMOTELY_CONFIRMED' ? 'CONFIRMADA NO BANCO' : 'DEFINIDA NO SCHEMA'}
            </span>
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
              onClick={handleTestSupabase}
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
            onClick={() => setSchemaModalOpen(true)}
            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 font-medium cursor-pointer"
          >
            <span>Ver script SQL de 11 tabelas com idempotência</span>
            <span>&rarr;</span>
          </button>
        </div>
      </div>

      {/* INSTAGRAM DIRECT INTEGRATION PANEL (RELEASE 5) */}
      <div className="p-6 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400">
              <Radio size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-100 font-display flex items-center gap-2">
                Integração Instagram Direct (Release 5 • Ingestão Oficial)
              </h3>
              <p className="text-xs text-neutral-400">
                Recebimento de mensagens reais via Webhook Meta, validação HMAC-SHA256, normalização, idempotência e persistência no PostgreSQL
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

        {/* Configuration Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Webhook Endpoint URL */}
          <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-neutral-300">URL DO WEBHOOK META</span>
              <button
                onClick={handleCopyWebhookUrl}
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
            <p className="text-[11px] text-neutral-500">
              Cadastre esta URL no Meta Developer Portal (Painel do App &rarr; Webhooks &rarr; Instagram).
            </p>
          </div>

          {/* Server-Side Secrets Security Status */}
          <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-neutral-300">CREDENCIAIS SERVER-SIDE</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                Isolamento Total
              </span>
            </div>
            <div className="space-y-1 text-xs font-mono text-neutral-400">
              <div className="flex justify-between py-0.5 border-b border-neutral-850">
                <span className="text-neutral-500">META_WEBHOOK_VERIFY_TOKEN:</span>
                <span className="text-emerald-400">Configurado no Server</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-neutral-850">
                <span className="text-neutral-500">META_APP_SECRET:</span>
                <span className="text-emerald-400">Assinatura HMAC Ativa</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-neutral-500">RESPOSTAS AO INSTAGRAM:</span>
                <span className="text-amber-400">Desativadas (Release 5)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Diagnostic Testing Suite */}
        <div className="p-4 rounded-xl bg-neutral-950/90 border border-neutral-800/90 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-mono font-bold text-neutral-200 block">
                DIAGNÓSTICO E VALIDAÇÃO DA PIPELINE DE INGESTÃO
              </span>
              <span className="text-[11px] text-neutral-400">
                Executa simulação de evento real da Meta com verificação estrita de idempotência e inserção no banco
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleRunIngestionTest}
                disabled={testingIngestion || testingIdempotency}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-neutral-950 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md shadow-cyan-950/40"
              >
                <Play size={13} className={testingIngestion ? 'animate-spin' : ''} />
                <span>{testingIngestion ? 'Ingerindo...' : 'Testar Ingestão Real'}</span>
              </button>

              <button
                onClick={handleRunIdempotencyTest}
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
              {ingestionLog.conversationId && (
                <div className="pt-1 text-[10px] text-neutral-400 flex flex-wrap gap-3">
                  <span>Conversa ID: {ingestionLog.conversationId}</span>
                  {ingestionLog.messageId && <span>Mensagem ID: {ingestionLog.messageId}</span>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* EDGE FUNCTIONS ARCHITECTURE SPECIFICATION */}
      <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-neutral-100 font-display flex items-center gap-2">
            <Server size={18} className="text-purple-400" />
            Estrutura de Edge Functions Server-Side
          </h3>
          <span className="text-[11px] font-mono text-purple-400 bg-purple-950/40 border border-purple-800/60 px-2.5 py-0.5 rounded-full">
            Deno Runtime
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800/80 space-y-1">
            <span className="text-purple-300 font-bold block">/supabase/functions/meta-webhook</span>
            <p className="text-neutral-400 text-[11px] font-sans">
              Handshake seguro de verificação e ingestão com validação de idempotência para Instagram e Messenger.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800/80 space-y-1">
            <span className="text-purple-300 font-bold block">/supabase/functions/whatsapp-webhook</span>
            <p className="text-neutral-400 text-[11px] font-sans">
              Handshake hub.challenge e ingestão de mensagens da WhatsApp Business Cloud API.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800/80 space-y-1">
            <span className="text-purple-300 font-bold block">/supabase/functions/ai-completion</span>
            <p className="text-neutral-400 text-[11px] font-sans">
              Pipeline de inteligência OpenAI (gpt-4o-mini) com RAG sobre itens de conhecimento oficiais.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800/80 space-y-1">
            <span className="text-purple-300 font-bold block">/supabase/functions/health-check</span>
            <p className="text-neutral-400 text-[11px] font-sans">
              Endpoint para verificação de disponibilidade, conectividade com PostgreSQL e readiness dos serviços.
            </p>
          </div>
        </div>
      </div>

      {/* Security & Secret Key Rules */}
      <div className="p-5 rounded-2xl bg-neutral-900/60 border border-cyan-800/40 space-y-2">
        <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs font-display">
          <Key size={15} className="text-cyan-400" />
          <span>DIRETRIZ DE SEGURANÇA E ISOLAMENTO DE CHAVES SECRETAS</span>
        </div>
        <p className="text-xs text-neutral-300 leading-relaxed">
          O frontend React utiliza <strong>estritamente chaves públicas com Row Level Security (RLS)</strong>. Chaves secretas como <code>SUPABASE_SERVICE_ROLE_KEY</code>, <code>OPENAI_API_KEY</code>, <code>META_APP_SECRET</code> e <code>WHATSAPP_ACCESS_TOKEN</code> <strong>nunca são expostas no cliente</strong> e residem apenas no ambiente das Edge Functions seguras.
        </p>
      </div>

      {/* Integrations Cards Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-neutral-100 font-display flex items-center gap-2">
            <Layers size={18} className="text-cyan-400" />
            Serviços & Canais Externos
          </h3>
          <span className="text-xs text-neutral-500 font-mono">
            5 Módulos Preparados
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-neutral-500 font-mono">
            Carregando módulos de integração...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {integrations.map((integ) => (
              <IntegrationCard key={integ.id} config={integ} />
            ))}
          </div>
        )}
      </div>

      {/* AI Persona & Guardrails Configuration Panel */}
      {aiConfig && (
        <div className="space-y-4 pt-4 border-t border-neutral-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-neutral-100 font-display flex items-center gap-2">
                <Bot size={18} className="text-purple-400" />
                Configuração da Camada de Inteligência Artificial
              </h3>
              <p className="text-xs text-neutral-400">
                Diretrizes de comportamento, tom de voz e regras de atendimento oficiais
              </p>
            </div>
            <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800/40 font-semibold">
              OpenAI gpt-4o-mini
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* System Prompt Box */}
            <div className="lg:col-span-2 p-5 rounded-2xl bg-neutral-900/50 border border-neutral-800 space-y-3">
              <span className="text-xs font-mono uppercase text-neutral-400 font-semibold block">
                Prompt de Sistema Base
              </span>
              <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800/80 text-xs text-neutral-300 font-mono leading-relaxed whitespace-pre-wrap">
                {aiConfig.systemPrompt}
              </div>
            </div>

            {/* Guardrails & Controls */}
            <div className="p-5 rounded-2xl bg-neutral-900/50 border border-neutral-800 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <span className="text-xs font-mono uppercase text-neutral-400 font-semibold block">
                  Regras de Segurança (Guardrails)
                </span>
                <ul className="space-y-2 text-xs text-neutral-300">
                  {aiConfig.guardrails.map((g, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-400 space-y-1">
                <div className="flex justify-between">
                  <span>Fallback para Humano:</span>
                  <strong className="text-emerald-400 font-mono">Ativado</strong>
                </div>
                <div className="flex justify-between">
                  <span>Temperatura:</span>
                  <strong className="text-neutral-200 font-mono">{aiConfig.temperature}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Architectural Independence Summary */}
      <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800/90 text-xs text-neutral-400 space-y-2">
        <div className="flex items-center gap-2 text-neutral-200 font-semibold font-display">
          <ShieldCheck size={16} className="text-cyan-400" />
          <span>Independência e Desacoplamento Garantidos</span>
        </div>
        <p className="leading-relaxed">
          O <strong>FABRE AUTOMATION</strong> foi estruturado de forma agnóstica a nuvens proprietárias. A persistência oficial utiliza <strong>Supabase (PostgreSQL)</strong> com schema relacional normalizado, sem nenhum vínculo com Firebase ou dependências lock-in.
        </p>
      </div>

      {/* Schema Modal */}
      <SupabaseSchemaModal
        isOpen={schemaModalOpen}
        onClose={() => setSchemaModalOpen(false)}
      />

      {/* Architecture Spec Modal */}
      <ArchitectureSpecModal
        isOpen={specModalOpen}
        onClose={() => setSpecModalOpen(false)}
      />

      {/* Edge Functions Deploy Guide Modal */}
      <DeployGuideModal
        isOpen={deployModalOpen}
        onClose={() => setDeployModalOpen(false)}
        functions={healthReport?.backend.functions || []}
        backendAvailable={healthReport?.backend.available || false}
      />
    </div>
  );
};
