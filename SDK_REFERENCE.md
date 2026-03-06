# @reqvet-sdk/sdk — Référence technique

Documentation complète des paramètres et réponses pour toutes les méthodes du SDK.

---

## 1) Instanciation

```ts
import ReqVet from '@reqvet-sdk/sdk';

const reqvet = new ReqVet(process.env.REQVET_API_KEY!, {
  baseUrl: process.env.REQVET_BASE_URL ?? 'https://api.reqvet.com',
  pollInterval: 5000, // intervalle de polling en ms (défaut : 5000)
  timeout: 5 * 60 * 1000, // attente maximale en polling en ms (défaut : 300 000 = 5 min)
});
```

La clé API doit commencer par `rqv_`. Une `Error` est levée immédiatement dans le cas contraire.

---

## 2) Avant votre premier appel

### Obtenir vos identifiants

Votre responsable de compte ReqVet vous fournira :

- `REQVET_API_KEY` — votre clé API d'organisation (`rqv_live_...`)
- `REQVET_BASE_URL` — l'URL de base de l'API
- `REQVET_WEBHOOK_SECRET` — votre secret de signature webhook (si vous utilisez les webhooks)

### Découvrir vos templates

Chaque job nécessite un `templateId`. Avant de générer des comptes rendus, listez les templates disponibles pour votre organisation :

```ts
const { custom, system } = await reqvet.listTemplates();
// system = templates créés par ReqVet, disponibles pour toutes les organisations (lecture seule)
// custom = templates créés par votre organisation
const templateId = system[0].id; // ou custom[0].id
```

---

## 3) Patterns d'intégration

### A) Webhook en priorité (recommandé pour la production)

```
uploadAudio() → createJob({ callbackUrl }) → ReqVet POSTe le résultat sur votre endpoint
```

L'utilisateur peut fermer le navigateur — le résultat arrive sur votre serveur de manière asynchrone.

### B) Polling (développement / intégrations simples)

```
uploadAudio() → createJob() → waitForJob() → rapport
```

Ou utilisez le wrapper pratique :

```ts
const report = await reqvet.generateReport({ audio, animalName, templateId, waitForResult: true });
```

---

## 4) Méthodes

### `getSignedUploadUrl(fileName, contentType)` ⭐ recommandé serveur

Obtenir une URL signée Supabase pour uploader le fichier audio directement, sans passer par une Vercel Serverless Function.

**Quand l'utiliser :** intégrations serveur (Next.js proxy, Express, etc.), fichiers > 4 MB.

**Flow :**
```
getSignedUploadUrl() → PUT uploadUrl (Supabase direct) → createJob({ audioFile: path })
```

**Paramètres :**
| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `fileName` | `string` | ✅ | Nom du fichier (ex. `consultation.webm`) |
| `contentType` | `string` | ✅ | Type MIME (ex. `audio/webm`) |

**Réponse :**
```ts
{
  uploadUrl: string; // URL presignée Supabase — à utiliser avec PUT
  path: string;      // chemin de stockage — à passer à createJob()
}
```

**Exemple :**
```ts
const { uploadUrl, path } = await reqvet.getSignedUploadUrl('consultation.webm', 'audio/webm');

await fetch(uploadUrl, {
  method: 'PUT',
  headers: { 'Content-Type': 'audio/webm' },
  body: audioBuffer,
});

const job = await reqvet.createJob({ audioFile: path, animalName, templateId });
```

---

### `uploadAudio(audio, fileName?)`

Uploader un fichier audio vers le stockage ReqVet via `/api/v1/upload`.

