// examples/js/nextjs/route-generate.mjs
// Next.js App Router — proxy route for report generation (JavaScript).
// Place at: app/api/reqvet/generate/route.js
//
// Uses getSignedUploadUrl() + direct PUT to Supabase instead of uploadAudio()
// to avoid Vercel Serverless Function's ~4.5 MB payload limit.

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

    // 1. Get a presigned Supabase URL — tiny JSON request, no file payload
    const { uploadUrl, path } = await reqvet.getSignedUploadUrl(
      audio.name || 'consultation.webm',
      audio.type || 'audio/webm',
    );

    // 2. Upload directly to Supabase — bypasses Vercel's ~4.5 MB limit
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

  } catch (err) {
    console.error('ReqVet generate error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
