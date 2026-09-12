/**
 * FABRE AUTOMATION - Supabase Management & Infrastructure Integration Layer
 * 
 * Provides secure, server-side management API integration for Supabase.
 * Enforces:
 * - Zero token exposure in logs or client-side bundles
 * - Secure header formation with Bearer authentication
 * - Structured error handling with HTTP status categorization
 * - Real connectivity checks against Supabase Management API v1
 */

export interface SupabaseProjectSummary {
  id: string;
  name: string;
  organization_id: string;
  region: string;
  created_at: string;
  status: string;
}

export interface ManagementAuthStatus {
  isConfigured: boolean;
  tokenPrefix?: string;
  tokenLength?: number;
  source: 'process.env.SUPABASE_ACCESS_TOKEN' | 'none';
}

export interface ManagementVerificationResult {
  success: boolean;
  authenticated: boolean;
  statusCode?: number;
  projectsFound?: number;
  targetProject?: SupabaseProjectSummary;
  projects?: Array<{ id: string; name: string; region: string; status: string }>;
  error?: string;
  errorCode?: 'MISSING_TOKEN' | 'INVALID_TOKEN' | 'FORBIDDEN' | 'NETWORK_ERROR' | 'UNKNOWN';
}

export class SupabaseManagementService {
  private static readonly MANAGEMENT_API_BASE = 'https://api.supabase.com/v1';

  /**
   * Retrieves the current access token safely from server environment.
   * Returns undefined if running in browser or variable is unset.
   */
  private static getAccessToken(): string | undefined {
    if (typeof process !== 'undefined' && process.env) {
      return process.env.SUPABASE_ACCESS_TOKEN?.trim();
    }
    return undefined;
  }

  /**
   * Sanitizes token for logging or reporting purposes without revealing secret material.
   */
  public static maskToken(token?: string): string {
    if (!token || token.length < 8) return '[UNCONFIGURED]';
    const prefix = token.slice(0, 4);
    const suffix = token.slice(-3);
    return `${prefix}...${suffix} (len: ${token.length})`;
  }

  /**
   * Checks whether the management token is set in the secure environment.
   */
  public static getAuthStatus(): ManagementAuthStatus {
    const token = this.getAccessToken();
    if (!token) {
      return {
        isConfigured: false,
        source: 'none',
      };
    }

    return {
      isConfigured: true,
      tokenPrefix: token.slice(0, 4),
      tokenLength: token.length,
      source: 'process.env.SUPABASE_ACCESS_TOKEN',
    };
  }

  /**
   * Performs an actual HTTP call to the Supabase Management API to verify credentials.
   */
  public static async verifyConnection(targetProjectName?: string): Promise<ManagementVerificationResult> {
    const token = this.getAccessToken();

    if (!token) {
      return {
        success: false,
        authenticated: false,
        error: 'SUPABASE_ACCESS_TOKEN não está configurada no ambiente.',
        errorCode: 'MISSING_TOKEN',
      };
    }

    try {
      const response = await fetch(`${this.MANAGEMENT_API_BASE}/projects`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'User-Agent': 'FABRE-AUTOMATION-AI-Studio/1.0',
        },
      });

      if (response.status === 401) {
        return {
          success: false,
          authenticated: false,
          statusCode: 401,
          error: 'Token inválido ou expirado (401 Unauthorized na Supabase Management API).',
          errorCode: 'INVALID_TOKEN',
        };
      }

      if (response.status === 403) {
        return {
          success: false,
          authenticated: false,
          statusCode: 403,
          error: 'Permissões insuficientes no token de acesso (403 Forbidden).',
          errorCode: 'FORBIDDEN',
        };
      }

      if (!response.ok) {
        return {
          success: false,
          authenticated: false,
          statusCode: response.status,
          error: `Erro ao comunicar com a Supabase Management API: HTTP ${response.status}`,
          errorCode: 'UNKNOWN',
        };
      }

      const projectsData = await response.json() as SupabaseProjectSummary[];
      const projects = (projectsData || []).map(p => ({
        id: p.id,
        name: p.name,
        region: p.region,
        status: p.status,
      }));

      let matchedProject: SupabaseProjectSummary | undefined;
      if (targetProjectName && projectsData) {
        const lowerTarget = targetProjectName.toLowerCase();
        matchedProject = projectsData.find(p => 
          p.name.toLowerCase().includes(lowerTarget) || 
          p.id.toLowerCase() === lowerTarget
        );
      }

      return {
        success: true,
        authenticated: true,
        statusCode: 200,
        projectsFound: projects.length,
        targetProject: matchedProject,
        projects,
      };
    } catch (err: any) {
      return {
        success: false,
        authenticated: false,
        error: `Falha de rede ao contatar Supabase Management API: ${err.message || err}`,
        errorCode: 'NETWORK_ERROR',
      };
    }
  }
}