> ⚠️ **Limite serveur** : `/api/v1/upload` est une Vercel Serverless Function avec une limite de payload de ~4.5 MB. Pour les proxies serveur gérant des fichiers > 4 MB, utilisez [`getSignedUploadUrl()`](#getsigneduploadurlfilename-contenttype--recommandé-serveur) à la place.
>
> `uploadAudio()` reste adapté pour les contextes navigateur (Blob/File natif, pas de limite Vercel) ou les fichiers légers.

**Paramètres :**
| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `audio` | `Blob \| File \| Buffer` | ✅ | Données audio |
| `fileName` | `string` | — | Nom du fichier, utilisé pour inférer le type MIME (défaut : `audio.webm`) |

**Réponse :**

```ts
{
  audio_file: string; // chemin de stockage canonique — à passer à createJob()
  path: string; // alias de audio_file
  size_bytes: number;
  content_type: string;
}
```

Formats supportés : `mp3`, `wav`, `webm`, `ogg`, `m4a`, `aac`, `flac`. Taille max : 100 Mo.

---

### `generateReport(params)`

Wrapper pratique : `uploadAudio → createJob`. Attend optionnellement la fin du traitement.

**Paramètres :**
| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `audio` | `Blob \| File \| Buffer` | ✅ | Données audio |
| `animalName` | `string` | ✅ | Nom de l'animal |
| `templateId` | `string` | ✅ | UUID du template (depuis `listTemplates()`) |
| `fileName` | `string` | — | Nom du fichier |
| `callbackUrl` | `string` | — | Votre endpoint webhook (HTTPS, accessible publiquement) |
| `metadata` | `Record<string, unknown>` | — | Données passthrough (ex. `{ consultationId, vetId }`) |
| `extraInstructions` | `string` | — | Instructions de génération supplémentaires injectées dans le prompt |
| `waitForResult` | `boolean` | — | Si `true`, poll et retourne le rapport final. Défaut : `false` |
| `onStatus` | `(status: string) => void` | — | Appelé à chaque poll (uniquement si `waitForResult: true`) |

**Réponse :**

- `waitForResult: false` (défaut) : `{ job_id: string, status: 'pending' }`
- `waitForResult: true` : `ReqVetReport` (voir `waitForJob`)

---

### `createJob(params)`

Démarrer un pipeline de transcription + génération de compte rendu.

**Paramètres :**
| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `audioFile` | `string` | ✅ | Valeur de `uploadAudio().path` |
| `animalName` | `string` | ✅ | Nom de l'animal |
| `templateId` | `string` | ✅ | UUID du template |
| `callbackUrl` | `string` | — | URL webhook (HTTPS, accessible publiquement). Utilise le webhook par défaut de l'organisation si omis. |
| `metadata` | `Record<string, unknown>` | — | Données passthrough — pour corréler avec vos propres enregistrements |
| `extraInstructions` | `string` | — | Instructions de génération supplémentaires (max 5 000 caractères) |

**Réponse :**

```ts
{
  job_id: string;
  status: 'pending';
}
```

> **Limite de débit** : 10 000 requêtes/minute par organisation.

---

### `listJobs(options?)`

Lister les jobs de l'organisation authentifiée, avec pagination et filtrage.

**Paramètres :**
| Nom | Type | Défaut | Description |
|-----|------|--------|-------------|
| `limit` | `number` | `20` | Résultats par page (1–100) |
| `offset` | `number` | `0` | Décalage de pagination |
| `status` | `string` | — | Filtre : `pending` `transcribing` `generating` `completed` `failed` `amending` |
| `sort` | `string` | `created_at` | Champ de tri : `created_at` ou `updated_at` |
| `order` | `string` | `desc` | Direction : `asc` ou `desc` |

**Réponse :**

```ts
{
  jobs: JobSummary[];
  pagination: { total: number; limit: number; offset: number; has_more: boolean };
}
```

---

### `getJob(jobId)`

Obtenir l'état actuel et le résultat d'un job.

**Champs de réponse par statut :**

| Champ           | `pending` | `transcribing` | `generating` | `completed` | `failed` |
| --------------- | :-------: | :------------: | :----------: | :---------: | :------: |
| `job_id`        |    ✅     |       ✅       |      ✅      |     ✅      |    ✅    |
| `status`        |    ✅     |       ✅       |      ✅      |     ✅      |    ✅    |
| `animal_name`   |    ✅     |       ✅       |      ✅      |     ✅      |    ✅    |
| `metadata`      |    ✅     |       ✅       |      ✅      |     ✅      |    ✅    |
| `transcription` |     —     |       —        |      ✅      |     ✅      |    —     |
| `result.html`   |     —     |       —        |      —       |     ✅      |    —     |
| `result.fields` |     —     |       —        |      —       |    ✅\*     |    —     |
| `cost`          |     —     |       —        |      —       |     ✅      |    —     |
| `error`         |     —     |       —        |      —       |      —      |    ✅    |

\*`result.fields` n'est présent que si votre organisation a un `field_schema` configuré (extraction de données structurées). Vaut `null` sinon. Voir [Schéma de champs](#5-schéma-de-champs) ci-dessous.

**Structure du coût (jobs terminés) :**

```ts
cost: {
  transcription_usd: number;
  generation_usd: number;
  total_usd: number;
}
```

> **Note** : `cost` est disponible via `getJob()` et `waitForJob()`, mais n'est **pas** inclus dans les payloads webhook. Récupérez-le avec `getJob()` après réception d'un événement `job.completed` si nécessaire.

---

### `waitForJob(jobId, onStatus?)`

Poller jusqu'à ce qu'un job atteigne `completed` ou `failed`. Respecte `pollInterval` et `timeout`.

**Réponse (`ReqVetReport`) :**

```ts
{
  jobId: string;
  html: string; // HTML du compte rendu généré
  fields: ExtractedFields | null; // null si aucun field_schema configuré
  transcription: string;
  animalName: string;
  cost: {
    transcription_usd: number;
    generation_usd: number;
    total_usd: number;
  }
  metadata: Record<string, unknown>;
}
```

Lève une `ReqVetError` si le job échoue ou si le timeout est dépassé.

---

### `regenerateJob(jobId, options?)`

Régénérer le compte rendu d'un job terminé — par exemple avec des instructions différentes ou un autre template.

**Paramètres :**
| Nom | Type | Description |
|-----|------|-------------|
| `extraInstructions` | `string` | Nouvelles instructions (max 2 000 caractères) |
| `templateId` | `string` | Basculer vers un autre template |

**Réponse :**

```ts
{ job_id: string; status: 'completed'; result: { html: string; fields?: ExtractedFields } }
```

Déclenche un événement webhook `job.regenerated` si un `callbackUrl` est configuré.

> **Limite de débit** : 30 requêtes/minute par organisation.

---

### `amendJob(jobId, params)`

Ajouter un audio complémentaire à un job terminé. Le nouvel audio est transcrit, fusionné avec la transcription existante, et le compte rendu est régénéré.

**Paramètres :**
| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `audioFile` | `string` | ✅ | Valeur de `uploadAudio().path` |
| `templateId` | `string` | — | Basculer vers un autre template |

**Réponse :**

```ts
{
  job_id: string;
  status: 'amending';
  amendment_number: number;
  message: string;
}
```

Le job repasse à `completed` quand l'amendement est terminé. Utilisez `waitForJob()` ou écoutez l'événement webhook `job.amended`. Plusieurs amendements sont supportés — chacun est ajouté à la transcription complète.

---

### `reformulateReport(jobId, params)`

Générer une version alternative d'un compte rendu terminé pour une audience spécifique.

**Paramètres :**
| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `purpose` | `string` | ✅ | `owner` `referral` `summary` `custom` `diagnostic_hypothesis` |
| `customInstructions` | `string` | Si `purpose: 'custom'` | Instructions de reformulation |

**Valeurs de `purpose` :**
| Valeur | Résultat |
|--------|----------|
| `owner` | Version simplifiée pour le propriétaire de l'animal |
| `referral` | Résumé clinique pour un spécialiste |
| `summary` | Note interne courte |
| `diagnostic_hypothesis` | Liste de diagnostics différentiels |
| `custom` | Défini par `customInstructions` |

**Réponse (`ReqVetReformulation`) :**

```ts
{
  id: string;
  job_id: string;
  purpose: string;
  html: string;
  custom_instructions?: string;
  cost: { model: string; prompt_tokens: number; completion_tokens: number; cost_usd: number };
  created_at: string;
}
```

> **Limite de débit** : 30 requêtes/minute par organisation.

---

### `listReformulations(jobId)`

**Réponse :** `{ reformulations: ReqVetReformulation[] }`

---

### Templates

#### `listTemplates()` → `{ custom: Template[], system: Template[] }`

- **`system`** — templates créés par ReqVet, visibles par toutes les organisations. Lecture seule. Commencez ici pour trouver les `templateId` disponibles.
- **`custom`** — templates créés par votre organisation. Modifiables via `createTemplate` / `updateTemplate`.

#### `getTemplate(templateId)` → `Template`

#### `createTemplate(params)` → `Template`

| Nom           | Type      | Requis |
| ------------- | --------- | ------ |
| `name`        | `string`  | ✅     |
| `content`     | `string`  | ✅     |
| `description` | `string`  | —      |
| `is_default`  | `boolean` | —      |

#### `updateTemplate(templateId, updates)` → `Template`

Tous les champs sont optionnels (mise à jour partielle). Mêmes champs que `createTemplate`.

#### `deleteTemplate(templateId)` → `{ success: true }`

---

### `health()`

**Réponse :** `{ status: 'ok' | 'degraded'; timestamp: string }`

---

## 5) Schéma de champs

Si votre organisation a un `field_schema` configuré, ReqVet extrait des champs structurés de chaque consultation en plus de générer le compte rendu HTML.

Exemple de `result.fields` pour un bilan de santé standard :

```json
{
  "espece": "Chien",
  "race": "Labrador",
  "poids": 28.5,
  "temperature": 38.6,
  "traitements": ["Frontline", "Milbemax"],
  "sterilise": true,
  "prochain_rdv": "Dans 6 mois"
}
```

`fields` vaut `null` si aucun `field_schema` n'est configuré pour votre organisation. Contactez votre responsable de compte ReqVet pour activer et configurer l'extraction structurée.

---

## 6) Événements webhook

ReqVet POSTe sur votre `callbackUrl` quand un job change d'état. Tous les événements partagent le même format.

### En-têtes

```
Content-Type: application/json
X-ReqVet-Signature: sha256=<hex>   (uniquement si l'organisation a un webhook_secret)
X-ReqVet-Timestamp: <unix_ms>      (uniquement si l'organisation a un webhook_secret)
```

### Types d'événements et payloads

#### `job.completed`

```json
{
  "event": "job.completed",
  "job_id": "a1b2c3d4-...",
  "animal_name": "Rex",
  "transcription": "Le vétérinaire examine Rex, labrador de 5 ans...",
  "html": "<section class=\"cr\">...</section>",
  "fields": { "espece": "Chien", "poids": 28.5 },
  "metadata": { "consultationId": "abc123", "vetId": "v42" }
}
```

> `fields` est absent si l'organisation n'a pas de `field_schema`. `cost` n'est pas dans le webhook — récupérez-le avec `getJob()` si nécessaire.

---

#### `job.failed`

```json
{
  "event": "job.failed",
  "job_id": "a1b2c3d4-...",
  "animal_name": "Rex",
  "error": "Transcription failed",
  "metadata": { "consultationId": "abc123" }
}
```

---

#### `job.amended`

Envoyé quand un amendement (`amendJob`) se termine avec succès.

```json
{
  "event": "job.amended",
  "job_id": "a1b2c3d4-...",
  "animal_name": "Rex",
  "transcription": "...transcription complète incluant l'amendement...",
  "html": "<section class=\"cr\">...</section>",
  "amendment_number": 1,
  "fields": { "espece": "Chien", "poids": 28.5 },
  "metadata": { "consultationId": "abc123" }
}
```

---

#### `job.amend_failed`

Envoyé quand la transcription d'un amendement échoue. Le compte rendu original est préservé.

```json
{
  "event": "job.amend_failed",
  "job_id": "a1b2c3d4-...",
  "animal_name": "Rex",
  "error": "Amendment transcription failed",
  "metadata": { "consultationId": "abc123" }
}
```

---

#### `job.regenerated`

Envoyé quand `regenerateJob()` se termine.

```json
{
  "event": "job.regenerated",
  "job_id": "a1b2c3d4-...",
  "animal_name": "Rex",
  "html": "<section class=\"cr\">...</section>",
  "fields": { "espece": "Chien", "poids": 28.5 },
  "metadata": { "consultationId": "abc123" }
}
```

---

### Politique de retry

ReqVet retente les livraisons webhook échouées **3 fois** avec des délais de 0s, 2s et 5s. Après 3 échecs, l'événement est marqué comme non livré. Implémentez l'idempotence dans votre handler (dédoublonnez sur `job_id + event`).

---

## 7) Vérification des webhooks

```ts
import { verifyWebhookSignature } from '@reqvet-sdk/sdk/webhooks';

const { ok, reason } = verifyWebhookSignature({
  secret: process.env.REQVET_WEBHOOK_SECRET!,
  rawBody, // corps brut de la requête — à lire AVANT JSON.parse
  signature, // valeur de l'en-tête X-ReqVet-Signature
  timestamp, // valeur de l'en-tête X-ReqVet-Timestamp
  maxSkewMs: 5 * 60 * 1000, // rejeter les événements de plus de 5 min (défaut)
});
```

Raisons de rejet : `missing_headers` `invalid_timestamp` `stale_timestamp` `invalid_signature`

Voir [SECURITY.md](./SECURITY.md) pour un exemple d'implémentation complet avec Next.js.

---

## 8) Gestion des erreurs

Toutes les méthodes lèvent une `ReqVetError` en cas d'erreur HTTP ou de panne réseau :

```ts
import { ReqVetError } from '@reqvet-sdk/sdk';

try {
  const report = await reqvet.waitForJob(jobId);
} catch (err) {
  if (err instanceof ReqVetError) {
    console.error(err.message); // message lisible par un humain
    console.error(err.status); // statut HTTP (0 pour les erreurs réseau/timeout)
    console.error(err.body); // corps brut de la réponse
  }
}
```

| Statut | Signification                                     |
| ------ | ------------------------------------------------- |
| `400`  | Erreur de validation — vérifiez `err.body.issues` |
| `401`  | Clé API invalide ou manquante                     |
| `403`  | Quota mensuel dépassé                             |
| `404`  | Job ou template introuvable                       |
| `429`  | Limite de débit dépassée — attendez et réessayez  |
| `500`  | Erreur interne ReqVet                             |

---

## 9) API Partenaire / Revendeur

Ces méthodes sont réservées aux revendeurs (éditeurs logiciels) qui provisionnent et administrent des cliniques clientes. Elles nécessitent une clé API avec `role='reseller'`, distincte des clés d'organisation standard.

> **Isolation garantie** : un revendeur ne peut accéder qu'aux organisations qu'il a lui-même créées. La contrainte est appliquée en base de données (`parent_org_id = reseller.orgId`) — il n'est pas possible d'accéder aux données d'un autre revendeur, même avec un `orgId` connu.

---

### Pattern : gestion des clés par clinique

Chaque clinique provisionnée reçoit sa propre clé API `rqv_live_...`. Avec 100 cliniques, il faut un mécanisme pour associer la bonne clé au bon utilisateur authentifié au moment de l'appel.

**Le principe** : vous stockez les clés dans votre propre base de données, liées à vos enregistrements cliniques. Vos appels vers ReqVet se font **server-side** — la clé ne passe jamais dans le navigateur.

#### Schéma recommandé (côté revendeur)

```sql
-- Dans votre base de données
ALTER TABLE clinics ADD COLUMN reqvet_org_id     TEXT;         -- UUID ReqVet
ALTER TABLE clinics ADD COLUMN reqvet_api_key    TEXT;         -- rqv_live_... chiffré
ALTER TABLE clinics ADD COLUMN reqvet_wh_secret  TEXT;         -- whsec_... chiffré
```

> Chiffrez `reqvet_api_key` et `reqvet_wh_secret` au repos (AES-256 ou équivalent). Ces valeurs sont des secrets d'accès — traitez-les comme des mots de passe.

#### Flux d'onboarding d'une clinique

```ts
// Appelé quand vous créez une nouvelle clinique dans votre système
async function onboardClinic(clinicId: string, clinicData: ClinicInput) {
  const reseller = new ReqVet(process.env.REQVET_RESELLER_KEY!);

  // externalId = votre ID interne → garantit l'idempotence en cas de retry
  const result = await reseller.createOrganization({
    name: clinicData.name,
    contactEmail: clinicData.email,
    externalId: clinicId,       // ← votre identifiant interne comme pont
    monthlyQuota: 200,
    webhookUrl: `https://votre-app.com/webhooks/reqvet`,
  });

  if (result.api_key) {
    // Première création : stocker la clé chiffrée
    await db.clinics.update(clinicId, {
      reqvet_org_id:    result.organization.id,
      reqvet_api_key:   encrypt(result.api_key),
      reqvet_wh_secret: encrypt(result.webhook_secret),
    });
  }
  // Si !result.api_key → organisation déjà existante (idempotent), clé déjà en base
}
```

#### Flux d'appel au moment de la consultation

```ts
// Appelé quand un vétérinaire authentifié lance une transcription
async function transcribe(userId: string, audioBuffer: Buffer) {
  // 1. Identifier la clinique de l'utilisateur dans VOTRE système
  const clinic = await db.getClinicByUser(userId);

  // 2. Récupérer et déchiffrer la clé ReqVet — côté serveur uniquement
  const reqvetKey = decrypt(clinic.reqvet_api_key);

  // 3. Instancier le client avec la clé de CETTE clinique
  const reqvet = new ReqVet(reqvetKey);

  // 4. Appel ReqVet — la clé ne sort jamais du serveur
  const { uploadUrl, path } = await reqvet.getSignedUploadUrl('consultation.webm', 'audio/webm');
  await fetch(uploadUrl, { method: 'PUT', body: audioBuffer });

  const job = await reqvet.createJob({
    audioFile: path,
    animalName: consultation.animalName,
    templateId: clinic.reqvet_template_id,
    callbackUrl: `https://votre-app.com/webhooks/reqvet`,
    metadata: { clinicId: clinic.id, userId },
  });

  return job;
}
```

#### Réception du webhook

Le webhook ReqVet arrive sur votre endpoint. Pour l'associer à la bonne clinique, utilisez le `metadata.clinicId` que vous avez injecté lors du `createJob` :

```ts
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const event = JSON.parse(rawBody);

  // Retrouver la clinique via les metadata passthrough
  const clinicId = event.metadata?.clinicId;
  const clinic = await db.getClinic(clinicId);

  // Vérifier la signature avec le secret de CETTE clinique
  const { ok } = verifyWebhookSignature({
    secret: decrypt(clinic.reqvet_wh_secret),
    rawBody,
    signature: req.headers.get('x-reqvet-signature') ?? '',
    timestamp: req.headers.get('x-reqvet-timestamp') ?? '',
  });

  if (!ok) return new Response('Unauthorized', { status: 401 });

  // Traiter l'événement
  if (event.event === 'job.completed') {
    await db.saveReport(clinicId, event.job_id, event.html, event.fields);
  }
}
```

#### Règles impératives

| Règle | Détail |
|-------|--------|
| **Server-side uniquement** | La clé clinique ne doit jamais être envoyée au navigateur, ni apparaître dans les réponses API de votre frontend |
| **Chiffrement au repos** | `reqvet_api_key` et `reqvet_wh_secret` chiffrés en base — pas en clair |
| **`externalId` = votre ID** | Utilisez systématiquement votre identifiant interne comme `externalId` — c'est le pont entre vos deux systèmes et le garde-fou anti-doublon |
| **Une clé par clinique** | Ne réutilisez jamais la clé d'une clinique pour une autre — l'isolation des données ReqVet est par `org_id` |
| **Rotation** | Si une clé est compromise, désactivez la clinique (`isActive: false`), puis réactivez — les nouvelles clés devront être provisionnées manuellement via `createOrganization` |

---

### `listOrganizations()`

Lister toutes les organisations (cliniques) provisionnées par le revendeur, enrichies de l'usage du mois courant.

**Réponse :**

```ts
{
  organizations: Array<{
    id: string;
    name: string;
    contact_email: string | null;
    is_active: boolean;
    monthly_quota: number | null;
    external_id: string | null;
    created_at: string;
    usage: {
      jobs_this_month: number;
      quota_remaining: number | 'unlimited';
    };
  }>;
}
```

**Exemple :**

```ts
const reseller = new ReqVet(process.env.REQVET_RESELLER_KEY!);

