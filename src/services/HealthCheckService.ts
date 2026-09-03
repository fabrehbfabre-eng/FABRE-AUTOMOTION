/**
 * FABRE AUTOMATION - Backend & Edge Functions Health Check Service
 * Release 9: Edge Functions Deployment Readiness & Server-Side Certification
 */

import { 
  testSupabaseConnection, 
  runPersistenceSmokeTest,
  isSupabaseConfigured, 
  getSupabaseConfig, 
  SupabaseConnectionStatus, 
  SchemaAuditResult,
  PersistenceSmokeTestResult,
  DatabaseState,
  TableVerificationDetail
} from '../lib/supabase';
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
    status: 'READY';
    environment: string;
    version: string;
  };
  supabase: {
    status: 'CONNECTED' | 'NOT_CONFIGURED' | 'ERROR';
    configured: boolean;
    url: string;
    hasPublishableKey: boolean;
  };
  postgres: {
    status: 'REACHABLE' | 'UNREACHABLE' | 'NOT_CONFIGURED';
    reachable: boolean;
  };
  schema: {
    status: 'READY' | 'INCOMPLETE' | 'PENDING' | 'ERROR' | 'DEMO' | 'UNVERIFIED';
    databaseState: DatabaseState;
    totalExpected: number;
    totalFound: number;
    missingTables: string[];
    presentTables: string[];
    tables: TableVerificationDetail[];
  };
  rls: {
    status: 'SCHEMA_DEFINED' | 'REMOTELY_CONFIRMED' | 'NOT_CONFIRMED';
  };
  idempotency: {
    status: 'SCHEMA_DEFINED' | 'REMOTELY_CONFIRMED' | 'NOT_CONFIRMED';
  };
  persistence: {
    status: 'CERTIFIED' | 'NOT_CERTIFIED';
    certified: boolean;
    message: string;
    smokeTest?: PersistenceSmokeTestResult;
  };
  database: {
    status: SupabaseConnectionStatus;
    databaseState: DatabaseState;
    configured: boolean;
    connected: boolean;
    schemaApplied: boolean;
    persistenceCertified: boolean;
    postgresReachable: boolean;
    message: string;
    schemaAudit?: SchemaAuditResult;
    smokeTest?: PersistenceSmokeTestResult;
    details?: Record<string, unknown>;
  };
  backend: {
    status: 'PREPARED' | 'DEPLOYED' | 'ERROR' | 'UNCONFIGURED';
    rawStatus: EdgeFunctionDeployStatus;
    configured: boolean;
    available: boolean;
    url?: string;
    message: string;
    functions: EdgeFunctionItemStatus[];
    details?: Partial<ServerHealthStatus>;
  };
  ai: {
    enabled: boolean;
    status: 'DISABLED';
    message: string;
  };
  channels: {
    meta: 'awaiting_connection';
    whatsapp: 'awaiting_connection';
  };
  overallStatus: 'ready' | 'schema_pending' | 'schema_incomplete' | 'demo_mode' | 'configuration_error';
}

export class HealthCheckService {
  /**
   * Executes a full system health audit (Frontend, Supabase, PostgreSQL, Schema, Persistence Smoke Test, Edge Functions)
   */
  async runHealthCheck(): Promise<ComprehensiveHealthReport> {
    const supabaseConfig = getSupabaseConfig();
    const isConfigured = isSupabaseConfigured();

    // 1. Database Health Check & Deep Schema Audit
    let dbStatus: SupabaseConnectionStatus = 'demo';
    let databaseState: DatabaseState = 'UNVERIFIED_ENVIRONMENT';
    let dbConnected = false;
    let dbSchemaApplied = false;
    let dbPersistenceCertified = false;
    let dbPostgresReachable = false;
    let dbRlsStatus: 'SCHEMA_DEFINED' | 'REMOTELY_CONFIRMED' | 'NOT_CONFIRMED' = 'SCHEMA_DEFINED';
    let dbIdempotencyStatus: 'SCHEMA_DEFINED' | 'REMOTELY_CONFIRMED' | 'NOT_CONFIRMED' = 'SCHEMA_DEFINED';
    let dbMessage = 'Supabase não configurado no ambiente local (.env pendente). Operando em Modo Demonstração.';
    let dbSchemaAudit: SchemaAuditResult | undefined = undefined;
    let dbSmokeTest: PersistenceSmokeTestResult | undefined = undefined;
    let dbDetails: Record<string, unknown> | undefined = undefined;

    if (isConfigured) {
      const dbRes = await testSupabaseConnection();
      dbStatus = dbRes.status;
      databaseState = dbRes.databaseState;
      dbConnected = dbRes.status === 'connected' || dbRes.status === 'schema_pending' || dbRes.status === 'schema_incomplete';
      dbSchemaApplied = dbRes.schemaApplied;
      dbPersistenceCertified = dbRes.persistenceCertified;
      dbPostgresReachable = dbRes.postgresReachable;
      dbRlsStatus = dbRes.rlsStatus;
      dbIdempotencyStatus = dbRes.idempotencyStatus;
      dbMessage = dbRes.message;
      dbSchemaAudit = dbRes.schemaAudit;
      dbSmokeTest = dbRes.smokeTest;
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
        name: 'meta-send-message',
        path: '/supabase/functions/meta-send-message',
        endpoint: supabaseConfig.url ? `${supabaseConfig.url}/functions/v1/meta-send-message` : '/functions/v1/meta-send-message',
        verifyJwt: true,
        status: backendStatus === 'deployed' ? 'deployed' : 'ready_for_deploy',
        description: 'Envio outbound oficial do operador para WhatsApp Business Cloud API com segurança server-side',
      },
      {
        name: 'ai-completion',
        path: '/supabase/functions/ai-completion',
        endpoint: supabaseConfig.url ? `${supabaseConfig.url}/functions/v1/ai-completion` : '/functions/v1/ai-completion',
        verifyJwt: false,
        status: backendStatus === 'deployed' ? 'deployed' : 'ready_for_deploy',
        description: 'Pipeline de IA preparada (Explicitamente DESATIVADA na Release 9)',
      },
    ];

