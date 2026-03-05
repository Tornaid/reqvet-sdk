# @reqvet/sdk — Technical Reference

Complete parameter and response documentation for all SDK methods.

---

## 1) Instantiation

```ts
import ReqVet from '@reqvet/sdk';

const reqvet = new ReqVet(process.env.REQVET_API_KEY!, {
  baseUrl: process.env.REQVET_BASE_URL ?? 'https://api.reqvet.com',
  pollInterval: 5000,       // polling interval in ms (default: 5000)
  timeout: 5 * 60 * 1000,  // max polling wait in ms (default: 300 000 = 5 min)
});
```

The API key must start with `rqv_`. An `Error` is thrown immediately if it doesn't.

---

## 2) Before your first call

### Get your credentials

Your ReqVet account manager will provide:
- `REQVET_API_KEY` — your org API key (`rqv_live_...`)
- `REQVET_BASE_URL` — the API base URL
- `REQVET_WEBHOOK_SECRET` — your webhook signing secret (if using webhooks)

### Discover your templates

Every job requires a `templateId`. Before generating reports, list the templates available to your organization:

```ts
const { custom, system } = await reqvet.listTemplates();
// system = templates created by ReqVet, available to all organizations (read-only)
// custom = templates created by your organization
const templateId = system[0].id; // or custom[0].id
```

---

## 3) Integration patterns

### A) Webhook-first (recommended for production)

```
uploadAudio() → createJob({ callbackUrl }) → ReqVet POSTs result to your endpoint
```

The user can close the browser — the result arrives on your server asynchronously.

### B) Polling (development / simple integrations)

```
uploadAudio() → createJob() → waitForJob() → report
```

Or use the convenience wrapper:

```ts
const report = await reqvet.generateReport({ audio, animalName, templateId, waitForResult: true });
```

---

## 4) Methods

### `uploadAudio(audio, fileName?)`

Upload an audio file to ReqVet storage.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `audio` | `Blob \| File \| Buffer` | ✅ | Audio data |
| `fileName` | `string` | — | File name, used to infer MIME type (default: `audio.webm`) |

**Response:**
```ts
{
  audio_file: string;   // canonical storage path — pass this to createJob()
  path: string;         // alias of audio_file
  size_bytes: number;
  content_type: string;
}
```

Supported formats: `mp3`, `wav`, `webm`, `ogg`, `m4a`, `aac`, `flac`. Max size: 100 MB.

---

### `generateReport(params)`

Convenience wrapper: `uploadAudio → createJob`. Optionally waits for completion.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `audio` | `Blob \| File \| Buffer` | ✅ | Audio data |
| `animalName` | `string` | ✅ | Name of the animal |
| `templateId` | `string` | ✅ | Template UUID (from `listTemplates()`) |
| `fileName` | `string` | — | File name |
| `callbackUrl` | `string` | — | Your webhook endpoint (HTTPS, publicly reachable) |
| `metadata` | `Record<string, unknown>` | — | Passthrough data (e.g. `{ consultationId, vetId }`) |
| `extraInstructions` | `string` | — | Additional generation instructions injected into the prompt |
| `waitForResult` | `boolean` | — | If `true`, polls and returns the final report. Default: `false` |
| `onStatus` | `(status: string) => void` | — | Called on each poll (only when `waitForResult: true`) |

**Response:**
- `waitForResult: false` (default): `{ job_id: string, status: 'pending' }`
- `waitForResult: true`: `ReqVetReport` (see `waitForJob`)

---

### `createJob(params)`

Start a transcription + report generation pipeline.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `audioFile` | `string` | ✅ | Value of `uploadAudio().path` |
| `animalName` | `string` | ✅ | Name of the animal |
| `templateId` | `string` | ✅ | Template UUID |
| `callbackUrl` | `string` | — | Webhook URL (HTTPS, publicly reachable). Falls back to the org default webhook if omitted. |
| `metadata` | `Record<string, unknown>` | — | Passthrough data — correlate with your own records |
| `extraInstructions` | `string` | — | Extra generation instructions (max 5 000 chars) |

**Response:**
```ts
{ job_id: string; status: 'pending' }
```

> **Rate limit**: 10 000 requests/minute per organization.

---

### `listJobs(options?)`

