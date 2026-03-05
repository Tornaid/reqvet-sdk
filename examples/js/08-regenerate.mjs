// examples/js/08-regenerate.mjs
// Regenerate a completed report with new instructions or a different template.
// Usage: node 08-regenerate.mjs <job-id>

import reqvet from './client.mjs';

const JOB_ID = process.argv[2] ?? 'your-completed-job-id';

// ─── Regenerate with new instructions ─────────────────────────

const result = await reqvet.regenerateJob(JOB_ID, {
  extraInstructions:
    'Reformule le diagnostic de manière plus détaillée. ' +
    'Ajoute une section pronostic à la fin du compte-rendu.',
});

console.log('Status :', result.status);
console.log('HTML preview:', result.result.html.slice(0, 400));

if (result.result.fields) {
  console.log('Fields:', result.result.fields);
}

// ─── Regenerate with a different template ─────────────────────

const { system } = await reqvet.listTemplates();

if (system.length > 1) {
  const altTemplate = system[1];
  console.log(`\nSwitching to template: ${altTemplate.name}`);

  const alt = await reqvet.regenerateJob(JOB_ID, {
    templateId: altTemplate.id,
  });

  console.log('Regenerated HTML preview:', alt.result.html.slice(0, 300));
}