    // Standardized Schema status
    let schemaStatus: ComprehensiveHealthReport['schema']['status'] = 'DEMO';
    if (isConfigured) {
      if (dbSchemaAudit?.allTablesExist) {
        schemaStatus = 'READY';
      } else if ((dbSchemaAudit?.totalFound ?? 0) > 0) {
        schemaStatus = 'INCOMPLETE';
      } else if (dbStatus === 'error') {
        schemaStatus = 'ERROR';
      } else {
        schemaStatus = 'PENDING';
      }
    } else {
      schemaStatus = 'UNVERIFIED';
    }

    // Standardized Overall Status
    let overallStatus: ComprehensiveHealthReport['overallStatus'] = 'demo_mode';
    if (!isConfigured) {
      overallStatus = 'demo_mode';
    } else if (dbStatus === 'connected' && dbPersistenceCertified) {
      overallStatus = 'ready';
    } else if (dbStatus === 'schema_pending') {
      overallStatus = 'schema_pending';
    } else if (dbStatus === 'schema_incomplete') {
      overallStatus = 'schema_incomplete';
    } else {
      overallStatus = 'configuration_error';
    }

    const backendNormalizedStatus: ComprehensiveHealthReport['backend']['status'] =
      backendStatus === 'deployed' ? 'DEPLOYED' :
      backendStatus === 'error' ? 'ERROR' :
      backendStatus === 'unconfigured' ? 'UNCONFIGURED' : 'PREPARED';

    return {
      frontend: {
        status: 'READY',
        environment: 'Client-Side React (Vite)',
        version: 'Release 9.0.0',
      },
      supabase: {
        status: isConfigured ? (dbConnected ? 'CONNECTED' : 'ERROR') : 'NOT_CONFIGURED',
        configured: isConfigured,
        url: supabaseConfig.url,
        hasPublishableKey: supabaseConfig.hasKey,
      },
      postgres: {
        status: isConfigured ? (dbPostgresReachable ? 'REACHABLE' : 'UNREACHABLE') : 'NOT_CONFIGURED',
        reachable: dbPostgresReachable,
      },
      schema: {
        status: schemaStatus,
        databaseState,
        totalExpected: dbSchemaAudit?.totalExpected ?? 11,
        totalFound: dbSchemaAudit?.totalFound ?? 0,
        missingTables: dbSchemaAudit?.missingTables ?? [],
        presentTables: dbSchemaAudit?.presentTables ?? [],
        tables: dbSchemaAudit?.tables ?? [],
      },
      rls: {
        status: dbRlsStatus,
      },
      idempotency: {
        status: dbIdempotencyStatus,
      },
      persistence: {
        status: dbPersistenceCertified ? 'CERTIFIED' : 'NOT_CERTIFIED',
        certified: dbPersistenceCertified,
        message: dbPersistenceCertified 
          ? 'Persistência PostgreSQL comprovada no banco remoto (11 tabelas, integridade relacional, idempotência e RLS validados).'
          : (dbMessage || 'Persistência não certificada.'),
        smokeTest: dbSmokeTest,
      },
      database: {
        status: dbStatus,
        databaseState,
        configured: isConfigured,
        connected: dbConnected,
        schemaApplied: dbSchemaApplied,
        persistenceCertified: dbPersistenceCertified,
        postgresReachable: dbPostgresReachable,
        message: dbMessage,
        schemaAudit: dbSchemaAudit,
        smokeTest: dbSmokeTest,
        details: dbDetails,
      },
      backend: {
        status: backendNormalizedStatus,
        rawStatus: backendStatus,
        configured: isConfigured,
        available: backendAvailable,
        url: supabaseConfig.url ? `${supabaseConfig.url}/functions/v1` : undefined,
        message: backendMessage,
        functions,
        details: backendDetails,
      },
      ai: {
        enabled: false,
        status: 'DISABLED',
        message: 'Motor de IA permanece DESATIVADO nesta Release 9 (Zero chamadas LLM).',
      },
      channels: {
        meta: 'awaiting_connection',
        whatsapp: 'awaiting_connection',
      },
      overallStatus,
    };
  }

  /**
   * Executes the non-destructive Persistence Smoke Test independently
   */
  async runSmokeTest(): Promise<PersistenceSmokeTestResult> {
    return runPersistenceSmokeTest();
  }
}

export const healthCheckService = new HealthCheckService();

