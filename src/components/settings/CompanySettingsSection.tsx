/**
 * FABRE AUTOMATION - Configurações: Minha Empresa
 * Release 9.1: Simplificação da Interface de Configurações
 * 
 * Área amigável para o usuário final gerenciar os dados da empresa.
 */

import React, { useState, useEffect } from 'react';
import { Building2, Save, CheckCircle2, Image, Phone, Mail, MapPin, FileText } from 'lucide-react';

interface CompanyData {
  name: string;
  segment: string;
  phone: string;
  email: string;
  address: string;
  description: string;
  logoText: string;
}

const DEFAULT_COMPANY_DATA: CompanyData = {
  name: 'Casal Fabre',
  segment: 'Educação, Infoprodutos & Marketing Digital',
  phone: '+55 14 98840-3642',
  email: 'contato@casalfabre.com.br',
  address: 'Bauru, SP - Brasil',
  description: 'Atendimento inteligente multicanal com automação e IA para Instagram Direct, WhatsApp e Facebook Messenger.',
  logoText: 'CF',
};

const STORAGE_KEY = 'fabre_company_settings';

export const CompanySettingsSection: React.FC = () => {
  const [data, setData] = useState<CompanyData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_COMPANY_DATA, ...JSON.parse(saved) };
      }
    } catch {
      // fallback
    }
    return DEFAULT_COMPANY_DATA;
  });

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleChange = (field: keyof CompanyData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setTimeout(() => {
        setSaving(false);
        setFeedback('Informações da empresa salvas com sucesso!');
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
          <Building2 size={20} className="text-cyan-400" />
          Minha Empresa
        </h3>
        <p className="text-xs text-neutral-400 mt-1">
          Identificação institucional e dados gerais da sua marca exibidos nos atendimentos e relatórios.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Cartão de Identidade Visual / Logo */}
        <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-neutral-900 to-indigo-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-display font-bold text-xl shadow-lg shadow-cyan-950/40 shrink-0">
            {data.logoText || 'CF'}
          </div>

          <div className="flex-1 space-y-1">
            <h4 className="text-sm font-bold text-neutral-200">Logotipo / Monograma da Empresa</h4>
            <p className="text-xs text-neutral-400">
              Personalize o identificador visual exibido no painel e cabeçalhos.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                maxLength={4}
                value={data.logoText}
                onChange={(e) => handleChange('logoText', e.target.value.toUpperCase())}
                placeholder="CF"
                className="w-20 px-3 py-2 text-center text-xs font-mono font-bold bg-neutral-950 border border-neutral-800 rounded-xl text-cyan-300 placeholder-neutral-600 focus:outline-none focus:border-cyan-500"
                title="Sigla ou iniciais da marca"
              />
            </div>
            <span className="text-[11px] text-neutral-500 font-mono">Iniciais</span>
          </div>
        </div>

        {/* Campos de Dados Básicos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800/80 space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Building2 size={13} className="text-cyan-400" />
              Nome da Empresa
            </label>
            <input
              type="text"
              value={data.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Ex: Casal Fabre"
              required
              className="w-full px-3.5 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800/80 space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <FileText size={13} className="text-cyan-400" />
              Ramo / Segmento
            </label>
            <input
              type="text"
              value={data.segment}
              onChange={(e) => handleChange('segment', e.target.value)}
              placeholder="Ex: Marketing & Infoprodutos"
              className="w-full px-3.5 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800/80 space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Phone size={13} className="text-emerald-400" />
              Telefone / WhatsApp de Contato
            </label>
            <input
              type="text"
              value={data.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="Ex: +55 14 98840-3642"
              className="w-full px-3.5 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800/80 space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Mail size={13} className="text-purple-400" />
              E-mail Comercial / Suporte
            </label>
            <input
              type="email"
              value={data.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="Ex: contato@casalfabre.com.br"
              className="w-full px-3.5 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800/80 space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <MapPin size={13} className="text-amber-400" />
              Cidade / Localização
            </label>
            <input
              type="text"
              value={data.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="Ex: Bauru, SP - Brasil"
              className="w-full px-3.5 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800/80 space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-neutral-300">
              Descrição Curta da Empresa
            </label>
            <textarea
              rows={3}
              value={data.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Breve resumo sobre a empresa, missão e produtos principais..."
              className="w-full px-3.5 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-cyan-500 resize-none leading-relaxed"
            />
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
              Alterações aplicadas instantaneamente ao perfil da empresa.
            </span>
          )}

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-neutral-950 transition-colors flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-950/40 disabled:opacity-50"
          >
            <Save size={14} />
            <span>{saving ? 'Salvando...' : 'Salvar dados da empresa'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
