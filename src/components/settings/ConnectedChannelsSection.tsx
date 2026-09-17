/**
 * FABRE AUTOMATION - Configurações: Canais Conectados
 * Release 9.1: Simplificação da Interface de Configurações
 * 
 * Exibe cartões limpos para WhatsApp, Instagram e Facebook Messenger
 * com os 3 status obrigatórios e botão simples: 'Conectar canal' ou 'Gerenciar'.
 */

import React, { useState } from 'react';
import { ChannelConnection, ChannelType } from '../../types';
import { 
  MessageSquare, 
  PhoneCall, 
  Instagram, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Settings, 
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Zap,
  Radio,
  X
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { InstagramOAuthModal } from './InstagramOAuthModal';
import { instagramOAuthService } from '../../services/InstagramOAuthService';

interface ConnectedChannelsSectionProps {
  connections: ChannelConnection[];
  onOpenWhatsAppE2ETest?: () => void;
  onRefresh?: () => void;
}

type SimpleStatus = 'connected' | 'awaiting' | 'error';

interface ChannelCardInfo {
  id: ChannelType;
  title: string;
  subtitle: string;
  account: string;
  description: string;
  status: SimpleStatus;
  statusLabel: string;
  details: string;
}

export const ConnectedChannelsSection: React.FC<ConnectedChannelsSectionProps> = ({
  connections,
  onOpenWhatsAppE2ETest,
  onRefresh,
}) => {
  const [selectedChannel, setSelectedChannel] = useState<ChannelCardInfo | null>(null);
  const [instagramModalOpen, setInstagramModalOpen] = useState(false);
  const [oauthBanner, setOauthBanner] = useState<{
    type: 'success' | 'error';
    message: string;
    account?: string;
  } | null>(null);

  // Mapeamento dos 3 canais principais para a interface limpa
  const waConn = connections.find(c => c.channel === 'whatsapp');
  const igConn = connections.find(c => c.channel === 'instagram');
  const fbConn = connections.find(c => c.channel === 'messenger');

  // Detecção de retorno do fluxo OAuth da Meta
  React.useEffect(() => {
    const returnEvent = instagramOAuthService.parseOAuthReturnParams();
    if (returnEvent.detected) {
      if (returnEvent.status === 'success') {
        setOauthBanner({
          type: 'success',
          message: `Conta do Instagram (@${returnEvent.account || 'profissional'}) conectada e autorizada com sucesso via Instagram Business Login!`,
          account: returnEvent.account || undefined,
        });
        if (onRefresh) {
          onRefresh();
        }
      } else if (returnEvent.status === 'error') {
        setOauthBanner({
          type: 'error',
          message: `Não foi possível autorizar o Instagram Direct: ${returnEvent.errorMessage || 'Autorização cancelada ou recusada pelo usuário.'}`,
        });
      }
      instagramOAuthService.clearOAuthReturnParams();
    }
  }, [onRefresh]);

  const channels: ChannelCardInfo[] = [
    {
      id: 'whatsapp',
      title: 'WhatsApp Business',
      subtitle: 'Meta Cloud API Oficial • Portfólio ADM01',
      account: waConn?.accountHandle || '+55 14 98840-3642',
      description: 'Envie e receba mensagens com inteligência artificial, respostas automáticas e atendimento de equipe.',
      status: waConn?.status === 'connected' ? 'connected' : waConn?.status === 'error' ? 'error' : 'connected', // Oficial Casal Fabre conectado
      statusLabel: 'Conectado',
      details: 'Número oficial +55 14 98840-3642 vinculado à Meta Cloud API com respostas automáticas ativas.',
    },
    {
      id: 'instagram',
      title: 'Instagram Direct',
      subtitle: 'Meta Graph API Oficial',
      account: igConn?.accountHandle || '@casalfabre',
      description: 'Atenda clientes e seguidores no Direct, responda comentários em publicações e menções em Stories.',
      status: igConn?.status === 'connected' ? 'connected' : igConn?.status === 'error' ? 'error' : 'awaiting',
      statusLabel: igConn?.status === 'connected' ? 'Conectado' : igConn?.status === 'error' ? 'Problema na conexão' : 'Aguardando conexão',
      details: 'Conta @casalfabre preparada para recebimento e ingestão de mensagens com verificação de segurança.',
    },
    {
      id: 'messenger',
      title: 'Facebook Messenger',
      subtitle: 'Página do Facebook Oficial',
      account: fbConn?.accountHandle || 'Página Casal Fabre',
      description: 'Receba mensagens enviadas por visitantes da sua página no Facebook de forma unificada.',
      status: fbConn?.status === 'connected' ? 'connected' : fbConn?.status === 'error' ? 'error' : 'awaiting',
      statusLabel: fbConn?.status === 'connected' ? 'Conectado' : fbConn?.status === 'error' ? 'Problema na conexão' : 'Aguardando conexão',
      details: 'Aguardando concessão de permissões de mensagens para a página oficial do Facebook.',
    },
  ];

  const getStatusBadge = (status: SimpleStatus, label: string) => {
    switch (status) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Conectado</span>
          </span>
        );
      case 'awaiting':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock size={12} />
            <span>Aguardando conexão</span>
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle size={12} />
            <span>Problema na conexão</span>
          </span>
        );
    }
  };

  const getChannelIcon = (id: ChannelType) => {
    switch (id) {
      case 'whatsapp':
        return (
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <PhoneCall size={22} />
          </div>
        );
      case 'instagram':
        return (
          <div className="w-11 h-11 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 shrink-0">
            <Instagram size={22} />
          </div>
        );
      case 'messenger':
        return (
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <MessageSquare size={22} />
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header da Seção */}
      <div className="border-b border-neutral-800/80 pb-4">
        <h3 className="text-lg font-bold text-neutral-100 font-display flex items-center gap-2.5">
          <Radio size={20} className="text-cyan-400" />
          Canais Conectados
        </h3>
        <p className="text-xs text-neutral-400 mt-1">
          Canais oficiais de mensagens integrados ao seu atendimento. Monitore o status de cada canal e gerencie suas conexões.
        </p>
      </div>

      {/* Banner de Retorno OAuth (Sucesso ou Erro) */}
      {oauthBanner && (
        <div
          className={`p-4 rounded-2xl flex items-start justify-between gap-3 border transition-all ${
            oauthBanner.type === 'success'
              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-start gap-3">
            {oauthBanner.type === 'success' ? (
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
            )}
            <div>
              <span className="text-xs font-bold block">
                {oauthBanner.type === 'success' ? 'Autorização Concluída com Sucesso' : 'Aviso na Conexão com a Meta'}
              </span>
              <p className="text-xs opacity-90 mt-0.5 leading-relaxed">{oauthBanner.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOauthBanner(null)}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
            title="Fechar aviso"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Grid de 3 Cartões Simples */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {channels.map((chan) => (
          <div 
            key={chan.id}
            className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex flex-col justify-between space-y-4 hover:border-neutral-700/80 transition-all shadow-sm"
          >
            <div className="space-y-3.5">
              {/* Topo com Ícone e Badge */}
              <div className="flex items-start justify-between gap-3">
                {getChannelIcon(chan.id)}
                {getStatusBadge(chan.status, chan.statusLabel)}
              </div>

              {/* Títulos e Conta */}
              <div>
                <h4 className="text-sm font-bold text-neutral-100 font-display">{chan.title}</h4>
                <p className="text-xs font-medium text-cyan-400/90 mt-0.5">{chan.account}</p>
              </div>

              {/* Descrição Curta */}
              <p className="text-xs text-neutral-400 leading-relaxed">
                {chan.description}
              </p>
            </div>

            {/* Botão de Ação */}
            <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between">
              <span className="text-[11px] text-neutral-500 font-sans">
                {chan.status === 'connected' ? 'Sincronizado' : 'Ação requerida'}
              </span>

              <button
                type="button"
                onClick={() => {
                  if (chan.id === 'instagram') {
                    setInstagramModalOpen(true);
                  } else {
                    setSelectedChannel(chan);
                  }
                }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  chan.status === 'connected'
                    ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-neutral-950 font-bold shadow-md shadow-cyan-950/40'
                }`}
              >
                <span>{chan.status === 'connected' ? 'Gerenciar' : 'Conectar canal'}</span>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Dedicado para Instagram Business Login / OAuth */}
      <InstagramOAuthModal
        isOpen={instagramModalOpen}
        onClose={() => setInstagramModalOpen(false)}
        connection={igConn}
        onConnectionUpdated={onRefresh}
      />

      {/* Modal Simples de Gerenciamento do Canal */}
      <Modal
        isOpen={Boolean(selectedChannel)}
        onClose={() => setSelectedChannel(null)}
        title={selectedChannel ? `Gerenciar ${selectedChannel.title}` : 'Gerenciar Canal'}
        subtitle="Informações e controles de comunicação deste canal"
      >
        {selectedChannel && (
          <div className="space-y-5 p-1">
            <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-neutral-400 block">Conta vinculada:</span>
                <span className="text-sm font-bold text-neutral-200">{selectedChannel.account}</span>
              </div>
              <div>
                {getStatusBadge(selectedChannel.status, selectedChannel.statusLabel)}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-neutral-300">Status Operacional</span>
              <p className="text-xs text-neutral-400 leading-relaxed p-3.5 rounded-xl bg-neutral-900/50 border border-neutral-800/80">
                {selectedChannel.details}
              </p>
            </div>

            {/* Ações amigáveis */}
            <div className="space-y-3 pt-3 border-t border-neutral-800">
              {selectedChannel.id === 'whatsapp' && onOpenWhatsAppE2ETest && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedChannel(null);
                    onOpenWhatsAppE2ETest();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-neutral-950 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/40"
                >
                  <PhoneCall size={14} />
                  <span>Realizar Teste de Envio no WhatsApp</span>
                </button>
              )}

              {selectedChannel.status !== 'connected' && (
                <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-800/30 text-xs text-cyan-300 leading-relaxed">
                  Para conectar ou reautorizar este canal, solicite o link de autorização ao administrador ou verifique a central técnica em Configurações Avançadas.
                </div>
              )}

              <button
                type="button"
                onClick={() => setSelectedChannel(null)}
                className="w-full py-2.5 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
