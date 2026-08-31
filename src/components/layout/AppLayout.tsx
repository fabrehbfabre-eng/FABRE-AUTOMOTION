/**
 * FABRE AUTOMATION - Main Layout Component
 */

import React from 'react';
import { Sidebar, NavItemKey } from './Sidebar';
import { Header } from './Header';

interface AppLayoutProps {
  activeTab: NavItemKey;
  onSelectTab: (tab: NavItemKey) => void;
  unreadCount?: number;
  activeAutomationsCount?: number;
  onOpenArchitectureModal?: () => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  activeTab,
  onSelectTab,
  unreadCount,
  activeAutomationsCount,
  onOpenArchitectureModal,
  children,
}) => {
  return (
    <div className="flex h-screen w-full bg-[#08090d] text-neutral-100 overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        unreadCount={unreadCount}
        activeAutomationsCount={activeAutomationsCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-neutral-950/40">
        <Header activeTab={activeTab} onOpenArchitectureModal={onOpenArchitectureModal} />

        <main className="flex-1 overflow-y-auto min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
};
