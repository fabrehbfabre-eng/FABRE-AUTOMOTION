/**
 * FABRE AUTOMATION - Operator Login Screen
 * Release 13: Operator Authentication + Secure Automation Outbound
 * 
 * Professional, high-contrast dark theme login interface.
 * Strictly uses Supabase Auth with email & password.
 */

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Cpu, 
  Lock, 
  Mail, 
  LogIn, 
  AlertCircle, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Loader2, 
  Database 
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { signIn, isConfigured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Informe o e-mail e a senha de operador.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await signIn(email, password);
    if (!result.success) {
      setErrorMessage(result.error || 'Falha ao autenticar operador.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#08090d] text-neutral-100 flex flex-col justify-center items-center px-4 sm:px-6 relative overflow-hidden select-none">
      {/* Background Decorative Ambient Glow */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-cyan-950/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-emerald-950/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-neutral-900 to-indigo-500/20 border border-cyan-500/30 text-cyan-400 shadow-xl shadow-cyan-950/50 mb-4">
            <Cpu size={28} className="text-cyan-300" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="text-xl font-bold tracking-wider text-neutral-100 font-display">
              FABRE
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
              AUTOMATION
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1 font-mono">
            Painel de Acesso Operacional • Supabase Auth
          </p>
        </div>

        {/* Card */}
        <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl shadow-black/80">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-neutral-100">
              Autenticação de Operador
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Entre com as credenciais cadastradas na instância Supabase.
            </p>
          </div>

          {/* Environment Warning if Supabase is unconfigured */}
          {!isConfigured && (
            <div className="mb-5 p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 flex items-start gap-2.5 text-xs text-amber-300">
              <Database size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Supabase Não Configurado</span>
                <span className="text-[11px] text-amber-200/80 leading-relaxed block mt-0.5">
                  As variáveis <code className="font-mono text-amber-300">VITE_SUPABASE_URL</code> e <code className="font-mono text-amber-300">VITE_SUPABASE_PUBLISHABLE_KEY</code> precisam ser configuradas para autenticar em produção.
                </span>
              </div>
            </div>
          )}

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="mb-5 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start gap-2.5 text-xs text-rose-300 animate-in fade-in duration-200">
              <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-[11px] leading-relaxed">
                {errorMessage}
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5 font-mono">
                E-MAIL DO OPERADOR
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operador@fabreautomation.com"
                  autoComplete="email"
                  required
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-sans disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5 font-mono">
                SENHA
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                  <Lock size={16} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  required
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-sans disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-500 hover:text-neutral-300 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !isConfigured}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-medium text-sm transition-all shadow-lg shadow-cyan-950/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin text-white" />
                  <span>Validando Sessão...</span>
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  <span>Entrar no Sistema</span>
                </>
              )}
            </button>
          </form>

          {/* Security Assurance Footer Note */}
          <div className="mt-6 pt-5 border-t border-neutral-800/80 flex items-start gap-2 text-[11px] text-neutral-400">
            <ShieldCheck size={14} className="text-emerald-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong className="text-neutral-300">Segurança Fail-Closed:</strong> Operações de envio outbound exigem claim server-side autorizada (<code className="font-mono text-emerald-400 text-[10px]">app_metadata.role: operator | admin</code>).
            </p>
          </div>
        </div>

        {/* System Version Footnote */}
        <div className="text-center mt-6 text-[11px] text-neutral-500 font-mono">
          FABRE AUTOMATION • Release 13 • Operator Authentication
        </div>
      </div>
    </div>
  );
};
