// examples/js/07-get-job.mjs
// Get a job by ID and read its result.
// Usage: node 07-get-job.mjs <job-id>

import reqvet from './client.mjs';

const JOB_ID = process.argv[2] ?? 'your-job-id-here';

const job = await reqvet.getJob(JOB_ID);

console.log('Status   :', job.status);
console.log('Animal   :', job.animal_name);
console.log('Created  :', job.created_at);

if (job.status === 'completed') {
  console.log('\n─── Result ───────────────────────────────────────');
  console.log('HTML (preview):', String(job.result?.html ?? '').slice(0, 300));
  console.log('Fields        :', job.result?.fields ?? null);
  console.log('Cost          :', job.cost);
  console.log('Reformulations:', job.reformulations?.length ?? 0);
}

if (job.status === 'failed') {
  console.log('\nError:', job.error);
}

// ─── Custom polling (without waitForJob) ──────────────────────

async function pollUntilDone(jobId, intervalMs = 3000) {
  while (true) {
    const j = await reqvet.getJob(jobId);
    console.log('Status:', j.status);
    if (j.status === 'completed' || j.status === 'failed') return j;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

// Usage: const result = await pollUntilDone(JOB_ID);
