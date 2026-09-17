import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  PhoneCall,
  MessageSquare,
  ArrowRight,
  Info,
} from 'lucide-react';
import { whatsAppE2ETestService, WhatsAppE2EResult } from '../../services/WhatsAppE2ETestService';

interface WhatsAppE2ETestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToInbox?: (conversationId: string) => void;
}

export const WhatsAppE2ETestModal: React.FC<WhatsAppE2ETestModalProps> = ({
  isOpen,
  onClose,
  onNavigateToInbox,
}) => {
  const [recipientPhone, setRecipientPhone] = useState('');
  const [messageText, setMessageText] = useState(
    'Teste oficial FABRE AUTOMATION. Mensagem enviada pelo WhatsApp oficial Casal Fabre.'
  );
  const [confirmed, setConfirmed] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<WhatsAppE2EResult | null>(null);
  const [inboundReply, setInboundReply] = useState<any | null>(null);
  const [waitingReply, setWaitingReply] = useState(false);

  // Subscribe to real-time inbound reply when conversationId is available
  useEffect(() => {
    if (result?.status === 'SUCCESS' && result?.conversationId) {
      setWaitingReply(true);
      const unsubscribe = whatsAppE2ETestService.subscribeToInboundReply(
        result.conversationId,
        (replyMsg) => {
          setInboundReply(replyMsg);
          setWaitingReply(false);
        }
      );

      return () => {
        unsubscribe();
      };
    }
  }, [result?.status, result?.conversationId]);

  if (!isOpen) return null;

  const handleSendTest = async () => {
    if (!confirmed || !recipientPhone.trim() || sending) return;

    setSending(true);
    setResult(null);
    setInboundReply(null);
    setWaitingReply(false);

    try {
      const res = await whatsAppE2ETestService.executeE2ETest({
        recipientPhone: recipientPhone.trim(),
        messageText: messageText.trim(),
      });
      setResult(res);
    } catch (err: any) {
      setResult({
        status: 'FAILED',
        httpStatus: 500,
        timestamp: new Date().toISOString(),
        destination: recipientPhone,
        phoneNumberId: '250763631462152',
        wabaId: '293410900513919',
        endpoint: 'https://graph.facebook.com/v21.0/250763631462152/messages',
        errorMessage: err?.message || 'Erro inesperado durante a execução do teste.',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-6 text-neutral-200 my-8 space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <PhoneCall size={20} />
              </span>
              <div>
                <h2 className="text-lg font-bold text-neutral-100 font-display flex items-center gap-2">
                  Teste E2E — WhatsApp Oficial Casal Fabre
                </h2>
                <p className="text-xs text-neutral-400">
                  Validação real ponta a ponta via Meta Cloud API v21.0 e Webhook Inbound
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Canonical Assets Badge */}
        <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2 text-xs font-mono">
          <div className="flex items-center justify-between text-[11px] text-neutral-400 border-b border-neutral-800/80 pb-2">
            <span className="text-emerald-400 font-bold flex items-center gap-1.5">
              <ShieldCheck size={14} />
              ATIVO OFICIAL CANÔNICO CONSOLIDADO
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-semibold">
              ADM01
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1 text-[11px]">
            <div>
              <span className="text-neutral-500 block text-[10px]">WABA ID</span>
              <span className="text-neutral-200 font-bold">293410900513919</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[10px]">PHONE NUMBER ID</span>
              <span className="text-neutral-200 font-bold">250763631462152</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[10px]">NÚMERO OFICIAL</span>
              <span className="text-neutral-200 font-bold">+55 14 98840-3642</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[10px]">NOME COMERCIAL</span>
              <span className="text-neutral-300">Casal Fabre</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[10px]">HANDLE OFICIAL</span>
              <span className="text-neutral-300">@casalfabre</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[10px]">STATUS META</span>
              <span className="text-amber-400">Não Publicado (Dev)</span>
            </div>
          </div>
        </div>

        {/* Form Inputs */}
        <div className="space-y-4">
          {/* Destination Number */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Número de Destino (WhatsApp Pessoal do Administrador/Testador)
            </label>
            <input
              type="text"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              placeholder="Ex: +55 14 99999-9999 ou 5514999999999"
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm font-mono text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <p className="text-[11px] text-neutral-500 mt-1">
              Informe o número completo com código de país (55) e DDD (ex: 5514988403642).
            </p>
          </div>

          {/* Test Message Text */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              Mensagem de Teste
            </label>
            <textarea
              rows={2}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Explicit Warning Callout */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <AlertTriangle size={16} className="text-amber-400 shrink-0" />
              <span>ATENÇÃO: este teste enviará uma mensagem REAL pelo WhatsApp oficial Casal Fabre.</span>
            </div>
            <p className="text-[11px] text-neutral-300 leading-relaxed">
              O disparo será efetuado diretamente na Meta Graph API utilizando o ativo consolidado <strong>ADM01</strong> (+55 14 98840-3642). Certifique-se de que o número informado pertence ao testador autorizado.
            </p>
          </div>

          {/* Explicit Confirmation Checkbox */}
          <label className="flex items-start gap-3 p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 rounded border-neutral-700 text-emerald-600 focus:ring-emerald-500 bg-neutral-900 cursor-pointer"
            />
            <span className="text-xs text-neutral-300 leading-snug">
              Confirmo que desejo enviar uma mensagem <strong>REAL</strong> pelo WhatsApp oficial Casal Fabre para o número informado acima.
            </span>
          </label>

          {/* Submit Button */}
          <button
            onClick={handleSendTest}
            disabled={!confirmed || !recipientPhone.trim() || sending}
            className="w-full py-3 px-4 rounded-xl text-xs font-bold font-display uppercase tracking-wider flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-neutral-950 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-950/40"
          >
            {sending ? (
              <>
                <RefreshCw size={15} className="animate-spin text-neutral-950" />
                <span>Disparando Mensagem na Meta Graph API...</span>
              </>
            ) : (
              <>
                <Send size={15} />
                <span>Disparar Teste Oficial Real (E2E)</span>
              </>
            )}
          </button>
        </div>

        {/* Audit & Execution Results Panel */}
        {result && (
          <div className="space-y-4 pt-4 border-t border-neutral-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-neutral-300">
                RESULTADO DA AUDITORIA DE ENVIO
              </span>
              <span
                className={`text-xs font-mono font-bold px-3 py-1 rounded-full border flex items-center gap-1.5 ${
                  result.status === 'SUCCESS'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                    : 'bg-rose-950 text-rose-300 border-rose-700'
                }`}
              >
                {result.status === 'SUCCESS' ? (
                  <>
                    <CheckCircle2 size={13} className="text-emerald-400" />
                    ENVIO &rarr; SUCESSO
                  </>
                ) : (
                  <>
                    <AlertTriangle size={13} className="text-rose-400" />
                    ENVIO &rarr; FALHA
                  </>
                )}
              </span>
            </div>

            {/* Detailed Audit Table */}
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2.5 text-xs font-mono">
              <div className="grid grid-cols-2 gap-2 pb-2 border-b border-neutral-850 text-[11px]">
                <div>
                  <span className="text-neutral-500 block text-[10px]">TIMESTAMP</span>
                  <span className="text-neutral-300">{new Date(result.timestamp).toLocaleString('pt-BR')}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[10px]">STATUS HTTP</span>
                  <span className={`font-bold ${result.httpStatus === 200 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    HTTP {result.httpStatus}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pb-2 border-b border-neutral-850 text-[11px]">
                <div>
                  <span className="text-neutral-500 block text-[10px]">DESTINATÁRIO (DESTINATION)</span>
                  <span className="text-neutral-200 font-bold">+{result.destination}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[10px]">PHONE NUMBER ID</span>
                  <span className="text-neutral-200 font-bold">{result.phoneNumberId}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pb-2 border-b border-neutral-850 text-[11px]">
                <div>
                  <span className="text-neutral-500 block text-[10px]">WABA ID</span>
                  <span className="text-neutral-200 font-bold">{result.wabaId}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[10px]">META MESSAGE ID (WAMID)</span>
                  <span className="text-cyan-400 truncate block">
                    {result.metaMessageId || 'Nenhum retornado'}
                  </span>
                </div>
              </div>

              <div className="text-[11px] pt-1">
                <span className="text-neutral-500 block text-[10px]">ENDPOINT UTILIZADO</span>
                <span className="text-neutral-400 truncate block text-[10px]">{result.endpoint}</span>
              </div>

              {/* Error Breakdown if Failed */}
              {result.status === 'FAILED' && (
                <div className="mt-3 p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-200 space-y-1.5 font-sans">
                  <div className="font-bold text-xs flex items-center gap-1.5 text-rose-300">
                    <AlertTriangle size={13} />
                    <span>Detalhe da Falha Meta:</span>
                  </div>
                  <p className="text-xs text-neutral-300 leading-relaxed">
                    {result.errorMessage}
                  </p>
                  {result.isTemplateRequired && (
                    <div className="mt-2 p-2.5 rounded bg-amber-950/60 border border-amber-800/40 text-amber-200 text-[11px] space-y-1">
                      <span className="font-bold block flex items-center gap-1">
                        <Info size={12} className="text-amber-400" />
                        Política de Mensagens Meta (Janela de 24h):
                      </span>
                      <p className="text-[11px] text-neutral-300">
                        Para conversas iniciadas pela empresa, a Meta exige uma mensagem de modelo (Template Message) aprovada, OU que o usuário envie uma mensagem primeiro para o número oficial <strong>+55 14 98840-3642</strong> para abrir a janela gratuita de 24h.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Inbound Lifecycle Monitor (Sections 8, 9, 10) */}
            {result.status === 'SUCCESS' && (
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-neutral-200 flex items-center gap-1.5">
                    <Clock size={13} className="text-cyan-400" />
                    MONITORAMENTO DO CICLO DE VIDA E2E
                  </span>
                  {waitingReply && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 animate-pulse">
                      Aguardando Resposta...
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 size={14} className="shrink-0" />
                    <span>1. Mensagem enviada com sucesso ao WhatsApp do testador.</span>
                  </div>

                  <div className="flex items-center gap-2 text-neutral-300">
                    <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
                    <span>2. Destino: +{result.destination} | Remetente: Casal Fabre (+55 14 98840-3642).</span>
                  </div>

                  <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800 text-xs space-y-2">
                    <p className="text-neutral-300">
                      <strong>Próximo Passo:</strong> Abra o WhatsApp no seu celular e responda à mensagem recebida com:
                    </p>
                    <div className="p-2 rounded bg-neutral-950 border border-neutral-800 text-cyan-300 font-mono text-[11px] select-all">
                      &quot;Confirmo o recebimento do teste E2E do FABRE AUTOMATION.&quot;
                    </div>
                  </div>

                  {/* Realtime Inbound Detection */}
                  {inboundReply ? (
                    <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800 text-emerald-200 space-y-1.5">
                      <div className="flex items-center justify-between font-bold text-xs text-emerald-300">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 size={14} />
                          RESPOSTA RECEBIDA VIA WEBHOOK COM SUCESSO!
                        </span>
                        <span className="text-[10px] opacity-75">
                          {new Date(inboundReply.created_at || inboundReply.createdAt).toLocaleTimeString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-xs font-sans text-neutral-100 bg-neutral-900/80 p-2 rounded border border-neutral-800">
                        &quot;{inboundReply.content}&quot;
                      </p>
                      <p className="text-[10px] text-neutral-400">
                        A resposta foi capturada pela Edge Function whatsapp-webhook e persistida no banco PostgreSQL.
                      </p>
                    </div>
                  ) : waitingReply ? (
                    <div className="flex items-center gap-2.5 p-3 rounded-lg bg-neutral-900/60 border border-neutral-800 text-xs text-neutral-400">
                      <RefreshCw size={13} className="animate-spin text-cyan-400 shrink-0" />
                      <span>Ouvindo Webhook da Meta em tempo real... Responda no WhatsApp para concluir o teste.</span>
                    </div>
                  ) : null}

                  {/* Button to Conversation in Inbox */}
                  {result.conversationId && (
                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => {
                          onClose();
                          if (onNavigateToInbox) {
                            onNavigateToInbox(result.conversationId!);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-emerald-400 border border-neutral-700 transition-colors cursor-pointer"
                      >
                        <MessageSquare size={13} />
                        <span>Ver Conversa no Inbox FABRE AUTOMATION</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
