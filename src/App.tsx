/**
 * FABRE AUTOMATION - Main Application Root
 * Release 1: Foundation & Architecture
 */

import React, { useState } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { NavItemKey } from './components/layout/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { ConversationsPage } from './pages/ConversationsPage';
import { AutomationsPage } from './pages/AutomationsPage';
import { KnowledgePage } from './pages/KnowledgePage';
import { SettingsPage } from './pages/SettingsPage';
import { ArchitectureSpecModal } from './components/settings/ArchitectureSpecModal';
import { useConversations } from './hooks/useConversations';
import { useAutomations } from './hooks/useAutomations';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavItemKey>('dashboard');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [architectureModalOpen, setArchitectureModalOpen] = useState(false);

  const { allConversations } = useConversations();
  const { automations } = useAutomations();

  const unreadCount = allConversations.reduce((acc, c) => acc + c.unreadCount, 0);
  const activeAutomationsCount = automations.filter(a => a.enabled).length;

  const handleSelectConversationFromDashboard = (id: string) => {
    setSelectedConversationId(id);
    setActiveTab('conversations');
  };

  return (
    <AppLayout
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      unreadCount={unreadCount}
      activeAutomationsCount={activeAutomationsCount}
      onOpenArchitectureModal={() => setArchitectureModalOpen(true)}
    >
      {activeTab === 'dashboard' && (
        <DashboardPage
          onNavigate={setActiveTab}
          onSelectConversation={handleSelectConversationFromDashboard}
          onOpenArchitectureModal={() => setArchitectureModalOpen(true)}
        />
      )}

      {activeTab === 'conversations' && (
        <ConversationsPage
          selectedId={selectedConversationId}
          onSelectId={setSelectedConversationId}
        />
      )}

      {activeTab === 'automations' && <AutomationsPage />}

      {activeTab === 'knowledge' && <KnowledgePage />}

      {activeTab === 'settings' && <SettingsPage />}

      {/* Architecture Spec Modal */}
      <ArchitectureSpecModal
        isOpen={architectureModalOpen}
        onClose={() => setArchitectureModalOpen(false)}
      />
    </AppLayout>
  );
}
