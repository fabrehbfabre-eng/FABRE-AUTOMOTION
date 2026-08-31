/**
 * FABRE AUTOMATION - Settings & Integrations Page
 * Release 1: Foundation & Architecture
 */

import React, { useState, useEffect } from 'react';
import { IntegrationCard } from '../components/settings/IntegrationCard';
import { useChannels } from '../hooks/useChannels';
import { aiService } from '../services';
import { AIConfiguration } from '../types';
import { 
  Settings, 
  Sparkles, 
  ShieldCheck, 
  Bot, 
  KeyRound, 
  Layers, 
  CheckCircle2, 
  Database,
  Lock,
  Cpu
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { integrations, loading } = useChannels();
  const [aiConfig, setAiConfig] = useState<AIConfiguration | null>(null);

  useEffect(() => {
    aiService.getConfiguration().then(setAiConfig);
  }, []);

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-neutral-100 font-display flex items-center gap-2.5">
          <Settings size={22} className="text-cyan-400" />
          Configurações & Conexões
        </h2>
        <p className="text-xs text-neutral-400 mt-1">
          Arquitetura e estado das integrações externas preparadas para as próximas releases.
        </p>
      </div>

      {/* Security & Non-Storage Policy Notice */}
      <div className="p-5 rounded-2xl bg-neutral-900/60 border border-amber-500/30 space-y-2">
        <div className="flex items-center gap-2 text-amber-300 font-bold text-xs font-display">
          <Lock size={15} />
          <span>DIRETRIZ DE SEGURANÇA • RELEASE 1</span>
        </div>
        <p className="text-xs text-neutral-300 leading-relaxed">
          Nesta primeira versão, <strong>nenhuma chave de API ou credencial secreta é solicitada ou gravada</strong>. 
          Todas as interfaces de integração abaixo foram criadas como abstrações tipadas, permitindo conectar as contas do Casal Fabre nas releases oficiais sem retrabalho arquitetural.
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
                Diretrizes de comportamento e tom de voz que serão enviados à OpenAI no Release 3
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
                Prompt de Sistema (Persona do Casal Fabre)
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
          O <strong>FABRE AUTOMATION</strong> foi estruturado de forma agnóstica a nuvens proprietárias. A persistência futura foi desenhada para suportar <strong>Supabase (PostgreSQL)</strong> e hospedagem independente de baixo custo, sem nenhum vínculo com Firebase ou dependências lock-in.
        </p>
      </div>
    </div>
  );
};
