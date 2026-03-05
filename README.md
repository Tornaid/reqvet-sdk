# @reqvet/sdk

Official JavaScript/TypeScript SDK for the [ReqVet](https://reqvet.com) API — AI-powered veterinary report generation from audio recordings.

[![npm version](https://img.shields.io/npm/v/@reqvet/sdk)](https://www.npmjs.com/package/@reqvet/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js ≥ 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

## What it does

- **Upload** an audio recording (`uploadAudio`)
- **Generate** a veterinary report (`createJob`, `generateReport`)
- **Track** a job — webhook-first or polling (`getJob`, `waitForJob`)
- **List** jobs with pagination and filtering (`listJobs`)
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

Requires Node.js ≥ 18. Works in modern browsers for the client methods (Blob/FormData required for upload).

## Quick start

### Recommended: webhook flow (server-side)

```ts
import ReqVet from '@reqvet/sdk';

const reqvet = new ReqVet(process.env.REQVET_API_KEY!, {
  baseUrl: process.env.REQVET_BASE_URL ?? 'https://api.reqvet.com',
});

// 1. Upload the audio
const { path } = await reqvet.uploadAudio(audioBuffer, 'consultation.webm');

// 2. Create a job — ReqVet will POST the result to your webhook when ready
const job = await reqvet.createJob({
  audioFile: path,
  animalName: 'Rex',
  templateId: 'your-template-uuid',
  callbackUrl: 'https://your-app.com/api/reqvet/webhook',
  metadata: { consultationId: 'abc123' },
});
// job = { job_id: '...', status: 'pending' }
```

### Alternative: polling flow

```ts
const report = await reqvet.generateReport({
  audio: audioFile,
  animalName: 'Rex',
  templateId: 'your-template-uuid',
  waitForResult: true,            // polls until completed
  onStatus: (s) => console.log(s),
});
// report = { jobId, html, fields, transcription, cost, metadata }
```

### Verify an incoming webhook

```ts
import { verifyWebhookSignature } from '@reqvet/sdk/webhooks';

const { ok, reason } = verifyWebhookSignature({
  secret: process.env.REQVET_WEBHOOK_SECRET!,
  rawBody,                                        // raw request body as string
  signature: req.headers['x-reqvet-signature'],
  timestamp: req.headers['x-reqvet-timestamp'],
});

if (!ok) return res.status(401).json({ error: reason });
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
| `regenerateJob(jobId, options?)` | Regenerate a completed report with new instructions |
| `amendJob(jobId, params)` | Add an audio complement to a completed job |
| `reformulateReport(jobId, params)` | Generate an audience-specific version of a report |
| `listReformulations(jobId)` | List all reformulations for a job |
| `listTemplates()` | List available templates (`{ custom, system }`) |
| `getTemplate(templateId)` | Get a template by ID |
| `createTemplate(params)` | Create a new template |
| `updateTemplate(templateId, updates)` | Update a template |
| `deleteTemplate(templateId)` | Delete a template |
| `health()` | API health check |

See [SDK_REFERENCE.md](./SDK_REFERENCE.md) for full parameter and response documentation.

## TypeScript

Full TypeScript definitions are included. Key types:

```ts
import type {
  ReqVetReport,
  JobSummary,
  ListJobsResult,
  Template,
  ReqVetReformulation,
} from '@reqvet/sdk';
```

## Security

**Never** expose your API key in client-side code. Always use the SDK server-side (Next.js API routes, Express, etc.) and proxy requests from your frontend.

See [SECURITY.md](./SECURITY.md) for complete security guidelines and webhook verification examples.

## License

MIT
