/**
 * FABRE AUTOMATION - Status Indicator & Handler Chips
 */

import React from 'react';
import { Bot, UserCheck, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { ConnectionStatus, ConversationHandler, ConversationStatus } from '../../types';

interface ConnectionStatusBadgeProps {
  status: ConnectionStatus;
  label?: string;
}

export const ConnectionStatusBadge: React.FC<ConnectionStatusBadgeProps> = ({
  status,
  label,
}) => {
  if (status === 'awaiting_connection') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
        <Clock size={12} className="animate-pulse text-amber-400" />
        {label || 'Aguardando Conexão'}
      </span>
    );
  }

  if (status === 'connected') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
        <CheckCircle2 size={12} className="text-emerald-400" />
        {label || 'Conectado'}
      </span>
    );
  }

  if (status === 'connecting') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
        {label || 'Conectando'}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-800 text-neutral-400 border border-neutral-700">
      <AlertCircle size={12} />
      {label || 'Desconectado'}
    </span>
  );
};

interface HandlerBadgeProps {
  handler: ConversationHandler;
  assignedTo?: string;
  size?: 'sm' | 'md';
}

export const HandlerBadge: React.FC<HandlerBadgeProps> = ({ handler, assignedTo, size = 'md' }) => {
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium';

  if (handler === 'human') {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 ${sizeClass}`}>
        <UserCheck size={12} className="text-indigo-400" />
        <span>{assignedTo ? `Humano (${assignedTo})` : 'Atendimento Humano'}</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 ${sizeClass}`}>
      <Bot size={12} className="text-cyan-400" />
      <span>Automação (Bot)</span>
    </span>
  );
};

interface ConversationStatusBadgeProps {
  status: ConversationStatus;
}

export const ConversationStatusBadge: React.FC<ConversationStatusBadgeProps> = ({ status }) => {
  switch (status) {
    case 'open':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          Aberta
        </span>
      );
    case 'waiting_user':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          Aguardando Seguidor
        </span>
      );
    case 'resolved':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">
          <CheckCircle2 size={10} />
          Resolvida
        </span>
      );
    case 'archived':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-500 border border-neutral-800">
          Arquivada
        </span>
      );
  }
};
