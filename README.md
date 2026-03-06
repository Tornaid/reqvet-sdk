# @reqvet-sdk/sdk

SDK JavaScript/TypeScript officiel pour l'API [ReqVet](https://reqvet.com) — génération de comptes rendus vétérinaires par IA à partir d'enregistrements audio.

[![npm version](https://img.shields.io/npm/v/@reqvet-sdk/sdk)](https://www.npmjs.com/package/@reqvet-sdk/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js ≥ 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

## Fonctionnalités

- **Uploader** un enregistrement audio (`uploadAudio`)
- **Générer** un compte rendu vétérinaire (`createJob`, `generateReport`)
- **Suivre** les jobs — via webhook ou polling (`getJob`, `waitForJob`, `listJobs`)
- **Amender** un compte rendu terminé avec un audio complémentaire (`amendJob`)
- **Régénérer** avec de nouvelles instructions (`regenerateJob`)
- **Reformuler** pour une audience spécifique — propriétaire, référé, spécialiste (`reformulateReport`)
- **Gérer les templates** (`listTemplates`, `createTemplate`, `updateTemplate`, `deleteTemplate`)
- **Vérifier les webhooks** avec HMAC (`@reqvet-sdk/sdk/webhooks`)
- **Provisionner et gérer des cliniques** en mode revendeur multi-tenant (`createOrganization`, `listOrganizations`, `updateOrganization`, `deactivateOrganization`)

> **Note** : ce SDK n'inclut pas d'enregistreur audio. Votre application gère l'enregistrement et passe un `File`, `Blob` ou `Buffer` au SDK.

## Installation

```bash
npm install @reqvet-sdk/sdk
```

Nécessite Node.js ≥ 18. Fonctionne dans les navigateurs modernes pour les méthodes client (Blob/FormData requis pour l'upload).

## Avant votre premier appel

Votre responsable de compte ReqVet vous fournira trois variables d'environnement :

```bash
REQVET_API_KEY=rqv_live_...
REQVET_BASE_URL=https://api.reqvet.com
REQVET_WEBHOOK_SECRET=...   # uniquement si vous utilisez les webhooks
```

Chaque job nécessite un `templateId`. **Appelez `listTemplates()` en premier** pour découvrir ce qui est disponible :

```ts
const { system, custom } = await reqvet.listTemplates();
// system = templates fournis par ReqVet, visibles par toutes les organisations (lecture seule)
// custom = templates créés par votre organisation

const templateId = system[0].id;
```

## Démarrage rapide

### Flux webhook (recommandé)

Pour les intégrations serveur (Next.js, Express…), utilisez `getSignedUploadUrl()` qui uploade le fichier directement dans Supabase sans passer par une Vercel Serverless Function — **pas de limite de taille**.

```ts
import ReqVet from '@reqvet-sdk/sdk';

const reqvet = new ReqVet(process.env.REQVET_API_KEY!, {
  baseUrl: process.env.REQVET_BASE_URL,
});

// 1. Obtenir une URL signée Supabase (requête JSON légère, pas de fichier)
const { uploadUrl, path } = await reqvet.getSignedUploadUrl(
  'consultation.webm',
  'audio/webm',
);

// 2. Uploader directement vers Supabase (contourne Vercel, pas de limite de taille)
await fetch(uploadUrl, {
  method: 'PUT',
  headers: { 'Content-Type': 'audio/webm' },
  body: audioBuffer, // Buffer | Blob | File
});

// 3. Créer un job — ReqVet POSTera le résultat sur votre webhook quand il sera prêt
const job = await reqvet.createJob({
  audioFile: path,
  animalName: 'Rex',
  templateId: 'your-template-uuid',
  callbackUrl: 'https://your-app.com/api/reqvet/webhook',
  metadata: { consultationId: 'abc123' },
});
// { job_id: '...', status: 'pending' }
```

> **`uploadAudio()` vs `getSignedUploadUrl()`**
>
> `uploadAudio()` est pratique pour des fichiers légers (< 4 MB) ou des contextes navigateur.
> Pour les proxies serveur, préférez `getSignedUploadUrl()` : le fichier va directement dans Supabase,
> sans passer par `/api/v1/upload` (Vercel Serverless Function, limite ~4.5 MB).

Votre webhook reçoit un événement `job.completed` :

```json
{
  "event": "job.completed",
  "job_id": "a1b2c3d4-...",
  "animal_name": "Rex",
  "html": "<section class=\"cr\">...</section>",
  "transcription": "Le vétérinaire examine Rex...",
  "fields": { "espece": "Chien", "poids": 28.5 },
  "metadata": { "consultationId": "abc123" }
}
```

### Flux polling (plus simple pour le développement)

```ts
const report = await reqvet.generateReport({
  audio: audioFile,
  animalName: 'Rex',
  templateId: 'your-template-uuid',
  waitForResult: true,
  onStatus: (s) => console.log(s),
});
// { jobId, html, fields, transcription, cost, metadata }
```

### Vérifier un webhook entrant

```ts
import { verifyWebhookSignature } from '@reqvet-sdk/sdk/webhooks';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const { ok, reason } = verifyWebhookSignature({
    secret: process.env.REQVET_WEBHOOK_SECRET!,
    rawBody,
    signature: req.headers.get('x-reqvet-signature') ?? '',
    timestamp: req.headers.get('x-reqvet-timestamp') ?? '',
  });

  if (!ok) return new Response('Unauthorized', { status: 401 });

  const event = JSON.parse(rawBody);
  // event.event, event.job_id, event.html, event.metadata ...
}
```

## API

### Génération de comptes rendus

| Méthode | Description |
|---------|-------------|
| `getSignedUploadUrl(fileName, contentType)` | URL signée Supabase pour upload direct (recommandé serveur) |
| `uploadAudio(audio, fileName?)` | Uploader un fichier audio via ReqVet (limite Vercel ~4.5 MB) |
| `generateReport(params)` | Upload + création de job (helper tout-en-un) |
| `createJob(params)` | Créer un job de génération |
| `listJobs(options?)` | Lister les jobs avec pagination et filtre par statut |
| `getJob(jobId)` | Obtenir le statut et le résultat d'un job |
| `waitForJob(jobId, onStatus?)` | Attendre en polling la fin d'un job |
| `regenerateJob(jobId, options?)` | Régénérer un compte rendu terminé |
| `amendJob(jobId, params)` | Ajouter un audio complémentaire à un job terminé |
| `reformulateReport(jobId, params)` | Générer une version adaptée à une audience |
| `listReformulations(jobId)` | Lister toutes les reformulations d'un job |
| `listTemplates()` | Lister les templates disponibles (`{ system, custom }`) |
| `getTemplate(templateId)` | Obtenir un template par son ID |
| `createTemplate(params)` | Créer un template personnalisé |
| `updateTemplate(templateId, updates)` | Mettre à jour un template |
| `deleteTemplate(templateId)` | Supprimer un template |
| `health()` | Vérification de l'état de l'API |

### API Partenaire / Revendeur

> Ces méthodes nécessitent une clé API revendeur (`rqv_live_...` avec `role='reseller'`), distincte de la clé d'une clinique standard. Contactez votre responsable de compte ReqVet pour obtenir une clé revendeur.

| Méthode | Description |
|---------|-------------|
| `listOrganizations()` | Lister toutes les cliniques provisionnées par le revendeur |
| `createOrganization(params)` | Provisionner une nouvelle clinique (génère sa clé API et son webhook secret) |
| `getOrganization(orgId)` | Obtenir le détail et l'usage du mois d'une clinique |
| `updateOrganization(orgId, updates)` | Modifier le quota, le statut ou le webhook d'une clinique |
| `deactivateOrganization(orgId)` | Suspendre une clinique et révoquer ses clés API (soft delete) |

## Événements webhook

ReqVet déclenche 5 types d'événements : `job.completed`, `job.failed`, `job.amended`, `job.amend_failed`, `job.regenerated`.

Les livraisons échouées sont retentées 3 fois (0s, 2s, 5s). Implémentez l'idempotence dans votre handler — dédoublonnez sur `job_id + event`.

Voir [SDK_REFERENCE.md §6](./SDK_REFERENCE.md#6-webhook-events) pour la structure complète des payloads de chaque événement.

## Intégration revendeur (multi-tenant)

Si vous êtes un éditeur logiciel intégrant ReqVet pour vos clients (cliniques), utilisez une clé API revendeur pour provisionner et gérer les organisations de manière programmatique.

```ts
import ReqVet from '@reqvet-sdk/sdk';

// Instancier avec la clé revendeur (role='reseller')
const reseller = new ReqVet(process.env.REQVET_RESELLER_KEY!);

// Provisionner une clinique à l'onboarding
const result = await reseller.createOrganization({
  name: 'Clinique du Parc',
  contactEmail: 'contact@clinique-du-parc.fr',
  externalId: 'votre_id_interne_4892', // votre ID — garantit l'idempotence
  monthlyQuota: 500,
  webhookUrl: 'https://votre-app.com/webhooks/reqvet',
});

// ⚠️ Stocker immédiatement ces valeurs — elles ne sont retournées qu'une seule fois
await db.saveClinicCredentials({
  clinicId: result.organization.id,
  apiKey: result.api_key,           // rqv_live_...
  webhookSecret: result.webhook_secret, // whsec_...
});

// La clinique utilise ensuite son propre client ReqVet avec sa clé
const clinic = new ReqVet(result.api_key);
const { system } = await clinic.listTemplates();
const job = await clinic.createJob({ audioFile, animalName, templateId: system[0].id });

// Lister toutes les cliniques avec leur usage du mois
const { organizations } = await reseller.listOrganizations();
// [{ id, name, is_active, monthly_quota, usage: { jobs_this_month, quota_remaining } }]

// Modifier le quota d'une clinique
await reseller.updateOrganization(orgId, { monthlyQuota: 1000 });

// Suspendre une clinique (révoque aussi ses clés API)
await reseller.updateOrganization(orgId, { isActive: false });

// Réactiver
await reseller.updateOrganization(orgId, { isActive: true });

// Désactiver définitivement (soft delete — données conservées pour le RGPD)
await reseller.deactivateOrganization(orgId);
```

> **Idempotence** : si `createOrganization` est appelé plusieurs fois avec le même `externalId`, l'organisation existante est retournée sans créer de doublon. Utile pour rendre votre processus d'onboarding sûr en cas de retry.

## TypeScript

Définitions TypeScript complètes incluses :

```ts
import type {
  ReqVetReport,
  JobSummary,
  ListJobsResult,
  Template,
  ReqVetReformulation,
  ExtractedFields,
  // Partner / Reseller
  PartnerOrganization,
  OrganizationUsage,
  CreateOrganizationParams,
  UpdateOrganizationParams,
  CreateOrganizationResult,
} from '@reqvet-sdk/sdk';
```

## Pour aller plus loin

- [SDK_REFERENCE.md](./SDK_REFERENCE.md) — documentation complète des paramètres et réponses, tous les payloads webhook, schéma des champs, codes d'erreur
- [SECURITY.md](./SECURITY.md) — bonnes pratiques de sécurité, pattern proxy, exemple complet de vérification webhook

## Sécurité

**Ne jamais** exposer votre clé API dans du code côté client. Utilisez toujours le SDK côté serveur et proxifiez les requêtes depuis votre frontend. Voir [SECURITY.md](./SECURITY.md).

## Licence

MIT
