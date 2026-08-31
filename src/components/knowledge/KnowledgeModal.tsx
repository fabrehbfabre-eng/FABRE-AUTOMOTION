/**
 * FABRE AUTOMATION - Create/Edit Knowledge Item Modal
 * Release 2: Supabase Persistence Foundation
 */

import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { KnowledgeItem, KnowledgeCategory } from '../../types';

interface KnowledgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  initialData?: KnowledgeItem | null;
}

export const KnowledgeModal: React.FC<KnowledgeModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [title, setTitle] = useState(initialData?.title || '');
  const [category, setCategory] = useState<KnowledgeCategory>(initialData?.category || 'product');
  const [content, setContent] = useState(initialData?.content || '');
  const [tags, setTags] = useState(initialData?.tags.join(', ') || 'atendimento, informacoes');
  const [priority, setPriority] = useState(initialData?.priority || 1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const tagsArray = tags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    onSave({
      title,
      category,
      content,
      tags: tagsArray,
      isActive: true,
      priority: Number(priority),
      isOfficial: true,
    });

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Editar Item de Conhecimento' : 'Novo Item na Base de Conhecimento'}
      subtitle="Cadastre informações oficiais que a IA e a equipe consultarão para responder com segurança"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-300">
            Título do Tópico
          </label>
          <input
            type="text"
            required
            placeholder="Ex: Diretrizes Oficiais de Atendimento"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        {/* Category & Priority */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">
              Categoria
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as KnowledgeCategory)}
              className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 focus:outline-none focus:border-cyan-500/50"
            >
              <option value="product">Produtos / Treinamentos</option>
              <option value="price">Valores e Formas de Pagamento</option>
              <option value="faq">Perguntas Frequentes (FAQ)</option>
              <option value="profile">Institucional / Apresentação</option>
              <option value="rules">Regras de Atendimento / Transbordo</option>
              <option value="tone">Tom de Comunicação</option>
              <option value="commercial">Orientações Comerciais</option>
              <option value="link">Links Oficiais Validados</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">
              Prioridade da Informação
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 focus:outline-none focus:border-cyan-500/50"
            >
              <option value={1}>P1 - Alta Prioridade (Frequente)</option>
              <option value={2}>P2 - Média Prioridade</option>
              <option value={3}>P3 - Contextual / Específico</option>
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-300">
            Conteúdo Detalhado (Instrução para a IA e Operadores)
          </label>
          <textarea
            rows={5}
            required
            placeholder="Descreva detalhadamente as diretrizes, procedimentos ou regras oficiais..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-cyan-500/50 resize-none font-sans leading-relaxed"
          />
        </div>

        {/* Tags */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-300">
            Etiquetas / Palavras-chave (separadas por vírgula)
          </label>
          <input
            type="text"
            placeholder="diretrizes, atendimento, suporte"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-cyan-500/50 font-mono"
          />
        </div>

        {/* Footer actions */}
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
            {initialData ? 'Salvar Alterações' : 'Salvar no Conhecimento Oficial'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
