/**
 * FABRE AUTOMATION - Architecture Specification Modal
 */

import React from 'react';
import { Modal } from '../common/Modal';
import { ShieldCheck, Layers, CheckCircle2, XCircle, ArrowRight, Database, Cpu, Bot } from 'lucide-react';

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
      title="Especificação Técnica • RELEASE 1"
      subtitle="Fundação, arquitetura desacoplada e roadmap do FABRE AUTOMATION"
      maxWidth="2xl"
    >
      <div className="space-y-5 text-xs text-neutral-300 max-h-[70vh] overflow-y-auto pr-1">
        {/* Compliance Checklist */}
        <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
          <h4 className="font-bold text-neutral-100 flex items-center gap-2 font-display">
            <ShieldCheck size={16} className="text-emerald-400" />
            Diretrizes Arquiteturais do Release 1
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Sem Firebase / Firestore</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Sem banco proprietário Google</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Sem n8n ou Fabre AI legado</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>TypeScript estrito e modular</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Serviços desacoplados via interfaces</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Sem armazenamento de chaves reais</span>
            </div>
          </div>
        </div>

        {/* Modules Structure */}
        <div className="space-y-2">
          <h4 className="font-bold text-neutral-100 flex items-center gap-2 font-display">
            <Layers size={15} className="text-cyan-400" />
            Estrutura de Módulos & Camadas
          </h4>

          <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800/80 font-mono text-[11px] space-y-1 text-neutral-400 leading-relaxed">
            <p><span className="text-cyan-400 font-bold">/src/types</span> • Modelos tipados (User, Conversation, Message, Automation, Knowledge, etc.)</p>
            <p><span className="text-cyan-400 font-bold">/src/services</span> • Contratos de serviços (Conversation, Automation, Knowledge, AI, Meta, WhatsApp)</p>
            <p><span className="text-cyan-400 font-bold">/src/hooks</span> • State handlers reativos (useConversations, useAutomations, useKnowledge)</p>
            <p><span className="text-cyan-400 font-bold">/src/components</span> • UI components modulares e reutilizáveis (Layout, Cards, Badges, Modals)</p>
            <p><span className="text-cyan-400 font-bold">/src/pages</span> • Páginas da aplicação (Dashboard, Conversas, Automações, Conhecimento, Configurações)</p>
          </div>
        </div>

        {/* Releases Roadmap */}
        <div className="space-y-2">
          <h4 className="font-bold text-neutral-100 flex items-center gap-2 font-display">
            <Cpu size={15} className="text-indigo-400" />
            Roadmap Incremental do Produto
          </h4>

          <div className="space-y-2">
            <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/30 flex items-start gap-3">
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold text-[10px] shrink-0 mt-0.5">
                RELEASE 1 (ATUAL)
              </span>
              <div className="text-[11px]">
                <strong className="text-neutral-200 block">Foundation & Architecture</strong>
                <span className="text-neutral-400">Estrutura base, tipagem, serviços mockados desacoplados, UI completa em modo escuro de alta fidelidade.</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-start gap-3">
              <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono font-bold text-[10px] shrink-0 mt-0.5">
                RELEASE 2
              </span>
              <div className="text-[11px]">
                <strong className="text-neutral-200 block">Meta & WhatsApp Cloud APIs</strong>
                <span className="text-neutral-400">Webhooks oficiais, envio de mensagens e integração com Instagram Direct, Messenger e WhatsApp.</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-start gap-3">
              <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono font-bold text-[10px] shrink-0 mt-0.5">
                RELEASE 3
              </span>
              <div className="text-[11px]">
                <strong className="text-neutral-200 block">AI Engine & Knowledge RAG</strong>
                <span className="text-neutral-400">Conexão com OpenAI API, consulta vetorial à base de conhecimento do Casal Fabre e fallback inteligente para atendimento humano.</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-start gap-3">
              <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono font-bold text-[10px] shrink-0 mt-0.5">
                RELEASE 4
              </span>
              <div className="text-[11px]">
                <strong className="text-neutral-200 block">Supabase & Cloud Hosting</strong>
                <span className="text-neutral-400">Persistência relacional PostgreSQL independente, autenticação de operadores e deploy de baixo custo.</span>
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
