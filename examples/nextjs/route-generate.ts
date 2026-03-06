// examples/nextjs/route-generate.ts
// ─────────────────────────────────────────────────────────────
// Next.js App Router — proxy route for report generation.
//
// Your frontend POSTs audio here. This route:
//   1. Gets a presigned Supabase URL (POST /api/v1/storage/signed-upload)
//   2. Uploads the audio directly to Supabase (PUT to the signed URL)
//   3. Creates a job with your org's webhook URL
//   4. Returns the job_id immediately
//
// The API key never leaves your server.
//
// Why not reqvet.uploadAudio()?
//   uploadAudio() POSTs the file to /api/v1/upload, which runs as a Vercel
//   Serverless Function (~4.5 MB payload limit). For audio files > 4 MB use
//   getSignedUploadUrl() instead — the file goes directly to Supabase,
//   bypassing Vercel entirely.
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

    // 1. Get a presigned Supabase URL — tiny JSON request, no file payload
    const { uploadUrl, path } = await reqvet.getSignedUploadUrl(
      audio.name || 'consultation.webm',
      audio.type || 'audio/webm',
    );

    // 2. Upload directly to Supabase — bypasses Vercel's ~4.5 MB limit entirely
    const audioBuffer = Buffer.from(await audio.arrayBuffer());
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': audio.type || 'audio/webm' },
      body: audioBuffer,
    });
    if (!uploadRes.ok) {
      throw new Error(`Supabase upload failed: ${uploadRes.status}`);
    }

    // 3. Create the generation job
    const job = await reqvet.createJob({
      audioFile: path,
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
