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

/**
 * Test connectivity with Supabase database
 */
export async function testSupabaseConnection(): Promise<{
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      message: 'Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no arquivo .env.',
    };
  }

  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Falha ao instanciar cliente Supabase.',
    };
  }

  try {
    const { data, error } = await client
      .from('channel_connections')
      .select('count')
      .limit(1);

    if (error) {
      return {
        success: false,
        message: `Erro na consulta Supabase: ${error.message} (${error.code || 'sem código'}). Verifique se o schema.sql foi executado.`,
        details: { error },
      };
    }

    return {
      success: true,
      message: 'Conexão com o Supabase PostgreSQL estabelecida com sucesso!',
      details: { data },
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Exceção de rede ou configuração ao conectar no Supabase: ${errorMessage}`,
    };
  }
}
