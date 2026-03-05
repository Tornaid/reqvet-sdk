// examples/03-generate-polling.ts
// ─────────────────────────────────────────────────────────────
// Generate a report using polling mode (waitForResult: true).
//
// Best for: scripts, CLIs, server-side integrations where
// you want the result synchronously without setting up a webhook.
// ─────────────────────────────────────────────────────────────

import { readFileSync } from 'fs';
import reqvet from './client.js';

// Load the audio file from disk (Buffer → SDK handles the upload)
const audio = readFileSync('./consultation.mp3');

// Discover available templates first
const { system, custom } = await reqvet.listTemplates();
const template = [...system, ...custom][0];

if (!template) throw new Error('No templates available');
console.log(`Using template: ${template.name} (${template.id})`);

// Generate — polls automatically until completed
const report = await reqvet.generateReport({
  audio,
  fileName: 'consultation.mp3',
  animalName: 'Luna',
  templateId: template.id,
  extraInstructions: 'Insiste sur les recommandations de suivi et le prochain rendez-vous.',
  metadata: {
    consultationId: 'CONSULT-2026-001',
    vetId: 'DR-MARTIN',
    clinicId: 'CLINIC-PARIS-12',
  },
  waitForResult: true,
  onStatus: (status) => console.log(`  → ${status}`),
});

console.log('\n─── Report ───────────────────────────────────────');
console.log('Job ID    :', report.jobId);
console.log('Animal    :', report.animalName);
console.log('Cost      :', report.cost);

console.log('\n─── Extracted fields ─────────────────────────────');
console.log(report.fields ?? '(no field_schema configured for this org)');

console.log('\n─── HTML preview (first 300 chars) ───────────────');
console.log(report.html.slice(0, 300) + '...');

console.log('\n─── Transcription preview ────────────────────────');
console.log(report.transcription.slice(0, 200) + '...');
