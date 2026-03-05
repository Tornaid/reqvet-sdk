# Examples — JavaScript (ESM)

Plain JavaScript versions of all SDK examples. No TypeScript, no compilation step.

## Setup

```bash
npm install @reqvet-sdk/sdk
```

Create a `.env` file:

```bash
REQVET_API_KEY=rqv_live_...
REQVET_BASE_URL=https://api.reqvet.com
REQVET_WEBHOOK_SECRET=...
```

Run any example:

```bash
node --env-file=.env 01-health.mjs
```

## Examples

| File | What it covers |
|------|----------------|
| [`client.mjs`](./client.mjs) | Shared client setup |
| [`01-health.mjs`](./01-health.mjs) | `health()` |
| [`02-templates.mjs`](./02-templates.mjs) | `listTemplates`, `getTemplate`, `createTemplate`, `updateTemplate`, `deleteTemplate` |
| [`03-generate-polling.mjs`](./03-generate-polling.mjs) | `generateReport` — polling, synchronous result |
| [`04-generate-webhook.mjs`](./04-generate-webhook.mjs) | `generateReport` — webhook-first, returns immediately |
| [`05-upload-and-create-job.mjs`](./05-upload-and-create-job.mjs) | `uploadAudio` + `createJob` — manual two-step flow |
| [`06-list-jobs.mjs`](./06-list-jobs.mjs) | `listJobs` with pagination, filters, full traversal |
| [`07-get-job.mjs`](./07-get-job.mjs) | `getJob` — read job state and result |
| [`08-regenerate.mjs`](./08-regenerate.mjs) | `regenerateJob` |
| [`09-amend.mjs`](./09-amend.mjs) | `amendJob` + `waitForJob` |
| [`10-reformulate.mjs`](./10-reformulate.mjs) | `reformulateReport` — all 5 purposes + `listReformulations` |
| [`11-webhook-verify.mjs`](./11-webhook-verify.mjs) | `verifyWebhookSignature` — all 5 event types |
| [`nextjs/route-generate.mjs`](./nextjs/route-generate.mjs) | Next.js proxy route (JS) |
| [`nextjs/route-webhook.mjs`](./nextjs/route-webhook.mjs) | Next.js webhook handler (JS) |

## Passing a job ID

```bash
node --env-file=.env 08-regenerate.mjs your-job-id-here
node --env-file=.env 10-reformulate.mjs your-job-id-here
```

> TypeScript versions available in [`../`](../) — same logic, with type annotations.
