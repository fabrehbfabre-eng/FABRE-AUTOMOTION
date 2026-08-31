/**
 * FABRE AUTOMATION - Supabase Client Layer
 * Release 2: Supabase Persistence Foundation
 * 
 * IMPORTANT:
 * - Uses only public/publishable keys in client-side bundle.
 * - Secret keys (SUPABASE_SECRET_KEY, service_role) must NEVER be exposed here.
 * - Graceful fallback to Demo/Mock mode when credentials are not configured.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

const isValidUrl = (url?: string): boolean => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl && 
    supabaseKey && 
    isValidUrl(supabaseUrl) && 
    supabaseKey.trim().length > 10 &&
    !supabaseUrl.includes('your-project-id')
  );
};

export const getSupabaseConfig = () => {
  return {
    url: supabaseUrl || '',
    hasKey: Boolean(supabaseKey && supabaseKey.trim().length > 0),
    isConfigured: isSupabaseConfigured(),
  };
};

let clientInstance: SupabaseClient<Database> | null = null;

export const getSupabaseClient = (): SupabaseClient<Database> | null => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!clientInstance && supabaseUrl && supabaseKey) {
    clientInstance = createClient<Database>(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  return clientInstance;
};

export const supabase = getSupabaseClient();

export type SupabaseConnectionStatus = 'connected' | 'schema_pending' | 'error' | 'demo';

export interface SupabaseTestResult {
  status: SupabaseConnectionStatus;
  success: boolean;
  schemaApplied: boolean;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Real connectivity and schema test with Supabase database.
 * Strictly avoids mock simulations when credentials are provided.
 */
export async function testSupabaseConnection(): Promise<SupabaseTestResult> {
  if (!isSupabaseConfigured()) {
    return {
      status: 'demo',
      success: false,
      schemaApplied: false,
      message: 'Supabase não configurado. Aplicação operando em Modo Demonstração (Demo).',
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      status: 'error',
      success: false,
      schemaApplied: false,
      message: 'Falha ao inicializar o cliente Supabase.',
    };
  }

  try {
    // Perform a real query against the channel_connections table
    const { data, error } = await client
      .from('channel_connections')
      .select('channel, status')
      .limit(1);

    if (error) {
      const isMissingTable = 
        error.code === '42P01' || 
        error.code === 'PGRST204' ||
        error.code === 'PGRST205' ||
        error.message?.toLowerCase().includes('does not exist') ||
        error.message?.toLowerCase().includes('not found') ||
        error.message?.toLowerCase().includes('relation "channel_connections"');

      if (isMissingTable) {
        return {
          status: 'schema_pending',
          success: false,
          schemaApplied: false,
          message: 'Supabase conectado, schema ainda não aplicado.',
          details: { error: error.message, code: error.code },
        };
      }

      return {
        status: 'error',
        success: false,
        schemaApplied: false,
        message: `Erro na consulta Supabase: ${error.message} (${error.code || 'sem código'}).`,
        details: { error: error.message, code: error.code, hint: error.hint },
      };
    }

    return {
      status: 'connected',
      success: true,
      schemaApplied: true,
      message: 'Supabase conectado e operacional (Schema validado).',
      details: { rowCount: data ? data.length : 0 },
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      status: 'error',
      success: false,
      schemaApplied: false,
      message: `Exceção de rede ao conectar no Supabase: ${errorMessage}`,
      details: { error: errorMessage },
    };
  }
}