const { organizations } = await reseller.listOrganizations();

for (const org of organizations) {
  console.log(`${org.name} — ${org.usage.jobs_this_month} jobs ce mois / quota ${org.monthly_quota}`);
}
```

---

### `createOrganization(params)`

Provisionner une nouvelle organisation (clinique) sous le compte revendeur.

Cette méthode crée automatiquement :
- l'enregistrement de l'organisation dans ReqVet
- une clé API `rqv_live_...` pour la clinique (stockée hashée côté serveur)
- un secret de signature webhook `whsec_...`

**Paramètres :**

| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `name` | `string` | ✅ | Nom de la clinique |
| `contactEmail` | `string` | — | Email de contact |
| `externalId` | `string` | — | Votre identifiant interne (active l'idempotence — voir ci-dessous) |
| `monthlyQuota` | `number` | — | Nombre max de jobs par mois (défaut : 100, max : 10 000) |
| `webhookUrl` | `string` | — | URL de webhook pour les événements de jobs de cette clinique |

**Idempotence via `externalId`**

Si `externalId` est fourni et qu'une organisation avec ce même identifiant existe déjà sous ce revendeur, la méthode retourne l'organisation existante sans créer de doublon. Le champ `message` est alors présent dans la réponse (`'Organization already exists (idempotent)'`), et `api_key` / `webhook_secret` sont absents (ils ne peuvent pas être récupérés après la création initiale).

**Réponse (statut 201 — première création) :**

```ts
{
  organization: {
    id: string;
    name: string;
    monthly_quota: number;
    external_id: string | null;
  };
  api_key: string;       // rqv_live_... — à stocker immédiatement, non récupérable ensuite
  webhook_secret: string; // whsec_...  — à stocker immédiatement, non récupérable ensuite
  warning: string;       // "Save api_key and webhook_secret now — they cannot be retrieved later!"
}
```

**Réponse (statut 200 — idempotent, organisation déjà existante) :**

```ts
{
  message: 'Organization already exists (idempotent)';
  organization: { id, name, monthly_quota, external_id, is_active };
  // api_key et webhook_secret absents
}
```

**Exemple :**

```ts
const result = await reseller.createOrganization({
  name: 'Clinique du Parc',
  contactEmail: 'contact@clinique-du-parc.fr',
  externalId: 'votre_id_interne_4892',
  monthlyQuota: 500,
  webhookUrl: 'https://votre-app.com/webhooks/reqvet',
});

