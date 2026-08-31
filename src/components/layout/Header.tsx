/**
 * FABRE AUTOMATION - Top Header Component
 * Release 2: Supabase Persistence Foundation
 */

import React from 'react';
import { NavItemKey } from './Sidebar';
import { ShieldCheck, Database, Terminal, CheckCircle2, AlertCircle } from 'lucide-react';
import { isSupabaseConfigured } from '../../lib/supabase';

interface HeaderProps {
  activeTab: NavItemKey;
  onOpenArchitectureModal?: () => void;
  onOpenSchemaModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onOpenArchitectureModal, onOpenSchemaModal }) => {
  const isConnected = isSupabaseConfigured();

  const titles: Record<NavItemKey, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Dashboard de Operações',
      subtitle: 'Métricas, status dos canais e visão geral do sistema Fabre',
    },
    conversations: {
      title: 'Caixa de Entrada Unificada',
      subtitle: 'Centralize conversas do Instagram Direct, WhatsApp e Messenger',
    },
    automations: {
      title: 'Regras de Automação',
      subtitle: 'Gatilhos por palavra-chave, comentários e respostas instantâneas',
    },
    knowledge: {
      title: 'Base de Conhecimento Oficial',
      subtitle: 'Diretrizes oficiais, regras de atendimento e informações do canal',
    },
    settings: {
      title: 'Configurações & Conexões',
      subtitle: 'Supabase PostgreSQL, Meta Integrations, WhatsApp Cloud e IA',
    },
  };

  const current = titles[activeTab] || titles.dashboard;

  return (
    <header className="h-16 border-b border-neutral-800/80 bg-neutral-950/60 backdrop-blur-md px-6 flex items-center justify-between shrink-0 select-none">
      <div>
        <h1 className="text-base font-bold text-neutral-100 font-display flex items-center gap-2">
          {current.title}
        </h1>
        <p className="text-xs text-neutral-400 hidden sm:block">
          {current.subtitle}
        </p>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Persistence Provider Status Indicator */}
        {isConnected ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300">
            <CheckCircle2 size={13} className="text-emerald-400 animate-pulse" />
            <span className="font-medium">Supabase:</span>
            <span className="font-mono text-[11px] font-semibold text-emerald-300">Conectado (PostgreSQL)</span>
          </div>
        ) : (
          <div 
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950/40 border border-amber-800/60 text-xs text-amber-300 cursor-pointer hover:bg-amber-900/40 transition-colors"
            onClick={onOpenSchemaModal}
            title="Clique para ver como conectar o Supabase PostgreSQL"
          >
            <AlertCircle size={13} className="text-amber-400" />
            <span className="font-medium">Persistência:</span>
            <span className="font-mono text-[11px] font-semibold text-amber-300">Modo Demo (Mock)</span>
          </div>
        )}

        {/* SQL Schema Button */}
        <button
          onClick={onOpenSchemaModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-300 border border-emerald-800/50 text-xs font-medium transition-colors cursor-pointer"
          title="Ver Schema SQL & Tabelas Supabase"
        >
          <Database size={13} className="text-emerald-400" />
          <span className="hidden sm:inline">Schema SQL</span>
        </button>

        {/* Architecture Spec Button */}
        <button
          onClick={onOpenArchitectureModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/40 text-cyan-300 border border-cyan-800/50 text-xs font-medium transition-colors cursor-pointer"
          title="Ver Especificação da Arquitetura do Release 2"
        >
          <Terminal size={13} className="text-cyan-400" />
          <span className="hidden sm:inline">Spec Release 2</span>
        </button>

        {/* Independent Architecture Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-400">
          <ShieldCheck size={14} className="text-cyan-400" />
          <span className="text-[11px] font-mono">Sem Lock-in</span>
        </div>
      </div>
    </header>
  );
};
