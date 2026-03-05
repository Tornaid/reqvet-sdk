// examples/js/09-amend.mjs
// Add an audio complement to a completed job.
// Usage: node 09-amend.mjs <job-id>

import { readFileSync } from 'fs';
import reqvet from './client.mjs';

const JOB_ID = process.argv[2] ?? 'your-completed-job-id';

// ─── Step 1: Upload the complement audio ──────────────────────

const complementAudio = readFileSync('./complement.mp3');
const upload = await reqvet.uploadAudio(complementAudio, 'complement.mp3');

console.log('Complement uploaded:', upload.path);

// ─── Step 2: Submit the amendment ─────────────────────────────

const amend = await reqvet.amendJob(JOB_ID, {
  audioFile: upload.path,
  // templateId: 'other-template-id',  // optional: switch template
});

console.log('Amendment submitted:', amend);
// { job_id: '...', status: 'amending', amendment_number: 1, message: '...' }

// ─── Step 3: Wait for the updated report ──────────────────────

console.log('\nWaiting for amended report...');

const updatedReport = await reqvet.waitForJob(JOB_ID, (status) => {
  console.log('  →', status);
});

console.log('\nAmendment complete!');
console.log('Amendment number:', amend.amendment_number);
console.log('Updated HTML preview:', updatedReport.html.slice(0, 400));
