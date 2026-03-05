// examples/js/client.mjs
// Shared ReqVet client — imported by all examples.

import ReqVet from '@reqvet-sdk/sdk';

if (!process.env.REQVET_API_KEY) {
  throw new Error('Missing REQVET_API_KEY environment variable');
}

const reqvet = new ReqVet(process.env.REQVET_API_KEY, {
  baseUrl: process.env.REQVET_BASE_URL ?? 'https://api.reqvet.com',
  pollInterval: 5000,
  timeout: 5 * 60 * 1000,
});

export default reqvet;
