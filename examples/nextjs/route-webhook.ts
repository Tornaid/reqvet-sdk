// examples/nextjs/route-webhook.ts
// ─────────────────────────────────────────────────────────────
// Next.js App Router — webhook receiver.
//
// ReqVet POSTs job results to this endpoint.
// This handler verifies the signature, parses the event,
// and saves the report to your database.
//
// IMPORTANT: Read the raw body BEFORE JSON.parse.
//            The signature is computed on the raw string.
// ─────────────────────────────────────────────────────────────
// Place at: app/api/reqvet/webhook/route.ts
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@reqvet-sdk/sdk/webhooks';

export async function POST(req: NextRequest) {
  // 1. Read raw body BEFORE parsing
  const rawBody = await req.text();
  const signature = req.headers.get('x-reqvet-signature') ?? '';
  const timestamp = req.headers.get('x-reqvet-timestamp') ?? '';

  // 2. Verify signature
  const { ok, reason } = verifyWebhookSignature({
    secret: process.env.REQVET_WEBHOOK_SECRET!,
    rawBody,
    signature,
    timestamp,
    maxSkewMs: 5 * 60 * 1000,
  });

  if (!ok) {
    console.warn('ReqVet webhook rejected:', reason);
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // 3. Parse event
  const event = JSON.parse(rawBody) as {
    event: string;
    job_id: string;
    animal_name: string;
    html?: string;
    transcription?: string;
    fields?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    amendment_number?: number;
    error?: string;
  };

  // 4. Idempotency — deduplicate on job_id + event
  const deduplicationKey = `${event.job_id}:${event.event}`;
  // const alreadyProcessed = await cache.get(deduplicationKey);
  // if (alreadyProcessed) return new NextResponse('OK');
  // await cache.set(deduplicationKey, true, { ttl: 86400 });

  console.log(`[ReqVet] ${event.event} — job ${event.job_id}`);

  // 5. Handle each event type
  switch (event.event) {
    case 'job.completed': {
      // Save the report to your database
      // await db.consultation.update({
      //   where: { reqvetJobId: event.job_id },
      //   data: {
      //     reportHtml: event.html,
      //     reportFields: event.fields,
      //     status: 'completed',
      //   },
      // });

      // Notify the vet via your real-time system (WebSocket, SSE, etc.)
      // await pusher.trigger(`consultation-${event.metadata?.consultationId}`, 'report-ready', {
      //   html: event.html,
      //   fields: event.fields,
      // });

      console.log('Report ready for', event.animal_name);
      console.log('Fields:', event.fields);
      break;
    }

    case 'job.failed': {
      // await db.consultation.update({
      //   where: { reqvetJobId: event.job_id },
      //   data: { status: 'failed', error: event.error },
      // });
      console.error('Job failed:', event.error);
      break;
    }

    case 'job.amended': {
      // await db.consultation.update({
      //   where: { reqvetJobId: event.job_id },
      //   data: { reportHtml: event.html, amendmentNumber: event.amendment_number },
      // });
      console.log(`Amendment #${event.amendment_number} complete`);
      break;
    }

    case 'job.amend_failed': {
      console.error('Amendment failed — original report preserved');
      break;
    }

    case 'job.regenerated': {
      // await db.consultation.update({
      //   where: { reqvetJobId: event.job_id },
      //   data: { reportHtml: event.html },
      // });
      console.log('Report regenerated');
      break;
    }
  }

  return new NextResponse('OK', { status: 200 });
}
