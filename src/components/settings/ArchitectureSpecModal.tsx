/**
 * FABRE AUTOMATION - Architecture Specification Modal
 * Release 5: Instagram Real Message Ingestion
 */

import React from 'react';
import { Modal } from '../common/Modal';
import { ShieldCheck, CheckCircle2, Cpu, Server, Lock, AlertTriangle, Radio } from 'lucide-react';

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
      title="Especificação Técnica • RELEASE 5"
      subtitle="Ingestão Real do Instagram Direct, Validação Webhook, Idempotência e Persistência no PostgreSQL"
      maxWidth="2xl"
    >
      <div className="space-y-5 text-xs text-neutral-300 max-h-[70vh] overflow-y-auto pr-1">
        {/* Compliance Checklist Release 5 */}
        <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
          <h4 className="font-bold text-neutral-100 flex items-center gap-2 font-display">
            <ShieldCheck size={16} className="text-emerald-400" />
            Critérios e Entregáveis do Release 5
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Handshake GET (hub.verify_token) validado</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Ingestão POST (x-hub-signature-256 HMAC-SHA256)</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Normalização agnóstica para NormalizedIncomingMessage</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Idempotência garantida via external_event_id</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Upsert de Perfil e Conversa no PostgreSQL</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Inserção de mensagem (sender: contact = Seguidor)</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Sem resposta externa ao Instagram (Ingestão Somente)</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Sem IA/OpenAI ativa e sem vazamento de secrets</span>
            </div>
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
            <p className="text-purple-400 pt-1">SERVER-SIDE / EDGE FUNCTIONS ENVIRONMENT</p>
            <p className="text-neutral-500 pl-4">↳ META_APP_SECRET, META_ACCESS_TOKEN, META_WEBHOOK_VERIFY_TOKEN, SUPABASE_SERVICE_ROLE_KEY</p>
          </div>
        </div>

        {/* Flow Architecture Diagram */}
        <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
          <h4 className="font-bold text-neutral-100 flex items-center gap-2 font-display">
            <Radio size={15} className="text-pink-400" />
            Pipeline de Ingestão Instagram Direct
          </h4>
          <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] font-mono text-neutral-300 space-y-1">
            <p className="text-pink-300">Instagram Direct (Seguidor envia DM)</p>
            <p className="text-neutral-500">↓ Webhook HTTPS POST</p>
            <p className="text-purple-300">Supabase Edge Function (/functions/v1/meta-webhook)</p>
            <p className="text-neutral-500">↓ Validação HMAC-SHA256 (META_APP_SECRET)</p>
            <p className="text-cyan-300">WebhookNormalizer (Extrai IGSID, Texto, Mídia e EventId)</p>
            <p className="text-neutral-500">↓ Verificação de Idempotência (external_event_id UNIQUE)</p>
            <p className="text-emerald-300">PostgreSQL (Profiles → Conversations → Messages: contact)</p>
            <p className="text-neutral-500">↓ Consulta Reativa</p>
            <p className="text-neutral-200">Caixa de Entrada Unificada (Inbox Operacional)</p>
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
                RELEASE 1 (CONCLUÍDO)
              </span>
              <div className="text-[11px]">
                <strong className="text-neutral-200 block">Foundation & Architecture</strong>
                <span className="text-neutral-400">Estrutura base, tipagem, serviços desacoplados e interface de alta fidelidade.</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-start gap-3 opacity-60">
              <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono font-bold text-[10px] shrink-0 mt-0.5">
                RELEASE 2 (CONCLUÍDO)
              </span>
              <div className="text-[11px]">
                <strong className="text-neutral-200 block">Supabase Persistence Foundation</strong>
                <span className="text-neutral-400">Schema relacional com 11 tabelas, Repository Pattern, RLS e chaveamento de provedores.</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-start gap-3 opacity-60">
              <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono font-bold text-[10px] shrink-0 mt-0.5">
                RELEASE 3 (CONCLUÍDO)
              </span>
              <div className="text-[11px]">
                <strong className="text-neutral-200 block">Secure Backend Foundation</strong>
                <span className="text-neutral-400">Isolamento de secrets, Edge Functions seguras, Webhook Normalizer e idempotência.</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-start gap-3 opacity-60">
              <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono font-bold text-[10px] shrink-0 mt-0.5">
                RELEASE 4 (CONCLUÍDO)
              </span>
              <div className="text-[11px]">
                <strong className="text-neutral-200 block">Supabase Activation & Backend Deployment</strong>
                <span className="text-neutral-400">Validação de persistência real, teste granular de schema, desativação explícita de IA e auditoria de segurança.</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-pink-950/20 border border-pink-500/30 flex items-start gap-3">
              <span className="px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 font-mono font-bold text-[10px] shrink-0 mt-0.5">
                RELEASE 5 (ATUAL)
              </span>
              <div className="text-[11px]">
                <strong className="text-neutral-200 block">Instagram Real Message Ingestion</strong>
                <span className="text-neutral-400">Recebimento e normalização de mensagens reais do Instagram Direct via Meta Webhook, handshake seguro, idempotência estrita e exibição na Caixa de Entrada.</span>
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

