/**
 * FABRE AUTOMATION - Automation Modal (Control Plane Builder)
 * Release: Automation Control Plane
 * 
 * Supports full configuration of triggers and action sequences
 * with strict validation, reordering, and fail-closed integrity.
 */

import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import {
  Automation,
  ChannelType,
  AutomationTriggerType,
  AutomationActionType,
  AutomationAction,
} from '../../types';
import {
  Zap,
  ArrowRight,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  Clock,
  Tag,
  UserCheck,
  Bot,
  MessageSquare,
} from 'lucide-react';
import { validateAutomationData, AutomationValidationError } from '../../services/engine/validation';

interface AutomationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Automation, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'>) => Promise<void> | void;
  initialData?: Automation | null;
}

const ACTION_TYPE_OPTIONS: Array<{
  type: AutomationActionType;
  label: string;
  defaultName: string;
  defaultDescription: string;
}> = [
  {
    type: 'send_message',
    label: 'Enviar Mensagem de Resposta',
    defaultName: 'Enviar Mensagem de Texto',
    defaultDescription: 'Envia resposta automática pelo canal ativo',
  },
  {
    type: 'send_dm',
    label: 'Enviar Direct (Instagram)',
    defaultName: 'Enviar Direct',
    defaultDescription: 'Envia mensagem direta no Instagram Direct',
  },
  {
    type: 'add_tag',
    label: 'Adicionar Etiqueta (Tag)',
    defaultName: 'Aplicar Etiqueta',
    defaultDescription: 'Aplica tag de classificação ao contato',
  },
  {
    type: 'remove_tag',
    label: 'Remover Etiqueta (Tag)',
    defaultName: 'Remover Etiqueta',
    defaultDescription: 'Remove tag do contato',
  },
  {
    type: 'assign_human',
    label: 'Transferir para Atendimento Humano',
    defaultName: 'Transbordo Humano',
    defaultDescription: 'Transfere o controle da conversa para a equipe',
  },
  {
    type: 'query_ai',
    label: 'Consultar Base de Conhecimento (IA)',
    defaultName: 'Consulta RAG Oficial',
    defaultDescription: 'Gera resposta utilizando itens da base de conhecimento',
  },
  {
    type: 'delay',
    label: 'Aguardar Intervalo (Delay)',
    defaultName: 'Pausa Programada',
    defaultDescription: 'Aguarda alguns segundos antes da próxima ação',
  },
];

