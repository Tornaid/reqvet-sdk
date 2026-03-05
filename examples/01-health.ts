// examples/01-health.ts
// ─────────────────────────────────────────────────────────────
// Check that the API is reachable and operational.
// Useful as a startup check in your integration.
// ─────────────────────────────────────────────────────────────

import reqvet from './client.js';

const result = await reqvet.health();

console.log(result);
// { status: 'ok', timestamp: '2026-03-05T15:41:58.839Z' }

if (result.status !== 'ok') {
  console.error('API is degraded — check ReqVet status before processing jobs');
  process.exit(1);
}

console.log('API is operational ✓');
