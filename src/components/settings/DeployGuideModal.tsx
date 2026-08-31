import React, { useState } from 'react';
import { X, Copy, Check, Terminal, Shield, Key, ExternalLink, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { getSupabaseConfig } from '../../lib/supabase';
import { EdgeFunctionItemStatus } from '../../services/HealthCheckService';

interface DeployGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  functions?: EdgeFunctionItemStatus[];
  backendAvailable?: boolean;
}

export const DeployGuideModal: React.FC<DeployGuideModalProps> = ({
  isOpen,
  onClose,
  functions = [],
  backendAvailable = false,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const supabaseConfig = getSupabaseConfig();

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const projectRef = supabaseConfig.url
    ? supabaseConfig.url.replace(/^https?:\/\//, '').split('.')[0]
    : 'SEU_PROJECT_REF';

  const defaultFunctions: EdgeFunctionItemStatus[] = [
    {
      name: 'health-check',
      path: '/supabase/functions/health-check',
      endpoint: `${supabaseConfig.url || 'https://seu-projeto.supabase.co'}/functions/v1/health-check`,
      verifyJwt: false,
      status: backendAvailable ? 'deployed' : 'ready_for_deploy',
      description: 'Auditoria de conectividade com PostgreSQL, readiness e runtime Deno',
    },
    {
      name: 'meta-webhook',
      path: '/supabase/functions/meta-webhook',
      endpoint: `${supabaseConfig.url || 'https://seu-projeto.supabase.co'}/functions/v1/meta-webhook`,
      verifyJwt: false,
      status: backendAvailable ? 'deployed' : 'ready_for_deploy',
      description: 'Handshake de verificação Meta e ingestão com idempotência para Instagram Direct',
    },
    {
      name: 'whatsapp-webhook',
      path: '/supabase/functions/whatsapp-webhook',
      endpoint: `${supabaseConfig.url || 'https://seu-projeto.supabase.co'}/functions/v1/whatsapp-webhook`,
      verifyJwt: false,
      status: backendAvailable ? 'deployed' : 'ready_for_deploy',
      description: 'Handshake e ingestão de mensagens da WhatsApp Business Cloud API',
    },
    {
      name: 'ai-completion',
      path: '/supabase/functions/ai-completion',
      endpoint: `${supabaseConfig.url || 'https://seu-projeto.supabase.co'}/functions/v1/ai-completion`,
      verifyJwt: false,
      status: backendAvailable ? 'deployed' : 'ready_for_deploy',
      description: 'Pipeline de IA preparada (Explicitamente desativada na Release 6)',
    },
  ];

  const displayFunctions = functions.length > 0 ? functions : defaultFunctions;

  const cliCommands = `# 1. Autenticar no Supabase CLI
supabase login

# 2. Vincular ao seu projeto Supabase
supabase link --project-ref ${projectRef}

# 3. Publicar as 4 Edge Functions
supabase functions deploy health-check --no-verify-jwt
supabase functions deploy meta-webhook --no-verify-jwt
supabase functions deploy whatsapp-webhook --no-verify-jwt
supabase functions deploy ai-completion --no-verify-jwt`;

  const secretsCommand = `# Configurar secrets das Edge Functions no Supabase:
supabase secrets set \\
  SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..." \\
  META_APP_SECRET="sua_chave_secreta_meta" \\
  META_WEBHOOK_VERIFY_TOKEN="seu_token_de_verificacao" \\
  WHATSAPP_ACCESS_TOKEN="seu_token_whatsapp" \\
  OPENAI_API_KEY="sk-..."`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-800 bg-neutral-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Terminal size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-100 font-display flex items-center gap-2">
                Deploy das Supabase Edge Functions
              </h2>
              <p className="text-xs text-neutral-400">
                Guia oficial de publicação via Supabase CLI (Release 6 | FABRE AUTOMATION)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status Real da Camada Server-Side */}
          <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-neutral-300">ESTADO DAS EDGE FUNCTIONS</span>
              {backendAvailable ? (
                <span className="text-xs font-mono px-2.5 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 size={12} />
                  Publicado & Ativo
                </span>
              ) : (
                <span className="text-xs font-mono px-2.5 py-1 rounded bg-purple-950/60 text-purple-300 border border-purple-800/60 flex items-center gap-1.5 font-semibold">
                  <Clock size={12} />
                  Pronto para Deploy
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              O código das 4 Edge Functions está pronto e versionado no repositório em <code>/supabase/functions/</code>. Para que passem a responder no Supabase, execute o deploy através da Supabase CLI abaixo.
            </p>
          </div>

          {/* Functions Inventory Grid */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono font-bold text-neutral-300 uppercase">
              Inventário das Funções para Deploy Individual
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {displayFunctions.map((fn) => (
                <div key={fn.name} className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-purple-300">{fn.name}</span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-1 ${
                        fn.status === 'deployed'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-neutral-800 text-purple-300 border border-neutral-700'
                      }`}
                    >
                      {fn.status === 'deployed' ? 'Publicado' : 'Pronto para Deploy'}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 font-sans">{fn.description}</p>
                  <div className="flex items-center justify-between pt-1 border-t border-neutral-900 text-[10px] text-neutral-500 font-mono">
                    <span>verify_jwt: false</span>
                    <span>{fn.path}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Step-by-Step CLI Commands */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold text-neutral-300 uppercase">
                Comandos para Executar via Supabase CLI
              </h3>
              <button
                onClick={() => handleCopy(cliCommands, 'cli')}
                className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 font-mono cursor-pointer"
              >
                {copiedKey === 'cli' ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedKey === 'cli' ? 'Copiado!' : 'Copiar Comandos'}</span>
              </button>
            </div>
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 text-xs font-mono text-neutral-300 space-y-2 overflow-x-auto">
              <pre className="text-emerald-400">{cliCommands}</pre>
            </div>
          </div>

          {/* Secrets Setup */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold text-neutral-300 uppercase flex items-center gap-1.5">
                <Key size={14} className="text-cyan-400" />
                <span>Configuração de Secrets no Supabase</span>
              </h3>
              <button
                onClick={() => handleCopy(secretsCommand, 'secrets')}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono cursor-pointer"
              >
                {copiedKey === 'secrets' ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedKey === 'secrets' ? 'Copiado!' : 'Copiar Secrets'}</span>
              </button>
            </div>
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 text-xs font-mono text-neutral-300 space-y-2 overflow-x-auto">
              <pre className="text-cyan-400">{secretsCommand}</pre>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Você também pode cadastrar essas variáveis no painel do Supabase em: <strong>Project Settings &gt; Edge Functions &gt; Add Secret</strong>.
            </p>
          </div>

          {/* Security Notice */}
          <div className="p-4 rounded-xl bg-neutral-950 border border-cyan-800/40 text-xs text-neutral-300 space-y-1">
            <div className="flex items-center gap-2 text-cyan-300 font-bold font-display">
              <Shield size={15} />
              <span>Garantia de Isolamento de Chaves</span>
            </div>
            <p className="text-[11px] text-neutral-400">
              O frontend do FABRE AUTOMATION não possui acesso a nenhuma chave mestra. Toda comunicação autenticada de canais e webhooks é processada exclusivamente dentro dessas 4 Edge Functions.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950/80 flex items-center justify-between">
          <div className="text-xs text-neutral-500 font-mono">
            Configuração gerada em <code>supabase/config.toml</code>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
