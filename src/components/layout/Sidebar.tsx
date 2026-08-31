/**
 * FABRE AUTOMATION - Sidebar Navigation Component
 * Release 1: Foundation & Architecture
 */

import React from 'react';
import { 
  LayoutDashboard, 
  MessageSquareText, 
  Zap, 
  BookOpen, 
  Settings, 
  Cpu,
  Layers,
  Sparkles
} from 'lucide-react';

export type NavItemKey = 'dashboard' | 'conversations' | 'automations' | 'knowledge' | 'settings';

interface SidebarProps {
  activeTab: NavItemKey;
  onSelectTab: (tab: NavItemKey) => void;
  unreadCount?: number;
  activeAutomationsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  unreadCount = 1,
  activeAutomationsCount = 2,
}) => {
  const navItems = [
    {
      key: 'dashboard' as NavItemKey,
      label: 'Dashboard',
      icon: LayoutDashboard,
      description: 'Visão geral e métricas',
    },
    {
      key: 'conversations' as NavItemKey,
      label: 'Conversas',
      icon: MessageSquareText,
      badge: unreadCount > 0 ? `${unreadCount}` : undefined,
      badgeColor: 'bg-cyan-500 text-neutral-950 font-bold',
      description: 'Caixa de entrada multicanal',
    },
    {
      key: 'automations' as NavItemKey,
      label: 'Automações',
      icon: Zap,
      badge: `${activeAutomationsCount} ativas`,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
      description: 'Regras de gatilho e resposta',
    },
    {
      key: 'knowledge' as NavItemKey,
      label: 'Conhecimento',
      icon: BookOpen,
      badge: 'Base IA',
      badgeColor: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
      description: 'Produtos, preços e regras',
    },
    {
      key: 'settings' as NavItemKey,
      label: 'Configurações',
      icon: Settings,
      description: 'Canais, Meta, OpenAI, Supabase',
    },
  ];

  return (
    <aside className="w-64 md:w-72 bg-neutral-950/90 border-r border-neutral-800/80 flex flex-col h-screen shrink-0 backdrop-blur-md select-none">
      {/* Brand Header */}
      <div className="p-6 border-b border-neutral-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 via-neutral-900 to-indigo-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-950/40">
            <Cpu size={20} className="text-cyan-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wider text-neutral-100 font-display">
                FABRE
              </span>
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                AUTOMATION
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 font-mono mt-0.5">
              Casal Fabre • Core v1.0
            </p>
          </div>
        </div>

        {/* Release 1 Indicator */}
        <div className="mt-4 px-3 py-2 rounded-lg bg-neutral-900/90 border border-neutral-800 flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 text-neutral-300 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Release 1: Foundation
          </span>
          <span className="text-[10px] text-neutral-500 font-mono">Decoupled</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-wider text-neutral-500">
          Menu Principal
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;

          return (
            <button
              key={item.key}
              onClick={() => onSelectTab(item.key)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group cursor-pointer ${
                isActive
                  ? 'bg-neutral-800/90 text-cyan-300 border border-cyan-500/30 shadow-md shadow-black/40'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  size={18}
                  className={`transition-colors ${
                    isActive ? 'text-cyan-400' : 'text-neutral-500 group-hover:text-neutral-300'
                  }`}
                />
                <span className="tracking-wide">{item.label}</span>
              </div>

              {item.badge && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Future Architecture Modules Preview */}
        <div className="pt-6 px-3">
          <div className="p-3 rounded-xl bg-neutral-900/40 border border-neutral-800/60 text-xs">
            <div className="flex items-center gap-1.5 text-neutral-300 font-medium mb-1">
              <Layers size={13} className="text-cyan-400" />
              <span>Arquitetura Desacoplada</span>
            </div>
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              Pronta para Meta Graph API, WhatsApp Cloud, OpenAI & Supabase nas próximas releases.
            </p>
          </div>
        </div>
      </nav>

      {/* User / Profile Footer */}
      <div className="p-4 border-t border-neutral-800/80 bg-neutral-950">
        <div className="flex items-center gap-3 px-2 py-1.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold ring-2 ring-neutral-800">
            CF
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-neutral-200 truncate">Casal Fabre</p>
            <p className="text-[10px] text-neutral-400 truncate flex items-center gap-1">
              <Sparkles size={10} className="text-cyan-400" />
              Administrador
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};
