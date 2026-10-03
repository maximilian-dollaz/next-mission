/**
 * The front door, as one page.
 *
 * One field, one button, a lot of space. The whole flow is: type your
 * number, tap once, Next Mission is in your contacts, call it, it already
 * knows you. Everything on this page serves that sentence — anything that
 * does not is not on it.
 *
 * No build step and no framework: one string of HTML with its CSS and ~80
 * lines of script inline, served by the same Hono app as the API. A judge
 * on a laptop and a user on a phone get the same page.
 */

import { AGENT_NUMBER } from './vcard.js';
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
<title>Next Mission</title>
<meta name="description" content="A voice agent you call to think something through. Your phone number is your login — no password, no account, no app.">
<meta name="theme-color" content="#0d0d0f">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><text y='26' font-size='26'>&#9742;</text></svg>">
<style>
  :root {
    --ink: #121215;
    --ink-soft: #5c5c66;
    --paper: #fbfaf8;
    --line: #e3e1dc;
    --accent: #0d0d0f;
    --accent-ink: #fbfaf8;
    --ok: #0f7a4a;
    --bad: #a8321f;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --ink: #f2f1ee; --ink-soft: #9a9aa4; --paper: #0d0d0f; --line: #2a2a30;
      --accent: #f2f1ee; --accent-ink: #0d0d0f; --ok: #4fc08a; --bad: #e8806c;
    }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body {
    background: var(--paper);
    color: var(--ink);
    font: 400 17px/1.5 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    min-height: 100svh;
    display: flex;
    flex-direction: column;
    padding: max(28px, env(safe-area-inset-top)) 24px max(28px, env(safe-area-inset-bottom));
  }
  main { width: 100%; max-width: 27rem; margin: auto; }
  .mark {
    font-size: 13px; letter-spacing: .14em; text-transform: uppercase;
    color: var(--ink-soft); margin: 0 0 2.6rem;
  }
  h1 {
    font-size: clamp(1.95rem, 7.5vw, 2.6rem); line-height: 1.12;
    letter-spacing: -.022em; font-weight: 500; margin: 0 0 1rem;
  }
  .lede { color: var(--ink-soft); margin: 0 0 2.4rem; font-size: 1.0625rem; }
  label { display: block; font-size: .8125rem; letter-spacing: .04em;
          text-transform: uppercase; color: var(--ink-soft); margin-bottom: .55rem; }
  input {
    width: 100%; padding: 1.05rem 1.1rem; font: inherit; font-size: 1.25rem;
    letter-spacing: .01em; color: var(--ink); background: transparent;
    border: 1px solid var(--line); border-radius: 12px;
  }
  input:focus { outline: 2px solid var(--accent); outline-offset: 1px; border-color: transparent; }
  button {
    width: 100%; margin-top: .75rem; padding: 1.05rem 1.1rem; font: inherit;
    font-size: 1.0625rem; font-weight: 500; color: var(--accent-ink);
    background: var(--accent); border: 0; border-radius: 12px; cursor: pointer;
    -webkit-appearance: none;
  }
  button:disabled { opacity: .5; cursor: default; }
  button.ghost {
    color: var(--ink); background: transparent; border: 1px solid var(--line);
  }
  .note { margin-top: 1.1rem; font-size: .9375rem; color: var(--ink-soft); }
  .err { margin-top: .85rem; font-size: .9375rem; color: var(--bad); min-height: 1.4em; }

  /* ── the done panel ── */
  .done { display: none; }
  body[data-state="done"] .start { display: none; }
  body[data-state="done"] .done { display: block; }
  .kicker { font-size: .9375rem; color: var(--ok); margin: 0 0 1.6rem;
            display: flex; gap: .5rem; align-items: baseline; }
  .number {
    display: block; font-size: clamp(2rem, 9vw, 2.9rem); font-weight: 500;
    letter-spacing: -.02em; color: var(--ink); text-decoration: none;
    margin: 0 0 .35rem; font-variant-numeric: tabular-nums;
  }
  .number:active { opacity: .6; }
  .steps { margin: 2rem 0 0; padding: 0; list-style: none; border-top: 1px solid var(--line); }
  .steps li {
    padding: .85rem 0 .85rem 1.9rem; border-bottom: 1px solid var(--line);
    font-size: .9375rem; color: var(--ink-soft); position: relative;
  }
  .steps li::before {
    content: counter(step); counter-increment: step; position: absolute; left: 0;
    font-variant-numeric: tabular-nums; color: var(--ink); font-size: .8125rem;
    top: .95rem;
  }
  .steps { counter-reset: step; }
  .qr {
    margin-top: 2rem; padding-top: 1.6rem; border-top: 1px solid var(--line);
    display: flex; gap: 1.1rem; align-items: center;
  }
  .qr svg { width: 104px; height: 104px; flex: none; border-radius: 8px; background: #fff; padding: 6px; }
  .qr p { margin: 0; font-size: .875rem; color: var(--ink-soft); }
  @media (max-width: 400px) { .qr { display: none; } }
  .cost { margin-top: 1.4rem; font-size: .875rem; color: var(--ink-soft); }
  footer { margin: 3rem auto 0; max-width: 27rem; width: 100%;
           font-size: .8125rem; color: var(--ink-soft); }
  footer a { color: inherit; }
</style>
</head>
<body data-state="start">
<main>
  <p class="mark">Next Mission</p>

  <section class="start">
    <h1>A number you call<br>to decide something.</h1>
    <p class="lede">Put it in your contacts. When you call, it already knows
      you — your phone number is your login. No password, no account, no app.</p>

    <form id="f" novalidate>
      <label for="p">Your phone number</label>
      <input id="p" name="phone" type="tel" inputmode="tel"
             autocomplete="tel" enterkeyhint="go" placeholder="(555) 123-4567"
             aria-describedby="e">
      <button id="go" type="submit">Add Next Mission to my contacts</button>
      <p class="err" id="e" role="alert"></p>
    </form>
    <p class="note">Your number is the only thing we store, and it is stored
      so the agent recognises you. Nothing else leaves the call.</p>
  </section>

  <section class="done" aria-live="polite">
    <p class="kicker"><span>&#10003;</span><span id="k">Your library is ready.</span></p>
    <h1>Call it.</h1>
    <a class="number" id="tel" href="tel:${AGENT_NUMBER}">${SPOKEN_NUMBER}</a>
    <p class="lede" style="margin-bottom:1.5rem">Tap to call, or add the contact
      so it is there when you need it.</p>

    <a id="vcf" href="/next-mission.vcf" download="Next Mission.vcf">
      <button class="ghost" type="button">Add to contacts</button>
    </a>

    <ol class="steps">
      <li>Tap <strong>Add to contacts</strong> &mdash; your phone opens a contact card.</li>
      <li>Hit <strong>Add</strong>. That is the whole install.</li>
      <li>Call it whenever you need to think something through.</li>
    </ol>

    <div class="qr">${qrSvg}<p>On a laptop? Scan this with your phone's camera to
      get the contact onto the phone you actually call from.</p></div>

    <p class="cost" id="cost">Free to add. You pay only for talk time.</p>
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

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var raw = (input.value || '').trim();
    if (!raw) { err.textContent = 'Your number, so it knows you when you call.'; input.focus(); return; }

    err.textContent = '';
    go.disabled = true;
    go.textContent = 'Setting up your library\\u2026';

    fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: raw })
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
      .then(function (res) {
        if (!res.ok) {
          err.textContent = res.body && res.body.message
            ? res.body.message
            : 'That did not look like a phone number. Try it with the area code.';
          return;
        }
        var d = res.body;
        try { localStorage.setItem('nm.phone', d.phone); } catch (_) {}

        if (d.accrued) document.getElementById('cost').textContent = d.accrued;
        if (d.greeting) document.getElementById('k').textContent = d.greeting;
        document.getElementById('vcf').setAttribute('href', d.vcard_url || '/next-mission.vcf');

        body.setAttribute('data-state', 'done');
        window.scrollTo(0, 0);

        // Hand back the vCard immediately — the tap they already made is the
        // tap that installs it. The panel behind it is there for a second go.
        setTimeout(function () {
          window.location.href = d.vcard_url || '/next-mission.vcf';
        }, 350);
      })
      .catch(function () {
        err.textContent = 'Could not reach the server. Try again?';
      })
      .finally(function () {
        go.disabled = false;
        go.textContent = 'Add Next Mission to my contacts';
      });
  });
})();
</script>
</body>
</html>`;
}
