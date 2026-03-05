// examples/js/02-templates.mjs
// Full template lifecycle: list → create → update → delete.
//
// system : provided by ReqVet, visible to all orgs (read-only)
// custom : created by your organization (full CRUD)

import reqvet from './client.mjs';

// ─── List ──────────────────────────────────────────────────────

const { system, custom } = await reqvet.listTemplates();

console.log(`System templates (${system.length}):`);
system.forEach((t) => console.log(`  • [${t.id}] ${t.name}`));

console.log(`\nCustom templates (${custom.length}):`);
custom.forEach((t) => console.log(`  • [${t.id}] ${t.name}`));

// ─── Get a single template ─────────────────────────────────────

if (system.length > 0) {
  const template = await reqvet.getTemplate(system[0].id);
  console.log('\nFull template:', template);
}

// ─── Create ────────────────────────────────────────────────────

const created = await reqvet.createTemplate({
  name: 'Bilan annuel chien',
  description: 'Modèle pour les bilans de santé annuels canins',
  content: `Compte-rendu de bilan annuel — {{animal_name}}

I. Commémoratif
[Rappel des antécédents médicaux et traitements en cours.]

II. Examen clinique
Poids : [valeur]
Température : [valeur]
Constantes : [détail]

III. Vaccinations et antiparasitaires
[Statut et mise à jour.]

IV. Recommandations
[Prescriptions et suivi.]`,
  is_default: false,
});

console.log('\nCreated template:', created.id, created.name);

// ─── Update ────────────────────────────────────────────────────

const updated = await reqvet.updateTemplate(created.id, {
  name: 'Bilan annuel chien — v2',
  description: 'Modèle mis à jour avec section nutritionnelle',
});

console.log('Updated template name:', updated.name);

// ─── Delete ────────────────────────────────────────────────────

const deleted = await reqvet.deleteTemplate(created.id);
console.log('Deleted:', deleted); // { success: true }
