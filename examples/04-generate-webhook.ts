// examples/04-generate-webhook.ts
// ─────────────────────────────────────────────────────────────
// Generate a report using webhook mode (recommended for production).
//
// Best for: production integrations where the user submits audio
// and your backend receives the result asynchronously.
//
// Flow:
//   1. Upload audio + create job → returns immediately with job_id
//   2. ReqVet processes the job (transcription + generation)
//   3. ReqVet POSTs the result to your callbackUrl
//
// See 11-webhook-handler-nextjs.ts for the webhook receiver.
// ─────────────────────────────────────────────────────────────

import { readFileSync } from 'fs';
import reqvet from './client.js';

const audio = readFileSync('./consultation.mp3');

const { system, custom } = await reqvet.listTemplates();
const template = [...system, ...custom][0];
if (!template) throw new Error('No templates available');

// Returns immediately — no polling
const job = await reqvet.generateReport({
  audio,
  fileName: 'consultation.mp3',
  animalName: 'Max',
  templateId: template.id,
  callbackUrl: 'https://your-app.com/api/reqvet/webhook',
  metadata: {
    consultationId: 'CONSULT-2026-002',
    vetId: 'DR-DUPONT',
  },
  // waitForResult: false (default)
});

console.log('Job created:', job);
// { job_id: 'xxxxxxxx-...', status: 'pending' }

// Store job.job_id in your database linked to the consultationId.
// Your webhook handler will receive the result when processing completes.
console.log(`\nStore job_id "${job.job_id}" in your DB.`);
console.log('Result will arrive at your callbackUrl when ready.');
