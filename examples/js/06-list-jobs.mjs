// examples/js/06-list-jobs.mjs
// List jobs with pagination and status filtering.

import reqvet from './client.mjs';

// ─── All recent jobs (default: 20, newest first) ──────────────

const { jobs, pagination } = await reqvet.listJobs();

console.log(`${pagination.total} total jobs — showing ${jobs.length}`);
jobs.forEach((j) => console.log(`  [${j.status}] ${j.id} — ${j.animal_name}`));

// ─── Only completed jobs ───────────────────────────────────────

const completed = await reqvet.listJobs({ status: 'completed', limit: 10 });
console.log(`\nCompleted jobs: ${completed.pagination.total}`);

// ─── Paginate through all jobs ─────────────────────────────────

async function fetchAllJobs() {
  const all = [];
  let offset = 0;
  const limit = 50;

  while (true) {
    const page = await reqvet.listJobs({ limit, offset, sort: 'created_at', order: 'asc' });
    all.push(...page.jobs);
    if (!page.pagination.has_more) break;
    offset += limit;
  }

  return all;
}

const allJobs = await fetchAllJobs();
console.log(`\nFetched all ${allJobs.length} jobs`);

// ─── Failed jobs (for monitoring) ─────────────────────────────

const failed = await reqvet.listJobs({ status: 'failed', limit: 5 });
if (failed.jobs.length > 0) {
  console.log(`\n⚠ ${failed.pagination.total} failed jobs:`);
  failed.jobs.forEach((j) => console.log(`  ${j.id} — ${j.animal_name} — ${j.created_at}`));
}
