/**
 * FABRE AUTOMATION - Automation Rule Card
 * Release: Automation Control Plane
 */

import React, { useState } from 'react';
import { Automation } from '../../types';
import { ChannelIcon } from '../common/ChannelIcon';
import {
  Zap,
  ArrowRight,
  Tag,
  Trash2,
  Edit3,
  CheckCircle2,
  Clock,
  UserCheck,
  Bot,
  AlertTriangle,
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
  const [confirmDelete, setConfirmDelete] = useState(false);

  const triggerTypeLabels: Record<string, string> = {
    keyword_direct: 'Mensagem no Direct',
    comment_post: 'Comentário em Post',
    story_reply: 'Resposta ao Story',
    first_contact: 'Primeiro Contato',
    inactive_followup: 'Follow-up de Inatividade',
  };

  const matchTypeLabels: Record<string, string> = {
    exact: 'Exata',
    contains: 'Contém',
    regex: 'Regex',
  };

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete(automation.id);
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
    }
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
              {automation.description || 'Sem descrição cadastrada.'}
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
              onChange={e => onToggle(automation.id, e.target.checked)}
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

          {/* Keywords or Trigger specifics */}
          {automation.trigger.config.keywords && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-neutral-500 font-mono">
                Palavras ({matchTypeLabels[automation.trigger.config.matchType as string] || 'Contém'}):
              </span>
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

          {automation.trigger.type === 'inactive_followup' && automation.trigger.config.inactivityHours && (
            <span className="inline-block text-[11px] text-amber-400 font-mono">
              Inatividade configurada: {automation.trigger.config.inactivityHours as number} horas
            </span>
          )}

          {automation.trigger.type === 'comment_post' && automation.trigger.config.postUrl && (
            <p className="text-[10px] text-neutral-400 font-mono truncate">
              Post: {automation.trigger.config.postUrl as string}
            </p>
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
            {automation.actions.map((act, idx) => (
              <div key={act.id || idx} className="text-xs text-neutral-200 flex items-start gap-2">
                <ArrowRight size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{act.name}</span>
                    <span className="text-[9px] font-mono text-neutral-500 bg-neutral-900 px-1.5 py-0.2 rounded border border-neutral-800">
                      {act.type}
                    </span>
                  </div>

                  {act.config.messageText && (
                    <p className="text-[11px] text-neutral-400 truncate mt-0.5 font-mono">
                      "{act.config.messageText}"
                    </p>
                  )}

                  {act.config.tagName && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-cyan-300 font-mono mt-0.5">
                      <Tag size={10} /> {act.type === 'remove_tag' ? `-${act.config.tagName}` : `+${act.config.tagName}`}
                    </span>
                  )}

                  {act.type === 'assign_human' && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 font-mono mt-0.5">
                      <UserCheck size={10} /> Transbordo para atendente humano
                    </span>
                  )}

                  {act.type === 'query_ai' && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-purple-300 font-mono mt-0.5">
                      <Bot size={10} /> Consulta com IA (Base de Conhecimento RAG)
                    </span>
                  )}

                  {act.type === 'delay' && act.config.delaySeconds && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 font-mono mt-0.5">
                      <Clock size={10} /> Aguardar {act.config.delaySeconds as number}s
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
          {automation.lastExecutedAt && (
            <span className="text-[11px] font-mono">
              Última execução: {new Date(automation.lastExecutedAt).toLocaleDateString('pt-BR')}
            </span>
          )}
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

          {confirmDelete ? (
            <div className="flex items-center gap-1 bg-rose-950/80 px-2 py-1 rounded-lg border border-rose-800">
              <AlertTriangle size={12} className="text-rose-400" />
              <span className="text-[10px] text-rose-200">Confirmar?</span>
              <button
                onClick={handleDelete}
                className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-500 text-neutral-950 rounded text-[10px] font-bold"
              >
                Sim
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-1.5 py-0.5 text-neutral-400 hover:text-neutral-200 text-[10px]"
              >
                Não
              </button>
            </div>
          ) : (
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Excluir Regra"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
