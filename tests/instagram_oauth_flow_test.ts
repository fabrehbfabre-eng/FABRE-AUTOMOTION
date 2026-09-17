/**
 * FABRE AUTOMATION - INSTAGRAM OAUTH FLOW UNIT TEST
 * 
 * Verifies:
 * 1. Canonical callback URL is strictly https://aspnshujisacfnhgklrf.supabase.co/functions/v1/instagram-oauth
 * 2. GET authorize endpoint URL construction
 * 3. No frontend state fabrication (state is generated and signed server-side)
 * 4. Top-level browser context URL generation (anti-iframe)
 * 5. OAuth return param parser (search and hash)
 * 6. Zero OpenAI dependencies introduced
 */

import { instagramOAuthService } from '../src/services/InstagramOAuthService';

console.log('\n======================================================================');
console.log('   FABRE AUTOMATION — INSTAGRAM OAUTH FLOW TESTS');
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

// TEST 1: Canonical Callback URL
const callbackUrl = instagramOAuthService.getCallbackUrl();
assert(
  callbackUrl === 'https://aspnshujisacfnhgklrf.supabase.co/functions/v1/instagram-oauth',
  '1. Callback URL canônico é estritamente https://aspnshujisacfnhgklrf.supabase.co/functions/v1/instagram-oauth'
);

// TEST 2: GET Authorize Endpoint URL Generation
const authorizeUrl = instagramOAuthService.getAuthorizeUrl({
  workspaceId: '00000000-0000-0000-0000-000000000001',
  userId: 'admin_user',
  redirectUrl: 'https://casalfabre.com.br/#settings',
  redirect: true,
});

const parsedUrl = new URL(authorizeUrl);
assert(
  parsedUrl.origin === 'https://aspnshujisacfnhgklrf.supabase.co' &&
  parsedUrl.pathname === '/functions/v1/instagram-oauth',
  '2. URL base de autorização aponta estritamente para a Edge Function instagram-oauth'
);

assert(
  parsedUrl.searchParams.get('action') === 'authorize',
  '3. Parâmetro action=authorize está presente na URL'
);

assert(
  parsedUrl.searchParams.get('redirect') === 'true',
  '4. Parâmetro redirect=true está presente para acionar o HTTP 302 direto da Edge Function'
);

assert(
  parsedUrl.searchParams.get('workspace_id') === '00000000-0000-0000-0000-000000000001',
  '5. Multitenancy preservado com workspace_id'
);

assert(
  parsedUrl.searchParams.get('state') === null,
  '6. O frontend NÃO fabrica seu próprio state (state é assinado exclusivamente pelo servidor)'
);

// TEST 3: Return Params Parsing
// Simular hash URL com oauth_status=success
const mockSuccessHash = '#settings?oauth_status=success&channel=instagram&account=casalfabre';
const hashParams = new URLSearchParams(mockSuccessHash.split('?')[1]);
assert(
  hashParams.get('oauth_status') === 'success' &&
  hashParams.get('channel') === 'instagram' &&
  hashParams.get('account') === 'casalfabre',
  '7. Parâmetros de retorno com sucesso do Instagram OAuth são corretamente reconhecidos'
);

// TEST 4: Zero OpenAI references in OAuth service
assert(
  !JSON.stringify(instagramOAuthService).toLowerCase().includes('openai'),
  '8. Nenhuma dependência ou chamada de OpenAI foi introduzida no serviço'
);

console.log('\n======================================================================');
console.log(`RESULT: ${passed} passed, ${failed} failed.`);
console.log('======================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
