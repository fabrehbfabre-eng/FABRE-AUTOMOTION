/**
 * FABRE AUTOMATION - Knowledge Base Item Card
 * Release 2: Supabase Persistence Foundation
 */

import React from 'react';
import { KnowledgeItem, KnowledgeCategory } from '../../types';
import { 
  BookOpen, 
  Tag, 
  Edit3, 
  Trash2, 
  DollarSign, 
  ShoppingBag, 
  HelpCircle, 
  User, 
  ShieldAlert, 
  Volume2, 
  Briefcase, 
  Link as LinkIcon,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface KnowledgeCardProps {
  item: KnowledgeItem;
  onEdit: (item: KnowledgeItem) => void;
  onDelete: (id: string) => void;
}

export const KnowledgeCard: React.FC<KnowledgeCardProps> = ({
  item,
  onEdit,
  onDelete,
}) => {
  const categoryConfig: Record<
    KnowledgeCategory,
    { label: string; icon: React.ElementType; color: 'cyan' | 'purple' | 'success' | 'warning' | 'info' | 'default' }
  > = {
    product: { label: 'Produtos / Treinamentos', icon: ShoppingBag, color: 'cyan' },
    price: { label: 'Tabela de Valores', icon: DollarSign, color: 'success' },
    faq: { label: 'Perguntas Frequentes (FAQ)', icon: HelpCircle, color: 'info' },
    profile: { label: 'Institucional', icon: User, color: 'purple' },
    rules: { label: 'Regras de Atendimento', icon: ShieldAlert, color: 'warning' },
    tone: { label: 'Tom de Comunicação', icon: Volume2, color: 'purple' },
    commercial: { label: 'Orientações Comerciais', icon: Briefcase, color: 'info' },
    link: { label: 'Links Oficiais', icon: LinkIcon, color: 'cyan' },
  };

  const cat = categoryConfig[item.category] || { label: item.category, icon: BookOpen, color: 'default' };
  const Icon = cat.icon;
  const isOfficial = item.isOfficial !== false;

  return (
    <div className="rounded-2xl border border-neutral-800/90 bg-neutral-900/50 p-5 hover:border-neutral-700/80 transition-all flex flex-col justify-between space-y-4">
      <div className="space-y-3">
        {/* Header: Category, Status & Priority */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-300">
              <Icon size={14} className="text-cyan-400" />
            </div>
            <span className="text-xs font-semibold text-neutral-300 font-mono">
              {cat.label}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {isOfficial ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 font-semibold">
                <CheckCircle2 size={10} className="text-emerald-400" />
                Oficial
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60">
                <AlertTriangle size={10} className="text-amber-400" />
                Demonstração
              </span>
            )}

            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800/80 text-neutral-400 border border-neutral-700">
              P{item.priority}
            </span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-sm font-bold text-neutral-100 font-display">
          {item.title}
        </h3>

        {/* Content */}
        <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800/80 text-xs text-neutral-300 leading-relaxed font-sans">
          {item.content}
        </div>

        {/* Tags */}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Tag size={11} className="text-neutral-500" />
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700/60"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-neutral-800/60 text-[11px] text-neutral-500">
        <span className="font-mono">
          Atualizado em: {new Date(item.updatedAt).toLocaleDateString('pt-BR')}
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(item)}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Editar Item de Conhecimento"
          >
            <Edit3 size={14} />
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
            title="Excluir Item"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
