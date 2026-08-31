/**
 * FABRE AUTOMATION - Main Active Conversation Thread View
 */

import React, { useState, useRef, useEffect } from 'react';
import { Conversation, Message } from '../../types';
import { ChannelIcon } from '../common/ChannelIcon';
import { HandlerBadge, ConversationStatusBadge } from '../common/StatusIndicator';
import { 
  Send, 
  Bot, 
  UserCheck, 
  Sparkles, 
  CheckCheck, 
  Info,
  Zap,
  MoreVertical,
  Check
} from 'lucide-react';

interface ConversationViewProps {
  conversation: Conversation | null;
  messages: Message[];
  onSendMessage: (text: string) => void;
  onToggleHandler: (handler: 'bot' | 'human') => void;
  onUpdateStatus: (status: Conversation['status']) => void;
  onToggleSidebar?: () => void;
  showSidebar?: boolean;
}

export const ConversationView: React.FC<ConversationViewProps> = ({
  conversation,
  messages,
  onSendMessage,
  onToggleHandler,
  onUpdateStatus,
  onToggleSidebar,
  showSidebar,
}) => {
  const [inputText, setInputText] = useState('');
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-neutral-500">
        <Bot size={40} className="text-neutral-700 mb-3" />
        <p className="text-sm font-medium text-neutral-400">Selecione uma conversa para visualizar</p>
        <p className="text-xs text-neutral-600 mt-1 max-w-sm">
          A caixa de entrada unificada permite gerenciar Instagram, WhatsApp e Messenger em um só lugar.
        </p>
      </div>
    );
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const isHuman = conversation.handler === 'human';

  return (
    <div className="flex-1 flex flex-col h-full bg-[#08090d] min-w-0">
      {/* Active Conversation Top Bar */}
      <div className="px-6 py-3.5 border-b border-neutral-800/80 bg-neutral-950/80 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative">
            <img
              src={conversation.contact.avatarUrl}
              alt={conversation.contact.name}
              className="w-10 h-10 rounded-full object-cover border border-neutral-700"
              referrerPolicy="no-referrer"
            />
            <div className="absolute -bottom-1 -right-1">
              <ChannelIcon channel={conversation.channel} size={13} withBg />
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-neutral-100 truncate font-display">
                {conversation.contact.name}
              </h2>
              <span className="text-xs text-neutral-500 font-mono hidden sm:inline">
                {conversation.contact.username}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-0.5">
              <ConversationStatusBadge status={conversation.status} />
              <HandlerBadge handler={conversation.handler} assignedTo={conversation.assignedTo} size="sm" />
            </div>
          </div>
        </div>

        {/* Action Controls: Handoff & Status */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Bot vs Human Switcher Button */}
          <button
            onClick={() => onToggleHandler(isHuman ? 'bot' : 'human')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm ${
              isHuman
                ? 'bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/40'
                : 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40'
            }`}
            title={isHuman ? 'Devolver atendimento ao Bot de Automação' : 'Assumir atendimento como Operador Humano'}
          >
            {isHuman ? (
              <>
                <Bot size={14} className="text-cyan-400" />
                <span className="hidden sm:inline">Devolver ao Bot</span>
              </>
            ) : (
              <>
                <UserCheck size={14} className="text-indigo-400" />
                <span className="hidden sm:inline">Assumir Atendimento</span>
              </>
            )}
          </button>

          {/* Status Quick Dropdown */}
          <div className="relative">
            <button
              onClick={() => setStatusMenuOpen(!statusMenuOpen)}
              className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800 transition-colors cursor-pointer"
              title="Alterar Status da Conversa"
            >
              <MoreVertical size={16} />
            </button>

            {statusMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-neutral-900 border border-neutral-800 rounded-xl shadow-xl p-1.5 z-30 text-xs space-y-1">
                <div className="px-2 py-1 text-[10px] font-mono uppercase text-neutral-500">
                  Status da Conversa
                </div>
                {(['open', 'waiting_user', 'resolved', 'archived'] as Conversation['status'][]).map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      onUpdateStatus(st);
                      setStatusMenuOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between capitalize transition-colors cursor-pointer ${
                      conversation.status === st
                        ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                        : 'text-neutral-300 hover:bg-neutral-800'
                    }`}
                  >
                    <span>
                      {st === 'open' && 'Aberta'}
                      {st === 'waiting_user' && 'Aguardando Usuário'}
                      {st === 'resolved' && 'Resolvida'}
                      {st === 'archived' && 'Arquivada'}
                    </span>
                    {conversation.status === st && <Check size={13} className="text-cyan-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Toggle Sidebar Info Drawer */}
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                showSidebar
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200'
              }`}
              title="Ver detalhes do seguidor"
            >
              <Info size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Release 1 Notice */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono bg-neutral-900/80 border border-neutral-800 text-neutral-400">
            <Sparkles size={11} className="text-cyan-400" />
            Visualização de Conversa • Release 1 (Dados de Demonstração Estruturados)
          </div>
        </div>

        {messages.map((msg) => {
          if (msg.sender === 'system') {
            return (
              <div key={msg.id} className="flex justify-center my-3">
                <span className="text-[11px] font-mono text-neutral-400 bg-neutral-900/90 border border-neutral-800/80 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <Zap size={11} className="text-cyan-400" />
                  {msg.content}
                </span>
              </div>
            );
          }

          const isContact = msg.sender === 'contact';
          const isBot = msg.sender === 'bot';

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isContact ? 'items-start' : 'items-end'}`}
            >
              {/* Sender Label */}
              <span className="text-[10px] font-mono text-neutral-500 mb-1 px-1 flex items-center gap-1">
                {isContact && conversation.contact.name}
                {isBot && (
                  <>
                    <Bot size={11} className="text-cyan-400" />
                    <span>Bot Automação Casal Fabre</span>
                  </>
                )}
                {!isContact && !isBot && (
                  <>
                    <UserCheck size={11} className="text-indigo-400" />
                    <span>Atendente Fabre</span>
                  </>
                )}
                <span>• {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              </span>

              {/* Message Bubble */}
              <div
                className={`max-w-lg rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm ${
                  isContact
                    ? 'bg-neutral-800/90 text-neutral-100 border border-neutral-700/60 rounded-tl-sm'
                    : isBot
                    ? 'bg-cyan-950/40 text-cyan-100 border border-cyan-800/40 rounded-tr-sm'
                    : 'bg-indigo-950/50 text-indigo-100 border border-indigo-800/50 rounded-tr-sm'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>

                {msg.metadata?.automationName && (
                  <div className="mt-2 pt-2 border-t border-cyan-800/30 flex items-center gap-1 text-[10px] text-cyan-400 font-mono">
                    <Zap size={10} />
                    <span>Acionado por: {msg.metadata.automationName}</span>
                  </div>
                )}
              </div>

              {/* Status footer for outgoing */}
              {!isContact && (
                <div className="flex items-center gap-1 text-[10px] text-neutral-500 mt-0.5 px-1 font-mono">
                  <span>{msg.status}</span>
                  <CheckCheck size={12} className="text-cyan-400" />
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Composer */}
      <div className="p-4 border-t border-neutral-800/80 bg-neutral-950/90">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder={
                isHuman
                  ? 'Digite uma mensagem como atendente humano...'
                  : 'Digite para testar envio manual ou troque para Humano acima...'
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full px-4 py-2.5 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={!inputText.trim()}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              inputText.trim()
                ? 'bg-cyan-600 hover:bg-cyan-500 text-neutral-950 shadow-md shadow-cyan-950/40'
                : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
            }`}
          >
            <span>Enviar</span>
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
};
