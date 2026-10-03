/**
 * The front door, as one page.
 *
 * One field, one button, a lot of space. The whole flow is: type your
 * number, tap once, Habibi is in your contacts, call it, it already
 * knows you. Everything on this page serves that sentence — anything that
 * does not is not on it.
 *
 * No build step and no framework: one string of HTML with its CSS and ~80
 * lines of script inline, served by the same Hono app as the API. A judge
 * on a laptop and a user on a phone get the same page.
 *
 * Visual system — "Observatory", chosen 2026-10-03 from three candidates:
 * a saturated blue-black ground with a cool interstellar white, Playfair
 * Display 700 for the quote, DM Sans for everything read, DM Mono for the
 * step numerals. Ember (#C4723A) is the single accent and, with no logo and
 * no eyebrow on this page, the only thing tying it to Upside — so it is
 * spent only on the numerals and the one button that matters. Committed
 * dark: this is not a dual-theme design, so every colour is painted
 * explicitly and nothing is inherited from the viewer's preference.
 */

import { AGENT_NUMBER, CONTACT_NAME, VCARD_FILENAME } from './vcard.js';
import { formatForHumans } from './phone.js';

export interface PageOptions {
  /** QR of the vCard URL, as inline SVG. Empty string hides the panel. */
  qrSvg: string;
  /** Absolute origin, for the "or scan this" caption. */
  origin: string;
}

const SPOKEN_NUMBER = formatForHumans(AGENT_NUMBER);

