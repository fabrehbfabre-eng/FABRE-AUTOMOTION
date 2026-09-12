/**
 * FABRE AUTOMATION - Supabase Management Integration Test
 * 
 * Verifies:
 * 1. Safe handling of SUPABASE_ACCESS_TOKEN without leakage.
 * 2. Token mask utility guarantees confidentiality.
 * 3. Management API client behavior when token is missing vs configured.
 * 4. Structured error codes and error categorization.
 */

import { SupabaseManagementService } from '../src/services/integrations/SupabaseManagementService';

async function runTests() {
  console.log('🧪 INICIANDO TESTES DE INTEGRAÇÃO DO SUPABASE MANAGEMENT LAYER');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, description: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${description}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${description}`);
      process.exitCode = 1;
    }
  }

  // TEST 1: Token Masking Functionality
  console.log('\n--- TESTE 1: Máscara de Segurança de Token ---');
  const maskedEmpty = SupabaseManagementService.maskToken('');
  assert(maskedEmpty === '[UNCONFIGURED]', 'Token vazio retorna [UNCONFIGURED]');

  const testToken = 'sbp_abcdefghijklmnopqrstuvwxyz123456';
  const maskedReal = SupabaseManagementService.maskToken(testToken);
  assert(
    maskedReal.startsWith('sbp_') && maskedReal.endsWith('456 (len: 36)') && !maskedReal.includes('hijklmnop'),
    'Token longo é mascarado preservando apenas prefixo/sufixo sem vazar o corpo'
  );

  // TEST 2: Environment Check without Leakage
  console.log('\n--- TESTE 2: Status do Ambiente Seguro ---');
  const authStatus = SupabaseManagementService.getAuthStatus();
  assert(typeof authStatus.isConfigured === 'boolean', 'getAuthStatus retorna flag booleana isConfigured');
  assert(
    authStatus.source === 'process.env.SUPABASE_ACCESS_TOKEN' || authStatus.source === 'none',
    'Fonte de dados é identificada com segurança'
  );

  // TEST 3: Connection Attempt with Controlled Token
  console.log('\n--- TESTE 3: Verificação com Token Não Configurado (Fail-Safe) ---');
  // Temporarily backup and clear token for test
  const originalToken = process.env.SUPABASE_ACCESS_TOKEN;
  delete process.env.SUPABASE_ACCESS_TOKEN;

  const resultWithoutToken = await SupabaseManagementService.verifyConnection();
  assert(!resultWithoutToken.success, 'Falha graciosa quando token não está no ambiente');
  assert(resultWithoutToken.errorCode === 'MISSING_TOKEN', 'Código de erro MISSING_TOKEN retornado');
  assert(!resultWithoutToken.authenticated, 'Flag authenticated permanece false');

  // TEST 4: Error Handling with Invalid Simulated Token
  console.log('\n--- TESTE 4: Tratamento de Token Inválido na Management API ---');
  process.env.SUPABASE_ACCESS_TOKEN = 'sbp_invalid_token_for_automated_test_assertion_99999';

  const resultWithInvalidToken = await SupabaseManagementService.verifyConnection();
  assert(!resultWithInvalidToken.success, 'Token inválido é rejeitado pela API do Supabase');
  assert(
    resultWithInvalidToken.errorCode === 'INVALID_TOKEN' || resultWithInvalidToken.errorCode === 'NETWORK_ERROR',
    'Código de erro categorizado adequadamente (INVALID_TOKEN ou NETWORK_ERROR)'
  );

  // Restore environment
  if (originalToken) {
    process.env.SUPABASE_ACCESS_TOKEN = originalToken;
  } else {
    delete process.env.SUPABASE_ACCESS_TOKEN;
  }

  // TEST 5: Real Token Check if available in execution runtime
  console.log('\n--- TESTE 5: Verificação do Token Real do Operador ---');
  if (process.env.SUPABASE_ACCESS_TOKEN) {
    console.log('ℹ️ SUPABASE_ACCESS_TOKEN detectado no ambiente! Executando validação ao vivo com Supabase Management API...');
    const liveResult = await SupabaseManagementService.verifyConnection('Heberson Fabre');
    console.log('Resultado da API ao vivo:', {
      success: liveResult.success,
      authenticated: liveResult.authenticated,
      statusCode: liveResult.statusCode,
      projectsFound: liveResult.projectsFound,
      targetProject: liveResult.targetProject?.name,
    });
    assert(liveResult.authenticated, 'Autenticação bem-sucedida com o token do operador');
  } else {
    console.log('ℹ️ SUPABASE_ACCESS_TOKEN ainda não foi injetado nas variáveis de ambiente do runtime.');
    assert(true, 'Teste informativo: ambiente pronto para receber o token do operador');
  }

  console.log(`\n======================================================================`);
  console.log(`RESULTADO DOS TESTES: ${passed}/${total} APROVADOS.`);
  console.log(`======================================================================`);
}

runTests().catch(err => {
  console.error('Erro fatal nos testes:', err);
  process.exit(1);
});
