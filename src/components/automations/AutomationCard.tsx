/**
 * FABRE AUTOMATION - Automation Rule Card
 */

import React from 'react';
import { Automation } from '../../types';
import { ChannelIcon } from '../common/ChannelIcon';
import { Badge } from '../common/Badge';
import { 
  Zap, 
  ArrowRight, 
  MessageSquare, 
  Tag, 
  Trash2, 
  Edit3,
  CheckCircle2,
  Clock
} from 'lucide-react';

interface AutomationCardProps {
  automation: Automation;
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (automation: Automation) => void;
  onDelete: (id: string) => void;
}

export const AutomationCard: React.FC<AutomationCardProps> = ({
  automation,
  onToggle,
  onEdit,
  onDelete,
}) => {
  const triggerTypeLabels = {
    keyword_direct: 'Mensagem no Direct',
    comment_post: 'Comentário em Post',
    story_reply: 'Resposta ao Story',
    first_contact: 'Primeiro Contato',
    inactive_followup: 'Follow-up de Inatividade',
  };

  const actionTypeLabels = {
    send_message: 'Enviar Mensagem',
    send_dm: 'Enviar Direct',
    assign_human: 'Transferir para Humano',
    add_tag: 'Adicionar Etiqueta',
    remove_tag: 'Remover Etiqueta',
    query_ai: 'Consultar IA',
    delay: 'Aguardar Tempo',
  };

  return (
    <div
      className={`rounded-2xl border transition-all p-5 sm:p-6 space-y-4 ${
        automation.enabled
          ? 'bg-neutral-900/60 border-neutral-800 hover:border-cyan-500/40 shadow-sm'
          : 'bg-neutral-950/40 border-neutral-900 opacity-70'
      }`}
    >
      {/* Top Bar: Title, Channel, Active Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${
              automation.enabled
                ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
                : 'bg-neutral-800 border-neutral-700 text-neutral-500'
            }`}
          >
            <Zap size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-neutral-100 font-display">
                {automation.title}
              </h3>
              <ChannelIcon channel={automation.channel} size={14} />
            </div>
            <p className="text-xs text-neutral-400 mt-0.5 line-clamp-1">
              {automation.description}
            </p>
          </div>
        </div>

        {/* Status Switcher Toggle */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <span className="text-xs font-mono text-neutral-400">
            {automation.enabled ? (
              <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 size={12} /> Ativa
              </span>
            ) : (
              <span className="text-neutral-500">Pausada</span>
            )}
          </span>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={automation.enabled}
              onChange={(e) => onToggle(automation.id, e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
          </label>
        </div>
      </div>

      {/* Visual Workflow: Trigger -> Action (Quando X acontecer -> Faça Y) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        {/* Trigger Box */}
        <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              Gatilho (Quando acontecer)
            </span>
            <span className="text-[10px] text-neutral-500 font-mono">
              {triggerTypeLabels[automation.trigger.type] || automation.trigger.type}
            </span>
          </div>

          <p className="text-xs text-neutral-200 font-medium">
            {automation.trigger.name}
          </p>

          {automation.trigger.config.keywords && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-neutral-500 font-mono">Palavras-chave:</span>
              {automation.trigger.config.keywords.map((kw, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-mono text-[10px]"
                >
                  "{kw}"
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Action Box */}
        <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Ações Executadas (Faça)
            </span>
            <span className="text-[10px] text-neutral-500 font-mono">
              {automation.actions.length} {automation.actions.length === 1 ? 'Ação' : 'Ações'}
            </span>
          </div>

          <div className="space-y-1.5">
            {automation.actions.map((act) => (
              <div key={act.id} className="text-xs text-neutral-200 flex items-start gap-2">
                <ArrowRight size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{act.name}</span>
                  {act.config.messageText && (
                    <p className="text-[11px] text-neutral-400 truncate mt-0.5 font-mono">
                      "{act.config.messageText}"
                    </p>
                  )}
                  {act.config.tagName && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-cyan-300 font-mono mt-0.5">
                      <Tag size={10} /> +{act.config.tagName}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Meta & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-800/60 text-xs text-neutral-500">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] flex items-center gap-1">
            <Clock size={12} />
            Execuções: <strong className="text-neutral-300 font-mono">{automation.executionCount}</strong>
          </span>
          <span className="text-[11px] font-mono">
            Criada em: {new Date(automation.createdAt).toLocaleDateString('pt-BR')}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(automation)}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Editar Regra"
          >
            <Edit3 size={14} />
          </button>
          <button
            onClick={() => onDelete(automation.id)}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
            title="Excluir Regra"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
