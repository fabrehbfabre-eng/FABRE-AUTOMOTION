/**
 * FABRE AUTOMATION - Operator Authentication Context
 * Release 13: Operator Authentication + Secure Automation Outbound
 * 
 * Provides global authenticated session state, automatic session restoration,
 * real-time auth change listener, and server-managed role detection.
 * 
 * Security Principles:
 * - Session handled strictly by native Supabase client (persistSession: true, autoRefreshToken: true)
 * - Operator role checked strictly from app_metadata.role (NEVER user_metadata)
 * - Server-side fail-closed authorization remains the source of truth
 */

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: string | null;
  isOperatorOrAdmin: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ success: boolean; needsEmailConfirmation?: boolean; error?: string }>;
  signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const isConfigured = isSupabaseConfigured();

  // Extract role strictly from server-managed app_metadata (never user_metadata)
  const role = useMemo(() => {
    if (!user) return null;
    const appRole = user.app_metadata?.role;
    return typeof appRole === 'string' ? appRole.trim().toLowerCase() : null;
  }, [user]);

  const isOperatorOrAdmin = useMemo(() => {
    return role === 'operator' || role === 'admin';
  }, [role]);

  const isAuthenticated = Boolean(session && user);

  // Initialize session and attach auth change listener
  useEffect(() => {
    let isMounted = true;
    const client = getSupabaseClient();

    if (!client || !isConfigured) {
      setIsLoading(false);
      return;
    }

    // 1. Initial session restoration
    client.auth.getSession()
      .then(({ data: { session: initialSession }, error }) => {
        if (!isMounted) return;
        if (error) {
          console.warn('[AuthContext] Erro ao restaurar sessão existente:', error.message);
          setSession(null);
          setUser(null);
        } else if (initialSession) {
          setSession(initialSession);
          setUser(initialSession.user ?? null);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('[AuthContext] Falha inesperada ao checar sessão:', err);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    // 2. Real-time auth state listener
    const { data: { subscription } } = client.auth.onAuthStateChange(
      (_event: AuthChangeEvent, newSession: Session | null) => {
        if (!isMounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setIsLoading(false);
      }
    );

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [isConfigured]);

  // Sign In with email & password
  const signIn = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const client = getSupabaseClient();
    if (!client || !isConfigured) {
      return {
        success: false,
        error: 'Supabase não está configurado neste ambiente. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.',
      };
    }

    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        let userMessage = error.message;
        const lower = error.message.toLowerCase();
        if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
          userMessage = 'E-mail ou senha incorretos.';
        } else if (lower.includes('email not confirmed')) {
          userMessage = 'O e-mail deste usuário ainda não foi confirmado. Verifique sua caixa de entrada para confirmar seu endereço.';
        } else if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('connection')) {
          userMessage = 'Não foi possível conectar ao serviço. Verifique sua conexão e tente novamente.';
        }
        return { success: false, error: userMessage };
      }

      if (data?.session && data?.user) {
        setSession(data.session);
        setUser(data.user);
        return { success: true };
      }

      return { success: false, error: 'Não foi possível estabelecer uma sessão de usuário.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Erro na tentativa de autenticação: ${msg}` };
    }
  }, [isConfigured]);

  // Sign Up with email, password & full name
  const signUp = useCallback(async (
    email: string,
    password: string,
    fullName: string
  ): Promise<{ success: boolean; needsEmailConfirmation?: boolean; error?: string }> => {
    const client = getSupabaseClient();
    if (!client || !isConfigured) {
      return {
        success: false,
        error: 'Supabase não está configurado neste ambiente. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.',
      };
    }

    try {
      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (error) {
        let userMessage = error.message;
        const lower = error.message.toLowerCase();
        if (lower.includes('user already registered') || lower.includes('already exists') || lower.includes('identity already exists')) {
          userMessage = 'Este e-mail já possui uma conta. Faça login ou utilize outro e-mail.';
        } else if (lower.includes('password') && (lower.includes('least 6') || lower.includes('short') || lower.includes('weak'))) {
          userMessage = 'A senha deve ter pelo menos 6 caracteres.';
        } else if (lower.includes('invalid email') || lower.includes('valid email')) {
          userMessage = 'Informe um e-mail válido.';
        } else if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('connection')) {
          userMessage = 'Não foi possível conectar ao serviço. Verifique sua conexão e tente novamente.';
        }
        return { success: false, error: userMessage };
      }

      // Check if email confirmation is required:
      // When email confirmation is enabled in Supabase, data.session is null and user confirmation_sent_at is set.
      // If email confirmation is disabled, data.session contains the active session immediately.
      const needsEmailConfirmation = !data?.session;

      if (data?.session && data?.user) {
        setSession(data.session);
        setUser(data.user);
      }

      return {
        success: true,
        needsEmailConfirmation,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Erro ao criar conta: ${msg}` };
    }
  }, [isConfigured]);

  // Sign In / Sign Up with Google OAuth
  const signInWithGoogle = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    const client = getSupabaseClient();
    if (!client || !isConfigured) {
      return {
        success: false,
        error: 'Supabase não está configurado neste ambiente. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.',
      };
    }

    try {
      const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
      });

      if (error) {
        let userMessage = error.message;
        const lower = error.message.toLowerCase();
        if (lower.includes('unsupported provider') || lower.includes('not enabled') || lower.includes('validation_failed')) {
          userMessage = 'O login com Google ainda não foi ativado no painel do Supabase (Authentication > Providers > Google). Ative o provedor com seu Google Client ID e Secret.';
        } else if (lower.includes('network') || lower.includes('failed to fetch')) {
          userMessage = 'Não foi possível conectar ao serviço. Verifique sua conexão e tente novamente.';
        }
        return { success: false, error: userMessage };
      }

      if (data?.url && typeof window !== 'undefined') {
        window.location.href = data.url;
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Erro ao iniciar autenticação com Google: ${msg}` };
    }
  }, [isConfigured]);

  // Sign Out
  const signOut = useCallback(async (): Promise<void> => {
    const client = getSupabaseClient();
    if (client) {
      try {
        await client.auth.signOut();
      } catch (err) {
        console.warn('[AuthContext] Erro ao encerrar sessão no Supabase:', err);
      }
    }
    setSession(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user,
    session,
    role,
    isOperatorOrAdmin,
    isAuthenticated,
    isLoading,
    isConfigured,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
  }), [user, session, role, isOperatorOrAdmin, isAuthenticated, isLoading, isConfigured, signIn, signUp, signInWithGoogle, signOut]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
