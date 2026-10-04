/**
 * The front door — the page, the vCard, signup, and the inbound webhook.
 *
 *   GET  /                    the page (HTML to a browser, JSON to an agent)
 *   GET  /next-mission.vcf    the contact. The entire install step.
 *   POST /api/signup          normalise → provision → hand back the vCard URL
 *   GET  /api/me              this number's call count and accrued cost
 *   POST /webhooks/retell     call_ended → caller ID is the login
 *
 * Mounted into src/app.ts, which is the single Hono app both `tsx
 * src/server.ts` and the Vercel function serve.
 */

import { Hono, type Context } from 'hono';
import { createHmac, timingSafeEqual } from 'node:crypto';
import QRCode from 'qrcode';
import { optionalRaw } from '../env.js';
import { accruedLine, formatSeconds, reportCallSeconds, billingReady } from '../billing/index.js';
import { landingPage } from './page.js';
import { formatForHumans, toE164 } from './phone.js';
import { AGENT_NUMBER, vcard, vcardHeaders, VCARD_FILENAME } from './vcard.js';
import {
  closeDelivery,
  dbReady,
  ensureStripeCustomer,
  getUser,
  landDelivery,
  markMetered,
  provisionUser,
  recordCall,
} from './users.js';

export const web = new Hono();

// ─────────────────────────────────────────────────────────────
// The page
// ─────────────────────────────────────────────────────────────

/** The absolute origin, so the QR and the vCard link resolve anywhere. */
function origin(c: Context): string {
  const configured = optionalRaw('PUBLIC_BASE_URL');
  if (configured) return configured.replace(/\/+$/, '');
  const url = new URL(c.req.url);
  return `${url.protocol}//${url.host}`;
}

/**
 * The QR encodes the vCard URL rather than the vCard text: every phone
 * camera opens a URL, while raw-vCard QR support varies by scanner. The
 * scan lands on the same contact card a tap on the phone would.
 */
const qrCache = new Map<string, string>();

async function qrSvg(target: string): Promise<string> {
  const hit = qrCache.get(target);
  if (hit !== undefined) return hit;
  try {
    const svg = await QRCode.toString(target, {
      type: 'svg',
      margin: 0,
      errorCorrectionLevel: 'M',
      color: { dark: '#121215', light: '#0000' },
    });
    // Strip the XML prolog so it can be inlined in HTML.
    const inline = svg.replace(/<\?xml[^>]*\?>/, '').trim();
    qrCache.set(target, inline);
    return inline;
  } catch (err) {
    console.error('[qr] could not render:', (err as Error).message);
    qrCache.set(target, '');
    return '';
  }
}

/** True when this request came from a browser rather than an agent. */
function wantsHtml(c: Context): boolean {
  const accept = c.req.header('accept') ?? '';
  return accept.includes('text/html');
}

web.get('/', async (c, next) => {
  // An agent (or `curl`) asking for JSON still gets the service document
  // that src/app.ts defines. Only a browser gets the page.
  if (!wantsHtml(c)) return next();

  const base = origin(c);
  const html = landingPage({ qrSvg: await qrSvg(`${base}/next-mission.vcf`), origin: base });
  return c.html(html);
});

// ─────────────────────────────────────────────────────────────
// The vCard — the whole install
// ─────────────────────────────────────────────────────────────

