// examples/js/10-reformulate.mjs
// Generate audience-specific versions of a completed report.
// Usage: node 10-reformulate.mjs <job-id>
//
// Purpose values:
//   owner               → simplified version for the pet owner
//   referral            → clinical summary for a specialist
//   summary             → short internal note
//   diagnostic_hypothesis → differential diagnosis list
//   custom              → defined by customInstructions

import reqvet from './client.mjs';

const JOB_ID = process.argv[2] ?? 'your-completed-job-id';

// ─── For the pet owner ─────────────────────────────────────────

const ownerVersion = await reqvet.reformulateReport(JOB_ID, { purpose: 'owner' });
console.log('Owner version (preview):');
console.log(ownerVersion.html.slice(0, 400));
console.log('Cost:', ownerVersion.cost.cost_usd, '$');

// ─── For a specialist referral ────────────────────────────────

const referral = await reqvet.reformulateReport(JOB_ID, { purpose: 'referral' });
console.log('\nReferral version (preview):');
console.log(referral.html.slice(0, 400));

// ─── Short internal summary ───────────────────────────────────

const summary = await reqvet.reformulateReport(JOB_ID, { purpose: 'summary' });
console.log('\nSummary:', summary.html);

// ─── Diagnostic hypothesis ────────────────────────────────────

const hypothesis = await reqvet.reformulateReport(JOB_ID, { purpose: 'diagnostic_hypothesis' });
console.log('\nDifferential diagnosis:', hypothesis.html.slice(0, 300));

// ─── Custom ───────────────────────────────────────────────────

const custom = await reqvet.reformulateReport(JOB_ID, {
  purpose: 'custom',
  customInstructions:
    'Reformule en insistant sur le pronostic et le suivi nutritionnel. ' +
    'Utilise un ton rassurant pour le propriétaire.',
});
console.log('\nCustom version (preview):', custom.html.slice(0, 400));

// ─── List all reformulations ──────────────────────────────────

const { reformulations } = await reqvet.listReformulations(JOB_ID);
console.log(`\nAll reformulations for job ${JOB_ID}:`);
reformulations.forEach((r) =>
  console.log(`  [${r.purpose}] created ${r.created_at} — cost: ${r.cost.cost_usd}$`)
);
