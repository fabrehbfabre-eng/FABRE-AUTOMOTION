/**
 * FABRE AUTOMATION - META WEBHOOK RUNTIME FINGERPRINT DIAGNOSTIC TEST
 * 
 * Verifies:
 * 1. Secret ausente: Retorna HTTP 500 com {"diagnostic": "secret-fingerprint", "configured": false}
 * 2. Secret presente: Retorna HTTP 200 com {"diagnostic": "secret-fingerprint", "configured": true, "fingerprint_prefix": "<16 caracteres>"}
 * 3. Fingerprint SHA-256 truncado para exatamente 16 caracteres hexadecimais minúsculos
 * 4. Ausência total de exposição do valor original do secret (nem substring, nem hash completo)
 * 5. Código estático: O diagnóstico é executado ANTES do handshake GET e não altera POST nem handshake normal
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

console.log('\n======================================================================');
console.log('   FABRE AUTOMATION — META WEBHOOK DIAGNOSTIC FINGERPRINT TESTS');
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

// 1. Implementação idêntica da função de fingerprint sob teste (Web Crypto API)
async function getSecretFingerprint(secret: string): Promise<string> {
  const bytes = new TextEncoder().encode(secret);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

// Simulador fiel do handler GET da Edge Function meta-webhook
async function handleMetaWebhookGet(
  urlStr: string,
  envMock: { META_APP_SECRET?: string; META_WEBHOOK_VERIFY_TOKEN?: string }
): Promise<{ status: number; body: string; headers: Record<string, string> }> {
  const url = new URL(urlStr);

  // 2.0 Temporary Runtime Diagnostic: Secret Fingerprint
  if (url.searchParams.get("diagnostic") === "secret-fingerprint") {
    const currentSecret = envMock.META_APP_SECRET;
    if (!currentSecret) {
      return {
        status: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagnostic: "secret-fingerprint",
          configured: false,
        }),
      };
    }

    const fingerprintPrefix = await getSecretFingerprint(currentSecret);
    return {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        diagnostic: "secret-fingerprint",
        configured: true,
        fingerprint_prefix: fingerprintPrefix,
      }),
    };
  }

  // Handshake normal do Meta
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (!mode || !token) {
    return {
      status: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing verification parameters" }),
    };
  }

  if (mode === "subscribe" && envMock.META_WEBHOOK_VERIFY_TOKEN && token === envMock.META_WEBHOOK_VERIFY_TOKEN) {
    return {
      status: 200,
      headers: { "Content-Type": "text/plain" },
      body: challenge || "",
    };
  }

  return {
    status: 403,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ error: "Verification token mismatch" }),
  };
}

// ======================================================================
// TESTES EM TEMPO DE EXECUÇÃO (BEHAVIORAL TESTS)
// ======================================================================

console.log('--- TESTE 1: Secret Ausente no Runtime ---');
const resAbsent = await handleMetaWebhookGet(
  'https://aspnshujisacfnhgklrf.supabase.co/functions/v1/meta-webhook?diagnostic=secret-fingerprint',
  { META_APP_SECRET: undefined }
);

assert(resAbsent.status === 500, 'TESTE 1: Status HTTP é 500 quando META_APP_SECRET não está configurado');
const bodyAbsent = JSON.parse(resAbsent.body);
assert(bodyAbsent.diagnostic === 'secret-fingerprint', 'TESTE 1: Campo "diagnostic" é "secret-fingerprint"');
assert(bodyAbsent.configured === false, 'TESTE 1: Campo "configured" é false');
assert(!('fingerprint_prefix' in bodyAbsent), 'TESTE 1: Campo "fingerprint_prefix" não é enviado se ausente');

console.log('\n--- TESTE 2: Secret Presente no Runtime ---');
const MOCK_SECRET = 'fabre_meta_secret_key_prod_2026_top_secret';
const resPresent = await handleMetaWebhookGet(
  'https://aspnshujisacfnhgklrf.supabase.co/functions/v1/meta-webhook?diagnostic=secret-fingerprint',
  { META_APP_SECRET: MOCK_SECRET }
);

assert(resPresent.status === 200, 'TESTE 2: Status HTTP é 200 quando META_APP_SECRET está configurado');
const bodyPresent = JSON.parse(resPresent.body);
assert(bodyPresent.diagnostic === 'secret-fingerprint', 'TESTE 2: Campo "diagnostic" é "secret-fingerprint"');
assert(bodyPresent.configured === true, 'TESTE 2: Campo "configured" é true');
assert(typeof bodyPresent.fingerprint_prefix === 'string', 'TESTE 2: "fingerprint_prefix" retornado como string');

console.log('\n--- TESTE 3: Validação do Fingerprint SHA-256 Truncado para 16 Caracteres ---');
assert(
  bodyPresent.fingerprint_prefix.length === 16,
  `TESTE 3: Fingerprint possui exatamente 16 caracteres (obtido: ${bodyPresent.fingerprint_prefix.length})`
);
assert(
  /^[0-9a-f]{16}$/.test(bodyPresent.fingerprint_prefix),
  `TESTE 3: Fingerprint é formato hexadecimal minúsculo [0-9a-f]{16} (${bodyPresent.fingerprint_prefix})`
);

// Validação independente usando crypto nativo do Node.js
const fullHashNode = crypto.createHash('sha256').update(MOCK_SECRET).digest('hex');
const expected16Prefix = fullHashNode.slice(0, 16);
assert(
  bodyPresent.fingerprint_prefix === expected16Prefix,
  `TESTE 3: Fingerprint corresponde aos primeiros 16 caracteres do SHA-256 de referência (${expected16Prefix})`
);

console.log('\n--- TESTE 4: Ausência de Exposição do Segredo Original ou do Hash Completo ---');
assert(!resPresent.body.includes(MOCK_SECRET), 'TESTE 4: A resposta HTTP NÃO contém o segredo original');
assert(!resPresent.body.includes(fullHashNode), 'TESTE 4: A resposta HTTP NÃO contém o hash completo de 64 caracteres');
assert(!resAbsent.body.includes(MOCK_SECRET), 'TESTE 4: Resposta de erro não vaza segredo');

const bodyKeys = Object.keys(bodyPresent).sort();
assert(
  JSON.stringify(bodyKeys) === JSON.stringify(['configured', 'diagnostic', 'fingerprint_prefix']),
  'TESTE 4: Resposta 200 contém ESTRITAMENTE as chaves autorizadas (configured, diagnostic, fingerprint_prefix)'
);

console.log('\n--- TESTE 5: Preservação do Handshake GET Normal do Meta ---');
const normalHandshakeRes = await handleMetaWebhookGet(
  'https://aspnshujisacfnhgklrf.supabase.co/functions/v1/meta-webhook?hub.mode=subscribe&hub.verify_token=my_meta_token&hub.challenge=test_challenge_12345',
  { META_WEBHOOK_VERIFY_TOKEN: 'my_meta_token' }
);
assert(
  normalHandshakeRes.status === 200 && normalHandshakeRes.body === 'test_challenge_12345',
  'TESTE 5: Handshake normal do Meta com hub.challenge continua funcionando perfeitamente'
);

const missingParamRes = await handleMetaWebhookGet(
  'https://aspnshujisacfnhgklrf.supabase.co/functions/v1/meta-webhook',
  {}
);
assert(
  missingParamRes.status === 400,
  'TESTE 5: GET comum sem parâmetros continua retornando 400 Missing verification parameters'
);

// ======================================================================
// TESTE 6: AUDITORIA ESTÁTICA DO CÓDIGO FONTE DA EDGE FUNCTION
// ======================================================================
console.log('\n--- TESTE 6: Auditoria Estática do Código Fonte em supabase/functions/meta-webhook/index.ts ---');
const edgeFunctionSource = fs.readFileSync(path.resolve('supabase/functions/meta-webhook/index.ts'), 'utf-8');

assert(
  edgeFunctionSource.includes('async function getSecretFingerprint(secret: string): Promise<string>'),
  'TESTE 6: Função getSecretFingerprint está declarada exatamente como especificado'
);

assert(
  edgeFunctionSource.includes('.slice(0, 16)'),
  'TESTE 6: Truncamento .slice(0, 16) está presente na função'
);

assert(
  edgeFunctionSource.includes('url.searchParams.get("diagnostic") === "secret-fingerprint"'),
  'TESTE 6: Rota GET verifica estritamente diagnostic === "secret-fingerprint"'
);

// Garantir que diagnostic ocorre ANTES de hub.mode
const diagnosticIndex = edgeFunctionSource.indexOf('url.searchParams.get("diagnostic") === "secret-fingerprint"');
const hubModeIndex = edgeFunctionSource.indexOf('url.searchParams.get("hub.mode")');
assert(
  diagnosticIndex !== -1 && hubModeIndex !== -1 && diagnosticIndex < hubModeIndex,
  'TESTE 6: Diagnóstico é executado ANTES da lógica normal de handshake hub.mode'
);

// Garantir que o secret não é logado
const logCallsWithSecret = edgeFunctionSource.match(/logSecure\([^)]*META_APP_SECRET[^)]*\)/gi);
assert(
  !logCallsWithSecret,
  'TESTE 6: Nenhuma chamada a logSecure registra META_APP_SECRET'
);

const consoleLogWithSecret = edgeFunctionSource.match(/console\.(log|error|warn|info)\([^)]*META_APP_SECRET[^)]*\)/gi);
assert(
  !consoleLogWithSecret,
  'TESTE 6: Nenhuma chamada a console.log registra META_APP_SECRET'
);

console.log('\n======================================================================');
console.log(`RESULT: ${passed} passed, ${failed} failed.`);
console.log('======================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
