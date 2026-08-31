/**
 * FABRE AUTOMATION - Main Application Root
 * Release 2: Supabase Persistence Foundation
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
import { SupabaseSchemaModal } from './components/settings/SupabaseSchemaModal';
import { useConversations } from './hooks/useConversations';
import { useAutomations } from './hooks/useAutomations';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavItemKey>('dashboard');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [architectureModalOpen, setArchitectureModalOpen] = useState(false);
  const [schemaModalOpen, setSchemaModalOpen] = useState(false);

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
      onOpenSchemaModal={() => setSchemaModalOpen(true)}
    >
      {activeTab === 'dashboard' && (
        <DashboardPage
          onNavigate={setActiveTab}
          onSelectConversation={handleSelectConversationFromDashboard}
          onOpenArchitectureModal={() => setArchitectureModalOpen(true)}
          onOpenSchemaModal={() => setSchemaModalOpen(true)}
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

      {/* Supabase Schema SQL & Connectivity Modal */}
      <SupabaseSchemaModal
        isOpen={schemaModalOpen}
        onClose={() => setSchemaModalOpen(false)}
      />
    </AppLayout>
  );
}
