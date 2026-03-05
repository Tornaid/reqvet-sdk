# @reqvet/sdk

Official JavaScript/TypeScript SDK for the [ReqVet](https://reqvet.com) API — AI-powered veterinary report generation from audio recordings.

[![npm version](https://img.shields.io/npm/v/@reqvet/sdk)](https://www.npmjs.com/package/@reqvet/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js ≥ 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

## What it does

- **Upload** an audio recording (`uploadAudio`)
- **Generate** a veterinary report (`createJob`, `generateReport`)
- **Track** jobs — webhook-first or polling (`getJob`, `waitForJob`, `listJobs`)
- **Amend** a completed report with additional audio (`amendJob`)
- **Regenerate** with new instructions (`regenerateJob`)
- **Reformulate** for a specific audience — owner, referral, specialist (`reformulateReport`)
- **Manage templates** (`listTemplates`, `createTemplate`, `updateTemplate`, `deleteTemplate`)
- **Verify webhooks** with HMAC (`@reqvet/sdk/webhooks`)

> **Note**: this SDK does not include an audio recorder. Your application handles recording and passes a `File`, `Blob`, or `Buffer` to the SDK.

## Installation

```bash
npm install @reqvet/sdk
```

Requires Node.js ≥ 18. Works in modern browsers for client methods (Blob/FormData required for upload).

## Before your first call

Your ReqVet account manager will provide three environment variables:

```bash
REQVET_API_KEY=rqv_live_...
REQVET_BASE_URL=https://api.reqvet.com
REQVET_WEBHOOK_SECRET=...   # only needed if using webhooks
```

Every job requires a `templateId`. **Call `listTemplates()` first** to discover what's available:

```ts
const { system, custom } = await reqvet.listTemplates();
// system = ReqVet-provided templates, visible to all organizations (read-only)
// custom = templates created by your organization

const templateId = system[0].id;
```

## Quick start

### Webhook flow (recommended)

```ts
import ReqVet from '@reqvet/sdk';

const reqvet = new ReqVet(process.env.REQVET_API_KEY!, {
  baseUrl: process.env.REQVET_BASE_URL,
});

// 1. Upload the audio
const { path } = await reqvet.uploadAudio(audioBuffer, 'consultation.webm');

// 2. Create a job — ReqVet will POST the result to your webhook when ready
const job = await reqvet.createJob({
  audioFile: path,
  animalName: 'Rex',
  templateId: 'your-template-uuid',
  callbackUrl: 'https://your-app.com/api/reqvet/webhook',
  metadata: { consultationId: 'abc123' },  // passed through to your webhook
});
// { job_id: '...', status: 'pending' }
```

Your webhook receives a `job.completed` event:

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

### Polling flow (simpler for development)

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

### Verify an incoming webhook

```ts
import { verifyWebhookSignature } from '@reqvet/sdk/webhooks';

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

| Method | Description |
|--------|-------------|
| `uploadAudio(audio, fileName?)` | Upload an audio file |
| `generateReport(params)` | Upload + create job (convenience helper) |
| `createJob(params)` | Create a generation job |
| `listJobs(options?)` | List jobs with pagination and status filter |
| `getJob(jobId)` | Get job status and result |
| `waitForJob(jobId, onStatus?)` | Poll until job completes |
| `regenerateJob(jobId, options?)` | Regenerate a completed report |
| `amendJob(jobId, params)` | Add an audio complement to a completed job |
| `reformulateReport(jobId, params)` | Generate an audience-specific version |
| `listReformulations(jobId)` | List all reformulations for a job |
| `listTemplates()` | List available templates (`{ system, custom }`) |
| `getTemplate(templateId)` | Get a template by ID |
| `createTemplate(params)` | Create a custom template |
| `updateTemplate(templateId, updates)` | Update a template |
| `deleteTemplate(templateId)` | Delete a template |
| `health()` | API health check |

## Webhook events

ReqVet fires 5 event types: `job.completed`, `job.failed`, `job.amended`, `job.amend_failed`, `job.regenerated`.

Failed deliveries are retried 3 times (0s, 2s, 5s). Implement idempotency in your handler — deduplicate on `job_id + event`.

See [SDK_REFERENCE.md §6](./SDK_REFERENCE.md#6-webhook-events) for the full payload structure of each event.

## TypeScript

Full TypeScript definitions included:

```ts
import type {
  ReqVetReport,
  JobSummary,
  ListJobsResult,
  Template,
  ReqVetReformulation,
  ExtractedFields,
} from '@reqvet/sdk';
```

## Further reading

- [SDK_REFERENCE.md](./SDK_REFERENCE.md) — full parameter and response documentation, all webhook payloads, field schema, error codes
- [SECURITY.md](./SECURITY.md) — security guidelines, proxy pattern, complete webhook verification example

## Security

**Never** expose your API key in client-side code. Always use the SDK server-side and proxy requests from your frontend. See [SECURITY.md](./SECURITY.md).

## License

MIT
