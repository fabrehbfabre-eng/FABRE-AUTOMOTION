/**
 * FABRE AUTOMATION - Integration Configuration Card
 * Release 1: Foundation & Architecture (Interface without storing real keys)
 */

import React from 'react';
import { IntegrationCardConfig } from '../../types';
import { ChannelIcon } from '../common/ChannelIcon';
import { ConnectionStatusBadge } from '../common/StatusIndicator';
import { Shield, Sparkles, Layers, Info, KeyRound } from 'lucide-react';

interface IntegrationCardProps {
  config: IntegrationCardConfig;
  onSimulateTest?: () => void;
}

export const IntegrationCard: React.FC<IntegrationCardProps> = ({
  config,
}) => {
  return (
    <div className="rounded-2xl border border-neutral-800/90 bg-neutral-900/50 p-5 sm:p-6 flex flex-col justify-between space-y-5">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <ChannelIcon
              channel={config.channelType || (config.category === 'ai' ? 'ai' : 'database')}
              size={22}
              withBg
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-neutral-100 font-display">
                  {config.name}
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/40">
                  {config.targetRelease}
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                {config.badgeLabel}
              </p>
            </div>
          </div>

          <ConnectionStatusBadge status={config.status} />
        </div>

        {/* Description */}
        <p className="text-xs text-neutral-300 leading-relaxed">
          {config.description}
        </p>

        {/* Architecture Specs Note */}
        <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800/80 text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 text-neutral-400 font-medium text-[11px]">
            <Layers size={12} className="text-cyan-400" />
            <span>Abstração de Código:</span>
          </div>
          <p className="text-[11px] text-neutral-500 font-mono leading-relaxed">
            {config.architectureNotes}
          </p>
        </div>

        {/* Placeholder Connection Fields for Visual Foundation */}
        <div className="pt-2 border-t border-neutral-800/60 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-neutral-400">
            <span className="flex items-center gap-1">
              <KeyRound size={12} className="text-amber-400" />
              Campos de Autenticação (Planejados)
            </span>
            <span className="text-[10px] font-mono text-neutral-500">
              Desativado na Release 1
            </span>
          </div>

          <div className="space-y-2 opacity-60 pointer-events-none">
            <div className="flex items-center gap-2">
              <input
                type="text"
                disabled
                placeholder={
                  config.id === 'instagram'
                    ? 'Instagram App ID / Meta Graph Token...'
                    : config.id === 'whatsapp'
                    ? 'WhatsApp Cloud Phone Number ID / Access Token...'
                    : config.id === 'openai'
                    ? 'sk-proj-... (OpenAI API Key)'
                    : config.id === 'supabase'
                    ? 'https://xyz.supabase.co (URL & Anon Key)...'
                    : 'Meta App Secret...'
                }
                className="flex-1 px-3 py-1.5 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-400 placeholder-neutral-600 font-mono"
              />
              <button
                disabled
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-800 text-neutral-500 border border-neutral-700"
              >
                Conectar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Notice Footer */}
      <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-2 border-t border-neutral-800/60">
        <span className="flex items-center gap-1 font-mono">
          <Info size={11} className="text-cyan-400" />
          Sem chaves armazenadas no Release 1
        </span>
        <span className="text-neutral-400 font-mono font-semibold">
          {config.category.toUpperCase()}
        </span>
      </div>
    </div>
  );
};
