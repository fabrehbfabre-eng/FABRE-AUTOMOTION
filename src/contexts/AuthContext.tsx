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
        if (error.message.includes('Invalid login credentials')) {
          userMessage = 'E-mail ou senha incorretos. Verifique suas credenciais.';
        } else if (error.message.includes('Email not confirmed')) {
          userMessage = 'O e-mail deste operador ainda não foi confirmado.';
        }
        return { success: false, error: userMessage };
      }

      if (data?.session && data?.user) {
        setSession(data.session);
        setUser(data.user);
        return { success: true };
      }

      return { success: false, error: 'Não foi possível estabelecer uma sessão de operador.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Erro na tentativa de autenticação: ${msg}` };
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
    signOut,
  }), [user, session, role, isOperatorOrAdmin, isAuthenticated, isLoading, isConfigured, signIn, signOut]);

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
