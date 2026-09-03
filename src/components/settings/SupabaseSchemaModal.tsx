/**
 * FABRE AUTOMATION - Supabase Schema & Migration Modal
 * Release 7: Database Schema Activation & Persistence Certification
 */

import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Database, Copy, Check, Terminal, Key, CheckCircle2, AlertCircle, AlertTriangle, TableProperties, RefreshCw, ShieldCheck, ShieldAlert, CheckCheck, FileText, Clock } from 'lucide-react';
import { testSupabaseConnection, runPersistenceSmokeTest, isSupabaseConfigured, getSupabaseConfig, SupabaseTestResult, PersistenceSmokeTestResult, EXPECTED_SCHEMA_TABLES } from '../../lib/supabase';

interface SupabaseSchemaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TABLE_DESCRIPTIONS: Record<string, string> = {
  profiles: 'Contatos, seguidores e dados de perfil unificados',
  conversations: 'Sessões de atendimento com status e handoff bot/humano',
  messages: 'Histórico de mensagens com external_event_id para idempotência',
  automations: 'Fluxos automatizados de resposta e triagem',
  automation_triggers: 'Gatilhos por palavra-chave, evento e direct',
  automation_actions: 'Ações sequenciais, mensagens e tags associadas',
  knowledge_items: 'Base oficial de conhecimento categorizada para RAG',
  channel_connections: 'Conexões multicanal (Instagram, Messenger, WhatsApp)',
  contact_tags: 'Tags globais de segmentação de contatos',
  contact_tag_assignments: 'Relações many-to-many entre contatos e tags',
  contact_notes: 'Notas e anotações internas da equipe de atendimento',
};

