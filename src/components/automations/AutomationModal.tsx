/**
 * FABRE AUTOMATION - Create/Edit Automation Modal
 * Release 2: Supabase Persistence Foundation
 */

import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Automation, ChannelType, AutomationTriggerType, AutomationActionType } from '../../types';
import { Zap, ArrowRight } from 'lucide-react';

interface AutomationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Automation, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'>) => void;
  initialData?: Automation | null;
}

export const AutomationModal: React.FC<AutomationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [channel, setChannel] = useState<ChannelType | 'all'>(initialData?.channel || 'instagram');
  const [triggerType, setTriggerType] = useState<AutomationTriggerType>(initialData?.trigger.type || 'keyword_direct');
  const [keywords, setKeywords] = useState(initialData?.trigger.config.keywords?.join(', ') || 'INFO');
  const [messageText, setMessageText] = useState(initialData?.actions[0]?.config.messageText || '');
  const [tagName, setTagName] = useState(initialData?.actions[1]?.config.tagName || 'Interesse-Info');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const keywordsArray = keywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    const data: Omit<Automation, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'> = {
      title,
      description,
      channel,
      enabled: initialData ? initialData.enabled : true,
      trigger: {
        type: triggerType,
        name: triggerType === 'keyword_direct' 
          ? 'Palavra-chave recebida no Direct' 
          : triggerType === 'comment_post' 
          ? 'Comentário em publicação no feed'
          : 'Primeiro contato no canal',
        description: `Gatilho acionado por: ${keywordsArray.join(', ')}`,
        config: {
          keywords: keywordsArray,
          matchType: 'contains',
        },
      },
      actions: [
        {
          id: `act_${Date.now()}_1`,
          type: 'send_message' as AutomationActionType,
          name: 'Enviar Resposta Automática',
          description: 'Envia mensagem personalizada configurada',
          config: {
            messageText,
          },
        },
        ...(tagName.trim() ? [{
          id: `act_${Date.now()}_2`,
          type: 'add_tag' as AutomationActionType,
          name: 'Adicionar Etiqueta ao Contato',
          description: `Aplica tag [${tagName.trim()}]`,
          config: {
            tagName: tagName.trim(),
          },
        }] : []),
      ],
    };

    onSave(data);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Editar Regra de Automação' : 'Nova Regra de Automação'}
      subtitle="Configure o gatilho (Quando acontecer X) e as ações correspondentes (Faça Y)"
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Rule Title & Channel */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">
              Nome da Regra
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Resposta Automática por Palavra-Chave 'INFO'"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">
              Canal
            </label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as ChannelType | 'all')}
              className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 focus:outline-none focus:border-cyan-500/50"
            >
              <option value="instagram">Instagram</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="messenger">Messenger</option>
              <option value="all">Todos os Canais</option>
            </select>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-300">
            Descrição / Objetivo
          </label>
          <input
            type="text"
            placeholder="Ex: Envia orientações e link do canal quando o seguidor solicitar informações"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        {/* TRIGGER SETUP */}
        <div className="p-4 rounded-xl bg-neutral-950/80 border border-cyan-500/20 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400 font-display">
            <Zap size={14} />
            <span>1. Gatilho (Quando acontecer...)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-neutral-400">Tipo de Evento</label>
              <select
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value as AutomationTriggerType)}
                className="w-full px-3 py-2 text-xs bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-none focus:border-cyan-500/50"
              >
                <option value="keyword_direct">Mensagem no Direct com Palavra-Chave</option>
                <option value="comment_post">Comentário em Post com Palavra-Chave</option>
                <option value="story_reply">Resposta ao Story</option>
                <option value="first_contact">Primeiro Contato (Boas-Vindas)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-neutral-400">Palavras-chave (separadas por vírgula)</label>
              <input
                type="text"
                placeholder="INFO, info, informacoes"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-none focus:border-cyan-500/50 font-mono"
              />
            </div>
          </div>
        </div>

        {/* ACTIONS SETUP */}
        <div className="p-4 rounded-xl bg-neutral-950/80 border border-emerald-500/20 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 font-display">
            <ArrowRight size={14} />
            <span>2. Ações (Faça o seguinte...)</span>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] text-neutral-400">Mensagem de Resposta Automática</label>
              <textarea
                rows={3}
                required
                placeholder="Olá! Agradecemos sua mensagem. Seguem as informações oficiais..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-none focus:border-emerald-500/50 resize-none font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-neutral-400">Adicionar Etiqueta ao Seguidor (Opcional)</label>
              <input
                type="text"
                placeholder="Interesse-Info"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-none focus:border-emerald-500/50 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-xl text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-semibold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-neutral-950 transition-colors cursor-pointer shadow-md shadow-cyan-950/40"
          >
            {initialData ? 'Atualizar Regra' : 'Criar Regra'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