if (!result.api_key) {
  // Organisation déjà existante (idempotent) — récupérer la clé depuis votre propre stockage
  const storedKey = await db.getApiKey(result.organization.id);
} else {
  // Première création — stocker la clé et le secret immédiatement
  await db.saveClinicCredentials({
    orgId: result.organization.id,
    apiKey: result.api_key,
    webhookSecret: result.webhook_secret,
  });
}
```

---

### `getOrganization(orgId)`

Obtenir les détails et l'usage du mois courant d'une organisation spécifique.

**Paramètres :**

| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `orgId` | `string` | ✅ | UUID de l'organisation |

**Réponse :** `PartnerOrganization` (même structure que les éléments de `listOrganizations`, avec `usage`)

**Exemple :**

```ts
const org = await reseller.getOrganization('uuid-de-la-clinique');
console.log(`Quota restant : ${org.usage.quota_remaining}`);
```

---

### `updateOrganization(orgId, updates)`

Modifier le quota mensuel, l'état d'activation, ou l'URL de webhook d'une organisation.

Tous les champs sont optionnels — seuls les champs fournis sont mis à jour.

**Paramètres :**

| Nom | Type | Description |
|-----|------|-------------|
| `orgId` | `string` | UUID de l'organisation |
| `updates.monthlyQuota` | `number` | Nouveau quota mensuel (1–10 000) |
| `updates.isActive` | `boolean` | `false` pour suspendre la clinique (révoque aussi ses clés API) |
| `updates.webhookUrl` | `string` | Nouvelle URL de webhook (`null` pour supprimer) |

> **Suspension** : passer `isActive: false` désactive l'organisation **et** révoque toutes ses clés API en cascade. Les jobs déjà en cours ne sont pas interrompus. Pour réactiver, passer `isActive: true` — les clés API restent révoquées et doivent être régénérées manuellement si nécessaire.

**Réponse :**

```ts
{
  id: string;
  name: string;
  is_active: boolean;
  monthly_quota: number;
  external_id: string | null;
}
```

**Exemples :**

```ts
// Augmenter le quota
await reseller.updateOrganization(orgId, { monthlyQuota: 1000 });