const SQL_SCHEMA_CONTENT = `-- =====================================================
-- FABRE AUTOMATION - Supabase PostgreSQL Database Schema
-- Release 7: Database Schema Activation & Persistence Certification
-- =====================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Helper function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. CORE TABLES (11 ENTITIES)
-- =====================================================

-- 3.1 PROFILES (Contacts, Followers & App Users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    username TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('instagram', 'messenger', 'whatsapp')),
    avatar_url TEXT,
    phone TEXT,
    email TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_profiles_channel ON public.profiles(channel);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_last_active ON public.profiles(last_active_at DESC);

-- 3.2 CONVERSATIONS
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('instagram', 'messenger', 'whatsapp')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'waiting_user', 'resolved', 'archived')),
    handler TEXT NOT NULL DEFAULT 'bot' CHECK (handler IN ('bot', 'human')),
    unread_count INTEGER NOT NULL DEFAULT 0,
    assigned_to TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;
CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_conversations_contact ON public.conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_channel ON public.conversations(channel);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_handler ON public.conversations(handler);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON public.conversations(updated_at DESC);

-- 3.3 MESSAGES (With external_event_id for Idempotency)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'contact', 'bot', 'system')),
    channel TEXT NOT NULL CHECK (channel IN ('instagram', 'messenger', 'whatsapp')),
    content TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'audio', 'quick_reply', 'template', 'system_event')),
    media_url TEXT,
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sending', 'sent', 'delivered', 'read', 'failed')),
    external_event_id TEXT UNIQUE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender);
CREATE INDEX IF NOT EXISTS idx_messages_external_event ON public.messages(external_event_id);

-- 3.4 AUTOMATIONS
CREATE TABLE IF NOT EXISTS public.automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    channel TEXT NOT NULL DEFAULT 'all',
    execution_count INTEGER NOT NULL DEFAULT 0,
    last_executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_automations_updated_at ON public.automations;
CREATE TRIGGER update_automations_updated_at
    BEFORE UPDATE ON public.automations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_automations_enabled ON public.automations(enabled);
CREATE INDEX IF NOT EXISTS idx_automations_channel ON public.automations(channel);

-- 3.5 AUTOMATION TRIGGERS
CREATE TABLE IF NOT EXISTS public.automation_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_triggers_automation ON public.automation_triggers(automation_id);
CREATE INDEX IF NOT EXISTS idx_triggers_type ON public.automation_triggers(type);

-- 3.6 AUTOMATION ACTIONS
CREATE TABLE IF NOT EXISTS public.automation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_actions_automation ON public.automation_actions(automation_id);
CREATE INDEX IF NOT EXISTS idx_actions_sort_order ON public.automation_actions(sort_order ASC);

-- 3.7 KNOWLEDGE ITEMS (Oficial & RAG Base)
CREATE TABLE IF NOT EXISTS public.knowledge_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('product', 'price', 'faq', 'profile', 'rules', 'tone', 'commercial', 'link')),
    content TEXT NOT NULL,
    summary TEXT,
    tags TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    priority INTEGER NOT NULL DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),
    is_official BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_knowledge_items_updated_at ON public.knowledge_items;
CREATE TRIGGER update_knowledge_items_updated_at
    BEFORE UPDATE ON public.knowledge_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_knowledge_category ON public.knowledge_items(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_is_active ON public.knowledge_items(is_active);
CREATE INDEX IF NOT EXISTS idx_knowledge_priority ON public.knowledge_items(priority);

-- 3.8 CHANNEL CONNECTIONS
CREATE TABLE IF NOT EXISTS public.channel_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel TEXT NOT NULL UNIQUE CHECK (channel IN ('instagram', 'messenger', 'whatsapp')),
    name TEXT NOT NULL,
    account_handle TEXT,
    status TEXT NOT NULL DEFAULT 'awaiting_connection' CHECK (status IN ('disconnected', 'awaiting_connection', 'connecting', 'connected', 'error')),
    status_message TEXT,
    connected_at TIMESTAMPTZ,
    last_sync_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_channel_connections_updated_at ON public.channel_connections;
CREATE TRIGGER update_channel_connections_updated_at
    BEFORE UPDATE ON public.channel_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 3.9 CONTACT TAGS
CREATE TABLE IF NOT EXISTS public.contact_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT 'cyan',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.10 CONTACT TAG ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.contact_tag_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.contact_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contact_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_tag_assignments_contact ON public.contact_tag_assignments(contact_id);
CREATE INDEX IF NOT EXISTS idx_tag_assignments_tag ON public.contact_tag_assignments(tag_id);

-- 3.11 CONTACT NOTES
CREATE TABLE IF NOT EXISTS public.contact_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_contact_notes_updated_at ON public.contact_notes;
CREATE TRIGGER update_contact_notes_updated_at
    BEFORE UPDATE ON public.contact_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_contact_notes_contact ON public.contact_notes(contact_id);

-- =====================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_notes ENABLE ROW LEVEL SECURITY;

-- 4.1 Profiles Policies
DROP POLICY IF EXISTS "Allow read profiles" ON public.profiles;
CREATE POLICY "Allow read profiles" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert profiles" ON public.profiles;
CREATE POLICY "Allow insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update profiles" ON public.profiles;
CREATE POLICY "Allow update profiles" ON public.profiles FOR UPDATE USING (true);

-- 4.2 Conversations Policies
DROP POLICY IF EXISTS "Allow read conversations" ON public.conversations;
CREATE POLICY "Allow read conversations" ON public.conversations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert conversations" ON public.conversations;
CREATE POLICY "Allow insert conversations" ON public.conversations FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update conversations" ON public.conversations;
CREATE POLICY "Allow update conversations" ON public.conversations FOR UPDATE USING (true);

-- 4.3 Messages Policies
DROP POLICY IF EXISTS "Allow read messages" ON public.messages;
CREATE POLICY "Allow read messages" ON public.messages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert messages" ON public.messages;
CREATE POLICY "Allow insert messages" ON public.messages FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update messages" ON public.messages;
CREATE POLICY "Allow update messages" ON public.messages FOR UPDATE USING (true);

-- 4.4 Automations Policies
DROP POLICY IF EXISTS "Allow read automations" ON public.automations;
CREATE POLICY "Allow read automations" ON public.automations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow modify automations" ON public.automations;
CREATE POLICY "Allow modify automations" ON public.automations FOR ALL USING (true);

-- 4.5 Automation Triggers Policies
DROP POLICY IF EXISTS "Allow all automation triggers" ON public.automation_triggers;
CREATE POLICY "Allow all automation triggers" ON public.automation_triggers FOR ALL USING (true);

-- 4.6 Automation Actions Policies
DROP POLICY IF EXISTS "Allow all automation actions" ON public.automation_actions;
CREATE POLICY "Allow all automation actions" ON public.automation_actions FOR ALL USING (true);

-- 4.7 Knowledge Items Policies
DROP POLICY IF EXISTS "Allow read knowledge" ON public.knowledge_items;
CREATE POLICY "Allow read knowledge" ON public.knowledge_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow modify knowledge" ON public.knowledge_items;
CREATE POLICY "Allow modify knowledge" ON public.knowledge_items FOR ALL USING (true);

-- 4.8 Channel Connections Policies
DROP POLICY IF EXISTS "Allow read channel connections" ON public.channel_connections;
CREATE POLICY "Allow read channel connections" ON public.channel_connections FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow modify channel connections" ON public.channel_connections;
CREATE POLICY "Allow modify channel connections" ON public.channel_connections FOR ALL USING (true);

-- 4.9 Tags Policies
DROP POLICY IF EXISTS "Allow all contact tags" ON public.contact_tags;
CREATE POLICY "Allow all contact tags" ON public.contact_tags FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all tag assignments" ON public.contact_tag_assignments;
CREATE POLICY "Allow all tag assignments" ON public.contact_tag_assignments FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all contact notes" ON public.contact_notes;
CREATE POLICY "Allow all contact notes" ON public.contact_notes FOR ALL USING (true);

-- =====================================================
-- 5. INITIAL CHANNEL ENTRIES (Awaiting Connection)
-- =====================================================
INSERT INTO public.channel_connections (channel, name, status, status_message)
VALUES 
    ('instagram', 'Instagram Direct API', 'awaiting_connection', 'Aguardando configuração de App Meta & Webhooks'),
    ('messenger', 'Facebook Messenger', 'awaiting_connection', 'Aguardando autenticação Meta Graph API'),
    ('whatsapp', 'WhatsApp Business Cloud API', 'awaiting_connection', 'Aguardando WhatsApp Cloud API Token')
ON CONFLICT (channel) DO NOTHING;
`;

