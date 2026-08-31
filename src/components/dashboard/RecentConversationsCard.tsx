/**
 * FABRE AUTOMATION - Recent Conversations Dashboard Widget
 */

import React from 'react';
import { Conversation } from '../../types';
import { ChannelIcon } from '../common/ChannelIcon';
import { HandlerBadge, ConversationStatusBadge } from '../common/StatusIndicator';
import { MessageSquare, ArrowRight } from 'lucide-react';

interface RecentConversationsCardProps {
  conversations: Conversation[];
  onViewAll: () => void;
  onSelectConversation: (id: string) => void;
}

export const RecentConversationsCard: React.FC<RecentConversationsCardProps> = ({
  conversations,
  onViewAll,
  onSelectConversation,
}) => {
  return (
    <div className="rounded-2xl border border-neutral-800/90 bg-neutral-900/50 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-base font-bold text-neutral-100 font-display flex items-center gap-2">
            <MessageSquare size={18} className="text-cyan-400" />
            Conversas Recentes
          </h3>
          <p className="text-xs text-neutral-400">
            Últimas interações nos canais com indicação de atendimento
          </p>
        </div>

        <button
          onClick={onViewAll}
          className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors cursor-pointer"
        >
          <span>Ver Caixa Completa</span>
          <ArrowRight size={14} />
        </button>
      </div>

      <div className="divide-y divide-neutral-800/60">
        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => onSelectConversation(conv.id)}
            className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-800/40 rounded-xl px-2.5 -mx-2.5 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative">
                <img
                  src={conv.contact.avatarUrl}
                  alt={conv.contact.name}
                  className="w-10 h-10 rounded-full object-cover border border-neutral-700/80"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute -bottom-1 -right-1">
                  <ChannelIcon channel={conv.channel} size={14} withBg />
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-neutral-200 truncate">
                    {conv.contact.name}
                  </span>
                  <span className="text-xs text-neutral-500 font-mono">
                    {conv.contact.username}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 truncate mt-0.5 max-w-md">
                  {conv.lastMessage?.content || 'Sem mensagens recentes'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 pl-13 sm:pl-0">
              <HandlerBadge handler={conv.handler} assignedTo={conv.assignedTo} size="sm" />
              <ConversationStatusBadge status={conv.status} />
              <span className="text-[11px] text-neutral-500 font-mono">
                {new Date(conv.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
