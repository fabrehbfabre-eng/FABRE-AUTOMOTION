/**
 * FABRE AUTOMATION - Backend & Edge Functions Health Check Service
 * Release 6: Supabase Edge Functions Deployment
 */

import { testSupabaseConnection, isSupabaseConfigured, getSupabaseConfig, SupabaseConnectionStatus } from '../lib/supabase';
import { ServerHealthStatus } from '../types/webhook';

export type EdgeFunctionDeployStatus = 'ready_for_deploy' | 'deployed' | 'error' | 'unconfigured';

export interface EdgeFunctionItemStatus {
  name: string;
  path: string;
  endpoint: string;
  verifyJwt: boolean;
  status: EdgeFunctionDeployStatus;
  description: string;
}

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
    status: EdgeFunctionDeployStatus;
    configured: boolean;
    available: boolean;
    url?: string;
    message: string;
    functions: EdgeFunctionItemStatus[];
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
    let backendStatus: EdgeFunctionDeployStatus = isConfigured ? 'ready_for_deploy' : 'unconfigured';
    let backendAvailable = false;
    let backendMessage = isConfigured 
      ? 'Edge Functions com código pronto no repositório. Aguardando deploy no Supabase via CLI.' 
      : 'Supabase URL não configurada. Configure o .env para habilitar verificação.';
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
          backendStatus = 'deployed';
          backendDetails = await response.json();
          backendMessage = 'Edge Functions publicadas e respondendo com sucesso no Supabase';
        } else if (response.status === 404) {
          backendStatus = 'ready_for_deploy';
          backendMessage = 'Código preparado no repositório. Função health-check ainda não publicada no Supabase (404).';
        } else {
          backendStatus = 'error';
          backendMessage = `Edge Function respondeu com status HTTP ${response.status}. Verifique logs no Supabase Dashboard.`;
        }
      } catch {
        backendStatus = 'ready_for_deploy';
        backendMessage = 'Código pronto para deploy. Função health-check aguardando publicação via Supabase CLI.';
      }
    }

    // Individual Functions Inventory
    const functions: EdgeFunctionItemStatus[] = [
      {
        name: 'health-check',
        path: '/supabase/functions/health-check',
        endpoint: supabaseConfig.url ? `${supabaseConfig.url}/functions/v1/health-check` : '/functions/v1/health-check',
        verifyJwt: false,
        status: backendStatus,
        description: 'Auditoria de conectividade com PostgreSQL, readiness e runtime Deno',
      },
      {
        name: 'meta-webhook',
        path: '/supabase/functions/meta-webhook',
        endpoint: supabaseConfig.url ? `${supabaseConfig.url}/functions/v1/meta-webhook` : '/functions/v1/meta-webhook',
        verifyJwt: false,
        status: backendStatus === 'deployed' ? 'deployed' : 'ready_for_deploy',
        description: 'Handshake de verificação Meta e ingestão com idempotência para Instagram Direct',
      },
      {
        name: 'whatsapp-webhook',
        path: '/supabase/functions/whatsapp-webhook',
        endpoint: supabaseConfig.url ? `${supabaseConfig.url}/functions/v1/whatsapp-webhook` : '/functions/v1/whatsapp-webhook',
        verifyJwt: false,
        status: backendStatus === 'deployed' ? 'deployed' : 'ready_for_deploy',
        description: 'Handshake e ingestão de mensagens da WhatsApp Business Cloud API',
      },
      {
        name: 'ai-completion',
        path: '/supabase/functions/ai-completion',
        endpoint: supabaseConfig.url ? `${supabaseConfig.url}/functions/v1/ai-completion` : '/functions/v1/ai-completion',
        verifyJwt: false,
        status: backendStatus === 'deployed' ? 'deployed' : 'ready_for_deploy',
        description: 'Pipeline de IA preparada (Explicitamente desativada na Release 6)',
      },
    ];

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
        version: 'Release 6.0.0',
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
        status: backendStatus,
        configured: isConfigured,
        available: backendAvailable,
        url: supabaseConfig.url ? `${supabaseConfig.url}/functions/v1` : undefined,
        message: backendMessage,
        functions,
        details: backendDetails,
      },
      ai: {
        enabled: false,
        status: 'deactivated',
        message: 'Motor de IA desacoplado e inativo na Release 6 (AI Service not enabled).',
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

