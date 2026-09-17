/**
 * FABRE AUTOMATION - Configurações: Automações
 * Release 9.1: Simplificação da Interface de Configurações
 * 
 * Configurações amigáveis para:
 * - Regras automáticas (resumo com ativação rápida)
 * - Respostas automáticas (ativação e opções de tempo)
 * - Encaminhamento para atendimento humano (regras de transbordo)
 */

import React, { useState } from 'react';
import { 
  Zap, 
  MessageSquare, 
  UserCheck, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  Save, 
  Check, 
  SlidersHorizontal,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { useAutomations } from '../../hooks/useAutomations';

interface AutomationsSettingsProps {
  onNavigate?: (tab: any) => void;
}

interface HandoffSettings {
  enabled: boolean;
  keywords: string;
  transferMessage: string;
  notifyTeam: boolean;
}

const DEFAULT_HANDOFF: HandoffSettings = {
  enabled: true,
  keywords: 'atendente, falar com pessoa, humano, suporte, ajuda, vendedor',
  transferMessage: 'Com certeza! Já estou transferindo sua conversa para um de nossos atendentes. Por favor, aguarde um instante.',
  notifyTeam: true,
};

const STORAGE_KEY = 'fabre_handoff_settings';

export const AutomationsSettingsSection: React.FC<AutomationsSettingsProps> = ({ onNavigate }) => {
  const { automations, toggleAutomation } = useAutomations();

  const [handoff, setHandoff] = useState<HandoffSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_HANDOFF, ...JSON.parse(saved) };
      }
    } catch {
      // fallback
    }
    return DEFAULT_HANDOFF;
  });

  const [autoReplyWelcome, setAutoReplyWelcome] = useState(true);
  const [autoReplyStories, setAutoReplyStories] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSaveHandoff = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(handoff));
      setTimeout(() => {
        setSaving(false);
        setFeedback('Configurações de encaminhamento salvas com sucesso!');
        setTimeout(() => setFeedback(null), 3500);
      }, 300);
    } catch {
      setSaving(false);
      setFeedback('Erro ao salvar localmente.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header da Seção */}
      <div className="border-b border-neutral-800/80 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-neutral-100 font-display flex items-center gap-2.5">
            <Zap size={20} className="text-emerald-400" />
            Automações
          </h3>
          <p className="text-xs text-neutral-400 mt-1">
            Controle de regras automáticas, respostas instantâneas e critérios de transbordo para atendimento humano.
          </p>
        </div>

        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate('automations')}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors flex items-center gap-2 self-start cursor-pointer"
          >
            <span>Central de Automações</span>
            <ExternalLink size={13} className="text-cyan-400" />
          </button>
        )}
      </div>

      {/* 1. Respostas Automáticas */}
      <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-4">
        <div>
          <h4 className="text-sm font-bold text-neutral-200 flex items-center gap-2">
            <MessageSquare size={16} className="text-cyan-400" />
            Respostas Automáticas Instantâneas
          </h4>
          <p className="text-xs text-neutral-400 mt-0.5">
            Defina quais tipos de eventos recebem respostas automáticas imediatas.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800 flex items-center justify-between">
            <div className="space-y-0.5 pr-2">
              <span className="text-xs font-bold text-neutral-200 block">Resposta a Novos Contatos</span>
              <span className="text-[11px] text-neutral-400 block">Enviar mensagem de recepção imediata</span>
            </div>
            <button
              type="button"
              onClick={() => setAutoReplyWelcome(!autoReplyWelcome)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                autoReplyWelcome
                  ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
              }`}
            >
              {autoReplyWelcome ? 'Ativada' : 'Desativada'}
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800 flex items-center justify-between">
            <div className="space-y-0.5 pr-2">
              <span className="text-xs font-bold text-neutral-200 block">Resposta a Menções em Stories</span>
              <span className="text-[11px] text-neutral-400 block">Agradecimento por marcar no Instagram</span>
            </div>
            <button
              type="button"
              onClick={() => setAutoReplyStories(!autoReplyStories)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                autoReplyStories
                  ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
              }`}
            >
              {autoReplyStories ? 'Ativada' : 'Desativada'}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Regras Automáticas Ativas */}
      <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-neutral-200 flex items-center gap-2">
              <Zap size={16} className="text-emerald-400" />
              Regras Automáticas Cadastradas
            </h4>
            <p className="text-xs text-neutral-400 mt-0.5">
              Ative ou pause rapidamente as regras principais configuradas.
            </p>
          </div>

          <span className="text-[11px] font-mono text-neutral-400 bg-neutral-800 px-2.5 py-1 rounded-lg">
            {automations.filter(a => a.enabled).length} de {automations.length} ativas
          </span>
        </div>

        <div className="space-y-2">
          {automations.slice(0, 4).map((rule) => (
            <div
              key={rule.id}
              className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800/80 flex items-center justify-between gap-3 hover:border-neutral-700 transition-colors"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-neutral-200">{rule.title}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-900 text-neutral-400 border border-neutral-800 uppercase">
                    {rule.channel}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400">{rule.description}</p>
              </div>

              <button
                type="button"
                onClick={() => toggleAutomation(rule.id, !rule.enabled)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
                  rule.enabled
                    ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                }`}
              >
                {rule.enabled ? 'Ativa' : 'Pausada'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Encaminhamento para Atendimento Humano */}
      <form onSubmit={handleSaveHandoff} className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-neutral-200 flex items-center gap-2">
              <UserCheck size={16} className="text-purple-400" />
              Encaminhamento para Atendimento Humano (Transbordo)
            </h4>
            <p className="text-xs text-neutral-400 mt-0.5">
              Defina quando o sistema deve transferir a conversa automaticamente para a equipe humana.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setHandoff(prev => ({ ...prev, enabled: !prev.enabled }))}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer self-start ${
              handoff.enabled
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40'
                : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
            }`}
          >
            {handoff.enabled ? 'Transbordo Ativo' : 'Transbordo Pausado'}
          </button>
        </div>

        <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300">
              Palavras-chave que solicitam atendente (separadas por vírgula)
            </label>
            <input
              type="text"
              value={handoff.keywords}
              onChange={(e) => setHandoff(prev => ({ ...prev, keywords: e.target.value }))}
              placeholder="Ex: atendente, humano, falar com pessoa, suporte, ajuda"
              className="w-full px-3.5 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-300">
              Mensagem enviada antes de transferir para a equipe
            </label>
            <textarea
              rows={2}
              value={handoff.transferMessage}
              onChange={(e) => setHandoff(prev => ({ ...prev, transferMessage: e.target.value }))}
              placeholder="Mensagem avisando que a conversa está sendo direcionada para um atendente..."
              className="w-full px-3.5 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-500 resize-none leading-relaxed"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-neutral-800/80">
          {feedback ? (
            <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 size={14} />
              {feedback}
            </span>
          ) : (
            <span className="text-xs text-neutral-500">
              Garante que nenhum cliente fique sem resposta humana quando necessário.
            </span>
          )}

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors flex items-center gap-2 cursor-pointer shadow-md shadow-purple-950/40 disabled:opacity-50"
          >
            <Save size={13} />
            <span>{saving ? 'Salvando...' : 'Salvar transbordo'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
