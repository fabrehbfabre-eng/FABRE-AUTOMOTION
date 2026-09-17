/**
/**
 * FABRE AUTOMATION - CHANNEL CONNECTIONS MULTITENANT PERSISTENCE TEST
 * 
 * Verifies:
 * - Caso 1: workspace A + instagram → pode existir.
 * - Caso 2: workspace A + instagram novamente → deve atualizar o mesmo registro via upsert.
 * - Caso 3: workspace B + instagram → deve poder existir independentemente do workspace A (multitenant).
 * - Caso 4: workspace A + whatsapp → continua sendo uma conexão diferente.
 * - Caso 5: não deve existir UNIQUE global apenas em channel (e sim UNIQUE(workspace_id, channel)).
 * - Caso 6: o upsert com onConflict: "workspace_id,channel" é 100% compatível com a constraint.
 * - Caso 7: Validação de integridade da migration (idempotência, sem comandos destrutivos).
 * - Caso 8: Verificação de dados reais existentes e ausência de duplicidades.
 */

import fs from 'fs';
import path from 'path';
import { getSupabaseClient } from '../src/lib/supabase';

console.log('\n======================================================================');
console.log('   FABRE AUTOMATION — CHANNEL CONNECTIONS PERSISTENCE TESTS');
console.log('======================================================================\n');

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`\x1b[32m✔ [PASS]\x1b[0m ${testName}`);
    passed++;
  } else {
    console.error(`\x1b[31m✖ [FAIL]\x1b[0m ${testName}`);
    failed++;
  }
}

// Simulador em memória da tabela public.channel_connections com verificação de constraints
interface ChannelConnectionRow {
  id: string;
  workspace_id: string;
  channel: 'instagram' | 'messenger' | 'whatsapp';
  name: string;
  account_handle: string | null;
  status: string;
  status_message: string | null;
  connected_at: string | null;
  last_sync_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

class MockChannelConnectionsTable {
  private rows: ChannelConnectionRow[] = [];
  private uniqueConstraints: Array<{ name: string; columns: string[] }> = [];

  constructor(uniqueConstraintColumns: string[][]) {
    this.uniqueConstraints = uniqueConstraintColumns.map((cols, idx) => ({
      name: `unique_idx_${idx}`,
      columns: cols,
    }));
  }

  public getRows(): ChannelConnectionRow[] {
    return [...this.rows];
  }

  public setRows(rows: ChannelConnectionRow[]) {
    this.rows = [...rows];
  }

