// examples/js/11-webhook-verify.mjs
// Standalone webhook signature verification + event handler.
// In production, use this inside your HTTP request handler.

import { verifyWebhookSignature } from '@reqvet-sdk/sdk/webhooks';

// Simulated incoming webhook (read from your HTTP request in production)
const rawBody = JSON.stringify({
  event: 'job.completed',
  job_id: 'a1b2c3d4-...',
  animal_name: 'Luna',
  html: '<h2>Consultation</h2><p>...</p>',
  transcription: 'Bonjour, je viens avec mon chien...',
  fields: { espece: 'Chien', poids: 28.5 },
  metadata: { consultationId: 'CONSULT-001' },
});

const timestamp = Date.now().toString();
const signature = 'sha256=invalidsignaturefortesting';

// ─── Verify ────────────────────────────────────────────────────

const { ok, reason } = verifyWebhookSignature({
  secret: process.env.REQVET_WEBHOOK_SECRET,
  rawBody,
  signature,
  timestamp,
  maxSkewMs: 5 * 60 * 1000,
});

if (!ok) {
  console.error('Webhook rejected:', reason);
  // reason: 'missing_headers' | 'invalid_timestamp' | 'stale_timestamp' | 'invalid_signature'
  process.exit(1);
}

// Only parse after verification
const event = JSON.parse(rawBody);
console.log('Webhook verified ✓');
console.log('Event:', event.event);
console.log('Job ID:', event.job_id);

// ─── Handle each event type ────────────────────────────────────

switch (event.event) {
  case 'job.completed':
    console.log('Report ready for', event.animal_name);
    console.log('HTML length:', event.html?.length);
    console.log('Fields:', event.fields);
    break;

  case 'job.failed':
    console.error('Job failed:', event.error);
    break;

  case 'job.amended':
    console.log(`Amendment #${event.amendment_number} complete for`, event.animal_name);
    break;

  case 'job.amend_failed':
    console.error('Amendment failed, original report preserved');
    break;

  case 'job.regenerated':
    console.log('Report regenerated for', event.animal_name);
    break;
}
