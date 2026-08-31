/**
 * FABRE AUTOMATION - Top Header Component
 */

import React from 'react';
import { NavItemKey } from './Sidebar';
import { ShieldCheck, Activity, Terminal } from 'lucide-react';

interface HeaderProps {
  activeTab: NavItemKey;
  onOpenArchitectureModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onOpenArchitectureModal }) => {
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
      title: 'Base de Conhecimento IA',
      subtitle: 'Informações oficiais do Casal Fabre, produtos, preços e diretrizes',
    },
    settings: {
      title: 'Configurações & Conexões',
      subtitle: 'Estrutura de integrações Meta, WhatsApp Cloud, OpenAI e Supabase',
    },
  };

  const current = titles[activeTab];

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

      <div className="flex items-center gap-3">
        {/* Status Chip */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs">
          <Activity size={13} className="text-emerald-400" />
          <span className="text-neutral-300 font-medium">Motor de Automação:</span>
          <span className="text-emerald-400 font-mono text-[11px]">Ready (Local)</span>
        </div>

        {/* Architecture Spec Button */}
        <button
          onClick={onOpenArchitectureModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/40 text-cyan-300 border border-cyan-800/50 text-xs font-medium transition-colors cursor-pointer"
          title="Ver Especificação da Arquitetura do Release 1"
        >
          <Terminal size={13} className="text-cyan-400" />
          <span>Spec Release 1</span>
        </button>

        {/* Independent Architecture Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-400">
          <ShieldCheck size={14} className="text-cyan-400" />
          <span className="hidden md:inline text-[11px] font-mono">Sem Lock-in</span>
        </div>
      </div>
    </header>
  );
};
