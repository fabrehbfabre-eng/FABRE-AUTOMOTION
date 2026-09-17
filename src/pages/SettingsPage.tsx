/**
 * FABRE AUTOMATION - Settings Page
 * Release 9.1: Simplificação da Interface de Configurações
 * 
 * Reorganização focada na experiência do usuário final não técnico:
 * 1. MINHA EMPRESA (Nome, Logo, Dados básicos)
 * 2. CANAIS CONECTADOS (WhatsApp, Instagram, Messenger com status simples e gerenciar/conectar)
 * 3. ATENDIMENTO (Equipe, Horário, Mensagens de recepção e ausência)
 * 4. INTELIGÊNCIA ARTIFICIAL (Ativar/pausar, Personalidade, Instruções da empresa)
 * 5. AUTOMAÇÕES (Regras, Respostas automáticas, Transbordo humano)
 * 6. CONTA (Perfil, Alterar senha, Sair)
 * 
 * Configurações avançadas segregadas em área recolhida para o administrador técnico.
 */

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Radio, 
  Clock, 
  Bot, 
  Zap, 
  User, 
  Settings, 
  Wrench, 
  ChevronDown, 
  ChevronUp,
  ShieldCheck
} from 'lucide-react';

import { CompanySettingsSection } from '../components/settings/CompanySettingsSection';
import { ConnectedChannelsSection } from '../components/settings/ConnectedChannelsSection';
import { AttendanceSettingsSection } from '../components/settings/AttendanceSettingsSection';
import { AISettingsSection } from '../components/settings/AISettingsSection';
import { AutomationsSettingsSection } from '../components/settings/AutomationsSettingsSection';
import { AccountSettingsSection } from '../components/settings/AccountSettingsSection';
import { AdvancedSettingsSection } from '../components/settings/AdvancedSettingsSection';

import { SupabaseSchemaModal } from '../components/settings/SupabaseSchemaModal';
import { ArchitectureSpecModal } from '../components/settings/ArchitectureSpecModal';
import { DeployGuideModal } from '../components/settings/DeployGuideModal';
import { WhatsAppE2ETestModal } from '../components/settings/WhatsAppE2ETestModal';

import { useChannels } from '../hooks/useChannels';
import { healthCheckService, instagramIngestionService } from '../services';
import { ComprehensiveHealthReport } from '../services/HealthCheckService';
import { IngestionResult } from '../services/InstagramIngestionService';
import { ChannelConnection } from '../types';
import { testSupabaseConnection, isSupabaseConfigured, getSupabaseConfig } from '../lib/supabase';

type SettingsTabKey = 'empresa' | 'canais' | 'atendimento' | 'ia' | 'automacoes' | 'conta';

