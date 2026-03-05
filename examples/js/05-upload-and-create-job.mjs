// examples/js/05-upload-and-create-job.mjs
// Manual flow: upload audio then create a job separately.
// Use this when you want full control over each step.

import { readFileSync } from 'fs';
import reqvet from './client.mjs';

// ─── Step 1: Upload ────────────────────────────────────────────

const audio = readFileSync('./consultation.mp3');
const upload = await reqvet.uploadAudio(audio, 'consultation.mp3');

console.log('Uploaded:', upload);
// {
//   audio_file: 'orgs/xxx/audio/yyy.mp3',
//   path: 'orgs/xxx/audio/yyy.mp3',
//   size_bytes: 2048000,
//   content_type: 'audio/mpeg'
// }

// ─── Step 2: Create job ────────────────────────────────────────

const { system } = await reqvet.listTemplates();
const templateId = system[0]?.id ?? 'your-template-id';

const job = await reqvet.createJob({
  audioFile: upload.path,
  animalName: 'Nala',
  templateId,
  callbackUrl: 'https://your-app.com/api/reqvet/webhook',
  extraInstructions: 'Animal craintif, préciser les recommandations de manipulation.',
  metadata: {
    consultationId: 'CONSULT-2026-003',
    species: 'chat',
  },
});

console.log('Job created:', job);
// { job_id: 'xxxxxxxx-...', status: 'pending' }