export const AutomationModal: React.FC<AutomationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [channel, setChannel] = useState<ChannelType | 'all'>('instagram');

  // Trigger state
  const [triggerType, setTriggerType] = useState<AutomationTriggerType>('keyword_direct');
  const [matchType, setMatchType] = useState<'exact' | 'contains' | 'regex'>('contains');
  const [keywords, setKeywords] = useState('');
  const [postUrl, setPostUrl] = useState('');
  const [inactivityHours, setInactivityHours] = useState<number>(24);

  // Actions state
  const [actions, setActions] = useState<AutomationAction[]>([]);
  const [selectedNewActionType, setSelectedNewActionType] = useState<AutomationActionType>('send_message');

  // UI state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setIsSaving(false);

      if (initialData) {
        setTitle(initialData.title || '');
        setDescription(initialData.description || '');
        setChannel(initialData.channel || 'instagram');
        setTriggerType(initialData.trigger.type || 'keyword_direct');
        setMatchType((initialData.trigger.config.matchType as 'exact' | 'contains' | 'regex') || 'contains');
        setKeywords(initialData.trigger.config.keywords?.join(', ') || '');
        setPostUrl((initialData.trigger.config.postUrl as string) || '');
        setInactivityHours(Number(initialData.trigger.config.inactivityHours) || 24);

        // Deep copy actions
        setActions(
          initialData.actions && initialData.actions.length > 0
            ? initialData.actions.map(act => ({
                id: act.id,
                type: act.type,
                name: act.name,
                description: act.description,
                config: { ...act.config },
              }))
            : [
                {
                  id: `act_${Date.now()}_1`,
                  type: 'send_message',
                  name: 'Enviar Resposta Automática',
                  description: 'Envia mensagem configurada',
                  config: { messageText: 'Olá! Como podemos ajudar?' },
                },
              ]
        );
      } else {
        // Defaults for new automation
        setTitle('');
        setDescription('');
        setChannel('instagram');
        setTriggerType('keyword_direct');
        setMatchType('contains');
        setKeywords('INFO, ajuda');
        setPostUrl('');
        setInactivityHours(24);
        setActions([
          {
            id: `act_${Date.now()}_1`,
            type: 'send_message',
            name: 'Enviar Mensagem de Texto',
            description: 'Envia resposta automática pelo canal ativo',
            config: {
              messageText: 'Olá! Agradecemos sua mensagem. Seguem as informações oficiais.',
            },
          },
        ]);
      }
    }
  }, [isOpen, initialData]);

  // Action reordering
  const moveActionUp = (index: number) => {
    if (index <= 0) return;
    setActions(prev => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const moveActionDown = (index: number) => {
    if (index >= actions.length - 1) return;
    setActions(prev => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const removeAction = (index: number) => {
    setActions(prev => prev.filter((_, i) => i !== index));
  };

  const addAction = () => {
    const opt = ACTION_TYPE_OPTIONS.find(o => o.type === selectedNewActionType);
    const newAct: AutomationAction = {
      id: `act_${Date.now()}_${actions.length + 1}`,
      type: selectedNewActionType,
      name: opt ? opt.defaultName : 'Nova Ação',
      description: opt ? opt.defaultDescription : '',
      config:
        selectedNewActionType === 'send_message' || selectedNewActionType === 'send_dm'
          ? { messageText: '' }
          : selectedNewActionType === 'add_tag' || selectedNewActionType === 'remove_tag'
          ? { tagName: '' }
          : selectedNewActionType === 'delay'
          ? { delaySeconds: 5 }
          : selectedNewActionType === 'assign_human'
          ? { handoffMessage: 'Transferindo seu atendimento para um atendente humano...' }
          : {},
    };
    setActions(prev => [...prev, newAct]);
  };

  const updateActionConfig = (index: number, key: string, value: any) => {
    setActions(prev => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        config: {
          ...next[index].config,
          [key]: value,
        },
      };
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const keywordsArray = keywords
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);

    // Build trigger object
    let triggerName = 'Gatilho de Automação';
    let triggerDesc = '';

    if (triggerType === 'keyword_direct') {
      triggerName = 'Mensagem com Palavra-Chave';
      triggerDesc = `Aciona quando o texto corresponder (${matchType}): ${keywordsArray.join(', ')}`;
    } else if (triggerType === 'comment_post') {
      triggerName = 'Comentário em Post do Feed';
      triggerDesc = keywordsArray.length > 0
        ? `Aciona em comentários contendo: ${keywordsArray.join(', ')}`
        : 'Aciona em qualquer comentário na publicação';
    } else if (triggerType === 'story_reply') {
      triggerName = 'Resposta ao Story';
      triggerDesc = keywordsArray.length > 0
        ? `Aciona em respostas contendo: ${keywordsArray.join(', ')}`
        : 'Aciona em qualquer resposta a Stories';
    } else if (triggerType === 'first_contact') {
      triggerName = 'Primeiro Contato (Boas-Vindas)';
      triggerDesc = 'Aciona no primeiro contato do seguidor com o canal';
    } else if (triggerType === 'inactive_followup') {
      triggerName = 'Follow-up de Inatividade';
      triggerDesc = `Aciona após ${inactivityHours}h de inatividade`;
    }

    const triggerConfig: Record<string, any> = {};
    if (triggerType === 'keyword_direct') {
      triggerConfig.keywords = keywordsArray;
      triggerConfig.matchType = matchType;
    } else if (triggerType === 'comment_post') {
      if (keywordsArray.length > 0) triggerConfig.keywords = keywordsArray;
      if (postUrl.trim()) triggerConfig.postUrl = postUrl.trim();
    } else if (triggerType === 'story_reply') {
      if (keywordsArray.length > 0) triggerConfig.keywords = keywordsArray;
    } else if (triggerType === 'inactive_followup') {
      triggerConfig.inactivityHours = Number(inactivityHours);
    }

    const candidateData: Omit<Automation, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'> = {
      title: title.trim(),
      description: description.trim(),
      channel,
      enabled: initialData ? initialData.enabled : true,
      trigger: {
        type: triggerType,
        name: triggerName,
        description: triggerDesc,
        config: triggerConfig,
      },
      actions: actions.map(a => ({
        id: a.id,
        type: a.type,
        name: a.name,
        description: a.description,
        config: a.config,
      })),
    };

    // Client-side fail-closed validation
    try {
      validateAutomationData(candidateData);
    } catch (err) {
      if (err instanceof AutomationValidationError) {
        setErrorMsg(err.message);
      } else if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Dados da automação inválidos.');
      }
      return;
    }

    setIsSaving(true);
    try {
      await onSave(candidateData);
      onClose();
    } catch (err: any) {
      console.error('Falha ao salvar automação:', err);
      setErrorMsg(err.message || 'Erro inesperado ao salvar a automação no banco de dados.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Editar Regra de Automação' : 'Criar Nova Regra de Automação'}
      subtitle="Configure o gatilho determinístico e a sequência de ações a serem executadas pelo Rule Engine"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error Notification Banner */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/80 flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
            <div>
              <strong className="font-semibold block text-rose-200">Validação da Regra</strong>
              {errorMsg}
            </div>
          </div>
        )}

        {/* 1. Basic Metadata */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1">
                Nome da Automação <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Resposta Automática por Palavra-Chave 'INFO'"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">
                Canal Alvo
              </label>
              <select
                value={channel}
                onChange={e => setChannel(e.target.value as ChannelType | 'all')}
                className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 focus:outline-none focus:border-cyan-500/50"
              >
                <option value="instagram">Instagram</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="messenger">Messenger</option>
                <option value="all">Todos os Canais</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">
              Descrição / Objetivo
            </label>
            <input
              type="text"
              placeholder="Ex: Envia orientações e aplica tag ao seguidor que solicitar informações"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
        </div>

        {/* 2. TRIGGER BUILDER */}
        <div className="p-4 rounded-xl bg-neutral-950/70 border border-cyan-500/30 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 font-display">
              <Zap size={15} />
              <span>GATILHO (Quando acontecer...)</span>
            </div>
            <span className="text-[10px] font-mono text-neutral-400 uppercase bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
              Trigger Engine
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-neutral-400 font-medium">Tipo de Evento</label>
              <select
                value={triggerType}
                onChange={e => setTriggerType(e.target.value as AutomationTriggerType)}
                className="w-full px-3 py-2 text-xs bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-none focus:border-cyan-500/50"
              >
                <option value="keyword_direct">Mensagem Direta com Palavra-Chave</option>
                <option value="first_contact">Primeiro Contato no Canal (Boas-Vindas)</option>
                <option value="comment_post">Comentário em Publicação do Feed</option>
                <option value="story_reply">Resposta ao Story do Instagram</option>
                <option value="inactive_followup">Follow-up de Inatividade</option>
              </select>
            </div>

            {triggerType === 'keyword_direct' && (
              <div className="space-y-1">
                <label className="text-[11px] text-neutral-400 font-medium">Modo de Correspondência</label>
                <select
                  value={matchType}
                  onChange={e => setMatchType(e.target.value as 'exact' | 'contains' | 'regex')}
                  className="w-full px-3 py-2 text-xs bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="contains">Contém a Palavra-Chave (Recomendado)</option>
                  <option value="exact">Mensagem Exata (Idêntica)</option>
                  <option value="regex">Expressão Regular (Regex Avançado)</option>
                </select>
              </div>
            )}

            {triggerType === 'inactive_followup' && (
              <div className="space-y-1">
                <label className="text-[11px] text-neutral-400 font-medium">Horas de Inatividade</label>
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={inactivityHours}
                  onChange={e => setInactivityHours(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-none focus:border-cyan-500/50 font-mono"
                />
              </div>
            )}
          </div>

          {/* Trigger Details by Type */}
          {triggerType === 'keyword_direct' && (
            <div className="space-y-1 pt-1">
              <label className="text-[11px] text-neutral-400 flex items-center justify-between">
                <span>
                  {matchType === 'regex' ? 'Padrões Regex (separados por vírgula)' : 'Palavras-chave (separadas por vírgula)'}
                </span>
                {matchType === 'regex' && (
                  <span className="text-[10px] text-cyan-400 font-mono">Ex: ^(preço|valor|custa)\b</span>
                )}
              </label>
              <input
                type="text"
                placeholder={matchType === 'regex' ? '^(info|ajuda), .*catalogo.*' : 'INFO, informacoes, ajuda, suporte'}
                value={keywords}
                onChange={e => setKeywords(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-100 focus:outline-none focus:border-cyan-500/50 font-mono"
              />
              <p className="text-[10px] text-neutral-500">
                {matchType === 'contains' && 'Dispara se o texto recebido contiver qualquer uma dessas palavras.'}
                {matchType === 'exact' && 'Dispara se a mensagem recebida for exatamente igual a uma dessas palavras.'}
                {matchType === 'regex' && 'Cada padrão será compilado e testado com RegExp case-insensitive.'}
              </p>
            </div>
          )}

          {triggerType === 'comment_post' && (
            <div className="space-y-2 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] text-neutral-400">URL ou ID do Post (Opcional - vazio para qualquer post)</label>
                <input
                  type="text"
                  placeholder="https://instagram.com/p/..."
                  value={postUrl}
                  onChange={e => setPostUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-none focus:border-cyan-500/50 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-neutral-400">Palavras-chave no Comentário (Opcional - vazio para todos)</label>
                <input
                  type="text"
                  placeholder="QUERO, eu quero, link"
                  value={keywords}
                  onChange={e => setKeywords(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-none focus:border-cyan-500/50 font-mono"
                />
              </div>
            </div>
          )}

          {triggerType === 'story_reply' && (
            <div className="space-y-1 pt-1">
              <label className="text-[11px] text-neutral-400">Palavras-chave na Resposta ao Story (Opcional)</label>
              <input
                type="text"
                placeholder="Vazio para responder a qualquer reação ou texto no Story"
                value={keywords}
                onChange={e => setKeywords(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-none focus:border-cyan-500/50 font-mono"
              />
            </div>
          )}

          {triggerType === 'first_contact' && (
            <div className="p-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800 text-[11px] text-neutral-400">
              Dispara automaticamente na <strong>primeira mensagem</strong> recebida de um seguidor ou contato que ainda não possua histórico no sistema.
            </div>
          )}
        </div>

        {/* 3. ACTION SEQUENCE BUILDER */}
        <div className="p-4 rounded-xl bg-neutral-950/70 border border-emerald-500/30 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 font-display">
              <ArrowRight size={15} />
              <span>AÇÕES A EXECUTAR (Sequência ordenada)</span>
            </div>
            <span className="text-[10px] font-mono text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
              {actions.length} {actions.length === 1 ? 'Ação' : 'Ações'}
            </span>
          </div>

          {/* Action List */}
          <div className="space-y-3">
            {actions.map((act, index) => (
              <div
                key={act.id}
                className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2.5"
              >
                {/* Header: step number, title, reordering buttons, remove */}
                <div className="flex items-center justify-between gap-2 border-b border-neutral-800/80 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-[11px] font-mono font-bold flex items-center justify-center shrink-0 border border-emerald-500/30">
                      {index + 1}
                    </span>
                    <span className="text-xs font-semibold text-neutral-200">
                      {act.name}
                    </span>
                    <span className="text-[10px] font-mono text-neutral-400 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800">
                      {act.type}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveActionUp(index)}
                      className="p-1 rounded text-neutral-400 hover:text-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-800"
                      title="Mover para cima"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={index === actions.length - 1}
                      onClick={() => moveActionDown(index)}
                      className="p-1 rounded text-neutral-400 hover:text-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-neutral-800"
                      title="Mover para baixo"
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAction(index)}
                      className="p-1 rounded text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors ml-1"
                      title="Excluir ação"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Specific Config Fields per Action Type */}
                {(act.type === 'send_message' || act.type === 'send_dm') && (
                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-400 flex items-center justify-between">
                      <span>Texto da Mensagem</span>
                      <span className="text-[10px] text-neutral-500 font-mono">sender: bot</span>
                    </label>
                    <textarea
                      rows={2}
                      required
                      placeholder="Digite a resposta automática oficial..."
                      value={act.config.messageText || ''}
                      onChange={e => updateActionConfig(index, 'messageText', e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-emerald-500/50 font-mono resize-none"
                    />
                  </div>
                )}

                {(act.type === 'add_tag' || act.type === 'remove_tag') && (
                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                      <Tag size={12} className="text-cyan-400" />
                      <span>Nome da Etiqueta (Tag)</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Interesse-Info, Lead-Qualificado"
                      value={act.config.tagName || ''}
                      onChange={e => updateActionConfig(index, 'tagName', e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-cyan-500/50 font-mono"
                    />
                  </div>
                )}

                {act.type === 'assign_human' && (
                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                      <UserCheck size={12} className="text-amber-400" />
                      <span>Mensagem de Transbordo (Opcional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Aguarde um instante, estou transferindo você para nosso atendimento humano..."
                      value={act.config.handoffMessage || ''}
                      onChange={e => updateActionConfig(index, 'handoffMessage', e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-amber-500/50 font-mono"
                    />
                  </div>
                )}

                {act.type === 'query_ai' && (
                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                      <Bot size={12} className="text-purple-400" />
                      <span>Instrução Adicional para IA (Opcional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Responda tirando dúvidas sobre o produto com base na base de conhecimento oficial"
                      value={act.config.aiPrompt || ''}
                      onChange={e => updateActionConfig(index, 'aiPrompt', e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-purple-500/50 font-mono"
                    />
                  </div>
                )}

                {act.type === 'delay' && (
                  <div className="space-y-1">
                    <label className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                      <Clock size={12} className="text-amber-400" />
                      <span>Tempo de Espera (em segundos)</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={300}
                      value={act.config.delaySeconds || 5}
                      onChange={e => updateActionConfig(index, 'delaySeconds', Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 focus:outline-none focus:border-amber-500/50 font-mono"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add New Action Control */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
            <select
              value={selectedNewActionType}
              onChange={e => setSelectedNewActionType(e.target.value as AutomationActionType)}
              className="flex-1 px-3 py-2 text-xs bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-emerald-500/50"
            >
              {ACTION_TYPE_OPTIONS.map(opt => (
                <option key={opt.type} value={opt.type}>
                  + {opt.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={addAction}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus size={14} />
              <span>Adicionar Ação</span>
            </button>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-800/80">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-xl text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2 text-xs font-semibold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-neutral-950 transition-colors cursor-pointer shadow-md shadow-cyan-950/40 disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving && (
              <div className="w-3 h-3 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
            )}
            <span>{initialData ? 'Salvar Alterações' : 'Criar Regra de Automação'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
