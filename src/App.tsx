/**
 * FABRE AUTOMATION - Main Application Root
 * Release 13: Operator Authentication + Secure Automation Outbound
 * 
 * Features:
 * - Real Supabase Operator Authentication (AuthProvider)
 * - Automatic session recovery with loading state
 * - Full protection of operator views (Dashboard, Inbox, Automations, Knowledge, Settings)
 * - Clean login interface when unauthenticated
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/auth/LoginPage';
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
import { Cpu, Loader2 } from 'lucide-react';

function AuthenticatedApp() {
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

function AppRoot() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-[#08090d] flex flex-col items-center justify-center text-neutral-100 select-none">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-neutral-900 to-indigo-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-xl shadow-cyan-950/50 mb-4 animate-pulse">
          <Cpu size={28} className="text-cyan-300" />
        </div>
        <div className="flex items-center gap-2.5 text-xs text-neutral-400 font-mono">
          <Loader2 size={16} className="animate-spin text-cyan-400" />
          <span>Restaurando sessão de operador...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <AuthenticatedApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoot />
    </AuthProvider>
  );
}
