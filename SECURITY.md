# Security

## API key management

Your ReqVet API key (`rqv_live_...`) grants full access to your organization's data and quota. Treat it like a password.

**Never** expose it in:
- Client-side JavaScript (React, Vue, browser bundles)
- Mobile app binaries
- Public repositories
- Logs or error messages

**Always** load it from environment variables server-side:

```ts
const reqvet = new ReqVet(process.env.REQVET_API_KEY!);
```

## Proxy pattern (required for browser integrations)

If your frontend records audio in the browser, use a server-side proxy — your backend calls ReqVet, never the browser directly:

```
Browser → your server (proxy) → ReqVet API
```

Example proxy route (Next.js App Router):

```ts
// app/api/reqvet/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import ReqVet from '@reqvet/sdk';

const reqvet = new ReqVet(process.env.REQVET_API_KEY!);

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const audio = form.get('audio') as File;

  const { path } = await reqvet.uploadAudio(audio, audio.name);
  const job = await reqvet.createJob({
    audioFile: path,
    animalName: form.get('animalName') as string,
    templateId: form.get('templateId') as string,
    callbackUrl: process.env.REQVET_WEBHOOK_URL,
  });

  return NextResponse.json(job);
}
```

## Webhook signature verification

Every ReqVet webhook is signed with HMAC-SHA256. Always verify the signature before processing.

```ts
import { verifyWebhookSignature } from '@reqvet/sdk/webhooks';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-reqvet-signature') ?? '';
  const timestamp = req.headers.get('x-reqvet-timestamp') ?? '';

  const { ok, reason } = verifyWebhookSignature({
    secret: process.env.REQVET_WEBHOOK_SECRET!,
    rawBody,
    signature,
    timestamp,
    maxSkewMs: 5 * 60 * 1000, // reject events older than 5 minutes
  });

  if (!ok) {
    console.warn('Webhook rejected:', reason);
    return new Response('Unauthorized', { status: 401 });
  }

  const event = JSON.parse(rawBody);
  // process event.job_id, event.status, event.result ...
}
```

**Signature format:**
- Header `X-ReqVet-Signature: sha256=<hex>`
- Header `X-ReqVet-Timestamp: <unix_ms>`
- Signed message: `HMAC_SHA256(secret, "${timestamp}.${rawBody}")`

**Rejection reasons:**
| `reason` | Cause |
|----------|-------|
| `missing_headers` | Signature or timestamp header absent |
| `invalid_timestamp` | Timestamp is not a valid number |
| `stale_timestamp` | Event is outside the allowed time window |
| `invalid_signature` | HMAC does not match |

## Idempotency

Webhooks may be delivered more than once. Use `job_id` + `event` as a deduplication key before processing:

```ts
const key = `${event.job_id}:${event.event}`;
if (await cache.has(key)) return new Response('OK'); // already processed
await cache.set(key, true, { ttl: 86400 });
// process...
```

## API key rotation

If a key is compromised:

1. Generate a new key from your ReqVet admin panel
2. Update `REQVET_API_KEY` in your environment variables
3. Redeploy your application
4. Revoke the old key

## Responsible disclosure

If you discover a security vulnerability in this SDK or the ReqVet API, report it privately to **security@reqvet.com**. Do not open a public GitHub issue for security vulnerabilities.

We commit to acknowledging reports within 48 hours and providing a fix timeline within 7 days for critical issues.
