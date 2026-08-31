/**
 * FABRE AUTOMATION - Architecture Status Banner
 * Release 4: Supabase Activation & Backend Deployment
 */

import React, { useState, useEffect } from 'react';
import { Database, Sparkles, ArrowRight, AlertTriangle, CheckCircle2, Server, Lock, AlertCircle } from 'lucide-react';
import { testSupabaseConnection, SupabaseTestResult, isSupabaseConfigured } from '../../lib/supabase';

interface ArchitectureBannerProps {
  onLearnMore?: () => void;
  onOpenSchemaModal?: () => void;
  onGoToSettings?: () => void;
}

export const ArchitectureBanner: React.FC<ArchitectureBannerProps> = ({
  onLearnMore,
  onOpenSchemaModal,
  onGoToSettings,
}) => {
  const [dbState, setDbState] = useState<SupabaseTestResult>({
    status: isSupabaseConfigured() ? 'schema_pending' : 'demo',
    success: false,
    schemaApplied: false,
    message: isSupabaseConfigured() ? 'Verificando conexão com Supabase...' : 'Modo Demonstração ativo.',
  });

  useEffect(() => {
    testSupabaseConnection().then(setDbState);
  }, []);

  const isConfigured = isSupabaseConfigured();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-gradient-to-r from-neutral-900/90 via-neutral-900/70 to-neutral-950 p-5 sm:p-6 shadow-xl shadow-black/30">
      {/* Subtle decorative glow */}
      <div className={`absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl pointer-events-none ${dbState.status === 'connected' ? 'bg-emerald-500/10' : dbState.status === 'error' ? 'bg-rose-500/10' : 'bg-amber-500/10'}`} />
      <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-2 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 font-mono">
              <Sparkles size={12} className="text-purple-400" />
              RELEASE 4 • SUPABASE ACTIVATION
            </span>

            {/* Database Status Discriminated */}
            {dbState.status === 'connected' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-emerald-950/80 text-emerald-300 border border-emerald-800 font-mono">
                <CheckCircle2 size={12} className="text-emerald-400" />
                Supabase DB: Conectado & Operacional
              </span>
            ) : dbState.status === 'schema_pending' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-amber-950/80 text-amber-300 border border-amber-800 font-mono">
                <AlertTriangle size={12} className="text-amber-400" />
                Supabase DB: Schema Pendente
              </span>
            ) : dbState.status === 'error' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-rose-950/80 text-rose-300 border border-rose-800 font-mono">
                <AlertCircle size={12} className="text-rose-400" />
                Supabase DB: Erro de Conexão
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-neutral-800 text-neutral-300 border border-neutral-700 font-mono">
                <AlertTriangle size={12} className="text-amber-400" />
                Modo Demonstração (Demo)
              </span>
            )}

            {/* Edge Functions Backend Status */}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-neutral-800 text-neutral-300 border border-neutral-700 font-mono">
              <Server size={12} className="text-purple-400" />
              Edge Functions: Preparadas
            </span>

            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-cyan-950/40 text-cyan-300 border border-cyan-800/60">
              <Lock size={12} className="text-cyan-400" />
              Zero Secrets no Frontend
            </span>
          </div>

          <h2 className="text-lg font-bold text-neutral-100 font-display">
            {dbState.status === 'connected'
              ? 'Supabase PostgreSQL Validado & Operacional com 11 Tabelas'
              : dbState.status === 'schema_pending'
              ? 'Supabase Conectado • Execute o schema.sql no SQL Editor'
              : isConfigured
              ? 'Erro ao Comunicar com o Supabase'
              : 'Arquitetura Supabase Pronta • Operando em Modo Demonstração'}
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
            {dbState.status === 'connected'
              ? 'Persistência relacional oficial ativa no Supabase com Row Level Security (RLS), triggers e isolamento total de credenciais externas.'
              : dbState.status === 'schema_pending'
              ? 'As credenciais foram validadas, porém as 11 tabelas ainda não foram criadas no banco de dados remoto. Abra o SQL Editor do Supabase para aplicar o script.'
              : isConfigured
              ? dbState.message
              : 'Aplicação executando em ambiente isolado de demonstração. Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY para ativar a persistência real.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {onOpenSchemaModal && (
            <button
              onClick={onOpenSchemaModal}
              className="px-3.5 py-2 rounded-xl text-xs font-medium bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-300 border border-emerald-800/50 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Database size={14} className="text-emerald-400" />
              Ver Schema SQL
            </button>
          )}

          {onLearnMore && (
            <button
              onClick={onLearnMore}
              className="px-3.5 py-2 rounded-xl text-xs font-medium bg-neutral-800/90 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              Ver Arquitetura
            </button>
          )}

          {onGoToSettings && (
            <button
              onClick={onGoToSettings}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-neutral-950 font-semibold transition-colors flex items-center gap-1.5 shadow-lg shadow-cyan-950/50 cursor-pointer"
            >
              <span>Gerenciar Backend</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

