/**
 * FABRE AUTOMATION - Dashboard Page
 * Release 2: Supabase Persistence Foundation
 */

import React from 'react';
import { ArchitectureBanner } from '../components/dashboard/ArchitectureBanner';
import { StatCard } from '../components/dashboard/StatCard';
import { ChannelCard } from '../components/dashboard/ChannelCard';
import { RecentConversationsCard } from '../components/dashboard/RecentConversationsCard';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useAutomations } from '../hooks/useAutomations';
import { 
  MessageSquare, 
  Bot, 
  Zap, 
  UserCheck, 
  Layers, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { NavItemKey } from '../components/layout/Sidebar';

interface DashboardPageProps {
  onNavigate: (tab: NavItemKey) => void;
  onSelectConversation: (id: string) => void;
  onOpenArchitectureModal: () => void;
  onOpenSchemaModal?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  onSelectConversation,
  onOpenArchitectureModal,
  onOpenSchemaModal,
}) => {
  const { stats, loading } = useDashboardStats();
  const { automations } = useAutomations();

  if (loading || !stats) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-3 text-neutral-400 text-sm font-mono">
          <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
          <span>Carregando painel Fabre Automation...</span>
        </div>
      </div>
    );
  }

  const activeAutomations = automations.filter(a => a.enabled);

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Release 3 Secure Backend & Architecture Status Banner */}
      <ArchitectureBanner
        onLearnMore={onOpenArchitectureModal}
        onOpenSchemaModal={onOpenSchemaModal}
        onGoToSettings={() => onNavigate('settings')}
      />

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total de Conversas"
          value={stats.totalConversations}
          subtitle="Interações registradas no sistema"
          icon={MessageSquare}
          variant="cyan"
          badge="Multicanal"
        />
        <StatCard
          title="Mensagens Respondidas"
          value={stats.messagesAutomated}
          subtitle="Respostas enviadas via automação"
          icon={Bot}
          variant="emerald"
          badge="100% Automático"
        />
        <StatCard
          title="Automações Ativas"
          value={activeAutomations.length}
          subtitle="Regras de gatilho em execução"
          icon={Zap}
          variant="indigo"
          badge={`${automations.length} Cadastradas`}
        />
        <StatCard
          title="Atendimentos Humanos"
          value={stats.humanHandoffs}
          subtitle="Conversas assumidas por operador"
          icon={UserCheck}
          variant="purple"
          badge="Transbordo"
        />
      </div>

      {/* Channel Connections Status Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-neutral-100 font-display flex items-center gap-2">
              <Layers size={18} className="text-cyan-400" />
              Canais de Atendimento
            </h3>
            <p className="text-xs text-neutral-400">
              Estado atual das integrações com redes sociais e canais de mensagem
            </p>
          </div>

          <button
            onClick={() => onNavigate('settings')}
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>Gerenciar Conexões</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ChannelCard
            connection={stats.channelConnections.instagram}
            onConfigure={() => onNavigate('settings')}
          />
          <ChannelCard
            connection={stats.channelConnections.messenger}
            onConfigure={() => onNavigate('settings')}
          />
          <ChannelCard
            connection={stats.channelConnections.whatsapp}
            onConfigure={() => onNavigate('settings')}
          />
        </div>
      </div>

      {/* Two Column Layout: Recent Conversations & Active Automations Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Conversations */}
        <div className="lg:col-span-2">
          <RecentConversationsCard
            conversations={stats.recentConversations}
            onViewAll={() => onNavigate('conversations')}
            onSelectConversation={(id) => {
              onSelectConversation(id);
              onNavigate('conversations');
            }}
          />
        </div>

        {/* Right 1 Col: Quick Automations Overview */}
        <div className="rounded-2xl border border-neutral-800/90 bg-neutral-900/50 p-5 sm:p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-neutral-100 font-display flex items-center gap-2">
                <Zap size={18} className="text-cyan-400" />
                Gatilhos Rápidos
              </h3>
              <button
                onClick={() => onNavigate('automations')}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
              >
                Ver Todas
              </button>
            </div>

            <p className="text-xs text-neutral-400">
              Regras inteligentes ativas para captar seguidores e responder com agilidade.
            </p>

            <div className="space-y-2.5 pt-1">
              {automations.slice(0, 3).map((auto) => (
                <div
                  key={auto.id}
                  onClick={() => onNavigate('automations')}
                  className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800/80 hover:border-cyan-500/30 transition-all cursor-pointer space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-200 truncate">
                      {auto.title}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        auto.enabled ? 'bg-emerald-400' : 'bg-neutral-600'
                      }`}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-mono">
                    <span>{auto.channel.toUpperCase()}</span>
                    <span>•</span>
                    <span className="text-cyan-400">
                      {auto.trigger.config.keywords?.[0] ? `"${auto.trigger.config.keywords[0]}"` : 'Evento'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/30 flex items-center gap-2 text-xs text-cyan-300">
            <Sparkles size={14} className="shrink-0 text-cyan-400" />
            <span className="text-[11px] leading-tight">
              Regras sincronizadas com persistência no Supabase PostgreSQL.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
