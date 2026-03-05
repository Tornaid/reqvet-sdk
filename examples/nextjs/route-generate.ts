// examples/nextjs/route-generate.ts
// ─────────────────────────────────────────────────────────────
// Next.js App Router — proxy route for report generation.
//
// Your frontend POSTs audio here. This route:
//   1. Forwards the audio to ReqVet
//   2. Creates a job with your org's webhook URL
//   3. Returns the job_id immediately
//
// The API key never leaves your server.
// ─────────────────────────────────────────────────────────────
// Place at: app/api/reqvet/generate/route.ts
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import ReqVet from '@reqvet-sdk/sdk';

const reqvet = new ReqVet(process.env.REQVET_API_KEY!, {
  baseUrl: process.env.REQVET_BASE_URL,
});

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const audio = form.get('audio') as File | null;
    const animalName = form.get('animalName') as string | null;
    const templateId = form.get('templateId') as string | null;
    const consultationId = form.get('consultationId') as string | null;

    if (!audio || !animalName || !templateId) {
      return NextResponse.json(
        { error: 'Missing required fields: audio, animalName, templateId' },
        { status: 400 },
      );
    }

    // Upload audio to ReqVet storage
    const upload = await reqvet.uploadAudio(audio, audio.name);

    // Create the generation job
    const job = await reqvet.createJob({
      audioFile: upload.path,
      animalName,
      templateId,
      callbackUrl: process.env.REQVET_WEBHOOK_URL,
      metadata: {
        consultationId,
        userId: req.headers.get('x-user-id') ?? undefined,
      },
    });

    return NextResponse.json(job, { status: 201 });
    // { job_id: '...', status: 'pending' }

  } catch (err: unknown) {
    console.error('ReqVet generate error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
