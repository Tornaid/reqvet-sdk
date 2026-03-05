export declare function signWebhook(rawBody: string, secret: string, timestamp: string): string;

export type WebhookVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'missing_headers' | 'invalid_timestamp' | 'stale_timestamp' | 'invalid_signature' };

export declare function verifyWebhookSignature(params: {
  secret: string;
  rawBody: string;
  signature: string;
  timestamp: string;
  maxSkewMs?: number;
  now?: number;
}): WebhookVerifyResult;
