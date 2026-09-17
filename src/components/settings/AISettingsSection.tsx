/**
 * FABRE AUTOMATION - Configurações: Inteligência Artificial
 * Release 9.1: Simplificação da Interface de Configurações
 * 
 * Permite ao usuário final:
 * - Ativar / Desativar atendimento por IA
 * - Escolher a personalidade do atendimento (presets amigáveis ou tom customizado)
 * - Inserir instruções da empresa para a IA
 */

import React, { useState, useEffect } from 'react';
import { Bot, Sparkles, CheckCircle2, Save, MessageSquare, ShieldCheck, ToggleLeft, ToggleRight } from 'lucide-react';
import { aiService } from '../../services';
import { AIConfiguration } from '../../types';

const PERSONALITY_PRESETS = [
  {
    id: 'elegante',
    label: 'Elegante e Profissional',
    desc: 'Tom polido, acolhedor, refinado e focado em alta resolução.',
    value: 'Elegante, polido, empático e resolutivo',
  },
  {
    id: 'amigavel',
    label: 'Amigável e Descontraído',
    desc: 'Tom caloroso, leve, comunicativo e dinâmico com emojis discretos.',
    value: 'Amigável, caloroso, atencioso e descontraído com comunicação clara',
  },
  {
    id: 'formal',
    label: 'Formal e Direto',
    desc: 'Comunicação executiva, objetiva e concisa, sem gírias.',
    value: 'Formal, preciso, corporativo e estritamente focado em dados e respostas diretas',
  },
  {
    id: 'consultivo',
    label: 'Consultivo e Educador',
    desc: 'Explica detalhes, tira dúvidas com paciência e orienta a escolha do cliente.',
    value: 'Consultivo, pedagógico, atencioso e focado em solucionar as dores do seguidor',
  },
];

export const AISettingsSection: React.FC = () => {
  const [aiEnabled, setAiEnabled] = useState(true);
  const [personalityTone, setPersonalityTone] = useState('Elegante, polido, empático e resolutivo');
  const [companyInstructions, setCompanyInstructions] = useState(
    'Você é a assistente virtual oficial do Casal Fabre. Responda com simpatia e clareza. Use as informações cadastradas sobre nossos produtos, cursos e eventos. Nunca prometa descontos sem autorização prévia e, caso o cliente queira falar com nossa equipe, informe que vamos transferir o atendimento.'
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    aiService.getConfiguration().then((cfg) => {
      if (cfg) {
        if (cfg.personalityTone) setPersonalityTone(cfg.personalityTone);
        if (cfg.systemPrompt) setCompanyInstructions(cfg.systemPrompt);
      }
      // Verificar estado de ativação localmente
      const savedEnabled = localStorage.getItem('fabre_ai_active_state');
      if (savedEnabled !== null) {
        setAiEnabled(savedEnabled === 'true');
      }
      setLoading(false);
    });
  }, []);

  const handleSelectPreset = (val: string) => {
    setPersonalityTone(val);
  };

  const handleToggleAI = () => {
    const next = !aiEnabled;
    setAiEnabled(next);
    localStorage.setItem('fabre_ai_active_state', String(next));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      localStorage.setItem('fabre_ai_active_state', String(aiEnabled));
      await aiService.updateConfiguration({
        personalityTone,
        systemPrompt: companyInstructions,
      });

      setSaving(false);
      setFeedback('Configurações de Inteligência Artificial atualizadas!');
      setTimeout(() => setFeedback(null), 3500);
    } catch {
      setSaving(false);
      setFeedback('Erro ao sincronizar com o serviço de IA.');
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-neutral-500 font-mono">
        Carregando configurações de inteligência artificial...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header da Seção */}
      <div className="border-b border-neutral-800/80 pb-4">
        <h3 className="text-lg font-bold text-neutral-100 font-display flex items-center gap-2.5">
          <Bot size={20} className="text-purple-400" />
          Inteligência Artificial
        </h3>
        <p className="text-xs text-neutral-400 mt-1">
          Ajuste como a assistente inteligente atua nas respostas aos clientes, personalizando seu comportamento e orientações gerais da empresa.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Ativar/Desativar Atendimento por IA */}
        <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-neutral-100">
                Atendimento por Inteligência Artificial
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                aiEnabled 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                  : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
              }`}>
                {aiEnabled ? 'Ativado' : 'Pausado'}
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              {aiEnabled
                ? 'A IA responderá prontamente nos canais conectados utilizando a base de conhecimento.'
                : 'A IA está pausada. As mensagens permanecerão na caixa de entrada para atendimento humano manual.'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleToggleAI}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
              aiEnabled
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30'
                : 'bg-neutral-800 text-neutral-300 border border-neutral-700 hover:bg-neutral-700'
            }`}
          >
            {aiEnabled ? (
              <>
                <CheckCircle2 size={14} className="text-emerald-400" />
                <span>IA Ativa (Clique para Pausar)</span>
              </>
            ) : (
              <>
                <ToggleLeft size={14} className="text-neutral-400" />
                <span>IA Pausada (Clique para Ativar)</span>
              </>
            )}
          </button>
        </div>

        {/* Personalidade do Atendimento */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-neutral-200 block">
              Personalidade e Tom de Voz
            </label>
            <p className="text-xs text-neutral-400 mt-0.5">
              Escolha o estilo de comunicação que melhor reflete a marca:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PERSONALITY_PRESETS.map((preset) => {
              const isSelected = personalityTone === preset.value;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset.value)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-1.5 ${
                    isSelected
                      ? 'bg-purple-950/20 border-purple-500/50 shadow-sm shadow-purple-950/20'
                      : 'bg-neutral-900/40 border-neutral-800/80 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${isSelected ? 'text-purple-300' : 'text-neutral-200'}`}>
                      {preset.label}
                    </span>
                    {isSelected && <CheckCircle2 size={13} className="text-purple-400 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    {preset.desc}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Campo de personalização detalhada */}
          <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800/80 space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Sparkles size={13} className="text-purple-400" />
              Descrição Personalizada do Tom
            </label>
            <input
              type="text"
              value={personalityTone}
              onChange={(e) => setPersonalityTone(e.target.value)}
              placeholder="Ex: Elegante, empático, acolhedor e resolutivo"
              className="w-full px-3.5 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Instruções da Empresa para a IA */}
        <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800/80 space-y-2">
          <div>
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <MessageSquare size={13} className="text-cyan-400" />
              Instruções e Regras da Empresa para a IA
            </label>
            <p className="text-xs text-neutral-400 mt-0.5">
              Escreva em linguagem natural as orientações que a assistente deve seguir sobre sua empresa, produtos, horário e políticas:
            </p>
          </div>

          <textarea
            rows={5}
            value={companyInstructions}
            onChange={(e) => setCompanyInstructions(e.target.value)}
            placeholder="Oriente a IA sobre como responder seus clientes, que temas são prioritários e quais restrições devem ser respeitadas..."
            className="w-full px-3.5 py-2.5 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-purple-500 resize-none leading-relaxed"
          />
        </div>

        {/* Rodapé de Ações */}
        <div className="flex items-center justify-between pt-2">
          {feedback ? (
            <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 size={14} />
              {feedback}
            </span>
          ) : (
            <span className="text-xs text-neutral-500">
              As instruções são aplicadas diretamente às próximas respostas.
            </span>
          )}

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors flex items-center gap-2 cursor-pointer shadow-lg shadow-purple-950/40 disabled:opacity-50"
          >
            <Save size={14} />
            <span>{saving ? 'Salvando...' : 'Salvar configurações de IA'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