const serveVcard = async (c: Context) => {
  const phone = toE164(c.req.query('phone'));
  if (phone && dbReady()) {
    try {
      const user = await provisionUser(phone, 'signup');
      void ensureStripeCustomer(user);
    } catch (err) {
      console.error('[vcard] provisioning failed, serving the contact anyway:', (err as Error).message);
    }
  }

  // iOS vCard handling varies by version and we cannot test it from here, so
  // every variant is reachable by ?v= and /vcard-test lists them. Whichever
  // one opens the Add-Contact sheet on a real phone becomes the default.
  const v = c.req.query('v') ?? '';
  const headers: Record<string, string> =
    v === '2' ? { 'Content-Type': 'text/x-vcard' }
    : v === '3' ? { 'Content-Type': 'text/vcard', 'Content-Disposition': `attachment; filename="${VCARD_FILENAME}"` }
    : v === '4' ? { 'Content-Type': 'text/directory;profile=vCard' }
    : v === '5' ? { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${VCARD_FILENAME}"` }
    : { 'Content-Type': 'text/vcard; charset=utf-8' };
  headers['Cache-Control'] = 'no-store';
  return new Response(vcard(), { headers });
};

// A bare page of every variant, so the one that works can be found in one pass.
web.get('/vcard-test', (c) => {
  const rows = [
    ['1', 'text/vcard; charset=utf-8', 'no disposition  (current default)'],
    ['2', 'text/x-vcard', 'legacy type, no disposition'],
    ['3', 'text/vcard', 'attachment disposition'],
    ['4', 'text/directory;profile=vCard', 'directory type'],
    ['5', 'application/octet-stream', 'forced download'],
  ];
  return c.html(
    `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1">
     <style>body{font:17px/1.5 -apple-system,sans-serif;padding:24px;max-width:34rem;margin:auto}
     a{display:block;padding:18px;margin:12px 0;border:1px solid #ccc;border-radius:12px;
       text-decoration:none;color:#111}
     b{display:block;font-size:19px}small{color:#666}</style>
     <h2>Tap each until one opens a contact card</h2>
     <p>Then tell the orchestrator which number worked.</p>` +
      rows
        .map(
          ([n, ct, note]) =>
            `<a href="/next-mission.vcf?v=${n}"><b>Variant ${n}</b><small>${ct} &middot; ${note}</small></a>`
        )
        .join('') +
      `<a href="tel:${AGENT_NUMBER}"><b>Or just call it now</b><small>${AGENT_NUMBER}</small></a>`
  );
});

web.get('/next-mission.vcf', serveVcard);
// A couple of spellings, because the filename gets typed and shared.
web.get('/nextmission.vcf', serveVcard);
web.get('/contact.vcf', serveVcard);

web.get('/qr.svg', async (c) => {
  const target = c.req.query('d') ?? `${origin(c)}/next-mission.vcf`;
  const svg = await qrSvg(target);
  return new Response(svg, {
    headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  });
});

// ─────────────────────────────────────────────────────────────
// Signup — one field, and then a library exists
// ─────────────────────────────────────────────────────────────

web.post('/api/signup', async (c) => {
  const raw = (await c.req.json().catch(() => ({}))) as { phone?: string };
  const phone = toE164(raw.phone);

  if (!phone) {
    return c.json(
      {
        error: 'bad_phone',
        message: 'That did not look like a phone number. Try it with the area code.',
      },
      400
    );
  }

  const base = origin(c);
  const response: Record<string, unknown> = {
    phone,
    display: formatForHumans(phone),
    agent_number: AGENT_NUMBER,
    agent_number_display: formatForHumans(AGENT_NUMBER),
    tel: `tel:${AGENT_NUMBER}`,
    vcard_url: `${base}/next-mission.vcf`,
    vcard_filename: VCARD_FILENAME,
    provisioned: false,
  };

  if (!dbReady()) {
    // The contact still installs and the number still answers. Say so
    // plainly rather than failing the one interaction that matters.
    response.greeting = 'Your contact is ready.';
    response.accrued = accruedLine(0);
    response.note = 'Library provisioning is not configured on this deployment.';
    return c.json(response);
  }

  // Provisioning must not be able to break the install. If the library
  // cannot be created, the person still gets the contact and the number
  // still answers them — and the webhook will provision them from their
  // caller ID on the first call anyway.
  let user: Awaited<ReturnType<typeof provisionUser>>;
  try {
    user = await provisionUser(phone, 'signup');
  } catch (err) {
    console.error('[signup] provisioning failed, serving the contact anyway:', (err as Error).message);
    response.greeting = 'Your contact is ready.';
    response.accrued = accruedLine(0);
    response.provisioning_error = (err as Error).message;
    return c.json(response);
  }

  const customerId = await ensureStripeCustomer(user);

  const returning = user.call_count > 0;
  response.provisioned = true;
  response.subject_id = user.subject_id;
  response.created_at = user.created_at;
  response.call_count = user.call_count;
  response.total_seconds = user.total_seconds;
  response.billing_ready = Boolean(customerId);
  response.greeting = returning
    ? `Welcome back — ${user.call_count} call${user.call_count === 1 ? '' : 's'}, ${formatSeconds(user.total_seconds)} so far.`
    : 'Your library is ready.';
  response.accrued = accruedLine(user.total_seconds);

  return c.json(response);
});

/** The running cost, for a number that already signed up. */
web.get('/api/me', async (c) => {
  const phone = toE164(c.req.query('phone'));
  if (!phone) return c.json({ error: 'bad_phone', message: '`phone` must be a phone number' }, 400);
  if (!dbReady()) return c.json({ error: 'not_configured' }, 503);

  const user = await getUser(phone);
  if (!user) return c.json({ error: 'not_found', message: 'That number has not signed up.' }, 404);

  return c.json({
    phone: user.phone,
    display: formatForHumans(user.phone),
    subject_id: user.subject_id,
    call_count: user.call_count,
    total_seconds: user.total_seconds,
    talk_time: formatSeconds(user.total_seconds),
    accrued: accruedLine(user.total_seconds),
    billing_ready: Boolean(user.stripe_customer_id),
    since: user.created_at,
  });
});

// ─────────────────────────────────────────────────────────────
// The webhook — caller ID is the login
// ─────────────────────────────────────────────────────────────

/**
 * Retell signs the raw body with the account API key and sends it as
 * `x-retell-signature`. We compare constant-time against our own HMAC.
 *
 * Two deliberate softnesses:
 *   - a `?token=` shared secret is accepted as well, so the webhook can be
 *     authenticated before the API key is in this deployment's env;
 *   - with neither secret configured the payload is accepted and recorded
 *     as unverified. Losing a call we cannot verify is worse than storing
 *     one we cannot attribute, because the provider keeps no copy.
 */
function verifySignature(rawBody: string, header: string | undefined, token: string | null) {
  const apiKey = optionalRaw('RETELL_API_KEY');
  const shared = optionalRaw('WEBHOOK_SHARED_SECRET');

  if (shared && token && token.length === shared.length) {
    if (timingSafeEqual(Buffer.from(token), Buffer.from(shared))) {
      return { ok: true, how: 'shared_secret' as const };
    }
  }

  if (apiKey && header) {
    const expected = createHmac('sha256', apiKey).update(rawBody).digest('hex');
    // Retell has shipped both a bare hex digest and a `v=<hex>` form.
    const presented = (header.match(/[0-9a-f]{64}/i) ?? [])[0];
    if (
      presented &&
      timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(presented.toLowerCase(), 'hex'))
    ) {
      return { ok: true, how: 'retell_hmac' as const };
    }
    return { ok: false, how: 'retell_hmac' as const };
  }

  if (!apiKey && !shared) return { ok: false, how: 'unconfigured' as const };
  return { ok: false, how: shared ? ('shared_secret' as const) : ('retell_hmac' as const) };
}

