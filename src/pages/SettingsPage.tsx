/**
 * FABRE AUTOMATION - Settings & Integrations Page
 * Release 2: Supabase Persistence Foundation
 */

import React, { useState, useEffect } from 'react';
import { IntegrationCard } from '../components/settings/IntegrationCard';
import { SupabaseSchemaModal } from '../components/settings/SupabaseSchemaModal';
import { useChannels } from '../hooks/useChannels';
import { aiService } from '../services';
import { AIConfiguration } from '../types';
import { 
  Settings, 
  ShieldCheck, 
  Bot, 
  Layers, 
  CheckCircle2, 
  Database,
  Lock,
  Activity,
  Check,
  AlertCircle,
  Key
} from 'lucide-react';
import { testSupabaseConnection, isSupabaseConfigured, getSupabaseConfig } from '../lib/supabase';

export const SettingsPage: React.FC = () => {
  const { integrations, loading } = useChannels();
  const [aiConfig, setAiConfig] = useState<AIConfiguration | null>(null);
  const [schemaModalOpen, setSchemaModalOpen] = useState(false);
  const [testingSupabase, setTestingSupabase] = useState(false);
  const [supabaseTestFeedback, setSupabaseTestFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const supabaseConfig = getSupabaseConfig();
  const isConnected = isSupabaseConfigured();

  useEffect(() => {
    aiService.getConfiguration().then(setAiConfig);
  }, []);

  const handleTestSupabase = async () => {
    setTestingSupabase(true);
    setSupabaseTestFeedback(null);
    try {
      const res = await testSupabaseConnection();
      setSupabaseTestFeedback(res);
    } finally {
      setTestingSupabase(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-100 font-display flex items-center gap-2.5">
            <Settings size={22} className="text-cyan-400" />
            Configurações, Supabase & Conexões
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Gestão do banco de dados relacional oficial (Supabase PostgreSQL), chaves de ambiente e status das integrações.
          </p>
        </div>

        <button
          onClick={() => setSchemaModalOpen(true)}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-neutral-950 transition-colors flex items-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer self-start sm:self-auto shrink-0"
        >
          <Database size={15} />
          <span>Ver Schema SQL & Tabelas</span>
        </button>
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

          <div className="flex items-center gap-2">
            {isConnected ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                <CheckCircle2 size={13} className="text-emerald-400" />
                Supabase Ativo (PostgreSQL)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                <AlertCircle size={13} className="text-amber-400" />
                Modo Demonstração (Mock Local)
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
              {supabaseConfig.hasKey ? '•••••••••••••••••••••••• (Chave Pública Anon)' : 'Chave Anon/Publishable necessária para persistência'}
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
            <span>Ver script SQL de 11 tabelas com RLS</span>
            <span>&rarr;</span>
          </button>
        </div>
      </div>

      {/* Security & Secret Key Rules */}
      <div className="p-5 rounded-2xl bg-neutral-900/60 border border-cyan-800/40 space-y-2">
        <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs font-display">
          <Key size={15} className="text-cyan-400" />
          <span>DIRETRIZ DE SEGURANÇA E ISOLAMENTO DE CHAVES</span>
        </div>
        <p className="text-xs text-neutral-300 leading-relaxed">
          O frontend React utiliza <strong>estritamente chaves públicas com Row Level Security (RLS)</strong>. Chaves secretas como <code>SUPABASE_SECRET_KEY</code>, <code>OPENAI_API_KEY</code> e <code>META_APP_SECRET</code> <strong>nunca são expostas no cliente</strong> e residem apenas no ambiente das Edge Functions seguras.
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
    </div>
  );
};
