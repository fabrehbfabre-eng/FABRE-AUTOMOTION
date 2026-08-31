/**
 * FABRE AUTOMATION - Supabase Schema & Migration Modal
 * Release 2: Supabase Persistence Foundation
 */

import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Database, Copy, Check, Terminal, ShieldCheck, Activity, Key, CheckCircle2, AlertCircle } from 'lucide-react';
import { testSupabaseConnection, isSupabaseConfigured, getSupabaseConfig } from '../../lib/supabase';

interface SupabaseSchemaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SQL_SCHEMA_CONTENT = `-- =====================================================
-- FABRE AUTOMATION - Supabase PostgreSQL Database Schema
-- Release 2: Supabase Persistence Foundation
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. PROFILES (Contacts & Users)
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

-- 2. CONVERSATIONS
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

-- 3. MESSAGES
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'contact', 'bot', 'system')),
    channel TEXT NOT NULL CHECK (channel IN ('instagram', 'messenger', 'whatsapp')),
    content TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'audio', 'quick_reply', 'template', 'system_event')),
    media_url TEXT,
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sending', 'sent', 'delivered', 'read', 'failed')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. AUTOMATIONS
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

-- 5. AUTOMATION TRIGGERS & ACTIONS
CREATE TABLE IF NOT EXISTS public.automation_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

-- 6. KNOWLEDGE ITEMS
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

-- 7. CHANNEL CONNECTIONS
CREATE TABLE IF NOT EXISTS public.channel_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel TEXT NOT NULL UNIQUE CHECK (channel IN ('instagram', 'messenger', 'whatsapp')),
    name TEXT NOT NULL,
    account_handle TEXT,
    status TEXT NOT NULL DEFAULT 'awaiting_connection',
    status_message TEXT,
    connected_at TIMESTAMPTZ,
    last_sync_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. CONTACT TAGS & NOTES
CREATE TABLE IF NOT EXISTS public.contact_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT 'cyan',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.contact_tag_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.contact_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contact_id, tag_id)
);

CREATE TABLE IF NOT EXISTS public.contact_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
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

CREATE POLICY "Allow all public in dev" ON public.profiles FOR ALL USING (true);
CREATE POLICY "Allow all public in dev" ON public.conversations FOR ALL USING (true);
CREATE POLICY "Allow all public in dev" ON public.messages FOR ALL USING (true);
CREATE POLICY "Allow all public in dev" ON public.automations FOR ALL USING (true);
CREATE POLICY "Allow all public in dev" ON public.automation_triggers FOR ALL USING (true);
CREATE POLICY "Allow all public in dev" ON public.automation_actions FOR ALL USING (true);
CREATE POLICY "Allow all public in dev" ON public.knowledge_items FOR ALL USING (true);
CREATE POLICY "Allow all public in dev" ON public.channel_connections FOR ALL USING (true);
CREATE POLICY "Allow all public in dev" ON public.contact_tags FOR ALL USING (true);
CREATE POLICY "Allow all public in dev" ON public.contact_tag_assignments FOR ALL USING (true);
CREATE POLICY "Allow all public in dev" ON public.contact_notes FOR ALL USING (true);`;

export const SupabaseSchemaModal: React.FC<SupabaseSchemaModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const config = getSupabaseConfig();
  const isConnected = isSupabaseConfigured();

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
    } finally {
      setTesting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Supabase PostgreSQL Persistence & Schema"
      subtitle="Estrutura de 11 tabelas, índices e políticas de Row Level Security (RLS)"
      maxWidth="2xl"
    >
      <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
        {/* Status Card */}
        <div className={`p-4 rounded-2xl border ${isConnected ? 'bg-emerald-950/30 border-emerald-800/60' : 'bg-neutral-900/60 border-neutral-800'} space-y-3`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database size={16} className={isConnected ? 'text-emerald-400' : 'text-cyan-400'} />
              <span className="text-xs font-bold text-neutral-100 font-display">Status de Conexão Supabase</span>
            </div>
            {isConnected ? (
              <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <CheckCircle2 size={11} />
                Conectado (PostgreSQL)
              </span>
            ) : (
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                <AlertCircle size={11} />
                Modo Demonstração (Mock)
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-2 rounded-lg bg-neutral-950/80 border border-neutral-800">
              <span className="text-neutral-500 block text-[10px]">VITE_SUPABASE_URL</span>
              <span className="text-neutral-200 truncate block">
                {config.url || 'Não configurada (.env)'}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-neutral-950/80 border border-neutral-800">
              <span className="text-neutral-500 block text-[10px]">VITE_SUPABASE_PUBLISHABLE_KEY</span>
              <span className="text-neutral-200 block">
                {config.hasKey ? '•••••••••••••••• (Presente)' : 'Não configurada (.env)'}
              </span>
            </div>
          </div>

          {/* Test Button & Result */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleTest}
              disabled={testing}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Activity size={13} className={testing ? 'animate-spin text-cyan-400' : 'text-cyan-400'} />
              <span>{testing ? 'Testando Conexão...' : 'Testar Conexão PostgreSQL'}</span>
            </button>
            {testResult && (
              <span className={`text-xs ${testResult.success ? 'text-emerald-400' : 'text-amber-400'}`}>
                {testResult.message}
              </span>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="p-4 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 space-y-2 text-xs text-neutral-300 leading-relaxed">
          <h4 className="font-bold text-neutral-100 flex items-center gap-2">
            <Terminal size={14} className="text-emerald-400" />
            Como inicializar as tabelas no seu Supabase:
          </h4>
          <ol className="list-decimal list-inside space-y-1 text-neutral-400 pl-1">
            <li>Copie o script SQL completo abaixo.</li>
            <li>Abra o dashboard do seu projeto no Supabase &gt; <strong>SQL Editor</strong>.</li>
            <li>Cole o script e clique em <strong>Run</strong>.</li>
            <li>Adicione a <code>VITE_SUPABASE_URL</code> e a <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> no seu <code>.env</code>.</li>
          </ol>
        </div>

        {/* SQL Code Box with Copy */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-300 font-mono flex items-center gap-1.5">
              <Database size={13} className="text-emerald-400" />
              supabase/schema.sql (11 Tabelas + RLS + Triggers)
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/80 text-xs font-medium transition-colors cursor-pointer"
            >
              {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{copied ? 'Copiado para o Clipboard!' : 'Copiar SQL Completo'}</span>
            </button>
          </div>

          <pre className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] font-mono text-emerald-400/90 max-h-72 overflow-y-auto leading-relaxed select-all">
            {SQL_SCHEMA_CONTENT}
          </pre>
        </div>

        {/* Security / Secret Key Notice */}
        <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-800/40 text-xs text-cyan-300/90 space-y-1">
          <div className="flex items-center gap-2 font-semibold text-cyan-200">
            <Key size={14} className="text-cyan-400" />
            <span>Diretriz de Segurança de Chaves Privadas</span>
          </div>
          <p className="text-neutral-400 text-[11px] leading-relaxed">
            Nunca coloque <code>SUPABASE_SECRET_KEY</code>, chaves <code>service_role</code> ou <code>OPENAI_API_KEY</code> no código do navegador. Essas chaves permanecem exclusivamente nas Edge Functions do Supabase (<code>/supabase/functions/</code>).
          </p>
        </div>
      </div>
    </Modal>
  );
};
