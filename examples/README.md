# @reqvet-sdk/sdk — Examples

Ready-to-run examples for every SDK method. Each file is self-contained and documented.

## Setup

```bash
npm install @reqvet-sdk/sdk tsx
```

Create a `.env` file:

```bash
REQVET_API_KEY=rqv_live_...
REQVET_BASE_URL=https://api.reqvet.com
REQVET_WEBHOOK_SECRET=...   # only needed for webhook examples
```

Run any example:

```bash
npx tsx --env-file=.env 01-health.ts
```

---

## Examples

| File | What it covers |
|------|----------------|
| [`client.ts`](./client.ts) | Shared client setup — imported by all examples |
| [`01-health.ts`](./01-health.ts) | `health()` — API connectivity check |
| [`02-templates.ts`](./02-templates.ts) | `listTemplates`, `getTemplate`, `createTemplate`, `updateTemplate`, `deleteTemplate` |
| [`03-generate-polling.ts`](./03-generate-polling.ts) | `generateReport` with `waitForResult: true` — synchronous polling flow |
| [`04-generate-webhook.ts`](./04-generate-webhook.ts) | `generateReport` webhook-first — returns immediately, result arrives on your endpoint |
| [`05-upload-and-create-job.ts`](./05-upload-and-create-job.ts) | `uploadAudio` + `createJob` — manual two-step flow |
| [`06-list-jobs.ts`](./06-list-jobs.ts) | `listJobs` with pagination, status filter, full traversal |
| [`07-get-job.ts`](./07-get-job.ts) | `getJob` — read job state and result |
| [`08-regenerate.ts`](./08-regenerate.ts) | `regenerateJob` — new instructions or different template |
| [`09-amend.ts`](./09-amend.ts) | `amendJob` — add an audio complement to a completed report |
| [`10-reformulate.ts`](./10-reformulate.ts) | `reformulateReport`, `listReformulations` — all 5 purpose types |
| [`11-webhook-verify.ts`](./11-webhook-verify.ts) | `verifyWebhookSignature` — all 5 event types with switch handler |
| [`nextjs/route-generate.ts`](./nextjs/route-generate.ts) | Next.js proxy route — receives audio from frontend, calls ReqVet server-side |
| [`nextjs/route-webhook.ts`](./nextjs/route-webhook.ts) | Next.js webhook handler — signature verification, idempotency, all events |

---

## Recommended integration flow

```
1. health()               → confirm API is reachable
2. listTemplates()        → discover available templateId values
3. uploadAudio()          → upload the consultation audio
4. createJob()            → start the pipeline with a callbackUrl
5. [webhook received]     → verify signature, parse event, save to DB
```

For development without a public webhook endpoint, use `generateReport({ waitForResult: true })` (example 03) instead of steps 4–5.

---

## Passing a job ID to examples

Some examples require a completed job ID:

```bash
npx tsx --env-file=.env 08-regenerate.ts your-job-id-here
npx tsx --env-file=.env 10-reformulate.ts your-job-id-here
```
