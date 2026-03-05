// examples/js/nextjs/route-generate.mjs
// Next.js App Router — proxy route for report generation (JavaScript).
// Place at: app/api/reqvet/generate/route.js

import { NextResponse } from 'next/server';
import ReqVet from '@reqvet-sdk/sdk';

const reqvet = new ReqVet(process.env.REQVET_API_KEY, {
  baseUrl: process.env.REQVET_BASE_URL,
});

export async function POST(req) {
  try {
    const form = await req.formData();

    const audio = form.get('audio');
    const animalName = form.get('animalName');
    const templateId = form.get('templateId');
    const consultationId = form.get('consultationId');

    if (!audio || !animalName || !templateId) {
      return NextResponse.json(
        { error: 'Missing required fields: audio, animalName, templateId' },
        { status: 400 },
      );
    }

    const upload = await reqvet.uploadAudio(audio, audio.name);

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

  } catch (err) {
    console.error('ReqVet generate error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
