/**
 * FABRE AUTOMATION - Master Test Runner
 * Executes all controlled test suites and reports aggregate verification status.
 */

import { execSync } from 'child_process';

const testSuites = [
  { name: 'Rule Engine', file: 'tests/rule_engine_test.ts' },
  { name: 'WhatsApp Webhook & Inbound', file: 'tests/whatsapp_webhook_test.ts' },
  { name: 'WhatsApp Outbound Delivery & Idempotency', file: 'tests/whatsapp_outbound_real_test.ts' },
  { name: 'Durable Scheduler & Retry', file: 'tests/durable_scheduler_test.ts' },
  { name: 'Secure Automation Outbound', file: 'tests/secure_automation_outbound_test.ts' },
  { name: 'Realtime Inbox Subscriptions', file: 'tests/realtime_inbox_test.ts' },
  { name: 'Instagram OAuth Flow & Top-Level Navigation', file: 'tests/instagram_oauth_flow_test.ts' },
  { name: 'Channel Connections Multitenant Persistence', file: 'tests/channel_connections_multitenant_persistence_test.ts' },
];

console.log('\n======================================================================');
console.log('   FABRE AUTOMATION — TEST SUITE VERIFICATION');
console.log('======================================================================\n');

let passedCount = 0;
let failedCount = 0;

for (const suite of testSuites) {
  try {
    console.log(`\x1b[36m▶ Running ${suite.name} (${suite.file})...\x1b[0m`);
    execSync(`npx tsx ${suite.file}`, { stdio: 'inherit' });
    console.log(`\x1b[32m✔ ${suite.name} PASSED\x1b[0m\n`);
    passedCount++;
  } catch (error) {
    console.error(`\x1b[31m✖ ${suite.name} FAILED\x1b[0m\n`);
    failedCount++;
  }
}

console.log('======================================================================');
console.log(`RESULT: ${passedCount} passed, ${failedCount} failed of ${testSuites.length} suites.`);
console.log('======================================================================\n');

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
