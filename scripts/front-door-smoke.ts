/**
 * The front door, end to end, against a running deployment.
 *
 *   npm run front:smoke                      # production
 *   BASE=http://localhost:4455 npm run front:smoke
 *
 * It walks the real flow in order — page, vCard, signup, a call_ended
 * webhook from a number that has never been seen, then the running cost —
 * and prints a pass/fail line per step. A failing step says what was
 * expected, because the point of this script is to be read at speed.
 */

import { createHmac } from 'node:crypto';
import { CONTACT_NAME, CONTACT_ORG, VCARD_FILENAME } from '../src/web/vcard.js';

const BASE = (process.env.BASE ?? 'https://next-mission-nu.vercel.app').replace(/\/+$/, '');

/** A number nobody will call, so a run never collides with a real signup. */
const SIGNUP_PHONE = process.env.SMOKE_PHONE ?? '+15005550101';
/** Deliberately NOT the signup number: this proves provisioning from caller ID. */
const COLD_CALLER = process.env.SMOKE_COLD_CALLER ?? '+15005550102';

let failures = 0;

function report(step: string, ok: boolean, detail: string) {
  if (!ok) failures += 1;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${step.padEnd(30)} ${detail}`);
}

async function main() {
  console.log(`\nfront door → ${BASE}\n`);

  // 1. The page renders for a browser.
  const page = await fetch(`${BASE}/`, { headers: { accept: 'text/html' } });
  const html = await page.text();
  report(
    'the page',
    page.ok && html.includes(`Add ${CONTACT_NAME} to my contacts`),
    `${page.status}, ${html.length}b, qr=${html.includes('<svg') ? 'yes' : 'NO'}`
  );

  // 2. The vCard. The headers are the install, so check them, not just 200.
  const vcf = await fetch(`${BASE}/next-mission.vcf`);
  const vcard = await vcf.text();
  const disposition = vcf.headers.get('content-disposition') ?? '';
  report(
    'the vCard',
    vcf.ok &&
      (vcf.headers.get('content-type') ?? '').includes('text/vcard') &&
      disposition.includes(VCARD_FILENAME) &&
      vcard.includes('TEL') &&
      vcard.includes(`FN:${CONTACT_NAME}`) &&
      vcard.includes(`ORG:${CONTACT_ORG}`),
    `${vcf.status}, ${vcf.headers.get('content-type')}, ${disposition}`
  );

  // 3. Signup provisions a library keyed to the number.
  const signup = await fetch(`${BASE}/api/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    // Pasted junk on purpose — this is what people actually type.
    body: JSON.stringify({ phone: ` (${SIGNUP_PHONE.slice(2, 5)}) ${SIGNUP_PHONE.slice(5, 8)}.${SIGNUP_PHONE.slice(8)} ` }),
  });
  const s = (await signup.json()) as Record<string, unknown>;
  report(
    'signup provisions',
    signup.ok && s.phone === SIGNUP_PHONE && s.provisioned === true,
    s.provisioned
      ? `${s.phone} → subject ${s.subject_id}, billing=${s.billing_ready}`
      : `provisioned=false ${s.provisioning_error ?? s.note ?? ''}`
  );

  // 4. Junk is refused once, clearly, rather than stored.
  const bad = await fetch(`${BASE}/api/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone: 'call me maybe' }),
  });
  report('junk is refused', bad.status === 400, `${bad.status}`);

  // 5. call_ended from a number that never signed up. Caller ID is the
  //    login, and an unknown caller must be created rather than dropped.
  const callId = `smoke_${Date.now()}`;
  const endedAt = Date.now();
  const payload = {
    event: 'call_ended',
    call: {
      call_id: callId,
      agent_id: 'agent_e81ba747b2d4e05bc12af01ba5',
      from_number: COLD_CALLER,
      to_number: '+12722297451',
      direction: 'inbound',
      duration_ms: 252_000, // 4m 12s — the brief's own example
      start_timestamp: endedAt - 252_000,
      end_timestamp: endedAt,
      disconnection_reason: 'user_hangup',
    },
  };
  const raw = JSON.stringify(payload);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (process.env.RETELL_API_KEY) {
    headers['x-retell-signature'] = createHmac('sha256', process.env.RETELL_API_KEY)
      .update(raw)
      .digest('hex');
  }
  const url = process.env.WEBHOOK_SHARED_SECRET
    ? `${BASE}/webhooks/retell?token=${encodeURIComponent(process.env.WEBHOOK_SHARED_SECRET)}`
    : `${BASE}/webhooks/retell`;

  const hook = await fetch(url, { method: 'POST', headers, body: raw });
  const h = (await hook.json()) as Record<string, any>;
  report(
    'caller ID is the login',
    hook.ok && h.ok === true && h.matched?.phone === COLD_CALLER && h.matched?.user_created === true,
    hook.ok
      ? `${h.matched?.phone} created=${h.matched?.user_created} ${h.seconds}s metered=${h.metered?.reported}`
      : `${hook.status} ${JSON.stringify(h).slice(0, 160)}`
  );

  // 6. Replay the exact same payload. It must not bill twice.
  const replay = await fetch(url, { method: 'POST', headers, body: raw });
  const r = (await replay.json()) as Record<string, any>;
  report(
    'a replay cannot double-bill',
    replay.ok && r.metered?.reported !== true,
    `metered=${JSON.stringify(r.metered)}`
  );

  // 7. The running cost, which is what the page shows.
  const me = await fetch(`${BASE}/api/me?phone=${encodeURIComponent(COLD_CALLER)}`);
  const m = (await me.json()) as Record<string, unknown>;
  report(
    'the running cost',
    me.ok && m.total_seconds === 252,
    me.ok ? String(m.accrued) : `${me.status} ${JSON.stringify(m).slice(0, 120)}`
  );

  console.log(
    failures === 0
      ? '\nall good — the front door works end to end.\n'
      : `\n${failures} step${failures === 1 ? '' : 's'} failed.\n`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nsmoke run blew up:', err.message, '\n');
  process.exit(1);
});