// Suspendre une clinique (non-paiement, etc.)
await reseller.updateOrganization(orgId, { isActive: false });

// Réactiver
await reseller.updateOrganization(orgId, { isActive: true });

// Mettre à jour le webhook
await reseller.updateOrganization(orgId, {
  webhookUrl: 'https://votre-app.com/webhooks/reqvet/v2',
});
```

---

### `deactivateOrganization(orgId)`

Désactiver définitivement une organisation et révoquer toutes ses clés API.

Il s'agit d'un **soft delete** : les données (jobs, transcriptions, comptes rendus) sont conservées en base pour respecter les obligations RGPD et permettre un audit trail. L'organisation ne peut plus créer de nouveaux jobs.

**Paramètres :**

| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| `orgId` | `string` | ✅ | UUID de l'organisation |

**Réponse :**

```ts
{ success: true; message: 'Organization and API keys deactivated' }
```

**Exemple :**

```ts
await reseller.deactivateOrganization(orgId);
// L'organisation est désormais inactive, ses clés API sont révoquées
```

---

## 10) Checklist d'intégration

**Intégration standard (clinique)**

- [ ] SDK utilisé **côté serveur uniquement** — clé API jamais dans les bundles navigateur
- [ ] `listTemplates()` appelé au démarrage pour découvrir les `templateId` disponibles
- [ ] `metadata` utilisé pour corréler les jobs ReqVet avec vos propres enregistrements (`consultationId`, `vetId`, etc.)
- [ ] L'endpoint webhook gère les 5 types d'événements : `job.completed`, `job.failed`, `job.amended`, `job.amend_failed`, `job.regenerated`
- [ ] Signature webhook vérifiée sur chaque événement entrant
- [ ] Vérification anti-replay du timestamp activée (`maxSkewMs`)
- [ ] Idempotence implémentée — dédoublonnage sur `job_id + event`
- [ ] `REQVET_API_KEY` et `REQVET_WEBHOOK_SECRET` stockés dans des variables d'environnement, jamais en dur dans le code

**Intégration revendeur (multi-tenant)**

- [ ] Clé revendeur (`REQVET_RESELLER_KEY`) distincte et stockée séparément des clés cliniques
- [ ] `externalId` systématiquement fourni à `createOrganization` — valeur = votre ID interne de clinique
- [ ] `api_key` et `webhook_secret` retournés par `createOrganization` stockés immédiatement, **chiffrés au repos** — ils ne sont affichés qu'une seule fois
- [ ] Clés cliniques appelées **server-side uniquement** — jamais exposées au navigateur ni aux réponses frontend
- [ ] Un client `ReqVet` instancié avec la clé de **la clinique concernée** à chaque appel — jamais avec la clé revendeur pour les jobs
- [ ] `metadata` enrichi de `clinicId` (et `userId` si pertinent) sur chaque `createJob` — permet de router les webhooks entrants vers la bonne clinique
- [ ] Signature webhook vérifiée avec le secret de **la clinique destinataire** (et non le secret revendeur)
- [ ] Suspension de clinique gérée via `updateOrganization(orgId, { isActive: false })` (et non `deactivateOrganization` qui est irréversible)
- [ ] Usage mensuel (`usage.jobs_this_month`, `usage.quota_remaining`) consulté via `listOrganizations()` ou `getOrganization()` pour le monitoring et la facturation
