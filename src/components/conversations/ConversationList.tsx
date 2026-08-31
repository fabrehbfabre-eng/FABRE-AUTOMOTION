/**
 * FABRE AUTOMATION - Conversation List Inbox Column
 */

import React from 'react';
import { Conversation, ChannelType } from '../../types';
import { ChannelIcon } from '../common/ChannelIcon';
import { HandlerBadge } from '../common/StatusIndicator';
import { Search, Filter, Bot, User } from 'lucide-react';

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  channelFilter: ChannelType | 'all';
  onChannelFilterChange: (channel: ChannelType | 'all') => void;
  handlerFilter: 'all' | 'bot' | 'human';
  onHandlerFilterChange: (handler: 'all' | 'bot' | 'human') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  activeId,
  onSelect,
  channelFilter,
  onChannelFilterChange,
  handlerFilter,
  onHandlerFilterChange,
  searchQuery,
  onSearchChange,
}) => {
  const channels: { id: ChannelType | 'all'; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'instagram', label: 'Instagram' },
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'messenger', label: 'Messenger' },
  ];

  return (
    <div className="w-full md:w-80 lg:w-96 flex flex-col h-full border-r border-neutral-800/80 bg-neutral-950/60 shrink-0">
      {/* Search & Channel Tabs Header */}
      <div className="p-4 border-b border-neutral-800/80 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Buscar por contato, mensagem ou tag..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
          />
        </div>

        {/* Channel Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
          {channels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => onChannelFilterChange(ch.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                channelFilter === ch.id
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                  : 'bg-neutral-900/60 text-neutral-400 border border-neutral-800 hover:text-neutral-200'
              }`}
            >
              {ch.id !== 'all' && <ChannelIcon channel={ch.id} size={12} />}
              <span>{ch.label}</span>
            </button>
          ))}
        </div>

        {/* Handler Switchers (Todos / Bot / Humano) */}
        <div className="flex items-center justify-between text-xs pt-1">
          <span className="text-[11px] text-neutral-500 font-mono flex items-center gap-1">
            <Filter size={11} />
            Filtrar:
          </span>
          <div className="flex items-center gap-1 bg-neutral-900 p-0.5 rounded-lg border border-neutral-800">
            <button
              onClick={() => onHandlerFilterChange('all')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                handlerFilter === 'all'
                  ? 'bg-neutral-800 text-neutral-200 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => onHandlerFilterChange('bot')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                handlerFilter === 'bot'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <Bot size={11} />
              Bot
            </button>
            <button
              onClick={() => onHandlerFilterChange('human')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                handlerFilter === 'human'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <User size={11} />
              Humano
            </button>
          </div>
        </div>
      </div>

      {/* Conversations Scrollable List */}
      <div className="flex-1 overflow-y-auto divide-y divide-neutral-800/50">
        {conversations.length === 0 ? (
          <div className="p-8 text-center text-xs text-neutral-500">
            Nenhuma conversa encontrada com os filtros selecionados.
          </div>
        ) : (
          conversations.map((conv) => {
            const isSelected = activeId === conv.id;
            return (
              <div
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`p-3.5 flex items-start gap-3 transition-all cursor-pointer select-none ${
                  isSelected
                    ? 'bg-neutral-800/80 border-l-2 border-l-cyan-400'
                    : 'hover:bg-neutral-900/50'
                }`}
              >
                {/* Avatar */}
                <div className="relative shrink-0 mt-0.5">
                  <img
                    src={conv.contact.avatarUrl}
                    alt={conv.contact.name}
                    className="w-10 h-10 rounded-full object-cover border border-neutral-700/80"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute -bottom-1 -right-1">
                    <ChannelIcon channel={conv.channel} size={13} withBg />
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-xs font-bold text-neutral-200 truncate">
                      {conv.contact.name}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono shrink-0">
                      {new Date(conv.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-400 truncate mb-2">
                    {conv.lastMessage?.content || 'Sem mensagens'}
                  </p>

                  <div className="flex items-center justify-between gap-2">
                    <HandlerBadge handler={conv.handler} size="sm" />

                    {conv.unreadCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-cyan-500 text-neutral-950 font-extrabold text-[10px] flex items-center justify-center">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
