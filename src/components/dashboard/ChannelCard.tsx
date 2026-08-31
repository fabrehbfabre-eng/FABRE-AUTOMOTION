/**
 * FABRE AUTOMATION - Channel Connection Status Card
 */

import React from 'react';
import { ChannelConnection } from '../../types';
import { ChannelIcon } from '../common/ChannelIcon';
import { ConnectionStatusBadge } from '../common/StatusIndicator';
import { Shield, Sparkles } from 'lucide-react';

interface ChannelCardProps {
  connection: ChannelConnection;
  onConfigure?: () => void;
}

export const ChannelCard: React.FC<ChannelCardProps> = ({
  connection,
  onConfigure,
}) => {
  const channelDetails: Record<
    ChannelConnection['channel'],
    { title: string; subtitle: string; protocol: string; targetRelease: string }
  > = {
    instagram: {
      title: 'Instagram Direct',
      subtitle: 'Comentários em posts, stories e DMs automáticas',
      protocol: 'Meta Graph API (Webhooks & Send API)',
      targetRelease: 'Release 2',
    },
    messenger: {
      title: 'Facebook Messenger',
      subtitle: 'Conversas da página oficial do Casal Fabre',
      protocol: 'Meta Messenger Platform API',
      targetRelease: 'Release 2',
    },
    whatsapp: {
      title: 'WhatsApp Business',
      subtitle: 'Cloud API oficial com modelos e transbordo humano',
      protocol: 'WhatsApp Business Cloud API v21.0',
      targetRelease: 'Release 2',
    },
  };

  const info = channelDetails[connection.channel];

  return (
    <div className="relative flex flex-col justify-between rounded-2xl border border-neutral-800/90 bg-neutral-900/50 p-5 hover:border-neutral-700/80 transition-all group">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <ChannelIcon channel={connection.channel} size={22} withBg />
            <div>
              <h3 className="text-sm font-bold text-neutral-100 font-display flex items-center gap-1.5">
                {info.title}
              </h3>
              <p className="text-xs text-neutral-400 font-mono">
                {connection.accountHandle || 'Conta Não Vinculada'}
              </p>
            </div>
          </div>

          <ConnectionStatusBadge status={connection.status} />
        </div>

        {/* Description */}
        <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
          {info.subtitle}
        </p>

        {/* Technical Readiness Note */}
        <div className="p-3 rounded-xl bg-neutral-950/70 border border-neutral-800/70 text-[11px] text-neutral-400 space-y-1.5 mb-4">
          <div className="flex items-center justify-between text-neutral-300 font-medium">
            <span className="flex items-center gap-1">
              <Shield size={12} className="text-cyan-400" />
              Protocolo Oficial
            </span>
            <span className="text-[10px] text-cyan-400 font-mono font-semibold bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/40">
              {info.targetRelease}
            </span>
          </div>
          <p className="font-mono text-neutral-500 truncate">{info.protocol}</p>
        </div>
      </div>

      {/* Footer action */}
      <div className="pt-2 border-t border-neutral-800/60 flex items-center justify-between">
        <span className="text-[11px] text-neutral-500 flex items-center gap-1">
          <Sparkles size={11} className="text-amber-400" />
          {connection.statusMessage || 'Aguardando credenciais'}
        </span>

        {onConfigure && (
          <button
            onClick={onConfigure}
            className="text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
          >
            Ver Detalhes &rarr;
          </button>
        )}
      </div>
    </div>
  );
};
