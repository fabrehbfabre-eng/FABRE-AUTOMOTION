/**
 * FABRE AUTOMATION - Architecture Specification Modal
 * Release 7: Database Schema Activation & Persistence Certification
 */

import React from 'react';
import { Modal } from '../common/Modal';
import { ShieldCheck, CheckCircle2, Cpu, Server, Lock, Database, TableProperties } from 'lucide-react';

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
      title="Especificação Técnica • RELEASE 7"
      subtitle="Database Schema Activation, Auditoria Granular de 11 Tabelas e Certificação de Persistência PostgreSQL"
      maxWidth="2xl"
    >
      <div className="space-y-5 text-xs text-neutral-300 max-h-[70vh] overflow-y-auto pr-1">
        {/* Compliance Checklist Release 7 */}
        <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
          <h4 className="font-bold text-neutral-100 flex items-center gap-2 font-display">
            <ShieldCheck size={16} className="text-cyan-400" />
            Critérios e Entregáveis do Release 7
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div className="flex items-center gap-2 text-cyan-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Auditoria técnica da camada de persistência com 11 tabelas</span>
            </div>
            <div className="flex items-center gap-2 text-cyan-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Verificação granular de existência e contagem de linhas</span>
            </div>
            <div className="flex items-center gap-2 text-cyan-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Diferenciação clara: REACHABLE vs SCHEMA_READY vs INCOMPLETE</span>
            </div>
            <div className="flex items-center gap-2 text-cyan-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Guia de ativação do schema SQL em 6 passos documentado</span>
            </div>
            <div className="flex items-center gap-2 text-cyan-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Modo Mock preservado com integridade para demonstração</span>
            </div>
            <div className="flex items-center gap-2 text-cyan-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Isolamento total de secrets e chaves service_role no client</span>
            </div>
            <div className="flex items-center gap-2 text-cyan-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Zero Firebase, Zero Cloud Run, Zero dependências externas</span>
            </div>
            <div className="flex items-center gap-2 text-cyan-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Motor de IA mantido desativado de forma explícita</span>
            </div>
          </div>
        </div>

        {/* 11 Tables Schema Blueprint */}
        <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
          <h4 className="font-bold text-neutral-100 flex items-center gap-2 font-display">
            <TableProperties size={15} className="text-cyan-400" />
            Estrutura Oficial do Schema (11 Tabelas Relacionais)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] font-mono text-neutral-300">
            <p>1. public.profiles</p>
            <p>2. public.conversations</p>
            <p>3. public.messages</p>
            <p>4. public.automations</p>
            <p>5. public.automation_triggers</p>
            <p>6. public.automation_actions</p>
            <p>7. public.knowledge_items</p>
            <p>8. public.channel_connections</p>
            <p>9. public.contact_tags</p>
            <p>10. public.contact_tag_assignments</p>
            <p className="sm:col-span-2">11. public.contact_notes</p>
          </div>
        </div>

        {/* Security Isolation Hierarchy */}
        <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-800/40 space-y-2.5">
          <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs font-display">
            <Lock size={15} className="text-cyan-400" />
            <span>Matriz de Segurança e Secrets (Meta + Supabase)</span>
          </div>
          <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-[11px] font-mono text-neutral-300 leading-relaxed">
            <p className="text-cyan-400">CLIENTE / FRONTEND (Vite Bundle)</p>
            <p className="text-neutral-500 pl-4">↳ Apenas VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY</p>
            <p className="text-purple-400 pt-1">SERVER-SIDE / SUPABASE EDGE FUNCTIONS SECRETS</p>
            <p className="text-neutral-500 pl-4">↳ SUPABASE_SERVICE_ROLE_KEY, META_APP_SECRET, META_WEBHOOK_VERIFY_TOKEN, WHATSAPP_ACCESS_TOKEN, OPENAI_API_KEY</p>
          </div>
        </div>

        {/* Releases Roadmap */}
        <div className="space-y-2">
          <h4 className="font-bold text-neutral-100 flex items-center gap-2 font-display">
            <Cpu size={15} className="text-indigo-400" />
            Roadmap Incremental do Produto
          </h4>

          <div className="space-y-2">
            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-start gap-3 opacity-60">
              <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono font-bold text-[10px] shrink-0 mt-0.5">
                RELEASE 1-8
              </span>
              <div className="text-[11px]">
                <strong className="text-neutral-200 block">Fundação, Modelagem Relacional & Persistência 11 Tabelas</strong>
                <span className="text-neutral-400">Arquitetura de 3 camadas, 11 tabelas no schema, RLS, idempotência e Smoke Test.</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 flex items-start gap-3">
              <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono font-bold text-[10px] shrink-0 mt-0.5">
                RELEASE 9 (ATUAL)
              </span>
              <div className="text-[11px]">
                <strong className="text-neutral-200 block">Edge Functions Deployment Readiness & Server-Side Certification</strong>
                <span className="text-neutral-400">Auditoria server-side das 4 Edge Functions (health-check, meta-webhook, whatsapp-webhook, ai-completion), isolamento total de secrets e guia CLI.</span>
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