export function landingPage({ qrSvg, origin }: PageOptions): string {
  const host = origin.replace(/^https?:\/\//, '');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${CONTACT_NAME}</title>
<meta name="description" content="A voice agent you call when you are standing at a crossroads. You already know the answer — this helps you discover it, then hands the next step to your own agent.">
<meta name="theme-color" content="#070910">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><text y='26' font-size='26'>&#9742;</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500&family=Playfair+Display:wght@600;700&display=swap">
<style>
  :root {
    /* Observatory — the black has sky in it. */
    --ground: #070910;
    --light: #F4F6FB;
    --dim: #A8AEC2;
    --faint: #6B7288;
    --hair: rgba(244,246,251,.09);
    --hair-strong: rgba(244,246,251,.17);
    --well: rgba(244,246,251,.035);
    --placeholder: #5E657A;
    --ember: #C4723A;
    --ember-lift: #D4824A;
    --ember-ink: #FBF7F2;
    --ok: #7FD4A8;
    --bad: #E8927C;

    --display: 'Playfair Display', Georgia, 'Times New Roman', serif;
    --body: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, system-ui, sans-serif;
    --mono: 'DM Mono', ui-monospace, 'SF Mono', Menlo, monospace;
  }
  * { box-sizing: border-box; }
  html { background: var(--ground); }
  html, body { margin: 0; }
  body {
    background: var(--ground);
    color: var(--dim);
    font: 400 17px/1.5 var(--body);
    -webkit-font-smoothing: antialiased;
    -webkit-text-size-adjust: 100%;
    min-height: 100svh;
    display: flex;
    flex-direction: column;
    text-align: center;
    padding: max(56px, env(safe-area-inset-top)) 26px max(34px, env(safe-area-inset-bottom));
    position: relative;
    overflow-x: hidden;
  }
  /* the distant star behind the quote — present in the room, not incense */
  body::before {
    content: '';
    position: absolute;
    inset: 0 0 auto;
    height: 72vh;
    background: radial-gradient(60% 42% at 50% 14%, rgba(126,150,214,.16) 0%, rgba(126,150,214,0) 72%);
    pointer-events: none;
    z-index: 0;
  }
  main { position: relative; z-index: 1; width: 100%; max-width: 25rem; margin: auto; }

  .headline {
    font-family: var(--display);
    font-weight: 700;
    font-size: clamp(1.9rem, 7.8vw, 2.45rem);
    line-height: 1.2;
    letter-spacing: -.018em;
    color: var(--light);
    margin: 0 0 18px;
    text-wrap: balance;
  }
  .headline b { color: var(--ember); font-weight: inherit; }
  .gloss {
    margin: 0 auto 36px;
    max-width: 21rem;
    font-size: 15px;
    line-height: 1.55;
    color: var(--faint);
    text-wrap: balance;
  }

  /* ── what it is ── not a sequence, so no numerals: a dash and a name ── */
  .features {
    margin: 44px 0 0;
    padding: 0;
    list-style: none;
    text-align: left;
    border-top: 1px solid var(--hair);
  }
  .features li {
    padding: 16px 2px 17px;
    border-bottom: 1px solid var(--hair);
  }
  .features b {
    display: block;
    font-size: 15px;
    font-weight: 500;
    color: var(--light);
    margin-bottom: 3px;
  }
  .features b::before {
    content: '—';
    color: var(--ember);
    margin-right: .5em;
  }
  .features span {
    display: block;
    font-size: 14px;
    line-height: 1.5;
    color: var(--faint);
  }

  .section-mark {
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: .15em;
    text-transform: uppercase;
    color: var(--faint);
    text-align: left;
    margin: 44px 0 0;
  }
  .section-mark + .steps,
  .section-mark + .features { margin-top: 16px; }

  /* how to use it — a real sequence, so the numerals earn their place */
  .steps {
    margin: 0 0 40px;
    padding: 0;
    list-style: none;
    text-align: left;
    counter-reset: s;
    border-top: 1px solid var(--hair);
  }
  .steps li {
    counter-increment: s;
    display: flex;
    gap: 14px;
    align-items: baseline;
    padding: 15px 2px;
    border-bottom: 1px solid var(--hair);
    font-size: 15px;
    line-height: 1.5;
    color: var(--dim);
  }
  .steps li::before {
    content: counter(s);
    flex: none;
    width: 1.2em;
    font-family: var(--mono);
    font-size: 12px;
    color: var(--ember);
    font-variant-numeric: tabular-nums;
  }

  form { text-align: left; }
  label {
    display: block;
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: .14em;
    text-transform: uppercase;
    color: var(--faint);
    margin-bottom: .6rem;
  }
  input {
    width: 100%;
    padding: 1rem 1.0625rem;
    font-family: var(--body);
    /* 17px — never below 16, or Safari zooms the page on focus */
    font-size: 17px;
    letter-spacing: .01em;
    color: var(--light);
    background: var(--well);
    border: 1px solid var(--hair-strong);
    border-radius: 12px;
    -webkit-appearance: none;
  }
  input::placeholder { color: var(--placeholder); }
  input:focus {
    outline: 2px solid var(--ember);
    outline-offset: 1px;
    border-color: transparent;
    background: rgba(244,246,251,.06);
  }
  button {
    width: 100%;
    margin-top: .625rem;
    padding: 1rem 1.0625rem;
    font-family: var(--body);
    font-size: 16px;
    font-weight: 500;
    color: var(--ember-ink);
    background: var(--ember);
    border: 0;
    border-radius: 12px;
    cursor: pointer;
    -webkit-appearance: none;
    transition: background-color .15s ease;
  }
  button:hover { background: var(--ember-lift); }
  button:focus-visible { outline: 2px solid var(--light); outline-offset: 2px; }
  button:disabled { opacity: .55; cursor: default; }
  button.ghost, a.ghost {
    color: var(--light);
    background: transparent;
    border: 1px solid var(--hair-strong);
  }
  button.ghost:hover, a.ghost:hover { background: var(--well); }
  /* The anchor IS the button. iOS will not open a vCard from a nested
     <button>, nor from a programmatic navigation — only a direct tap on a
     real link, with no download attribute. Do not "improve" this. */
  a.ghost {
    display: block; width: 100%; box-sizing: border-box;
    margin-top: .625rem;
    text-align: center; text-decoration: none; cursor: pointer;
    font-family: var(--body); font-size: 16px; font-weight: 500;
    padding: 1rem 1.0625rem; border-radius: 12px; -webkit-appearance: none;
  }
  a.ghost:focus-visible { outline: 2px solid var(--light); outline-offset: 2px; }

  .fine { margin: 18px 0 0; font-size: 13px; line-height: 1.5; color: var(--faint); }
  .err {
    margin: .85rem 0 0;
    font-size: 14px;
    color: var(--bad);
    min-height: 1.4em;
    text-align: left;
  }

  /* ── the done panel ── */
  .done { display: none; }
  body[data-state="done"] .start { display: none; }
  body[data-state="done"] .done { display: block; }
  .kicker {
    font-family: var(--mono);
    font-size: 12px;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: var(--ok);
    margin: 0 0 1.6rem;
    display: flex;
    gap: .5rem;
    align-items: baseline;
    justify-content: center;
  }
  .call {
    font-family: var(--display);
    font-weight: 700;
    font-size: clamp(1.9rem, 8vw, 2.4rem);
    line-height: 1.15;
    letter-spacing: -.015em;
    color: var(--light);
    margin: 0 0 1rem;
  }
  .number {
    display: block;
    font-size: clamp(2rem, 9vw, 2.75rem);
    font-weight: 500;
    letter-spacing: -.02em;
    color: var(--ember);
    text-decoration: none;
    margin: 0 0 1rem;
    font-variant-numeric: tabular-nums;
  }
  .number:active { opacity: .6; }
  .qr {
    margin-top: 2rem;
    padding-top: 1.6rem;
    border-top: 1px solid var(--hair);
    display: flex;
    gap: 1.1rem;
    align-items: center;
    text-align: left;
  }
  .qr svg {
    width: 104px; height: 104px; flex: none;
    border-radius: 8px; background: #fff; padding: 6px;
  }
  .qr p { margin: 0; font-size: 13px; line-height: 1.5; color: var(--faint); }
  @media (max-width: 400px) { .qr { display: none; } }

  footer {
    position: relative; z-index: 1;
    margin: 3rem auto 0; max-width: 25rem; width: 100%;
    font-family: var(--mono);
    font-size: 11px; letter-spacing: .06em;
    color: var(--faint);
  }
  footer a { color: inherit; }

  @media (prefers-reduced-motion: reduce) {
    * { transition: none !important; animation: none !important; }
  }
</style>
</head>
<body data-state="start">
<main>

  <section class="start">
    <h1 class="headline">You already know the answer.
      Discovered with the help of <b>${CONTACT_NAME}</b>.</h1>
    <p class="gloss">An agent you talk to that helps you make the best next decision
      based on your own intuition.</p>

    <form id="f" action="/next-mission.vcf" method="get" novalidate>
      <label for="p">Your phone number</label>
      <input id="p" name="phone" type="tel" inputmode="tel"
             autocomplete="tel" enterkeyhint="go" placeholder="(555) 123-4567"
             aria-describedby="e">
      <button id="go" type="submit">Add ${CONTACT_NAME} to my contacts</button>
      <p class="err" id="e" role="alert"></p>
    </form>

    <p class="section-mark">What it is</p>
    <ul class="features">
      <li>
        <b>Your conversation is not stored</b>
        <span>No recording, no transcript kept. Your number is the only thing on
          file, and only so ${CONTACT_NAME} knows you when you call.</span>
      </li>
      <li>
        <b>It builds a context library you own</b>
        <span>What you decide is saved to a private library that belongs to you,
          so the next call starts where the last one ended.</span>
      </li>
      <li>
        <b>It dispatches the task to your assistant</b>
        <span>${CONTACT_NAME} never acts for you. It writes the brief and hands the
          next step to your own personal agent to execute.</span>
      </li>
      <li>
        <b>You pay for talk time, by the minute</b>
        <span>Billed only for the minutes you are actually on the call. Adding the
          contact is free.</span>
      </li>
      <li>
        <b>No subscription</b>
        <span>Pay as you go, or settle on usage. Nothing recurring, nothing to cancel.</span>
      </li>
    </ul>

    <p class="section-mark">How to use it</p>
    <ol class="steps">
      <li>When you&rsquo;re standing at a crossroads, call ${CONTACT_NAME}.</li>
      <li>Give as much context about the situation as you can.</li>
      <li>Be ruthlessly honest, and steer the conversation if you need to.</li>
      <li>At the end, approve a task for your personal assistant agent.</li>
      <li>Take action.</li>
    </ol>
  </section>

  <section class="done" aria-live="polite">
    <p class="kicker"><span>&#10003;</span><span id="k">Your library is ready.</span></p>
    <p class="call">Call it.</p>
    <a class="number" id="tel" href="tel:${AGENT_NUMBER}">${SPOKEN_NUMBER}</a>
    <p class="gloss" style="margin-bottom:1.75rem">${CONTACT_NAME} is in your contacts.
      Tap the number to call now.</p>

    <a id="vcf" class="ghost" href="/next-mission.vcf" role="button">Open the contact again</a>

    <ol class="steps" style="margin-top:2rem">
      <li>Hit <strong>Add</strong> on the card your phone just opened.</li>
      <li>Tap the number above to call &mdash; right now, if you like.</li>
      <li>It knows you by your number. No password, no app.</li>
    </ol>

    <div class="qr">${qrSvg}<p>On a laptop? Scan this with your phone&rsquo;s camera to
      get the contact onto the phone you actually call from.</p></div>

    <p class="fine" id="cost">Free to add. You pay only for talk time.</p>
  </section>
</main>

<footer>
  <span id="host">${host}</span> &middot;
  <a href="/llms.txt">what we keep, and what it costs</a>
</footer>

<script>
(function () {
  var form = document.getElementById('f');
  var input = document.getElementById('p');
  var go = document.getElementById('go');
  var err = document.getElementById('e');
  var body = document.body;

  // If they have signed up on this phone before, skip straight to the end.
  try {
    var seen = localStorage.getItem('nm.phone');
    if (seen) { input.value = seen; }
  } catch (_) {}

  // The form is a REAL GET navigation to /next-mission.vcf?phone=...
  // That is the whole point: iOS only opens a vCard from a direct user
  // gesture, so the submit tap must itself be the navigation. We validate
  // and then get out of the way — no preventDefault, no fetch, no redirect.
  // Provisioning happens server-side on that same request.
  form.addEventListener('submit', function (ev) {
    var raw = (input.value || '').trim();
    if (!raw) {
      ev.preventDefault();
      err.textContent = 'Your number, so it knows you when you call.';
      input.focus();
      return;
    }
    if (raw.replace(/\D/g, '').length < 10) {
      ev.preventDefault();
      err.textContent = 'That did not look like a phone number. Try it with the area code.';
      input.focus();
      return;
    }
    err.textContent = '';
    try { localStorage.setItem('nm.phone', raw); } catch (_) {}
    // Let it through. The contact card opens; this page stays behind it.
    body.setAttribute('data-state', 'done');
    go.textContent = 'Opening your contact\u2026';
  });
})();
</script>
</body>
</html>`;
}
