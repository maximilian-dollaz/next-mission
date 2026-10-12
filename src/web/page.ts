/**
 * The front door, built for one moment: someone walks past the red phone,
 * scans a QR code, and is looking at this on their iPhone thirty seconds later
 * — without having heard the pitch.
 *
 * So the page answers their questions in the order they come up, and nothing
 * else above the fold:
 *
 *   what is this?   → the line under the name
 *   what would I bring to it?   → the question in the middle
 *   what do I do?   → three steps
 *   go              → one green button, the one their thumb already knows
 *
 * It is laid out like a locked iPhone receiving a call: black, the name in
 * white, and "slide to call" at the bottom. No decline — there is nothing to
 * refuse. Everything that explains *why* lives below the fold, for after.
 *
 * The slider is progressive enhancement over a plain tel: link. iOS only dials
 * from a real user gesture, so a completed slide navigates synchronously inside
 * touchend/mouseup — never after a timeout or a fetch. And the knob IS the
 * tel: link, so a plain tap still dials if the slide ever fails.
 */

import { AGENT_NUMBER, CONTACT_NAME } from './vcard.js';
import { formatForHumans } from './phone.js';

export interface PageOptions {
  /** An inline SVG QR code. Encodes tel:, so a laptop visitor can scan to call. */
  qrSvg: string;
  /** The public origin, e.g. https://nextmissionsi.com. */
  origin: string;
}

