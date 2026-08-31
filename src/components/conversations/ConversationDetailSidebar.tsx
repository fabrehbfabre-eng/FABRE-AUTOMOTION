/**
 * FABRE AUTOMATION - Contact Detail Drawer / Sidebar
 */

import React from 'react';
import { Conversation } from '../../types';
import { ChannelIcon } from '../common/ChannelIcon';
import { Badge } from '../common/Badge';
import { 
  User, 
  Phone, 
  Calendar, 
  Tag, 
  FileText, 
  X,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';

interface ConversationDetailSidebarProps {
  conversation: Conversation | null;
  onClose: () => void;
}

export const ConversationDetailSidebar: React.FC<ConversationDetailSidebarProps> = ({
  conversation,
  onClose,
}) => {
  if (!conversation) return null;

  const { contact } = conversation;

  return (
    <div className="w-80 border-l border-neutral-800/80 bg-neutral-950/90 flex flex-col h-full shrink-0 overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-neutral-800/80 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 font-mono">
          Detalhes do Contato
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-5 space-y-6">
        {/* Profile Card */}
        <div className="text-center space-y-2 pb-4 border-b border-neutral-800/60">
          <div className="relative inline-block">
            <img
              src={contact.avatarUrl}
              alt={contact.name}
              className="w-16 h-16 rounded-full object-cover border-2 border-neutral-700 mx-auto shadow-md"
              referrerPolicy="no-referrer"
            />
            <div className="absolute bottom-0 right-0">
              <ChannelIcon channel={contact.channel} size={16} withBg />
            </div>
          </div>
          <h4 className="text-sm font-bold text-neutral-100 font-display">{contact.name}</h4>
          <p className="text-xs text-neutral-400 font-mono">{contact.username}</p>
        </div>

        {/* Contact Info */}
        <div className="space-y-3">
          <span className="text-[11px] font-mono uppercase text-neutral-500 font-semibold block">
            Dados de Identificação
          </span>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-900/60 border border-neutral-800">
              <span className="text-neutral-400 flex items-center gap-2">
                <User size={13} className="text-neutral-500" />
                Canal de Origem
              </span>
              <span className="font-semibold text-neutral-200 uppercase text-[10px] font-mono">
                {contact.channel}
              </span>
            </div>

            {contact.phone && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-900/60 border border-neutral-800">
                <span className="text-neutral-400 flex items-center gap-2">
                  <Phone size={13} className="text-neutral-500" />
                  Telefone
                </span>
                <span className="font-mono text-neutral-200 text-xs">{contact.phone}</span>
              </div>
            )}

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-900/60 border border-neutral-800">
              <span className="text-neutral-400 flex items-center gap-2">
                <Calendar size={13} className="text-neutral-500" />
                Primeiro Contato
              </span>
              <span className="text-neutral-300 font-mono text-[11px]">
                {new Date(contact.createdAt).toLocaleDateString('pt-BR')}
              </span>
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <span className="text-[11px] font-mono uppercase text-neutral-500 font-semibold block flex items-center gap-1.5">
            <Tag size={12} />
            Etiquetas & Segmentação
          </span>

          <div className="flex flex-wrap gap-1.5">
            {contact.tags.map((tag) => (
              <Badge key={tag} variant="primary" size="sm">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        {/* Internal Notes */}
        <div className="space-y-2">
          <span className="text-[11px] font-mono uppercase text-neutral-500 font-semibold block flex items-center gap-1.5">
            <FileText size={12} />
            Observações da Equipe
          </span>

          <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 leading-relaxed">
            {contact.notes || 'Nenhuma anotação registrada para este seguidor.'}
          </div>
        </div>

        {/* Action Handoff Status Note */}
        <div className="p-3.5 rounded-xl bg-neutral-900/40 border border-neutral-800/80 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
            <ShieldAlert size={14} className="text-cyan-400" />
            <span>Controle de Atendimento</span>
          </div>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            Quando o atendimento humano é ativado, o robô interrompe respostas automáticas até ser devolvido manualmente.
          </p>
        </div>
      </div>
    </div>
  );
};