interface SettingsPageProps {
  onNavigate?: (tab: any) => void;
  onSelectConversation?: (id: string) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onNavigate, onSelectConversation }) => {
  const { connections, refresh } = useChannels();
  const [activeTab, setActiveTab] = useState<SettingsTabKey>('empresa');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Modais técnicos
  const [schemaModalOpen, setSchemaModalOpen] = useState(false);
  const [specModalOpen, setSpecModalOpen] = useState(false);
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [whatsAppE2EModalOpen, setWhatsAppE2EModalOpen] = useState(false);

  // Estados técnicos preservados
  const [testingSupabase, setTestingSupabase] = useState(false);
  const [supabaseTestFeedback, setSupabaseTestFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [runningHealthCheck, setRunningHealthCheck] = useState(false);
  const [healthReport, setHealthReport] = useState<ComprehensiveHealthReport | null>(null);
  const [instagramConn, setInstagramConn] = useState<ChannelConnection | null>(null);
  const [testingIngestion, setTestingIngestion] = useState(false);
  const [testingIdempotency, setTestingIdempotency] = useState(false);
  const [ingestionLog, setIngestionLog] = useState<IngestionResult | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const supabaseConfig = getSupabaseConfig();
  const isConnected = isSupabaseConfigured();
  const webhookUrl = instagramIngestionService.getWebhookUrl();

  useEffect(() => {
    healthCheckService.runHealthCheck().then(setHealthReport);
    instagramIngestionService.getStatus().then(setInstagramConn);
  }, []);

  const handleTestSupabase = async () => {
    setTestingSupabase(true);
    setSupabaseTestFeedback(null);
    try {
      const res = await testSupabaseConnection();
      setSupabaseTestFeedback(res);
      const updated = await healthCheckService.runHealthCheck();
      setHealthReport(updated);
    } finally {
      setTestingSupabase(false);
    }
  };

  const handleFullHealthCheck = async () => {
    setRunningHealthCheck(true);
    try {
      const report = await healthCheckService.runHealthCheck();
      setHealthReport(report);
    } finally {
      setRunningHealthCheck(false);
    }
  };

  const handleRunIngestionTest = async () => {
    setTestingIngestion(true);
    setIngestionLog(null);
    try {
      const res = await instagramIngestionService.runDiagnosticTest(false);
      setIngestionLog(res);
      const updatedConn = await instagramIngestionService.getStatus();
      setInstagramConn(updatedConn);
    } finally {
      setTestingIngestion(false);
    }
  };

  const handleRunIdempotencyTest = async () => {
    setTestingIdempotency(true);
    setIngestionLog(null);
    try {
      await instagramIngestionService.runDiagnosticTest(true);
      const duplicateRes = await instagramIngestionService.runDiagnosticTest(true);
      setIngestionLog(duplicateRes);
    } finally {
      setTestingIdempotency(false);
    }
  };

  const handleCopyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const tabs: { key: SettingsTabKey; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
    { key: 'empresa', label: 'Minha Empresa', icon: Building2 },
    { key: 'canais', label: 'Canais Conectados', icon: Radio },
    { key: 'atendimento', label: 'Atendimento', icon: Clock },
    { key: 'ia', label: 'Inteligência Artificial', icon: Bot },
    { key: 'automacoes', label: 'Automações', icon: Zap },
    { key: 'conta', label: 'Conta', icon: User },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-6xl mx-auto">
      {/* Cabeçalho Principal da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-100 font-display flex items-center gap-2.5">
            <Settings size={22} className="text-cyan-400" />
            Configurações
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Personalize os dados da sua empresa, canais de comunicação, equipe e inteligência artificial.
          </p>
        </div>

        {/* Botão sutil para Administrador Técnico */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto ${
            showAdvanced
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
              : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border border-neutral-800 hover:text-neutral-200'
          }`}
          title="Acessar ferramentas técnicas de desenvolvedor"
        >
          <Wrench size={14} className={showAdvanced ? 'text-amber-400' : 'text-neutral-400'} />
          <span>Configurações avançadas</span>
          {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Navegação por Abas das 6 Áreas Obrigatórias */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-neutral-800/80 no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-950/20'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60 border border-transparent'
              }`}
            >
              <Icon size={15} className={isActive ? 'text-cyan-400' : 'text-neutral-400'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Conteúdo da Aba Selecionada */}
      <div className="min-h-[420px]">
        {activeTab === 'empresa' && <CompanySettingsSection />}

        {activeTab === 'canais' && (
          <ConnectedChannelsSection
            connections={connections}
            onRefresh={refresh}
            onOpenWhatsAppE2ETest={() => setWhatsAppE2EModalOpen(true)}
          />
        )}

        {activeTab === 'atendimento' && <AttendanceSettingsSection />}

        {activeTab === 'ia' && <AISettingsSection />}

        {activeTab === 'automacoes' && (
          <AutomationsSettingsSection onNavigate={onNavigate} />
        )}

        {activeTab === 'conta' && <AccountSettingsSection />}
      </div>

      {/* ÁREA DE CONFIGURAÇÕES AVANÇADAS (TÉCNICO / ADMINISTRADOR) */}
      {showAdvanced && (
        <div className="pt-8 border-t border-neutral-800 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-neutral-100 font-display flex items-center gap-2">
              <Wrench size={18} className="text-amber-400" />
              Painel de Infraestrutura e Configurações Avançadas
            </h3>
            <button
              type="button"
              onClick={() => setShowAdvanced(false)}
              className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
            >
              Ocultar área técnica
            </button>
          </div>

          <AdvancedSettingsSection
            healthReport={healthReport}
            runningHealthCheck={runningHealthCheck}
            onRunFullHealthCheck={handleFullHealthCheck}
            isConnected={isConnected}
            supabaseConfig={supabaseConfig}
            testingSupabase={testingSupabase}
            supabaseTestFeedback={supabaseTestFeedback}
            onTestSupabase={handleTestSupabase}
            instagramConn={instagramConn}
            webhookUrl={webhookUrl}
            copiedWebhook={copiedWebhook}
            onCopyWebhookUrl={handleCopyWebhookUrl}
            testingIngestion={testingIngestion}
            testingIdempotency={testingIdempotency}
            ingestionLog={ingestionLog}
            onRunIngestionTest={handleRunIngestionTest}
            onRunIdempotencyTest={handleRunIdempotencyTest}
            onOpenWhatsAppE2EModal={() => setWhatsAppE2EModalOpen(true)}
            onOpenDeployModal={() => setDeployModalOpen(true)}
            onOpenSpecModal={() => setSpecModalOpen(true)}
            onOpenSchemaModal={() => setSchemaModalOpen(true)}
          />
        </div>
      )}

      {/* Modais Técnicos Preservados */}
      <SupabaseSchemaModal
        isOpen={schemaModalOpen}
        onClose={() => setSchemaModalOpen(false)}
      />

      <ArchitectureSpecModal
        isOpen={specModalOpen}
        onClose={() => setSpecModalOpen(false)}
      />

      <DeployGuideModal
        isOpen={deployModalOpen}
        onClose={() => setDeployModalOpen(false)}
        functions={healthReport?.backend.functions || []}
        backendAvailable={healthReport?.backend.available || false}
      />

      <WhatsAppE2ETestModal
        isOpen={whatsAppE2EModalOpen}
        onClose={() => setWhatsAppE2EModalOpen(false)}
        onNavigateToInbox={(convId) => {
          if (onSelectConversation) {
            onSelectConversation(convId);
          } else if (onNavigate) {
            onNavigate('conversations');
          }
        }}
      />
    </div>
  );
};