List jobs for the authenticated organization, with pagination and filtering.

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `limit` | `number` | `20` | Results per page (1–100) |
| `offset` | `number` | `0` | Pagination offset |
| `status` | `string` | — | Filter: `pending` `transcribing` `generating` `completed` `failed` `amending` |
| `sort` | `string` | `created_at` | Sort field: `created_at` or `updated_at` |
| `order` | `string` | `desc` | Direction: `asc` or `desc` |

**Response:**
```ts
{
  jobs: JobSummary[];
  pagination: { total: number; limit: number; offset: number; has_more: boolean };
}
```

---

### `getJob(jobId)`

Get the current state and result of a job.

**Response fields by status:**

| Field | `pending` | `transcribing` | `generating` | `completed` | `failed` |
|-------|:---------:|:--------------:|:------------:|:-----------:|:--------:|
| `job_id` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `status` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `animal_name` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `metadata` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `transcription` | — | — | ✅ | ✅ | — |
| `result.html` | — | — | — | ✅ | — |
| `result.fields` | — | — | — | ✅* | — |
| `cost` | — | — | — | ✅ | — |
| `error` | — | — | — | — | ✅ |

*`result.fields` is only present if your organization has a `field_schema` configured (structured data extraction). It is `null` otherwise. See [Field schema](#field-schema) below.

**Cost structure (completed jobs):**
```ts
cost: {
  transcription_usd: number;
  generation_usd: number;
  total_usd: number;
}
```

> **Note**: `cost` is available via `getJob()` and `waitForJob()`, but is **not** included in webhook payloads. Retrieve it with `getJob()` after receiving a `job.completed` event if needed.

---

### `waitForJob(jobId, onStatus?)`

Poll until a job reaches `completed` or `failed`. Respects `pollInterval` and `timeout`.

**Response (`ReqVetReport`):**
```ts
{
  jobId: string;
  html: string;                              // generated report HTML
  fields: ExtractedFields | null;            // null if no field_schema configured
  transcription: string;
  animalName: string;
  cost: { transcription_usd: number; generation_usd: number; total_usd: number };
  metadata: Record<string, unknown>;
}
```

Throws `ReqVetError` if the job fails or the timeout is exceeded.

---

### `regenerateJob(jobId, options?)`

Regenerate the report for a completed job — e.g. with different instructions or a different template.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `extraInstructions` | `string` | New instructions (max 2 000 chars) |
| `templateId` | `string` | Switch to a different template |

**Response:**
```ts
{ job_id: string; status: 'completed'; result: { html: string; fields?: ExtractedFields } }
```

Triggers a `job.regenerated` webhook event if a `callbackUrl` is configured.

> **Rate limit**: 30 requests/minute per organization.

---

### `amendJob(jobId, params)`

Add an audio complement to a completed job. The new audio is transcribed, merged with the existing transcription, and the report is regenerated.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `audioFile` | `string` | ✅ | Value of `uploadAudio().path` |
| `templateId` | `string` | — | Switch to a different template |

**Response:**
```ts
{ job_id: string; status: 'amending'; amendment_number: number; message: string }
```

The job returns to `completed` when the amendment finishes. Use `waitForJob()` or listen for the `job.amended` webhook event. Multiple amendments are supported — each one appends to the full transcription.

---

### `reformulateReport(jobId, params)`

Generate an alternative version of a completed report for a specific audience.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `purpose` | `string` | ✅ | `owner` `referral` `summary` `custom` `diagnostic_hypothesis` |
| `customInstructions` | `string` | If `purpose: 'custom'` | Reformulation instructions |

**Purpose values:**
| Value | Output |
|-------|--------|
| `owner` | Simplified version for the pet owner |
| `referral` | Clinical summary for a specialist |
| `summary` | Short internal note |
| `diagnostic_hypothesis` | Differential diagnosis list |
| `custom` | Defined by `customInstructions` |

**Response (`ReqVetReformulation`):**
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

> **Rate limit**: 30 requests/minute per organization.

---

### `listReformulations(jobId)`

**Response:** `{ reformulations: ReqVetReformulation[] }`

---

### Templates

#### `listTemplates()` → `{ custom: Template[], system: Template[] }`

- **`system`** — templates created by ReqVet, visible to all organizations. Read-only. Start here to find available `templateId` values.
- **`custom`** — templates created by your organization. Editable via `createTemplate` / `updateTemplate`.

#### `getTemplate(templateId)` → `Template`

#### `createTemplate(params)` → `Template`

| Name | Type | Required |
|------|------|----------|
| `name` | `string` | ✅ |
| `content` | `string` | ✅ |
| `description` | `string` | — |
| `is_default` | `boolean` | — |

#### `updateTemplate(templateId, updates)` → `Template`

All fields optional (partial update). Same fields as `createTemplate`.

#### `deleteTemplate(templateId)` → `{ success: true }`

---

### `health()`

**Response:** `{ status: 'ok' | 'degraded'; timestamp: string }`

---

## 5) Field schema

If your organization has a `field_schema` configured, ReqVet extracts structured fields from each consultation in addition to generating the HTML report.

Example `result.fields` for a standard checkup:

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

`fields` is `null` if no `field_schema` is configured for your organization. Contact your ReqVet account manager to enable and configure structured extraction.

---

## 6) Webhook events

ReqVet POSTs to your `callbackUrl` when a job changes state. All events share the same format.

### Headers

```
Content-Type: application/json
X-ReqVet-Signature: sha256=<hex>   (only if org has a webhook_secret)
X-ReqVet-Timestamp: <unix_ms>      (only if org has a webhook_secret)
```

### Event types and payloads

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

> `fields` is absent if the organization has no `field_schema`. `cost` is not in the webhook — retrieve it with `getJob()` if needed.

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

Sent when an amendment (`amendJob`) completes successfully.

```json
{
  "event": "job.amended",
  "job_id": "a1b2c3d4-...",
  "animal_name": "Rex",
  "transcription": "...full transcription including amendment...",
  "html": "<section class=\"cr\">...</section>",
  "amendment_number": 1,
  "fields": { "espece": "Chien", "poids": 28.5 },
  "metadata": { "consultationId": "abc123" }
}
```

---

#### `job.amend_failed`

Sent when amendment transcription fails. The original report is preserved.

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

Sent when `regenerateJob()` completes.

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

### Retry policy

ReqVet retries failed webhook deliveries **3 times** with delays of 0s, 2s, and 5s. After 3 failures, the event is marked as undelivered. Implement idempotency in your handler (deduplicate on `job_id + event`).

---

## 7) Webhook verification

```ts
import { verifyWebhookSignature } from '@reqvet/sdk/webhooks';

const { ok, reason } = verifyWebhookSignature({
  secret: process.env.REQVET_WEBHOOK_SECRET!,
  rawBody,       // raw request body string — read BEFORE JSON.parse
  signature,     // X-ReqVet-Signature header value
  timestamp,     // X-ReqVet-Timestamp header value
  maxSkewMs: 5 * 60 * 1000,  // reject events older than 5 min (default)
});
```

Rejection reasons: `missing_headers` `invalid_timestamp` `stale_timestamp` `invalid_signature`

See [SECURITY.md](./SECURITY.md) for a complete Next.js implementation example.

---

## 8) Error handling

All methods throw `ReqVetError` on HTTP errors or network failures:

```ts
import { ReqVetError } from '@reqvet/sdk';

try {
  const report = await reqvet.waitForJob(jobId);
} catch (err) {
  if (err instanceof ReqVetError) {
    console.error(err.message);  // human-readable message
    console.error(err.status);   // HTTP status (0 for network/timeout errors)
    console.error(err.body);     // raw response body
  }
}
```

| Status | Meaning |
|--------|---------|
| `400` | Validation error — check `err.body.issues` |
| `401` | Invalid or missing API key |
| `403` | Monthly quota exceeded |
| `404` | Job or template not found |
| `429` | Rate limit exceeded — back off and retry |
| `500` | ReqVet internal error |

---

## 9) Integration checklist

- [ ] SDK used **server-side only** — API key never in browser bundles
- [ ] `listTemplates()` called at startup to discover available `templateId` values
- [ ] `metadata` used to correlate ReqVet jobs with your own records (`consultationId`, `vetId`, etc.)
- [ ] Webhook endpoint handles all 5 event types: `job.completed`, `job.failed`, `job.amended`, `job.amend_failed`, `job.regenerated`
- [ ] Webhook signature verified on every incoming event
- [ ] Timestamp anti-replay check enabled (`maxSkewMs`)
- [ ] Idempotency implemented — deduplicate on `job_id + event`
- [ ] `REQVET_API_KEY` and `REQVET_WEBHOOK_SECRET` stored in environment variables, never hardcoded
