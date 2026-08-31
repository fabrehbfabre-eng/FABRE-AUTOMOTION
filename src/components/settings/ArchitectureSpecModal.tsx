/**
 * FABRE AUTOMATION - Architecture Specification Modal
 * Release 2: Supabase Persistence Foundation
 */

import React from 'react';
import { Modal } from '../common/Modal';
import { ShieldCheck, Layers, CheckCircle2, Database, Cpu, Bot } from 'lucide-react';

interface ArchitectureSpecModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchitectureSpecModal: React.FC<ArchitectureSpecModalProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Especificação Técnica • RELEASE 2"
      subtitle="Fundação de Persistência Supabase PostgreSQL e Repositórios Desacoplados"
      maxWidth="2xl"
    >
      <div className="space-y-5 text-xs text-neutral-300 max-h-[70vh] overflow-y-auto pr-1">
        {/* Compliance Checklist */}
        <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
          <h4 className="font-bold text-neutral-100 flex items-center gap-2 font-display">
            <ShieldCheck size={16} className="text-emerald-400" />
            Diretrizes Arquiteturais do Release 2
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Supabase PostgreSQL como banco oficial</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Padrão Repository & Provider desacoplado</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Chaveamento automático (Supabase vs Mock Demo)</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Row Level Security (RLS) habilitado em 11 tabelas</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Chaves secretas isoladas em Edge Functions</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Sanitização completa: nenhum dado falso oficial</span>
            </div>
          </div>
        </div>

        {/* Modules Structure */}
        <div className="space-y-2">
          <h4 className="font-bold text-neutral-100 flex items-center gap-2 font-display">
            <Layers size={15} className="text-cyan-400" />
            Estrutura de Repositórios & Provedores
          </h4>

          <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800/80 font-mono text-[11px] space-y-1.5 text-neutral-400 leading-relaxed">
            <p><span className="text-emerald-400 font-bold">/supabase/schema.sql</span> • Schema relacional PostgreSQL com 11 tabelas, índices e RLS</p>
            <p><span className="text-cyan-400 font-bold">/src/services/repositories</span> • Contratos agnósticos de repositório (IConversation, IAutomation, etc.)</p>
            <p><span className="text-cyan-400 font-bold">/src/services/repositories/supabase</span> • Implementação oficial sobre o client Supabase</p>
            <p><span className="text-cyan-400 font-bold">/src/services/repositories/mock</span> • Implementação em memória/localStorage para Modo Demo</p>
            <p><span className="text-purple-400 font-bold">/supabase/functions</span> • Edge Functions Deno para Webhooks e AI Completion com chaves secretas</p>
          </div>
        </div>

        {/* Releases Roadmap */}
        <div className="space-y-2">
          <h4 className="font-bold text-neutral-100 flex items-center gap-2 font-display">
            <Cpu size={15} className="text-indigo-400" />
            Roadmap Incremental do Produto
          </h4>

          <div className="space-y-2">
            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-start gap-3">
              <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono font-bold text-[10px] shrink-0 mt-0.5">
                RELEASE 1 (CONCLUÍDO)
              </span>
              <div className="text-[11px]">
                <strong className="text-neutral-200 block">Foundation & Architecture</strong>
                <span className="text-neutral-400">Estrutura base, tipagem, serviços desacoplados e interface de alta fidelidade.</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-start gap-3">
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold text-[10px] shrink-0 mt-0.5">
                RELEASE 2 (ATUAL)
              </span>
              <div className="text-[11px]">
                <strong className="text-neutral-200 block">Supabase Persistence Foundation</strong>
                <span className="text-neutral-400">Banco oficial Supabase PostgreSQL, schema relacional, padrão Repository/Provider, RLS e sanitização de dados.</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-start gap-3">
              <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono font-bold text-[10px] shrink-0 mt-0.5">
                RELEASE 3
              </span>
              <div className="text-[11px]">
                <strong className="text-neutral-200 block">Meta & WhatsApp Cloud APIs</strong>
                <span className="text-neutral-400">Webhooks oficiais, envio de mensagens e integração com Instagram Direct, Messenger e WhatsApp.</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-start gap-3">
              <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono font-bold text-[10px] shrink-0 mt-0.5">
                RELEASE 4
              </span>
              <div className="text-[11px]">
                <strong className="text-neutral-200 block">AI Engine & Knowledge RAG</strong>
                <span className="text-neutral-400">Embeddings vetoriais no Supabase (pgvector), OpenAI API e fallback inteligente para atendimento humano.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Close Button */}
        <div className="flex justify-end pt-2 border-t border-neutral-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </Modal>
  );
};
