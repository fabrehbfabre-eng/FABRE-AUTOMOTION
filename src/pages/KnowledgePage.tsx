/**
 * FABRE AUTOMATION - Knowledge Base Page
 * Release 1: Foundation & Architecture
 */

import React, { useState } from 'react';
import { KnowledgeCard } from '../components/knowledge/KnowledgeCard';
import { KnowledgeModal } from '../components/knowledge/KnowledgeModal';
import { useKnowledge } from '../hooks/useKnowledge';
import { KnowledgeCategory, KnowledgeItem } from '../types';
import { 
  BookOpen, 
  Plus, 
  Search, 
  ShoppingBag, 
  DollarSign, 
  HelpCircle, 
  User, 
  ShieldAlert, 
  Volume2, 
  Link as LinkIcon,
  Sparkles,
  Bot
} from 'lucide-react';

export const KnowledgePage: React.FC = () => {
  const {
    items,
    loading,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    createItem,
    updateItem,
    deleteItem,
  } = useKnowledge();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);

  const categories: { id: KnowledgeCategory | 'all'; label: string; icon: React.ElementType }[] = [
    { id: 'all', label: 'Todos os Tópicos', icon: BookOpen },
    { id: 'product', label: 'Produtos & Mentoria', icon: ShoppingBag },
    { id: 'price', label: 'Valores e Preços', icon: DollarSign },
    { id: 'profile', label: 'Sobre Casal Fabre', icon: User },
    { id: 'rules', label: 'Regras de Atendimento', icon: ShieldAlert },
    { id: 'tone', label: 'Tom de Voz', icon: Volume2 },
    { id: 'faq', label: 'Perguntas Frequentes', icon: HelpCircle },
    { id: 'link', label: 'Links Oficiais', icon: LinkIcon },
  ];

  const handleOpenCreate = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: KnowledgeItem) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleSave = async (data: Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingItem) {
      await updateItem(editingItem.id, data);
    } else {
      await createItem(data);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-100 font-display flex items-center gap-2.5">
            <BookOpen size={22} className="text-purple-400" />
            Base de Conhecimento
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Informações oficiais, produtos, valores e diretrizes que a IA consultará para responder com precisão e segurança.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-neutral-100 transition-colors flex items-center gap-2 shadow-lg shadow-purple-950/40 cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <Plus size={16} />
          <span>Novo Item de Conhecimento</span>
        </button>
      </div>

      {/* Release 1 IA Context Note */}
      <div className="p-4 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 text-neutral-300">
          <Bot size={16} className="text-purple-400 shrink-0" />
          <span>
            <strong>Release 1:</strong> Estrutura de tópicos, prioridades e modelos TypeScript prontos. No <strong>Release 3</strong>, estes tópicos serão convertidos em Embeddings para o motor RAG da OpenAI.
          </span>
        </div>
        <span className="text-[11px] font-mono text-purple-400 bg-purple-950/80 px-2.5 py-1 rounded-full border border-purple-800/40 shrink-0">
          RAG Ready
        </span>
      </div>

      {/* Category Pills & Search Bar */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Pesquisar por tópicos, produtos, preços, regras ou tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-purple-500/50"
          />
        </div>

        {/* Category horizontal selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-xl whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold'
                    : 'bg-neutral-900/60 text-neutral-400 border border-neutral-800 hover:text-neutral-200'
                }`}
              >
                <Icon size={12} className={isSelected ? 'text-purple-400' : 'text-neutral-500'} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Knowledge Cards Grid */}
      {loading ? (
        <div className="p-8 text-center text-xs text-neutral-500 font-mono">
          Carregando base de conhecimento...
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-neutral-800/80 bg-neutral-900/30 space-y-3">
          <BookOpen size={32} className="mx-auto text-neutral-600" />
          <h3 className="text-sm font-semibold text-neutral-200">Nenhum tópico encontrado</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            Cadastre os primeiros produtos, regras e links para orientar as respostas da automação.
          </p>
          <button
            onClick={handleOpenCreate}
            className="mt-2 px-4 py-2 rounded-xl text-xs font-medium bg-neutral-800 text-neutral-200 border border-neutral-700 hover:bg-neutral-700 transition-colors cursor-pointer"
          >
            Adicionar Tópico Agora
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <KnowledgeCard
              key={item.id}
              item={item}
              onEdit={handleOpenEdit}
              onDelete={deleteItem}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <KnowledgeModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        initialData={editingItem}
      />
    </div>
  );
};
