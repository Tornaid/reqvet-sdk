// examples/client.ts
// ─────────────────────────────────────────────────────────────
// Shared ReqVet client — imported by all examples.
// Set your credentials in environment variables before running.
// ─────────────────────────────────────────────────────────────

import ReqVet from '@reqvet-sdk/sdk';

if (!process.env.REQVET_API_KEY) {
  throw new Error('Missing REQVET_API_KEY environment variable');
}

const reqvet = new ReqVet(process.env.REQVET_API_KEY, {
  baseUrl: process.env.REQVET_BASE_URL ?? 'https://api.reqvet.com',
  pollInterval: 5000,       // check every 5s when polling
  timeout: 5 * 60 * 1000,  // give up after 5 minutes
});

export default reqvet;
