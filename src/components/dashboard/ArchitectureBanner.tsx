/**
 * FABRE AUTOMATION - Architecture Status Banner
 */

import React from 'react';
import { Layers, ShieldCheck, Sparkles, ArrowRight } from 'lucide-react';

interface ArchitectureBannerProps {
  onLearnMore?: () => void;
  onGoToSettings?: () => void;
}

export const ArchitectureBanner: React.FC<ArchitectureBannerProps> = ({
  onLearnMore,
  onGoToSettings,
}) => {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-neutral-900/90 via-neutral-900/60 to-neutral-950 p-5 sm:p-6 shadow-xl shadow-black/30">
      {/* Subtle decorative glow */}
      <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono">
              <Sparkles size={12} className="text-cyan-400" />
              RELEASE 1 • FOUNDATION & ARCHITECTURE
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-neutral-800 text-neutral-400 border border-neutral-700">
              <ShieldCheck size={12} className="text-emerald-400" />
              Arquitetura Independente
            </span>
          </div>

          <h2 className="text-lg font-bold text-neutral-100 font-display">
            Fundação Modular Preparada para o Casal Fabre
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
            Esta versão estabelece a arquitetura limpa, tipos TypeScript rigorosos, serviços desacoplados e a interface do sistema. 
            Sem dependência de serviços proprietários, pronta para receber as APIs oficiais da Meta (Instagram/Messenger/WhatsApp), OpenAI e Supabase.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {onLearnMore && (
            <button
              onClick={onLearnMore}
              className="px-3.5 py-2 rounded-xl text-xs font-medium bg-neutral-800/90 hover:bg-neutral-750 text-neutral-200 border border-neutral-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Layers size={14} className="text-cyan-400" />
              Ver Arquitetura
            </button>
          )}

          {onGoToSettings && (
            <button
              onClick={onGoToSettings}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-neutral-950 font-semibold transition-colors flex items-center gap-1.5 shadow-lg shadow-cyan-950/50 cursor-pointer"
            >
              <span>Ver Conexões</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
