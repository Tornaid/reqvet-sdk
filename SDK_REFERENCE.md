# @reqvet/sdk — Technical Reference

Complete parameter and response documentation for all SDK methods.

---

## 1) Instantiation

```ts
import ReqVet from '@reqvet/sdk';

const reqvet = new ReqVet(process.env.REQVET_API_KEY!, {
  baseUrl: process.env.REQVET_BASE_URL ?? 'https://api.reqvet.com',
  pollInterval: 5000,       // polling interval in ms (default: 5000)
  timeout: 5 * 60 * 1000,  // max polling wait (default: 300 000ms = 5 min)
});
```

The API key must start with `rqv_`. An `Error` is thrown immediately if it doesn't.

---

## 2) Integration patterns

### A) Webhook-first (recommended)

```
uploadAudio() → createJob({ callbackUrl }) → ReqVet POSTs result to your endpoint
```

Best for production. The user can close the browser — the result arrives on your server.

### B) Polling (fallback / development)

```
uploadAudio() → createJob() → waitForJob() → report
```

Or use the convenience wrapper:

```
generateReport({ waitForResult: true }) → report
```

---

## 3) Methods

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
  audio_file: string;   // canonical storage path
  path: string;         // alias of audio_file (convenience)
  size_bytes: number;
  content_type: string;
}
```

Supported formats: `mp3`, `wav`, `webm`, `ogg`, `m4a`, `aac`, `flac`.

---

### `generateReport(params)`

Convenience wrapper: `uploadAudio → createJob`. Optionally waits for completion.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `audio` | `Blob \| File \| Buffer` | ✅ | Audio data |
| `animalName` | `string` | ✅ | Name of the animal |
| `templateId` | `string` | ✅ | Template UUID |
| `fileName` | `string` | — | File name |
| `callbackUrl` | `string` | — | Webhook URL for result delivery |
| `metadata` | `Record<string, unknown>` | — | Passthrough data (e.g. `consultationId`) |
| `extraInstructions` | `string` | — | Additional generation instructions |
| `waitForResult` | `boolean` | — | If `true`, polls and returns the final report (default: `false`) |
| `onStatus` | `(status: string) => void` | — | Called on each poll (only when `waitForResult: true`) |

**Response:**
- `waitForResult: false` (default): `{ job_id, status }`
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
| `metadata` | `Record<string, unknown>` | — | Passthrough data |
| `extraInstructions` | `string` | — | Extra generation instructions (max 5000 chars) |

**Response:**
```ts
{ job_id: string; status: 'pending' }
```

---

### `listJobs(options?)`

List jobs for the authenticated organization, with pagination and filtering.

**Parameters:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `limit` | `number` | `20` | Number of results (1–100) |
| `offset` | `number` | `0` | Pagination offset |
| `status` | `string` | — | Filter by status: `pending`, `transcribing`, `generating`, `completed`, `failed`, `amending` |
| `sort` | `string` | `created_at` | Sort field: `created_at` or `updated_at` |
| `order` | `string` | `desc` | Sort direction: `asc` or `desc` |

**Response:**
```ts
{
  jobs: JobSummary[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}
```

---

### `getJob(jobId)`

Get the current state of a job.

**Response:** Full job object. Fields vary by status:

| Field | Present when |
|-------|-------------|
| `job_id` | Always |
| `status` | Always |
| `animal_name` | Always |
| `template_id` | Always |
| `metadata` | Always |
| `created_at` / `updated_at` | Always |
| `transcription` | After transcription |
| `result.html` | `completed` |
| `result.fields` | `completed` (if org has a `field_schema`) |
| `cost` | `completed` |
| `error` | `failed` |

---

### `waitForJob(jobId, onStatus?)`

Poll until a job reaches `completed` or `failed`. Respects `pollInterval` and `timeout`.

**Response (`ReqVetReport`):**
```ts
{
  jobId: string;
  html: string;
  fields: Record<string, string | number | boolean | string[] | null> | null;
  transcription: string;
  animalName: string;
  cost: {
    transcription_usd: number;
    generation_usd: number;
    total_usd: number;
  };
  metadata: Record<string, unknown>;
}
```

Throws `ReqVetError` if the job fails or the timeout is exceeded.

---

### `regenerateJob(jobId, options?)`

Regenerate the report for a completed job, optionally with new instructions or a different template.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `extraInstructions` | `string` | Additional instructions (max 2000 chars) |
| `templateId` | `string` | Switch to a different template |

**Response:**
```ts
{ job_id: string; status: string; result: { html: string; fields?: object } }
```

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

The job returns to `completed` when the amendment finishes. Use `waitForJob()` or listen for the `job.amended` webhook event.

---

### `reformulateReport(jobId, params)`

Generate an alternative version of a completed report for a specific audience.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `purpose` | `string` | ✅ | `owner`, `referral`, `summary`, `custom`, `diagnostic_hypothesis` |
| `customInstructions` | `string` | Required if `purpose: 'custom'` | Custom reformulation instructions |

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

---

### `listReformulations(jobId)`

**Response:**
```ts
{ reformulations: ReqVetReformulation[] }
```

---

### Templates

#### `listTemplates()`

Returns all templates accessible to the organization.

**Response:**
```ts
{
  custom: Template[];  // org-specific templates
  system: Template[];  // global templates (visible to all organizations)
}
```

#### `getTemplate(templateId)` → `Template`

#### `createTemplate(params)` → `Template`

| Name | Type | Required |
|------|------|----------|
| `name` | `string` | ✅ |
| `content` | `string` | ✅ |
| `description` | `string` | — |
| `is_default` | `boolean` | — |

#### `updateTemplate(templateId, updates)` → `Template`

All fields optional (partial update).

#### `deleteTemplate(templateId)` → `{ success: true }`

---

### `health()`

**Response:**
```ts
{ status: 'ok' | 'degraded'; timestamp: string }
```

---

## 4) Webhook verification

```ts
import { verifyWebhookSignature } from '@reqvet/sdk/webhooks';

const { ok, reason } = verifyWebhookSignature({
  secret: process.env.REQVET_WEBHOOK_SECRET!,
  rawBody,       // raw request body string (before JSON.parse)
  signature,     // X-ReqVet-Signature header value
  timestamp,     // X-ReqVet-Timestamp header value
  maxSkewMs: 5 * 60 * 1000,  // optional, default: 5 min
});
```

See [SECURITY.md](./SECURITY.md) for a full implementation example.

---

## 5) Error handling

All methods throw `ReqVetError` on HTTP errors or network failures:

```ts
import { ReqVetError } from '@reqvet/sdk';

try {
  const report = await reqvet.waitForJob(jobId);
} catch (err) {
  if (err instanceof ReqVetError) {
    console.error(err.message); // human-readable message
    console.error(err.status);  // HTTP status code (0 for network/timeout errors)
    console.error(err.body);    // raw response body
  }
}
```

Common status codes:

| Code | Meaning |
|------|---------|
| `400` | Validation error — check `err.body.issues` |
| `401` | Invalid or missing API key |
| `403` | Monthly quota exceeded |
| `404` | Job or template not found |
| `429` | Rate limit exceeded — retry after `err.body.retryAfter` seconds |
| `500` | ReqVet internal error |

---

## 6) Integration checklist

- [ ] SDK used **server-side only** — API key never in browser bundles
- [ ] Webhook signature verified on every incoming event
- [ ] Timestamp anti-replay check enabled (`maxSkewMs`)
- [ ] Idempotency implemented (deduplicate on `job_id + event`)
- [ ] `metadata` used to correlate ReqVet jobs with your own records
- [ ] `REQVET_API_KEY` and `REQVET_WEBHOOK_SECRET` stored in environment variables, never hardcoded
