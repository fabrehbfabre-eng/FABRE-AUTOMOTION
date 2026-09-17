/**
 * FABRE AUTOMATION - Public Signup & Operator Authentication Screen
 * Release: Public Signup & User Onboarding
 * 
 * Professional, high-contrast dark theme authentication interface.
 * Strictly uses official Supabase Auth for both login and signup:
 * - Login: supabase.auth.signInWithPassword
 * - Signup: supabase.auth.signUp with full_name in user metadata
 * - Confirmation: respects Supabase email confirmation configuration
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getLocalDiagnostics, LocalDiagnosticInfo } from '../../lib/supabase';
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
  Database,
  User,
  UserPlus,
  ArrowLeft,
  CheckCircle2,
  Chrome,
  Activity,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from 'lucide-react';

type AuthMode = 'login' | 'signup' | 'confirmation_sent';

export const LoginPage: React.FC = () => {
  const { signIn, signUp, signInWithGoogle, isConfigured } = useAuth();
  
  // Active view mode
  const [authMode, setAuthMode] = useState<AuthMode>('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Signup form state
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);

  // Submission feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState('');

  // Local Environment Diagnostics (FASE 8)
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnostics, setDiagnostics] = useState<LocalDiagnosticInfo | null>(null);
  const [isLoadingDiag, setIsLoadingDiag] = useState(false);

  const loadDiagnostics = async () => {
    setIsLoadingDiag(true);
    try {
      const info = await getLocalDiagnostics();
      setDiagnostics(info);
    } catch {
      // safe fallback
    } finally {
      setIsLoadingDiag(false);
    }
  };

  // Check URL parameters for OAuth returns or errors on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const error = searchParams.get('error') || hashParams.get('error');
      const errorDesc = searchParams.get('error_description') || hashParams.get('error_description');

      if (error || errorDesc) {
        const decoded = errorDesc ? decodeURIComponent(errorDesc).replace(/\+/g, ' ') : '';
        if (decoded.toLowerCase().includes('unsupported provider') || error === 'validation_failed') {
          setErrorMessage('O login com Google não está ativo no painel do Supabase. Para ativá-lo, vá em Authentication > Providers > Google.');
        } else if (decoded) {
          setErrorMessage(decoded);
        } else {
          setErrorMessage('Autenticação com Google foi cancelada ou não autorizada.');
        }
        // Clean URL without reloading page
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch {
      // silent
    }
  }, []);

  // Switch mode and clear errors
  const handleSwitchMode = (mode: AuthMode) => {
    setAuthMode(mode);
    setErrorMessage(null);
  };

  // -------------------------------------------------------------
  // Google OAuth Handler
  // -------------------------------------------------------------
  const handleGoogleAuth = async () => {
    setErrorMessage(null);
    setIsGoogleSubmitting(true);
    try {
      const result = await signInWithGoogle();
      if (!result.success) {
        setErrorMessage(result.error || 'Falha ao iniciar autenticação com Google.');
        setIsGoogleSubmitting(false);
      }
    } catch {
      setErrorMessage('Não foi possível conectar ao serviço. Verifique sua conexão e tente novamente.');
      setIsGoogleSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // Login Handler
  // -------------------------------------------------------------
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const email = loginEmail.trim();
    if (!email) {
      setErrorMessage('Informe um e-mail válido.');
      return;
    }
    if (!loginPassword) {
      setErrorMessage('Informe uma senha.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await signIn(email, loginPassword);
      if (!result.success) {
        setErrorMessage(result.error || 'Falha ao autenticar.');
        setIsSubmitting(false);
      }
    } catch {
      setErrorMessage('Não foi possível conectar ao serviço. Verifique sua conexão e tente novamente.');
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // Signup Handler
  // -------------------------------------------------------------
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const name = signupName.trim();
    const email = signupEmail.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Strict validation rules
    if (!name) {
      setErrorMessage('Informe seu nome.');
      return;
    }

    if (!email || !emailRegex.test(email)) {
      setErrorMessage('Informe um e-mail válido.');
      return;
    }

    if (!signupPassword) {
      setErrorMessage('Informe uma senha.');
      return;
    }

    if (signupPassword.length < 6) {
      setErrorMessage('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (!signupConfirmPassword) {
      setErrorMessage('Confirme sua senha.');
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      setErrorMessage('As senhas não coincidem.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await signUp(email, signupPassword, name);

      if (!result.success) {
        setErrorMessage(result.error || 'Falha ao criar sua conta.');
        setIsSubmitting(false);
        return;
      }

      // If email confirmation is required by Supabase
      if (result.needsEmailConfirmation) {
        setRegisteredEmail(email);
        setAuthMode('confirmation_sent');
        setIsSubmitting(false);
      }
      // If no confirmation needed, the session is active and AppRoot will transition automatically
    } catch {
      setErrorMessage('Não foi possível conectar ao serviço. Verifique sua conexão e tente novamente.');
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
            Plataforma de Automação & Atendimento • Supabase Auth
          </p>
        </div>

        {/* Card */}
        <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl shadow-black/80 transition-all">
          
          {/* Environment Warning if Supabase is unconfigured */}
          {!isConfigured && (
            <div className="mb-5 p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 flex items-start gap-2.5 text-xs text-amber-300">
              <Database size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Supabase Não Configurado</span>
                <span className="text-[11px] text-amber-200/80 leading-relaxed block mt-0.5">
                  As variáveis <code className="font-mono text-amber-300">VITE_SUPABASE_URL</code> e <code className="font-mono text-amber-300">VITE_SUPABASE_PUBLISHABLE_KEY</code> precisam ser configuradas no ambiente.
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

          {/* ======================================================== */}
          {/* VIEW: LOGIN                                              */}
          {/* ======================================================== */}
          {authMode === 'login' && (
            <>
              <div className="mb-6">
                <h2 className="text-base font-semibold text-neutral-100 font-display">
                  Autenticação de Operador
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Entre com seu e-mail e senha para acessar o FABRE AUTOMATION.
                </p>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5 font-mono">
                    E-MAIL
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                      <Mail size={16} />
                    </div>
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
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
                      type={showLoginPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••••••"
                      autoComplete="current-password"
                      required
                      disabled={isSubmitting}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-sans disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-500 hover:text-neutral-300 cursor-pointer"
                      tabIndex={-1}
                    >
                      {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || isGoogleSubmitting || !isConfigured}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-medium text-sm transition-all shadow-lg shadow-cyan-950/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin text-white" />
                      <span>Entrando...</span>
                    </>
                  ) : (
                    <>
                      <LogIn size={16} />
                      <span>Entrar no Sistema</span>
                    </>
                  )}
                </button>

                {/* Divider */}
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-neutral-800" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-neutral-950 px-3 text-neutral-400 font-mono">ou</span>
                  </div>
                </div>

                {/* Google Sign In Button */}
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={isSubmitting || isGoogleSubmitting || !isConfigured}
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-100 font-medium text-sm transition-all border border-neutral-700/80 hover:border-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md shadow-black/40"
                >
                  {isGoogleSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin text-cyan-400" />
                      <span>Conectando ao Google...</span>
                    </>
                  ) : (
                    <>
                      <Chrome size={18} className="text-cyan-400" />
                      <span>Continuar com Google</span>
                    </>
                  )}
                </button>
              </form>

              {/* Switch to Signup */}
              <div className="mt-6 pt-5 border-t border-neutral-800/80 text-center">
                <p className="text-xs text-neutral-400">
                  Não possui uma conta?{' '}
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('signup')}
                    disabled={isSubmitting}
                    className="text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer transition-colors inline-flex items-center gap-1 ml-1"
                  >
                    <span>Criar minha conta</span>
                  </button>
                </p>
              </div>
            </>
          )}

          {/* ======================================================== */}
          {/* VIEW: SIGNUP (CRIAR SUA CONTA)                           */}
          {/* ======================================================== */}
          {authMode === 'signup' && (
            <>
              <div className="mb-6">
                <h2 className="text-base font-semibold text-neutral-100 font-display">
                  Criar sua conta
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Crie sua conta para acessar o FABRE AUTOMATION.
                </p>
              </div>

              <form onSubmit={handleSignupSubmit} className="space-y-4">
                {/* Nome Completo */}
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5 font-mono">
                    NOME COMPLETO
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                      <User size={16} />
                    </div>
                    <input
                      type="text"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      placeholder="Seu nome completo"
                      autoComplete="name"
                      required
                      disabled={isSubmitting}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-sans disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* E-mail */}
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5 font-mono">
                    E-MAIL
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                      <Mail size={16} />
                    </div>
                    <input
                      type="email"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      placeholder="seu.email@exemplo.com"
                      autoComplete="email"
                      required
                      disabled={isSubmitting}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-sans disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Senha */}
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5 font-mono">
                    SENHA
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                      <Lock size={16} />
                    </div>
                    <input
                      type={showSignupPassword ? 'text' : 'password'}
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="••••••••••••"
                      autoComplete="new-password"
                      required
                      disabled={isSubmitting}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-sans disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword(!showSignupPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-500 hover:text-neutral-300 cursor-pointer"
                      tabIndex={-1}
                    >
                      {showSignupPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Confirmar Senha */}
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5 font-mono">
                    CONFIRMAR SENHA
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                      <Lock size={16} />
                    </div>
                    <input
                      type={showSignupConfirmPassword ? 'text' : 'password'}
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      autoComplete="new-password"
                      required
                      disabled={isSubmitting}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-sans disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupConfirmPassword(!showSignupConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-500 hover:text-neutral-300 cursor-pointer"
                      tabIndex={-1}
                    >
                      {showSignupConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || isGoogleSubmitting || !isConfigured}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-medium text-sm transition-all shadow-lg shadow-emerald-950/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin text-white" />
                      <span>Criando sua conta...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      <span>Criar minha conta</span>
                    </>
                  )}
                </button>

                {/* Divider */}
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-neutral-800" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-neutral-950 px-3 text-neutral-400 font-mono">ou</span>
                  </div>
                </div>

                {/* Google Sign Up / In Button */}
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={isSubmitting || isGoogleSubmitting || !isConfigured}
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-850 text-neutral-100 font-medium text-sm transition-all border border-neutral-700/80 hover:border-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md shadow-black/40"
                >
                  {isGoogleSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin text-cyan-400" />
                      <span>Conectando ao Google...</span>
                    </>
                  ) : (
                    <>
                      <Chrome size={18} className="text-cyan-400" />
                      <span>Continuar com Google</span>
                    </>
                  )}
                </button>

                <p className="text-[11px] text-neutral-400 text-center mt-2 leading-relaxed">
                  Use sua conta Google para criar ou acessar sua conta no FABRE AUTOMATION.
                </p>
              </form>

              {/* Switch to Login */}
              <div className="mt-6 pt-5 border-t border-neutral-800/80 text-center">
                <p className="text-xs text-neutral-400">
                  Já possui uma conta?{' '}
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('login')}
                    disabled={isSubmitting}
                    className="text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer transition-colors inline-flex items-center gap-1 ml-1"
                  >
                    <span>Voltar para o login</span>
                  </button>
                </p>
              </div>
            </>
          )}

          {/* ======================================================== */}
          {/* VIEW: CONFIRMATION SENT (EMAIL CONFIRMATION REQUIRED)    */}
          {/* ======================================================== */}
          {authMode === 'confirmation_sent' && (
            <div className="text-center py-2 space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto">
                <CheckCircle2 size={30} className="text-emerald-400" />
              </div>

              <div>
                <h2 className="text-base font-bold text-neutral-100 font-display">
                  Conta criada com sucesso!
                </h2>
                <p className="text-xs text-neutral-300 mt-2 leading-relaxed">
                  Enviamos um link de confirmação para seu e-mail. Confirme seu endereço para continuar.
                </p>
              </div>

              {registeredEmail && (
                <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 font-mono text-xs text-cyan-300 truncate">
                  {registeredEmail}
                </div>
              )}

              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Após confirmar seu e-mail através do link recebido, retorne aqui e faça login com sua senha cadastrada.
              </p>

              <button
                type="button"
                onClick={() => {
                  setLoginEmail(registeredEmail);
                  handleSwitchMode('login');
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-100 font-medium text-sm transition-all border border-neutral-700 cursor-pointer"
              >
                <ArrowLeft size={16} />
                <span>Voltar para o login</span>
              </button>
            </div>
          )}

          {/* Security Assurance Footer Note */}
          <div className="mt-6 pt-5 border-t border-neutral-800/80 flex items-start gap-2 text-[11px] text-neutral-400">
            <ShieldCheck size={14} className="text-emerald-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong className="text-neutral-300">Supabase Auth:</strong> Gerenciamento nativo de credenciais e sessões encriptadas com suporte a RLS (Row Level Security).
            </p>
          </div>

          {/* FASE 8: Diagnóstico Seguro de Conexão e Ambiente Local */}
          <div className="mt-4 pt-3 border-t border-neutral-900">
            <button
              type="button"
              onClick={() => {
                const next = !showDiagnostics;
                setShowDiagnostics(next);
                if (next && !diagnostics) {
                  loadDiagnostics();
                }
              }}
              className="w-full flex items-center justify-between text-[11px] font-mono text-neutral-500 hover:text-neutral-300 py-1 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Activity size={12} className="text-cyan-400" />
                <span>Diagnóstico do Ambiente Local</span>
              </span>
              {showDiagnostics ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showDiagnostics && (
              <div className="mt-3 p-3.5 rounded-xl bg-neutral-900/90 border border-neutral-800 text-[11px] font-mono space-y-2.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Supabase Configurado:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    diagnostics?.isConfigured ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {diagnostics?.isConfigured ? 'SIM' : 'NÃO'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">URL do Projeto:</span>
                  <span className="text-neutral-200 text-[10px] truncate max-w-[200px]" title={diagnostics?.maskedUrl}>
                    {diagnostics?.maskedUrl || 'Verificando...'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Publishable Key:</span>
                  <span className="text-neutral-200 text-[10px] truncate max-w-[200px]" title={diagnostics?.maskedKey}>
                    {diagnostics?.maskedKey || 'Verificando...'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Auth Supabase (API):</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    diagnostics?.authReachable ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {diagnostics ? (diagnostics.authReachable ? 'ONLINE' : 'INDISPONÍVEL') : '...'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Google OAuth:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    diagnostics?.googleOAuthEnabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                  }`}>
                    {diagnostics ? (diagnostics.googleOAuthEnabled ? 'ATIVO NO SUPABASE' : 'PENDENTE ATIVAÇÃO NO SUPABASE') : '...'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Sessão Ativa:</span>
                  <span className="text-neutral-300 text-[10px]">
                    {diagnostics?.hasActiveSession ? 'SIM' : 'NÃO'}
                  </span>
                </div>

                <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between">
                  <span className="text-[10px] text-neutral-500">
                    Ambiente: {diagnostics?.environment || 'dev'}
                  </span>
                  <button
                    type="button"
                    onClick={loadDiagnostics}
                    disabled={isLoadingDiag}
                    className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 font-mono cursor-pointer transition-colors"
                  >
                    <RefreshCw size={10} className={isLoadingDiag ? 'animate-spin' : ''} />
                    <span>Atualizar</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* System Version Footnote */}
        <div className="text-center mt-6 text-[11px] text-neutral-500 font-mono">
          FABRE AUTOMATION • Public Signup & User Onboarding
        </div>
      </div>
    </div>
  );
};
