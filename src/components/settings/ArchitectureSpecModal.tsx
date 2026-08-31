/**
 * FABRE AUTOMATION - Architecture Specification Modal
 * Release 6: Supabase Edge Functions Deployment
 */

import React from 'react';
import { Modal } from '../common/Modal';
import { ShieldCheck, CheckCircle2, Cpu, Server, Lock, Terminal, Radio } from 'lucide-react';

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
      title="Especificação Técnica • RELEASE 6"
      subtitle="Deploy das Supabase Edge Functions, Configuração CLI, Handshake de Canais e Diagnóstico de Conectividade"
      maxWidth="2xl"
    >
      <div className="space-y-5 text-xs text-neutral-300 max-h-[70vh] overflow-y-auto pr-1">
        {/* Compliance Checklist Release 6 */}
        <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
          <h4 className="font-bold text-neutral-100 flex items-center gap-2 font-display">
            <ShieldCheck size={16} className="text-emerald-400" />
            Critérios e Entregáveis do Release 6
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Arquivo supabase/config.toml configurado para CLI</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>4 Edge Functions preparadas para deploy individual</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Pasta _shared isolada de deploy avulso</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Compatibilidade estrita com runtime Deno</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Zero secrets no Git / frontend do cliente</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Health-check com auditoria de conectividade DB</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Meta & WhatsApp Webhooks com idempotência</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={13} className="shrink-0" />
              <span>Motor de IA explicitamente desativado nesta Release</span>
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
            <p className="text-purple-400 pt-1">SERVER-SIDE / SUPABASE EDGE FUNCTIONS SECRETS</p>
            <p className="text-neutral-500 pl-4">↳ SUPABASE_SERVICE_ROLE_KEY, META_APP_SECRET, META_WEBHOOK_VERIFY_TOKEN, WHATSAPP_ACCESS_TOKEN, OPENAI_API_KEY</p>
          </div>
        </div>

        {/* Edge Functions Matrix */}
        <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
          <h4 className="font-bold text-neutral-100 flex items-center gap-2 font-display">
            <Server size={15} className="text-purple-400" />
            Topologia das Edge Functions para Deploy
          </h4>
          <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] font-mono text-neutral-300 space-y-1.5">
            <p className="text-purple-300">1. /supabase/functions/health-check (GET - Diagnóstico PostgreSQL e Deno)</p>
            <p className="text-pink-300">2. /supabase/functions/meta-webhook (GET/POST - Handshake e Ingestão Instagram)</p>
            <p className="text-emerald-300">3. /supabase/functions/whatsapp-webhook (GET/POST - Handshake e Ingestão WhatsApp)</p>
            <p className="text-cyan-300">4. /supabase/functions/ai-completion (POST - Desativada com status seguro)</p>
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
                RELEASE 1
              </span>
              <div className="text-[11px]">
                <strong className="text-neutral-200 block">Foundation & Architecture</strong>
                <span className="text-neutral-400">Estrutura base, tipagem, serviços desacoplados e interface de alta fidelidade.</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-start gap-3 opacity-60">
              <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono font-bold text-[10px] shrink-0 mt-0.5">
                RELEASE 2
              </span>
              <div className="text-[11px]">
                <strong className="text-neutral-200 block">Supabase Persistence Foundation</strong>
                <span className="text-neutral-400">Schema relacional com 11 tabelas, Repository Pattern, RLS e chaveamento de provedores.</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-start gap-3 opacity-60">
              <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono font-bold text-[10px] shrink-0 mt-0.5">
                RELEASE 3
              </span>
              <div className="text-[11px]">
                <strong className="text-neutral-200 block">Secure Backend Foundation</strong>
                <span className="text-neutral-400">Isolamento de secrets, Edge Functions seguras, Webhook Normalizer e idempotência.</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-start gap-3 opacity-60">
              <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono font-bold text-[10px] shrink-0 mt-0.5">
                RELEASE 4
              </span>
              <div className="text-[11px]">
                <strong className="text-neutral-200 block">Supabase Activation & Backend Deployment</strong>
                <span className="text-neutral-400">Validação de persistência real, teste granular de schema, desativação explícita de IA e auditoria de segurança.</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-start gap-3 opacity-60">
              <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono font-bold text-[10px] shrink-0 mt-0.5">
                RELEASE 5
              </span>
              <div className="text-[11px]">
                <strong className="text-neutral-200 block">Instagram Real Message Ingestion</strong>
                <span className="text-neutral-400">Recebimento e normalização de mensagens reais do Instagram Direct via Meta Webhook, handshake seguro e idempotência.</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 flex items-start gap-3">
              <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono font-bold text-[10px] shrink-0 mt-0.5">
                RELEASE 6 (ATUAL)
              </span>
              <div className="text-[11px]">
                <strong className="text-neutral-200 block">Supabase Edge Functions Deployment</strong>
                <span className="text-neutral-400">Preparação e configuração de deploy oficial via Supabase CLI (config.toml, deploy.sh), isolamento Deno, verificação de segredos e monitoramento de status real.</span>
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


