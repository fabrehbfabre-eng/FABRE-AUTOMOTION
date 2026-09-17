/**
 * FABRE AUTOMATION - Configurações: Atendimento
 * Release 9.1: Simplificação da Interface de Configurações
 * 
 * Permite configurar o nome da equipe/atendente, horário de atendimento,
 * mensagem de boas-vindas e mensagem para fora do expediente.
 */

import React, { useState } from 'react';
import { Clock, Users, MessageSquare, Moon, Save, CheckCircle2 } from 'lucide-react';

interface AttendanceSettings {
  teamName: string;
  businessHoursText: string;
  daysText: string;
  welcomeMessage: string;
  outOfHoursMessage: string;
}

const DEFAULT_ATTENDANCE: AttendanceSettings = {
  teamName: 'Equipe de Atendimento Casal Fabre',
  businessHoursText: '08:00 às 18:00',
  daysText: 'Segunda a Sexta (Sábado das 09:00 às 13:00)',
  welcomeMessage: 'Olá! Seja muito bem-vindo(a) ao Casal Fabre! 👋 Como posso ajudar você hoje?',
  outOfHoursMessage: 'Olá! Agradecemos sua mensagem. Nosso horário de atendimento no momento encerrou, mas sua mensagem foi registrada e entraremos em contato logo no início do nosso próximo expediente!',
};

const STORAGE_KEY = 'fabre_attendance_settings';

export const AttendanceSettingsSection: React.FC = () => {
  const [settings, setSettings] = useState<AttendanceSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_ATTENDANCE, ...JSON.parse(saved) };
      }
    } catch {
      // fallback
    }
    return DEFAULT_ATTENDANCE;
  });

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleChange = (field: keyof AttendanceSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setTimeout(() => {
        setSaving(false);
        setFeedback('Configurações de atendimento salvas com sucesso!');
        setTimeout(() => setFeedback(null), 3500);
      }, 300);
    } catch {
      setSaving(false);
      setFeedback('Erro ao salvar localmente.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header da Seção */}
      <div className="border-b border-neutral-800/80 pb-4">
        <h3 className="text-lg font-bold text-neutral-100 font-display flex items-center gap-2.5">
          <Clock size={20} className="text-cyan-400" />
          Atendimento
        </h3>
        <p className="text-xs text-neutral-400 mt-1">
          Defina como sua equipe é identificada, os horários de operação e as mensagens automáticas de recepção e ausência.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Nome da Equipe / Atendente */}
          <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800/80 space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Users size={13} className="text-cyan-400" />
              Nome do Atendente / Equipe de Atendimento
            </label>
            <input
              type="text"
              value={settings.teamName}
              onChange={(e) => handleChange('teamName', e.target.value)}
              placeholder="Ex: Equipe de Atendimento Casal Fabre"
              required
              className="w-full px-3.5 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-cyan-500"
            />
            <span className="text-[11px] text-neutral-500 block">
              Nome exibido ao cliente quando o atendimento for assumido por um atendente humano.
            </span>
          </div>

          {/* Horário de Atendimento */}
          <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800/80 space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Clock size={13} className="text-amber-400" />
              Horário de Atendimento
            </label>
            <input
              type="text"
              value={settings.businessHoursText}
              onChange={(e) => handleChange('businessHoursText', e.target.value)}
              placeholder="Ex: 08:00 às 18:00"
              required
              className="w-full px-3.5 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Dias de Funcionamento */}
          <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800/80 space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Clock size={13} className="text-amber-400" />
              Dias da Semana
            </label>
            <input
              type="text"
              value={settings.daysText}
              onChange={(e) => handleChange('daysText', e.target.value)}
              placeholder="Ex: Segunda a Sexta (Sábado das 09h às 13h)"
              required
              className="w-full px-3.5 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Mensagem de Boas-Vindas */}
          <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800/80 space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <MessageSquare size={13} className="text-emerald-400" />
              Mensagem de Boas-Vindas
            </label>
            <textarea
              rows={3}
              value={settings.welcomeMessage}
              onChange={(e) => handleChange('welcomeMessage', e.target.value)}
              placeholder="Mensagem enviada automaticamente quando um cliente inicia uma conversa..."
              required
              className="w-full px-3.5 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-cyan-500 resize-none leading-relaxed"
            />
            <span className="text-[11px] text-neutral-500 block">
              Enviada na primeira interação do contato no canal.
            </span>
          </div>

          {/* Mensagem Fora do Horário */}
          <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800/80 space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Moon size={13} className="text-purple-400" />
              Mensagem Fora do Horário de Atendimento
            </label>
            <textarea
              rows={3}
              value={settings.outOfHoursMessage}
              onChange={(e) => handleChange('outOfHoursMessage', e.target.value)}
              placeholder="Mensagem enviada quando clientes entrarem em contato após o expediente ou feriados..."
              required
              className="w-full px-3.5 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-cyan-500 resize-none leading-relaxed"
            />
            <span className="text-[11px] text-neutral-500 block">
              Avisa o cliente de forma acolhedora sobre o retorno da equipe.
            </span>
          </div>
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
              As mensagens são salvas e ativadas imediatamente.
            </span>
          )}

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-neutral-950 transition-colors flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-950/40 disabled:opacity-50"
          >
            <Save size={14} />
            <span>{saving ? 'Salvando...' : 'Salvar configurações de atendimento'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
