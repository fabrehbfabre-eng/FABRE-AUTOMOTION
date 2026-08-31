/**
 * FABRE AUTOMATION - Automations Page
 * Release 1: Foundation & Architecture
 */

import React, { useState } from 'react';
import { AutomationCard } from '../components/automations/AutomationCard';
import { AutomationModal } from '../components/automations/AutomationModal';
import { useAutomations } from '../hooks/useAutomations';
import { ChannelType, Automation } from '../types';
import { Zap, Plus, Search, Filter, Sparkles, Layers } from 'lucide-react';

export const AutomationsPage: React.FC = () => {
  const {
    automations,
    loading,
    channelFilter,
    setChannelFilter,
    searchQuery,
    setSearchQuery,
    toggleAutomation,
    createAutomation,
    updateAutomation,
    deleteAutomation,
  } = useAutomations();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);

  const channels: { id: ChannelType | 'all'; label: string }[] = [
    { id: 'all', label: 'Todos os Canais' },
    { id: 'instagram', label: 'Instagram' },
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'messenger', label: 'Messenger' },
  ];

  const handleOpenCreate = () => {
    setEditingAutomation(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (automation: Automation) => {
    setEditingAutomation(automation);
    setModalOpen(true);
  };

  const handleSave = async (data: Omit<Automation, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'>) => {
    if (editingAutomation) {
      await updateAutomation(editingAutomation.id, data);
    } else {
      await createAutomation(data);
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header & New Rule CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-neutral-100 font-display flex items-center gap-2.5">
            <Zap size={22} className="text-cyan-400" />
            Regras de Automação
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Configure regras lógicas do tipo: <strong>"Quando acontecer X, faça Y"</strong> para responder seguidores automaticamente.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-neutral-950 transition-colors flex items-center gap-2 shadow-lg shadow-cyan-950/40 cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <Plus size={16} />
          <span>Criar Nova Regra</span>
        </button>
      </div>

      {/* Release Notice Banner */}
      <div className="p-4 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 text-neutral-300">
          <Sparkles size={16} className="text-cyan-400 shrink-0" />
          <span>
            <strong>Release 1:</strong> Estrutura lógica e visual de automações configurada. O motor de execução em tempo real será conectado na Release 2 junto com os Webhooks da Meta.
          </span>
        </div>
        <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/80 px-2.5 py-1 rounded-full border border-cyan-800/40 shrink-0">
          Foundation Ready
        </span>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        {/* Channel Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {channels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => setChannelFilter(ch.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                channelFilter === ch.id
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold'
                  : 'bg-neutral-900/60 text-neutral-400 border border-neutral-800 hover:text-neutral-200'
              }`}
            >
              {ch.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Buscar por nome, gatilho ou palavra-chave..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
      </div>

      {/* Automations List */}
      {loading ? (
        <div className="p-8 text-center text-xs text-neutral-500 font-mono">
          Carregando automações cadastradas...
        </div>
      ) : automations.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-neutral-800/80 bg-neutral-900/30 space-y-3">
          <Zap size={32} className="mx-auto text-neutral-600" />
          <h3 className="text-sm font-semibold text-neutral-200">Nenhuma regra encontrada</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            Crie sua primeira regra de resposta automática para comentários ou mensagens no Direct.
          </p>
          <button
            onClick={handleOpenCreate}
            className="mt-2 px-4 py-2 rounded-xl text-xs font-medium bg-neutral-800 text-neutral-200 border border-neutral-700 hover:bg-neutral-700 transition-colors cursor-pointer"
          >
            Cadastrar Regra Agora
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {automations.map((auto) => (
            <AutomationCard
              key={auto.id}
              automation={auto}
              onToggle={toggleAutomation}
              onEdit={handleOpenEdit}
              onDelete={deleteAutomation}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <AutomationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        initialData={editingAutomation}
      />
    </div>
  );
};