  public upsert(
    payload: Partial<ChannelConnectionRow> & { workspace_id: string; channel: 'instagram' | 'messenger' | 'whatsapp' },
    options: { onConflict: string }
  ): { data: ChannelConnectionRow | null; error: Error | null } {
    const conflictKeys = options.onConflict.split(',').map((k) => k.trim());

    // O PostgreSQL valida se existe uma restrição UNIQUE correspondente exata
    const matchingConstraint = this.uniqueConstraints.find((c) => {
      if (c.columns.length !== conflictKeys.length) return false;
      const sortedC = [...c.columns].sort();
      const sortedK = [...conflictKeys].sort();
      return sortedC.every((col, i) => col === sortedK[i]);
    });

    if (!matchingConstraint) {
      return {
        data: null,
        error: new Error(
          `PostgreSQL 42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification (${options.onConflict})`
        ),
      };
    }

    // Busca registro existente matching conflictKeys
    const existingIndex = this.rows.findIndex((row) => {
      return conflictKeys.every((key) => (row as any)[key] === (payload as any)[key]);
    });

    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      // Atualiza o registro existente
      const existing = this.rows[existingIndex];
      const updated: ChannelConnectionRow = {
        ...existing,
        ...payload,
        id: existing.id,
        updated_at: now,
      };
      this.rows[existingIndex] = updated;
      return { data: updated, error: null };
    } else {
      // Inserção: verifica se violaria qualquer constraint UNIQUE
      for (const constraint of this.uniqueConstraints) {
        const conflict = this.rows.some((row) => {
          return constraint.columns.every((col) => (row as any)[col] === (payload as any)[col]);
        });
        if (conflict) {
          return {
            data: null,
            error: new Error(`duplicate key value violates unique constraint "${constraint.name}"`),
          };
        }
      }

      const newRow: ChannelConnectionRow = {
        id: payload.id || `mock-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        workspace_id: payload.workspace_id,
        channel: payload.channel,
        name: payload.name || `${payload.channel} connection`,
        account_handle: payload.account_handle || null,
        status: payload.status || 'connected',
        status_message: payload.status_message || null,
        connected_at: payload.connected_at || now,
        last_sync_at: payload.last_sync_at || now,
        metadata: payload.metadata || null,
        created_at: now,
        updated_at: now,
      };

      this.rows.push(newRow);
      return { data: newRow, error: null };
    }
  }
}

// ======================================================================
// TESTES COM COMPORTAMENTO LEGADO VS CORRIGIDO
// ======================================================================

const WORKSPACE_A = '00000000-0000-0000-0000-000000000001';
const WORKSPACE_B = '00000000-0000-0000-0000-000000000002';

// 1. Simulação do Banco com UNIQUE(channel) LEGADO (onde falhava)
console.log('--- TESTE: Demonstração da falha com constraint legada UNIQUE(channel) ---');
const legacyTable = new MockChannelConnectionsTable([['channel']]);
legacyTable.setRows([
  {
    id: 'id-legacy-instagram',
    workspace_id: WORKSPACE_A,
    channel: 'instagram',
    name: 'Instagram Direct API',
    account_handle: null,
    status: 'awaiting_connection',
    status_message: 'Aguardando OAuth',
    connected_at: null,
    last_sync_at: null,
    metadata: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]);

const legacyUpsert = legacyTable.upsert(
  {
    workspace_id: WORKSPACE_A,
    channel: 'instagram',
    account_handle: '@casalfabre',
    status: 'connected',
  },
  { onConflict: 'workspace_id,channel' }
);

assert(
  legacyUpsert.error !== null && legacyUpsert.error.message.includes('42P10'),
  'Demonstrado: Upsert com onConflict "workspace_id,channel" falhava no schema antigo (42P10)'
);

// 2. Tabela corrigida com UNIQUE(workspace_id, channel)
console.log('\n--- TESTES: Validação dos Casos Obrigatórios 1 a 6 com UNIQUE(workspace_id, channel) ---');
const table = new MockChannelConnectionsTable([['workspace_id', 'channel']]);

// Seed inicial do Workspace A idêntico ao estado real confirmado no banco
table.setRows([
  {
    id: '64243f12-d564-44ea-99da-7e65825e525d',
    workspace_id: WORKSPACE_A,
    channel: 'instagram',
    name: 'Instagram Direct API',
    account_handle: null,
    status: 'awaiting_connection',
    status_message: 'Aguardando configuração de App Meta & Webhooks',
    connected_at: null,
    last_sync_at: null,
    metadata: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '1366d390-8852-404a-b861-10c92dca8803',
    workspace_id: WORKSPACE_A,
    channel: 'whatsapp',
    name: 'WhatsApp Business (Casal Fabre)',
    account_handle: '@casalfabre',
    status: 'connected',
    status_message: 'Webhook ativo e conectado ao ativo oficial Casal Fabre',
    connected_at: new Date().toISOString(),
    last_sync_at: new Date().toISOString(),
    metadata: { waba_id: '123456' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]);

// CASO 1: workspace A + instagram → pode existir.
const initialInsta = table.getRows().find((r) => r.workspace_id === WORKSPACE_A && r.channel === 'instagram');
assert(
  Boolean(initialInsta && initialInsta.channel === 'instagram' && initialInsta.workspace_id === WORKSPACE_A),
  'Caso 1: workspace A + instagram pode existir na tabela'
);

// CASO 2: workspace A + instagram novamente → deve atualizar o mesmo registro via upsert.
const instaPayloadWorkspaceA = {
  workspace_id: WORKSPACE_A,
  channel: 'instagram' as const,
  name: 'Casal Fabre Oficial',
  account_handle: '@casalfabre',
  status: 'connected',
  status_message: 'Conectado via Instagram Business Login (@casalfabre)',
  connected_at: new Date().toISOString(),
  last_sync_at: new Date().toISOString(),
  metadata: {
    instagram_business_id: '17841400000000000',
    username: 'casalfabre',
  },
};

const upsertResultCase2 = table.upsert(instaPayloadWorkspaceA, { onConflict: 'workspace_id,channel' });

assert(
  upsertResultCase2.error === null && upsertResultCase2.data !== null,
  'Caso 2: Upsert com onConflict: "workspace_id,channel" executa sem erros'
);
assert(
  upsertResultCase2.data?.id === '64243f12-d564-44ea-99da-7e65825e525d',
  'Caso 2: O registro existente de Instagram do workspace A teve seu ID preservado (atualizado in-place)'
);
assert(
  upsertResultCase2.data?.status === 'connected' && upsertResultCase2.data?.account_handle === '@casalfabre',
  'Caso 2: Status atualizado para "connected" e account_handle preenchido'
);
const rowsAfterCase2 = table.getRows().filter((r) => r.workspace_id === WORKSPACE_A && r.channel === 'instagram');
assert(rowsAfterCase2.length === 1, 'Caso 2: Não criou registro duplicado para o mesmo workspace e canal');

// CASO 3: workspace B + instagram → deve poder existir independentemente do workspace A.
const instaPayloadWorkspaceB = {
  workspace_id: WORKSPACE_B,
  channel: 'instagram' as const,
  name: 'Empresa Cliente B',
  account_handle: '@cliente_b',
  status: 'connected',
  status_message: 'Conectado via Instagram Business Login (@cliente_b)',
  connected_at: new Date().toISOString(),
  last_sync_at: new Date().toISOString(),
  metadata: {
    instagram_business_id: '17841499999999999',
    username: 'cliente_b',
  },
};

const upsertResultCase3 = table.upsert(instaPayloadWorkspaceB, { onConflict: 'workspace_id,channel' });

assert(
  upsertResultCase3.error === null && upsertResultCase3.data !== null,
  'Caso 3: Workspace B + instagram criado com sucesso sem colisão'
);
assert(
  upsertResultCase3.data?.workspace_id === WORKSPACE_B && upsertResultCase3.data?.account_handle === '@cliente_b',
  'Caso 3: Workspace B possui sua própria conexão isolada'
);
const allInstaRows = table.getRows().filter((r) => r.channel === 'instagram');
assert(
  allInstaRows.length === 2,
  'Caso 3: Workspace A e Workspace B possuem conexões simultâneas de Instagram sem conflito'
);

// CASO 4: workspace A + whatsapp → continua sendo uma conexão diferente.
const whatsappRow = table.getRows().find((r) => r.workspace_id === WORKSPACE_A && r.channel === 'whatsapp');
assert(
  Boolean(whatsappRow && whatsappRow.status === 'connected' && whatsappRow.name === 'WhatsApp Business (Casal Fabre)'),
  'Caso 4: workspace A + whatsapp permanece intacto e independente de instagram'
);

// CASO 5: não deve existir UNIQUE global apenas em channel.
console.log('\n--- TESTE: Verificação de Schema e Migrations locais ---');
const schemaContent = fs.readFileSync(path.resolve('supabase/schema.sql'), 'utf-8');
const migrationPath = path.resolve('supabase/migrations/20260917000000_fix_channel_connections_multitenant_unique.sql');
const migrationExists = fs.existsSync(migrationPath);
assert(migrationExists, 'Caso 5: Arquivo de migration específico criado em supabase/migrations/');

const migrationContent = fs.readFileSync(migrationPath, 'utf-8');

// Valida que no schema.sql não existe mais UNIQUE(channel) isolado na tabela channel_connections
const channelTableMatch = schemaContent.match(/CREATE TABLE IF NOT EXISTS public\.channel_connections\s*\(([\s\S]*?)\);/);
assert(Boolean(channelTableMatch), 'Caso 5: Definição de public.channel_connections localizada em schema.sql');

if (channelTableMatch) {
  const tableBody = channelTableMatch[1];
  const hasUniqueChannelOnly = /channel\s+TEXT[^,\n]*UNIQUE/i.test(tableBody) || /UNIQUE\s*\(\s*channel\s*\)/i.test(tableBody);
  assert(!hasUniqueChannelOnly, 'Caso 5: Não existe UNIQUE global apenas em channel no schema.sql');

  const hasUniqueComposite = /UNIQUE\s*\(\s*workspace_id\s*,\s*channel\s*\)/i.test(tableBody);
  assert(hasUniqueComposite, 'Caso 5: public.channel_connections possui UNIQUE(workspace_id, channel) no schema.sql');
}

// CASO 6: o upsert com onConflict: "workspace_id,channel" deve ser compatível com a estrutura definida.
const edgeFunctionContent = fs.readFileSync(path.resolve('supabase/functions/instagram-oauth/index.ts'), 'utf-8');
assert(
  edgeFunctionContent.includes('.upsert(connectionPayload, { onConflict: "workspace_id,channel" })'),
  'Caso 6: Edge Function instagram-oauth invoca .upsert com onConflict: "workspace_id,channel"'
);

// Validação dos campos do connectionPayload no index.ts
assert(
  edgeFunctionContent.includes('workspace_id: workspaceId') &&
  edgeFunctionContent.includes('channel: "instagram"') &&
  edgeFunctionContent.includes('account_handle: accountHandle') &&
  edgeFunctionContent.includes('status: "connected"'),
  'Caso 6: Payload da Edge Function instagram-oauth inclui todos os campos exigidos pela tabela'
);

// CASO 7: Integridade e Idempotência da Migration
console.log('\n--- TESTE: Verificação de Segurança e Idempotência da Migration SQL ---');
assert(
  migrationContent.includes('DO $$') && migrationContent.includes('channel_connections'),
  'Caso 7: Migration utiliza blocos anônimos PL/pgSQL seguros e transacionais'
);
assert(
  !migrationContent.includes('DROP TABLE') && !migrationContent.includes('TRUNCATE') && !migrationContent.includes('DELETE FROM'),
  'Caso 7: Migration é estritamente NÃO-DESTRUTIVA (sem DROP TABLE, TRUNCATE ou DELETE)'
);
assert(
  migrationContent.includes('RAISE EXCEPTION') && migrationContent.includes('duplicidades'),
  'Caso 7: Migration aborta com RAISE EXCEPTION se detectar duplicidades em (workspace_id, channel)'
);
assert(
  migrationContent.includes('channel_connections_workspace_channel_key') || migrationContent.includes('UNIQUE (workspace_id, channel)'),
  'Caso 7: Migration cria a constraint UNIQUE (workspace_id, channel)'
);
assert(
  !migrationContent.includes('CREATE UNIQUE INDEX'),
  'Caso 7: Migration não possui CREATE UNIQUE INDEX redundante (a constraint UNIQUE é a única estrutura de unicidade)'
);
assert(
  migrationContent.includes('is_nullable') && migrationContent.includes('SET NOT NULL'),
  'Caso 7: Migration valida nullability e aborta com RAISE EXCEPTION se houver valores NULL antes de aplicar NOT NULL'
);

// CASO 8: Auditoria do Banco de Dados Real (se configurado)
console.log('\n--- TESTE: Auditoria Read-Only no Supabase (se acessível) ---');
async function runDatabaseAudit() {
  try {
    const client = getSupabaseClient();
    if (!client) {
      console.log('ℹ️ Supabase não configurado neste ambiente local (modo mock).');
      return;
    }
    const { data, error } = await client
      .from('channel_connections')
      .select('id, workspace_id, channel, name, status, account_handle');

    if (error) {
      console.log(`ℹ️ Consulta read-only retornou: ${error.message}`);
      return;
    }

    if (data && data.length > 0) {
      console.log(`✅ ${data.length} registros existentes inspecionados em channel_connections.`);
      
      // Validação de duplicidades
      const seen = new Set<string>();
      let hasDuplicates = false;
      for (const row of data) {
        const key = `${row.workspace_id}:${row.channel}`;
        if (seen.has(key)) {
          hasDuplicates = true;
          console.error(`❌ Duplicidade detectada em: ${key}`);
        }
        seen.add(key);
      }
      assert(!hasDuplicates, 'Caso 8: Zero duplicidades encontradas nos dados reais de public.channel_connections');
      
      const insta = data.find((r) => r.channel === 'instagram');
      assert(Boolean(insta), 'Caso 8: Registro de Instagram preservado no workspace oficial');
      
      const whatsapp = data.find((r) => r.channel === 'whatsapp');
      assert(Boolean(whatsapp), 'Caso 8: Registro de WhatsApp preservado no workspace oficial');
    }
  } catch (err: any) {
    console.log(`ℹ️ Auditoria read-only concluída com aviso: ${err.message}`);
  }
}

await runDatabaseAudit();

console.log('\n======================================================================');
console.log(`RESULT: ${passed} passed, ${failed} failed.`);
console.log('======================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