interface RetellCall {
  call_id?: string;
  agent_id?: string;
  from_number?: string;
  to_number?: string;
  direction?: string;
  duration_ms?: number;
  start_timestamp?: number;
  end_timestamp?: number;
  disconnection_reason?: string;
}

function seconds(call: RetellCall): number {
  if (typeof call.duration_ms === 'number') return Math.round(call.duration_ms / 1000);
  if (typeof call.start_timestamp === 'number' && typeof call.end_timestamp === 'number') {
    return Math.max(0, Math.round((call.end_timestamp - call.start_timestamp) / 1000));
  }
  return 0;
}

function iso(ms: number | undefined): string | null {
  return typeof ms === 'number' && ms > 0 ? new Date(ms).toISOString() : null;
}

const handleWebhook = async (c: Context) => {
  // The raw body, read once — the signature is over these exact bytes.
  const rawBody = await c.req.text();

  let payload: { event?: string; call?: RetellCall } = {};
  try {
    payload = JSON.parse(rawBody || '{}');
  } catch {
    // Unparseable: still land it. We would rather hold a malformed payload
    // than discard the only copy of a call.
    await landDelivery({
      eventType: null,
      callId: null,
      fromNumber: null,
      signatureOk: false,
      payload: { unparseable: true, raw: rawBody.slice(0, 20000) },
    }).catch(() => null);
    return c.json({ error: 'bad_json', landed: true }, 400);
  }

  const event = payload.event ?? null;
  const call = payload.call ?? {};
  const callId = call.call_id ?? null;
  const from = toE164(call.from_number ?? null);

  const sig = verifySignature(rawBody, c.req.header('x-retell-signature'), c.req.query('token') ?? null);

  const deliveryId = dbReady()
    ? await landDelivery({
        eventType: event,
        callId,
        fromNumber: from ?? call.from_number ?? null,
        signatureOk: sig.ok,
        payload,
      })
    : null;

  if (!dbReady()) {
    console.warn('[webhook] Supabase is not configured; payload logged only');
    console.warn(JSON.stringify(payload));
  }

  // A presented-but-wrong signature is a rejection. The payload is already
  // stored, so the rejection costs us nothing and tells us something.
  if (!sig.ok && sig.how !== 'unconfigured') {
    await closeDelivery(deliveryId, 'signature rejected').catch(() => {});
    return c.json({ error: 'bad_signature', landed: Boolean(deliveryId) }, 401);
  }
  if (sig.how === 'unconfigured') {
    console.warn(
      '[webhook] accepted an UNVERIFIED payload: set RETELL_API_KEY or WEBHOOK_SHARED_SECRET'
    );
  }

  // Only `call_ended` carries a finished call. Everything else is landed
  // and acknowledged; acknowledging is what stops a retry storm.
  if (event && event !== 'call_ended') {
    await closeDelivery(deliveryId).catch(() => {});
    return c.json({ ok: true, event, action: 'landed' });
  }

  if (!callId) {
    await closeDelivery(deliveryId, 'no call_id').catch(() => {});
    return c.json({ ok: true, action: 'landed', note: 'no call_id in payload' });
  }

  if (!dbReady()) return c.json({ ok: true, action: 'logged', call_id: callId });

  try {
    const result = await recordCall({
      callId,
      fromNumber: from,
      toNumber: call.to_number ?? null,
      seconds: seconds(call),
      startedAt: iso(call.start_timestamp),
      endedAt: iso(call.end_timestamp),
      reason: call.disconnection_reason ?? null,
    });

    // Meter the talk time. Idempotent on the call id, so a replay cannot
    // double-bill, and a Stripe outage cannot fail the webhook.
    let metered: unknown = { reported: false, reason: 'not attempted' };
    const customerId = result.user ? await ensureStripeCustomer(result.user) : null;
    if (customerId && billingReady() && !result.call.metered_at) {
      try {
        const report = await reportCallSeconds({
          customerId,
          seconds: result.call.duration_seconds,
          callId,
        });
        metered = report;
        if (report.reported) await markMetered(callId, report.identifier);
      } catch (err) {
        metered = { reported: false, error: (err as Error).message };
        console.error('[billing] meter event failed:', (err as Error).message);
      }
    }

    await closeDelivery(deliveryId).catch(() => {});

    return c.json({
      ok: true,
      event: event ?? 'call_ended',
      call_id: callId,
      verified: sig.ok,
      matched: {
        phone: result.user?.phone ?? null,
        subject_id: result.user?.subject_id ?? null,
        user_created: result.user_created,
      },
      seconds: result.call.duration_seconds,
      metered,
    });
  } catch (err) {
    const message = (err as Error).message;
    await closeDelivery(deliveryId, message).catch(() => {});
    console.error('[webhook] processing failed but the payload is stored:', message);
    // 200 on purpose: the payload is safe in `webhook_deliveries` and is
    // replayable. A 500 would make the provider retry into the same bug.
    return c.json({ ok: false, landed: Boolean(deliveryId), replayable: true, error: message });
  }
};

web.post('/webhooks/retell', handleWebhook);
/** The path the brief names, kept as an alias so either can be configured. */
web.post('/api/retell-webhook', handleWebhook);

export default web;
