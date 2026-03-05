// Webhook helpers (Node.js)
//
// Used by partners to verify ReqVet webhook authenticity.
//
// Signature headers:
//   X-ReqVet-Signature: sha256=<hex>
//   X-ReqVet-Timestamp: <unix_ms>
//
// Expected signature:
//   HMAC_SHA256(secret, `${timestamp}.${rawBody}`)

import crypto from 'node:crypto';

export function signWebhook(rawBody, secret, timestamp) {
  const message = `${timestamp}.${rawBody}`;
  const hmac = crypto.createHmac('sha256', secret).update(message).digest('hex');
  return `sha256=${hmac}`;
}

function timingSafeEqual(a, b) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Verify webhook signature + (optional) anti-replay window.
 */
export function verifyWebhookSignature({
  secret,
  rawBody,
  signature,
  timestamp,
  maxSkewMs = 5 * 60 * 1000,
  now = Date.now(),
}) {
  if (!secret || !signature || !timestamp) {
    return { ok: false, reason: 'missing_headers' };
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'invalid_timestamp' };
  if (Math.abs(now - ts) > maxSkewMs) return { ok: false, reason: 'stale_timestamp' };

  const expected = signWebhook(rawBody, secret, String(timestamp));
  if (!timingSafeEqual(String(signature), expected)) {
    return { ok: false, reason: 'invalid_signature' };
  }

  return { ok: true };
}
