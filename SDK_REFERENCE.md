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

### `uploadAudio(audio, fileName?)`

Uploader un fichier audio vers le stockage ReqVet.

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

## 9) Checklist d'intégration

- [ ] SDK utilisé **côté serveur uniquement** — clé API jamais dans les bundles navigateur
- [ ] `listTemplates()` appelé au démarrage pour découvrir les `templateId` disponibles
- [ ] `metadata` utilisé pour corréler les jobs ReqVet avec vos propres enregistrements (`consultationId`, `vetId`, etc.)
- [ ] L'endpoint webhook gère les 5 types d'événements : `job.completed`, `job.failed`, `job.amended`, `job.amend_failed`, `job.regenerated`
- [ ] Signature webhook vérifiée sur chaque événement entrant
- [ ] Vérification anti-replay du timestamp activée (`maxSkewMs`)
- [ ] Idempotence implémentée — dédoublonnage sur `job_id + event`
- [ ] `REQVET_API_KEY` et `REQVET_WEBHOOK_SECRET` stockés dans des variables d'environnement, jamais en dur dans le code
