/**
 * Two-layer spam defense for /api/leads.
 *
 * Layer 1 — honeypot (always on)
 *   The form renders a hidden input named `website_url` that real users won't
 *   fill. Bots that auto-fill every field land in it. If the request body has
 *   a non-empty `website_url`, drop silently with a 200 so the bot doesn't
 *   learn it failed.
 *
 * Layer 2 — Google reCAPTCHA v3 (optional, off until keys provisioned)
 *   When NEXT_PUBLIC_RECAPTCHA_SITE_KEY + RECAPTCHA_SECRET_KEY are both set,
 *   the form attaches a token and the server verifies it. Score < 0.5 →
 *   reject. When keys are absent, this layer is a no-op.
 */

const HONEYPOT_FIELD = 'website_url';
const RECAPTCHA_TOKEN_FIELD = 'recaptcha_token';
const RECAPTCHA_MIN_SCORE = 0.5;
const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

export const HONEYPOT_FIELD_NAME = HONEYPOT_FIELD;
export const RECAPTCHA_TOKEN_FIELD_NAME = RECAPTCHA_TOKEN_FIELD;

export interface SpamCheckResult {
  /** True if the request looks like spam and the route should silently 200. */
  silentDrop?: boolean;
  /** True if reCAPTCHA verification failed (route should 400). */
  recaptchaFailed?: boolean;
  /** Optional debug info for server logs only. */
  detail?: string;
}

export function checkHoneypot(body: Record<string, unknown>): SpamCheckResult {
  const v = body[HONEYPOT_FIELD];
  if (typeof v === 'string' && v.trim().length > 0) {
    return { silentDrop: true, detail: `honeypot filled: ${v.slice(0, 32)}` };
  }
  return {};
}

export async function verifyRecaptcha(body: Record<string, unknown>): Promise<SpamCheckResult> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  // No keys provisioned yet → skip verification.
  if (!secret) return {};

  const token = body[RECAPTCHA_TOKEN_FIELD];
  if (typeof token !== 'string' || !token) {
    return { recaptchaFailed: true, detail: 'missing recaptcha token' };
  }

  try {
    const params = new URLSearchParams({ secret, response: token });
    const res = await fetch(RECAPTCHA_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = (await res.json()) as { success?: boolean; score?: number };
    if (!data.success) {
      return { recaptchaFailed: true, detail: 'recaptcha rejected' };
    }
    if (typeof data.score === 'number' && data.score < RECAPTCHA_MIN_SCORE) {
      return { recaptchaFailed: true, detail: `recaptcha score ${data.score} < ${RECAPTCHA_MIN_SCORE}` };
    }
    return {};
  } catch (err) {
    console.error('[spam-protection] recaptcha verify threw:', err);
    // Network failure on Google's side — fail open (let the request through).
    // Honeypot is still doing its job.
    return {};
  }
}