export function landingPage({ qrSvg, origin }: PageOptions): string {
  const number = formatForHumans(AGENT_NUMBER);
  const tel = `tel:${AGENT_NUMBER}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#000000">
<meta name="color-scheme" content="dark">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>${CONTACT_NAME}</title>
<meta name="description" content="An AI voice agent that helps you make a decision. Call it, explain the situation, be honest.">
<meta property="og:title" content="${CONTACT_NAME}">
<meta property="og:description" content="An AI voice agent that helps you make a decision.">
<meta property="og:url" content="${origin}">
<style>
  :root{
    --bg:#000; --fg:#fff; --dim:rgba(255,255,255,.62); --faint:rgba(255,255,255,.38);
    --card:#1C1C1E; --line:#2C2C2E; --green:#34C759;
    --sys:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Helvetica Neue",Helvetica,Arial,sans-serif;
  }
  *{box-sizing:border-box}
  html{background:var(--bg)}
  body{margin:0;background:var(--bg);color:var(--fg);font-family:var(--sys);
       -webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%}
  a{color:inherit}

  /* ── the call screen: exactly one viewport tall ── */
  .call-screen{
    min-height:100vh; min-height:100svh;
    max-width:440px; margin:0 auto;
    display:flex; flex-direction:column;
    padding:calc(env(safe-area-inset-top) + 9vh) 24px calc(env(safe-area-inset-bottom) + 28px);
  }

  .caller{text-align:center}
  .caller h1{margin:0;font-size:40px;font-weight:400;letter-spacing:-.6px;line-height:1.1}
  .caller p{margin:10px auto 0;max-width:20em;font-size:17px;line-height:1.35;color:var(--dim)}

  /* the "screenshot on the lock screen": centered in the remaining space */
  .middle{flex:1;display:flex;align-items:center;justify-content:center;padding:28px 0}
  .shot{width:100%;background:var(--card);border-radius:22px;padding:24px 22px 8px;
        box-shadow:0 0 0 .5px rgba(255,255,255,.08)}
  .shot .q{margin:0 0 18px;font-size:23px;font-weight:600;line-height:1.25;letter-spacing:-.3px;text-wrap:balance}
  .steps{list-style:none;margin:0;padding:0}
  .steps li{display:flex;align-items:center;gap:14px;padding:14px 0;border-top:.5px solid var(--line);font-size:18px}
  .steps .n{flex:none;width:28px;height:28px;border-radius:50%;background:#2C2C2E;color:var(--dim);
            display:grid;place-items:center;font-size:14px;font-weight:600}

  /* slide to call */
  .slide{position:relative;height:76px;border-radius:38px;background:rgba(255,255,255,.16);
         -webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);touch-action:pan-y;
         -webkit-user-select:none;user-select:none}
  .slide .txt{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
              padding-left:60px;font-size:21px;letter-spacing:-.2px;pointer-events:none;
              background:linear-gradient(90deg,rgba(255,255,255,.42) 0%,rgba(255,255,255,.42) 38%,#fff 50%,rgba(255,255,255,.42) 62%,rgba(255,255,255,.42) 100%);
              background-size:250% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;
              animation:shine 2.6s linear infinite;transition:opacity .15s}
  @keyframes shine{0%{background-position:100% 0}100%{background-position:-50% 0}}
  .knob{position:absolute;top:5px;left:5px;width:66px;height:66px;border-radius:50%;background:var(--green);
        display:grid;place-items:center;text-decoration:none;touch-action:none;cursor:grab;
        box-shadow:0 2px 10px rgba(0,0,0,.35);will-change:transform}
  .knob.snap{transition:transform .28s cubic-bezier(.2,.9,.3,1)}
  .knob svg{width:30px;height:30px;fill:#fff;pointer-events:none}
  .knob:focus-visible{outline:3px solid #fff;outline-offset:4px}
  .number{display:block;text-align:center;margin-top:14px;font-size:15px;color:var(--faint);text-decoration:none}

  .more-hint{display:block;text-align:center;margin-top:22px;font-size:13px;color:var(--faint);text-decoration:none}

  /* ── below the fold: for after they've tried it ── */
  .more{max-width:440px;margin:0 auto;padding:40px 16px calc(env(safe-area-inset-bottom) + 56px)}
  .more h2{font-size:28px;font-weight:700;letter-spacing:-.3px;margin:0 8px 18px}
  .sec{margin:0 0 16px}
  .sec .h{font-size:13px;letter-spacing:.02em;text-transform:uppercase;color:#8E8E93;padding:0 16px 7px}
  .sec .b{background:var(--card);border-radius:14px;padding:14px 16px;font-size:17px;line-height:1.4}
  .sec .b em{font-style:normal;color:var(--fg);font-weight:600}
  .save{display:flex;align-items:center;justify-content:center;gap:9px;margin:26px 0 0;height:54px;
        border-radius:14px;background:var(--card);text-decoration:none;font-size:17px;color:var(--green);font-weight:600}
  .save svg{width:20px;height:20px;fill:var(--green)}
  .foot{text-align:center;color:var(--faint);font-size:13px;margin-top:30px}

  /* laptops: you can't dial from here, so hand them a QR that dials from their phone */
  .desk{display:none}
  @media (hover:hover) and (pointer:fine) and (min-width:760px){
    .desk{display:flex;align-items:center;gap:16px;margin-top:18px;padding:14px;border-radius:16px;background:var(--card)}
    .desk .qr{flex:none;width:96px;height:96px;background:#fff;border-radius:10px;padding:6px}
    .desk .qr svg{width:100%;height:100%;display:block}
    .desk p{margin:0;font-size:14px;line-height:1.4;color:var(--dim)}
  }

  @media (prefers-reduced-motion:reduce){.slide .txt{animation:none;color:#fff;background:none}}
</style>
</head>
<body>

<main class="call-screen">
  <header class="caller">
    <h1>${CONTACT_NAME}</h1>
    <p>An AI voice agent that helps you make a decision.</p>
  </header>

  <section class="middle" aria-label="How to use it">
    <div class="shot">
      <p class="q">What have you been going back and forth on?</p>
      <ol class="steps">
        <li><span class="n">1</span>Call ${CONTACT_NAME}.</li>
        <li><span class="n">2</span>Explain the situation.</li>
        <li><span class="n">3</span>Be honest.</li>
      </ol>
      <div class="desk">
        <div class="qr" aria-hidden="true">${qrSvg}</div>
        <p>On a computer? Scan this with your iPhone camera and it will offer to call ${CONTACT_NAME}.</p>
      </div>
    </div>
  </section>

  <div class="slide" id="slide">
    <span class="txt">slide to call</span>
    <a class="knob" id="knob" href="${tel}" aria-label="Call ${CONTACT_NAME} at ${number}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg></a>
  </div>
  <a class="number" href="${tel}">${number}</a>
  <a class="more-hint" href="#more">How is this different?</a>
</main>

<section class="more" id="more">
  <h2>After you call</h2>

  <div class="sec"><div class="h">How is this different from ChatGPT?</div>
    <div class="b">ChatGPT answers you. <em>${CONTACT_NAME} asks you.</em> It won&#8217;t give you advice &#8212; it asks questions until the answer you already have becomes obvious.</div></div>

  <div class="sec"><div class="h">What should I bring to it?</div>
    <div class="b">Anything you&#8217;ve been going back and forth on. It can be small &#8212; you don&#8217;t have to start with the big one. It has a way of finding what&#8217;s underneath.</div></div>

  <div class="sec"><div class="h">Do I have to know what to say?</div>
    <div class="b">No. It starts by asking you a question. Give it as much of the situation as you can &#8212; <em>your only job is to be honest.</em></div></div>

  <div class="sec"><div class="h">What do I walk away with?</div>
    <div class="b">A decision in your own words, and the next step. If you use an AI assistant, ${CONTACT_NAME} can hand that step to it.</div></div>

  <div class="sec"><div class="h">Who hears this?</div>
    <div class="b">Only you. Your call is saved to a private library that belongs to you, and deleted from the voice provider.</div></div>

  <a class="save" href="/next-mission.vcf"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4z"/></svg>Save ${CONTACT_NAME} to contacts</a>

  <p class="foot">${number}</p>
</section>

<script>
(function () {
  var track = document.getElementById('slide');
  var knob = document.getElementById('knob');
  var txt = track.querySelector('.txt');
  var TEL = knob.getAttribute('href');
  var startX = 0, x = 0, max = 0, dragging = false, moved = false;

  function maxX() { return track.clientWidth - knob.offsetWidth - 10; }
  function set(v) {
    x = Math.max(0, Math.min(v, max));
    knob.style.transform = 'translateX(' + x + 'px)';
    txt.style.opacity = String(1 - Math.min(1, x / (max * 0.6)));
  }
  function begin(clientX) {
    max = maxX(); startX = clientX - x; dragging = true; moved = false;
    knob.classList.remove('snap');
  }
  function move(clientX) {
    if (!dragging) return;
    var v = clientX - startX;
    if (Math.abs(v) > 6) moved = true;
    set(v);
  }
  // Must run synchronously inside the touchend / mouseup handler:
  // iOS only dials tel: from a live user gesture.
  function end() {
    if (!dragging) return;
    dragging = false;
    knob.classList.add('snap');
    if (moved && x >= max * 0.72) {
      set(max);
      window.location.href = TEL;
      setTimeout(function () { set(0); }, 1200);
    } else {
      set(0);
    }
  }

  knob.addEventListener('touchstart', function (e) { begin(e.touches[0].clientX); }, { passive: true });
  knob.addEventListener('touchmove', function (e) { if (dragging) { e.preventDefault(); move(e.touches[0].clientX); } }, { passive: false });
  knob.addEventListener('touchend', end);
  knob.addEventListener('touchcancel', function () { dragging = false; knob.classList.add('snap'); set(0); });

  knob.addEventListener('mousedown', function (e) { e.preventDefault(); begin(e.clientX); });
  window.addEventListener('mousemove', function (e) { move(e.clientX); });
  window.addEventListener('mouseup', end);

  // A drag must not also fire the link; a plain tap still dials.
  knob.addEventListener('click', function (e) { if (moved) { e.preventDefault(); moved = false; } });
  window.addEventListener('resize', function () { max = maxX(); if (x) set(0); });
})();
</script>
</body>
</html>`;
}