export const SupabaseSchemaModal: React.FC<SupabaseSchemaModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [runningSmoke, setRunningSmoke] = useState(false);
  const [testResult, setTestResult] = useState<SupabaseTestResult | null>(null);
  const [smokeResult, setSmokeResult] = useState<PersistenceSmokeTestResult | null>(null);

  const config = getSupabaseConfig();
  const isConfigured = isSupabaseConfigured();

  const handleCopy = () => {
    navigator.clipboard.writeText(SQL_SCHEMA_CONTENT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnection();
      setTestResult(res);
      if (res.smokeTest) {
        setSmokeResult(res.smokeTest);
      }
    } finally {
      setTesting(false);
    }
  };

  const handleRunSmokeTest = async () => {
    setRunningSmoke(true);
    try {
      const smoke = await runPersistenceSmokeTest();
      setSmokeResult(smoke);
      const testRes = await testSupabaseConnection();
      setTestResult(testRes);
    } finally {
      setRunningSmoke(false);
    }
  };

  const audit = testResult?.schemaAudit;
  const isCertified = testResult?.persistenceCertified || smokeResult?.certified;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Supabase PostgreSQL Persistence & Schema"
      subtitle="Auditoria, ativação e certificação das 11 tabelas, índices de idempotência e RLS"
      maxWidth="3xl"
    >
      <div className="space-y-6 max-h-[78vh] overflow-y-auto pr-1">
        {/* Status Card */}
        <div className={`p-4 rounded-2xl border ${isConfigured ? 'bg-neutral-900/60 border-neutral-800' : 'bg-neutral-900/40 border-neutral-800'} space-y-4`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Database size={17} className={isConfigured ? 'text-cyan-400' : 'text-amber-400'} />
              <span className="text-sm font-bold text-neutral-100 font-display">Status da Camada de Persistência PostgreSQL</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {audit?.databaseState === 'DATABASE_SCHEMA_READY' ? (
                <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  DATABASE_SCHEMA_READY (11/11 Tabelas)
                </span>
              ) : audit?.databaseState === 'DATABASE_SCHEMA_INCOMPLETE' ? (
                <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                  <AlertTriangle size={12} />
                  DATABASE_SCHEMA_INCOMPLETE ({audit.totalFound}/11 Tabelas)
                </span>
              ) : audit?.databaseState === 'DATABASE_SCHEMA_PENDING' ? (
                <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                  <AlertCircle size={12} />
                  DATABASE_SCHEMA_PENDING (0/11 Tabelas)
                </span>
              ) : audit?.databaseState === 'DATABASE_CONNECTION_ERROR' ? (
                <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                  <AlertCircle size={12} />
                  DATABASE_CONNECTION_ERROR
                </span>
              ) : isConfigured ? (
                <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                  <Clock size={12} />
                  Aguardando Auditoria
                </span>
              ) : (
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700 flex items-center gap-1">
                  <AlertCircle size={12} />
                  VERIFICAÇÃO REMOTA NÃO DISPONÍVEL (Modo Demo)
                </span>
              )}

              {isCertified ? (
                <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 flex items-center gap-1">
                  <ShieldCheck size={12} />
                  PERSISTÊNCIA CERTIFICADA
                </span>
              ) : (
                <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                  <ShieldAlert size={12} />
                  NÃO CERTIFICADA
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
            <div className="p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800">
              <span className="text-neutral-500 block text-[10px] uppercase tracking-wider">SUPABASE POSTGRESQL</span>
              <span className={`block font-semibold ${isConfigured ? 'text-emerald-400' : 'text-neutral-400'}`}>
                {isConfigured ? '● CONECTADO' : '● NÃO CONFIGURADO (.env)'}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800">
              <span className="text-neutral-500 block text-[10px] uppercase tracking-wider">DATABASE SCHEMA</span>
              <span className={`block font-semibold ${audit?.allTablesExist ? 'text-emerald-400' : isConfigured ? 'text-amber-400' : 'text-neutral-400'}`}>
                {audit ? `${audit.totalFound}/11 TABELAS` : isConfigured ? 'NÃO AUDITADO' : 'MOCK LOCAL'}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800">
              <span className="text-neutral-500 block text-[10px] uppercase tracking-wider">RLS POLICIES</span>
              <span className={`block font-semibold ${audit?.rlsStatus === 'REMOTELY_CONFIRMED' ? 'text-emerald-400' : 'text-cyan-400'}`}>
                {audit?.rlsStatus === 'REMOTELY_CONFIRMED' ? 'CONFIRMADO NO BANCO' : 'DEFINIDO NO SCHEMA'}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800">
              <span className="text-neutral-500 block text-[10px] uppercase tracking-wider">IDEMPOTÊNCIA</span>
              <span className={`block font-semibold ${audit?.idempotencyStatus === 'REMOTELY_CONFIRMED' ? 'text-emerald-400' : 'text-cyan-400'}`}>
                {audit?.idempotencyStatus === 'REMOTELY_CONFIRMED' ? 'CONFIRMADA NO BANCO' : 'DEFINIDA NO SCHEMA'}
              </span>
            </div>
          </div>

          {!isConfigured && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono">
              <span className="font-bold block mb-1">VERIFICAÇÃO REMOTA NÃO DISPONÍVEL NESTE AMBIENTE</span>
              <span className="text-amber-300/80">
                As variáveis <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> não estão preenchidas no ambiente local. Para verificar o banco remoto real, configure o arquivo <code>.env</code> ou execute o schema no painel do Supabase.
              </span>
            </div>
          )}

          {/* Test Buttons & Result */}
          <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-neutral-800/80">
            <button
              onClick={handleTest}
              disabled={testing || runningSmoke}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={testing ? 'animate-spin' : ''} />
              <span>{testing ? 'Consultando 11 Tabelas Remotas...' : 'Auditar Schema & 11 Tabelas'}</span>
            </button>

            <button
              onClick={handleRunSmokeTest}
              disabled={testing || runningSmoke}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-neutral-950 shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCheck size={14} className={runningSmoke ? 'animate-spin' : ''} />
              <span>{runningSmoke ? 'Executando Smoke Test...' : 'Executar Smoke Test'}</span>
            </button>

            {testResult && (
              <span className={`text-xs font-medium ${testResult.success ? 'text-emerald-400' : 'text-amber-400'}`}>
                {testResult.message}
              </span>
            )}
          </div>
        </div>

        {/* Persistence Smoke Test Results Display */}
        {smokeResult && (
          <div className={`p-4 rounded-2xl border ${smokeResult.certified ? 'bg-emerald-950/20 border-emerald-800/60' : 'bg-neutral-950/80 border-neutral-800'} space-y-3`}>
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-neutral-100 uppercase tracking-wider font-mono flex items-center gap-2">
                <FileText size={14} className="text-emerald-400" />
                <span>
                  {smokeResult.mode === 'REMOTE_DATABASE_TEST'
                    ? 'REMOTE DATABASE TEST (PostgreSQL Live Query)'
                    : 'LOCAL/STATIC VALIDATION (Modo Demonstração)'}
                </span>
              </h4>
              <span className="text-[11px] font-mono text-neutral-400">
                {new Date(smokeResult.testedAt).toLocaleTimeString('pt-BR')}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800">
                <span className="text-neutral-500 block text-[10px]">TABELAS AUDITADAS</span>
                <span className="font-bold text-neutral-200">{smokeResult.tablesPassed}/{smokeResult.tablesTested}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800">
                <span className="text-neutral-500 block text-[10px]">INTEGRIDADE RELACIONAL</span>
                <span className={`font-bold ${smokeResult.relationalIntegrity ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {smokeResult.relationalIntegrity ? 'VALIDADA' : 'PENDENTE'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800">
                <span className="text-neutral-500 block text-[10px]">CAMPO IDEMPOTÊNCIA</span>
                <span className={`font-bold ${smokeResult.idempotencyFieldVerified ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {smokeResult.idempotencyFieldVerified ? 'CONFIRMADO' : 'PENDENTE'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800">
                <span className="text-neutral-500 block text-[10px]">STATUS PERSISTÊNCIA</span>
                <span className={`font-bold ${smokeResult.certified ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {smokeResult.certified ? 'CERTIFICADA' : 'NÃO CERTIFICADA'}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 max-h-36 overflow-y-auto space-y-1 font-mono text-[11px]">
              {smokeResult.logs.map((log, idx) => (
                <div key={idx} className={log.includes('OK') ? 'text-emerald-400/90' : log.includes('FAIL') || log.includes('ERROR') ? 'text-rose-400' : 'text-neutral-400'}>
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 11 Tables Grid Diagnostic */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-neutral-200 uppercase tracking-wider font-mono flex items-center gap-2">
              <TableProperties size={14} className="text-cyan-400" />
              Evidência Granular das 11 Tabelas do Schema
            </h4>
            {audit && (
              <span className="text-[11px] font-mono text-neutral-400">
                Modo: {audit.executionMode === 'REMOTE_LIVE_QUERY' ? 'PostgreSQL Live Query' : 'Validação Estática'} | {new Date(audit.verifiedAt).toLocaleTimeString('pt-BR')}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {EXPECTED_SCHEMA_TABLES.map((tableName) => {
              const tableDetail = audit?.tables.find(t => t.tableName === tableName);
              const exists = tableDetail?.exists ?? false;
              const hasAuditRun = Boolean(audit);
              const status = tableDetail?.status ?? 'UNVERIFIED';

              return (
                <div
                  key={tableName}
                  className={`p-3 rounded-xl border transition-all ${
                    !hasAuditRun || status === 'UNVERIFIED'
                      ? 'bg-neutral-950/60 border-neutral-800/80'
                      : status === 'PRESENT'
                      ? 'bg-emerald-950/20 border-emerald-800/50'
                      : status === 'ABSENT'
                      ? 'bg-amber-950/20 border-amber-800/50'
                      : 'bg-rose-950/20 border-rose-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold text-neutral-200">
                      {tableName}
                    </span>
                    {!hasAuditRun || status === 'UNVERIFIED' ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
                        {isConfigured ? 'Pendente Auditoria' : 'Não Verificado (Demo)'}
                      </span>
                    ) : status === 'PRESENT' ? (
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 size={10} />
                        PRESENT ({tableDetail?.rowCount ?? 0} rows {tableDetail?.responseTimeMs ? `· ${tableDetail.responseTimeMs}ms` : ''})
                      </span>
                    ) : status === 'ABSENT' ? (
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <AlertCircle size={10} />
                        ABSENT {tableDetail?.errorCode ? `(${tableDetail.errorCode})` : ''}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                        <AlertCircle size={10} />
                        ERROR
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-snug">
                    {TABLE_DESCRIPTIONS[tableName] || 'Entidade do schema relacional'}
                  </p>
                  {tableDetail?.queryExecuted && (
                    <div className="mt-1.5 p-1.5 rounded bg-neutral-950 border border-neutral-850 font-mono text-[9px] text-neutral-500 truncate">
                      {tableDetail.queryExecuted}
                    </div>
                  )}
                  {tableDetail?.error && (
                    <p className="text-[10px] text-rose-400/90 font-mono mt-1 truncate">
                      {tableDetail.error}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 6-Step Schema Activation Guide */}
        <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-3">
          <h4 className="text-xs font-bold text-neutral-100 uppercase tracking-wider font-mono flex items-center gap-2">
            <Terminal size={14} className="text-cyan-400" />
            Guia de Ativação do Schema em 6 Passos
          </h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-neutral-300">
            <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800/80 space-y-1">
              <span className="text-[10px] font-mono font-bold text-cyan-400">PASSO 1</span>
              <p className="font-semibold text-neutral-100">Abrir Supabase SQL Editor</p>
              <p className="text-[11px] text-neutral-400">Acesse o dashboard do seu projeto no Supabase e navegue até a aba SQL Editor.</p>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800/80 space-y-1">
              <span className="text-[10px] font-mono font-bold text-cyan-400">PASSO 2</span>
              <p className="font-semibold text-neutral-100">Copiar o SQL Completo</p>
              <p className="text-[11px] text-neutral-400">Clique no botão "Copiar SQL Completo" abaixo para obter o arquivo supabase/schema.sql.</p>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800/80 space-y-1">
              <span className="text-[10px] font-mono font-bold text-cyan-400">PASSO 3</span>
              <p className="font-semibold text-neutral-100">Executar o Schema no Supabase</p>
              <p className="text-[11px] text-neutral-400">Cole o código no SQL Editor e clique em <strong className="text-neutral-200">Run</strong> para criar as 11 tabelas, índices e RLS.</p>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800/80 space-y-1">
              <span className="text-[10px] font-mono font-bold text-cyan-400">PASSO 4</span>
              <p className="font-semibold text-neutral-100">Retornar ao FABRE AUTOMATION</p>
              <p className="text-[11px] text-neutral-400">Volte para este painel de Configurações para validar a persistência.</p>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800/80 space-y-1">
              <span className="text-[10px] font-mono font-bold text-cyan-400">PASSO 5</span>
              <p className="font-semibold text-neutral-100">Executar "Verificar Banco"</p>
              <p className="text-[11px] text-neutral-400">Clique no botão de auditoria para disparar a verificação tabela por tabela.</p>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800/80 space-y-1">
              <span className="text-[10px] font-mono font-bold text-cyan-400">PASSO 6</span>
              <p className="font-semibold text-neutral-100">Confirmação Automática</p>
              <p className="text-[11px] text-neutral-400">O sistema certifica as 11 tabelas e migra a operação para o PostgreSQL real.</p>
            </div>
          </div>
        </div>

        {/* SQL Code Box with Copy */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-300 font-mono flex items-center gap-1.5">
              <Database size={13} className="text-cyan-400" />
              supabase/schema.sql (11 Tabelas + Idempotência + RLS + Triggers)
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold transition-colors cursor-pointer"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{copied ? 'Copiado com Sucesso!' : 'Copiar SQL Completo'}</span>
            </button>
          </div>

          <pre className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] font-mono text-cyan-300/90 max-h-64 overflow-y-auto leading-relaxed select-all">
            {SQL_SCHEMA_CONTENT}
          </pre>
        </div>

        {/* Security / Secret Key Notice */}
        <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-800/40 text-xs text-cyan-300/90 space-y-1">
          <div className="flex items-center gap-2 font-semibold text-cyan-200">
            <Key size={14} className="text-cyan-400" />
            <span>Diretriz de Segurança e Isolamento de Chaves Privadas</span>
          </div>
          <p className="text-neutral-400 text-[11px] leading-relaxed">
            Nunca exponha <code>SUPABASE_SERVICE_ROLE_KEY</code>, <code>META_APP_SECRET</code> ou <code>OPENAI_API_KEY</code> no código do navegador ou em variáveis <code>VITE_</code>. Segredos residem exclusivamente no Supabase Secrets (<code>supabase secrets set</code>) para uso pelas Edge Functions.
          </p>
        </div>
      </div>
    </Modal>
  );
};
