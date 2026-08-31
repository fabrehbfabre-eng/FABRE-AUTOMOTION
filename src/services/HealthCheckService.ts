/**
 * FABRE AUTOMATION - Backend & Edge Functions Health Check Service
 * Release 4: Supabase Activation & Backend Deployment
 */

import { testSupabaseConnection, isSupabaseConfigured, getSupabaseConfig, SupabaseConnectionStatus } from '../lib/supabase';
import { ServerHealthStatus } from '../types/webhook';

export interface ComprehensiveHealthReport {
  frontend: {
    status: 'ok';
    environment: string;
    version: string;
  };
  database: {
    status: SupabaseConnectionStatus;
    configured: boolean;
    connected: boolean;
    schemaApplied: boolean;
    message: string;
    details?: Record<string, unknown>;
  };
  backend: {
    configured: boolean;
    available: boolean;
    url?: string;
    message: string;
    details?: Partial<ServerHealthStatus>;
  };
  ai: {
    enabled: boolean;
    status: 'deactivated';
    message: string;
  };
  channels: {
    meta: 'awaiting_connection';
    whatsapp: 'awaiting_connection';
  };
  overallStatus: 'ready' | 'schema_pending' | 'demo_mode' | 'configuration_error';
}

export class HealthCheckService {
  /**
   * Executes a full system health audit (Frontend, Database, Backend Edge Functions)
   */
  async runHealthCheck(): Promise<ComprehensiveHealthReport> {
    const supabaseConfig = getSupabaseConfig();
    const isConfigured = isSupabaseConfigured();

    // 1. Database Health Check
    let dbStatus: SupabaseConnectionStatus = 'demo';
    let dbConnected = false;
    let dbSchemaApplied = false;
    let dbMessage = 'Supabase não configurado (.env pendente). Operando em Modo Demonstração.';
    let dbDetails: Record<string, unknown> | undefined = undefined;

    if (isConfigured) {
      const dbRes = await testSupabaseConnection();
      dbStatus = dbRes.status;
      dbConnected = dbRes.status === 'connected' || dbRes.status === 'schema_pending';
      dbSchemaApplied = dbRes.schemaApplied;
      dbMessage = dbRes.message;
      dbDetails = dbRes.details;
    }

    // 2. Edge Functions Backend Health Check
    let backendAvailable = false;
    let backendMessage = 'Edge Functions aguardando deploy no Supabase';
    let backendDetails: Partial<ServerHealthStatus> | undefined = undefined;

    if (isConfigured && supabaseConfig.url) {
      try {
        const functionUrl = `${supabaseConfig.url.replace(/\/$/, '')}/functions/v1/health-check`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const response = await fetch(functionUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          backendAvailable = true;
          backendDetails = await response.json();
          backendMessage = 'Edge Functions ativas e respondendo com sucesso';
        } else {
          backendMessage = `Edge Function respondeu com status ${response.status} (Deploy pendente)`;
        }
      } catch {
        backendMessage = 'Edge Function health-check inacessível ou aguardando deploy no projeto Supabase';
      }
    }

    // 3. Determine Overall Status
    let overallStatus: 'ready' | 'schema_pending' | 'demo_mode' | 'configuration_error' = 'demo_mode';
    if (!isConfigured) {
      overallStatus = 'demo_mode';
    } else if (dbStatus === 'connected') {
      overallStatus = 'ready';
    } else if (dbStatus === 'schema_pending') {
      overallStatus = 'schema_pending';
    } else {
      overallStatus = 'configuration_error';
    }

    return {
      frontend: {
        status: 'ok',
        environment: 'Client-Side React (Vite)',
        version: 'Release 4.0.0',
      },
      database: {
        status: dbStatus,
        configured: isConfigured,
        connected: dbConnected,
        schemaApplied: dbSchemaApplied,
        message: dbMessage,
        details: dbDetails,
      },
      backend: {
        configured: isConfigured,
        available: backendAvailable,
        url: supabaseConfig.url ? `${supabaseConfig.url}/functions/v1` : undefined,
        message: backendMessage,
        details: backendDetails,
      },
      ai: {
        enabled: false,
        status: 'deactivated',
        message: 'Motor de IA desacoplado e inativo no Release 4 (AI Service not enabled).',
      },
      channels: {
        meta: 'awaiting_connection',
        whatsapp: 'awaiting_connection',
      },
      overallStatus,
    };
  }
}

export const healthCheckService = new HealthCheckService();

