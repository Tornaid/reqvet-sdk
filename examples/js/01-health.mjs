// examples/js/01-health.mjs
import reqvet from './client.mjs';

const result = await reqvet.health();

console.log(result);
// { status: 'ok', timestamp: '2026-03-05T15:41:58.839Z' }

if (result.status !== 'ok') {
  console.error('API is degraded — check ReqVet status before processing jobs');
  process.exit(1);
}

console.log('API is operational ✓');
