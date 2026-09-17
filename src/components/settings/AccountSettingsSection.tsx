/**
 * FABRE AUTOMATION - Configurações: Conta
 * Release 9.1: Simplificação da Interface de Configurações
 * 
 * Permite ao usuário:
 * - Visualizar seus dados de perfil (Nome, E-mail, Função, ID)
 * - Alterar sua senha de acesso
 * - Sair / Encerrar sessão com segurança
 */

import React, { useState } from 'react';
import { 
  User as UserIcon, 
  Lock, 
  LogOut, 
  CheckCircle2, 
  AlertCircle, 
  Shield, 
  Eye, 
  EyeOff,
  KeyRound,
  Mail,
  BadgeCheck
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getSupabaseClient } from '../../lib/supabase';

export const AccountSettingsSection: React.FC = () => {
  const { user, role, signOut } = useAuth();

  const rawName = user?.user_metadata?.full_name || user?.user_metadata?.name || '';
  const fullName = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : 'Operador Casal Fabre';
  const email = user?.email || 'operador@casalfabre.com.br';
  const displayRole = role === 'admin' ? 'Administrador' : role === 'operator' ? 'Operador' : 'Usuário';

  const userInitials = fullName
    ? fullName.split(/\s+/).filter(Boolean).map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'CF';

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Logout state
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmLogoutModal, setConfirmLogoutModal] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

    if (newPassword.length < 6) {
      setPasswordFeedback({
        success: false,
        message: 'A nova senha deve ter pelo menos 6 caracteres.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordFeedback({
        success: false,
        message: 'As senhas informadas não coincidem. Por favor, confira a digitação.',
      });
      return;
    }

    setUpdatingPassword(true);
    try {
      const client = getSupabaseClient();
      if (client) {
        const { error } = await client.auth.updateUser({ password: newPassword });
        if (error) throw error;
      }
      setPasswordFeedback({
        success: true,
        message: 'Senha atualizada com sucesso! Utilize-a em seu próximo login.',
      });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordFeedback({
        success: false,
        message: err.message || 'Não foi possível atualizar a senha no momento.',
      });
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleSignOut = async () => {
    setLoggingOut(true);
    try {
      await signOut();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header da Seção */}
      <div className="border-b border-neutral-800/80 pb-4">
        <h3 className="text-lg font-bold text-neutral-100 font-display flex items-center gap-2.5">
          <UserIcon size={20} className="text-cyan-400" />
          Minha Conta
        </h3>
        <p className="text-xs text-neutral-400 mt-1">
          Gerencie os dados do seu perfil, altere sua senha de acesso e controle sua sessão no sistema.
        </p>
      </div>

      {/* 1. Dados do Usuário */}
      <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-display font-bold text-lg shadow-md shadow-cyan-950/30 shrink-0">
            {userInitials}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-neutral-100">{fullName}</h4>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {displayRole}
              </span>
            </div>
            <p className="text-xs text-neutral-400 flex items-center gap-1.5">
              <Mail size={12} className="text-neutral-500" />
              <span>{email}</span>
            </p>
          </div>
        </div>

        <div className="text-xs text-neutral-500 font-mono sm:text-right">
          <span className="block text-[10px] uppercase text-neutral-500">Identificador da Conta</span>
          <span className="text-neutral-400 truncate max-w-[220px] inline-block">
            {user?.id || 'usr_local_operator'}
          </span>
        </div>
      </div>

      {/* 2. Alterar Senha */}
      <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-4">
        <div>
          <h4 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
            <Lock size={16} className="text-cyan-400" />
            Alterar Senha de Acesso
          </h4>
          <p className="text-xs text-neutral-400 mt-0.5">
            Defina uma nova senha para proteger seu acesso ao painel de atendimento.
          </p>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-4 pt-1 max-w-lg">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">Nova Senha</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo de 6 caracteres"
                required
                className="w-full pl-3.5 pr-10 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 cursor-pointer"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">Confirmar Nova Senha</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Digite novamente a nova senha"
              required
              className="w-full px-3.5 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {passwordFeedback && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              passwordFeedback.success 
                ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300' 
                : 'bg-rose-950/20 border-rose-800/40 text-rose-300'
            }`}>
              {passwordFeedback.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              <span>{passwordFeedback.message}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={updatingPassword || !newPassword}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-neutral-950 transition-colors flex items-center gap-2 cursor-pointer shadow-md shadow-cyan-950/40 disabled:opacity-50"
          >
            <KeyRound size={13} />
            <span>{updatingPassword ? 'Atualizando...' : 'Atualizar senha'}</span>
          </button>
        </form>
      </div>

      {/* 3. Sair / Encerrar Sessão */}
      <div className="p-5 rounded-2xl bg-rose-950/10 border border-rose-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-rose-300 flex items-center gap-2">
            <LogOut size={16} className="text-rose-400" />
            Encerrar Sessão
          </h4>
          <p className="text-xs text-neutral-400">
            Finaliza a sessão autenticada neste dispositivo com segurança.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={loggingOut}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 self-start sm:self-auto"
        >
          <LogOut size={13} />
          <span>{loggingOut ? 'Encerrando...' : 'Sair da conta'}</span>
        </button>
      </div>
    </div>
  );
};
