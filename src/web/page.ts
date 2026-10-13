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
 * Black, white text, one green bar at the bottom of the screen. No boxes, no
 * name, nothing to fill in. Everything that explains *why* lives below the
 * fold, for after they have tried it.
 *
 * No JavaScript: the bar is a plain tel: link. On iOS that is the only thing
 * that reliably dials, and the thing least likely to break.
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

  /* ── the call screen: exactly one viewport tall ──
     The text block sits at the optical center (a little above the middle),
     where the eye lands first on a phone; the button sits in the thumb zone. */
  .call-screen{
    min-height:100vh; min-height:100svh;
    max-width:440px; margin:0 auto;
    display:flex; flex-direction:column;
    padding:calc(env(safe-area-inset-top) + 16px) 28px calc(env(safe-area-inset-bottom) + 24px);
  }
  .above{flex:1 1 0}
  .below{flex:1.4 1 0}

  .content{text-align:center}
  .content h1{
    margin:0 auto; max-width:12.5em;
    font-size:clamp(28px, 7.8vw, 34px); font-weight:600; line-height:1.16; letter-spacing:-.5px;
    color:#fff; text-wrap:balance;
  }

  /* centered as a block, left-aligned inside so the numbers line up */
  .steps{list-style:none; margin:40px auto 0; padding:0; width:fit-content; text-align:left}
  .steps li{font-size:clamp(19px, 5.2vw, 21px); line-height:1.3; padding:7px 0; color:#fff; font-weight:400}
  .steps .n{display:inline-block; min-width:1.6em; color:#fff; font-weight:600; font-variant-numeric:tabular-nums}

  /* the one button: a green pill across the bottom */
  .bar{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:62px;
       border-radius:31px;background:var(--green);color:#fff;text-decoration:none;
       font-size:19px;font-weight:600;letter-spacing:-.2px;-webkit-tap-highlight-color:transparent;
       transition:transform .1s, filter .1s}
  .bar svg{width:22px;height:22px;fill:#fff}
  .bar:active{transform:scale(.98);filter:brightness(.92)}
  .bar:focus-visible{outline:3px solid #fff;outline-offset:4px}

  .more-hint{display:block;text-align:center;margin-top:22px;font-size:13px;color:var(--faint);text-decoration:none}

  /* ── below the fold: for after they've tried it ── */
  .more{max-width:440px;margin:0 auto;padding:40px 16px calc(env(safe-area-inset-bottom) + 56px)}
  .more h2{font-size:28px;font-weight:700;letter-spacing:-.3px;margin:0 8px 18px}
  .sec{margin:0 0 26px}
  .sec .h{font-size:13px;letter-spacing:.02em;text-transform:uppercase;color:#8E8E93;padding:0 16px 7px}
  .sec .b{padding:0 16px;font-size:17px;line-height:1.45;color:var(--dim)}
  .sec .b em{font-style:normal;color:var(--fg);font-weight:600}
  .save{display:flex;align-items:center;justify-content:center;gap:8px;margin:30px 0 0;
        text-decoration:none;font-size:17px;color:var(--green);font-weight:600}
  .save svg{width:20px;height:20px;fill:var(--green)}
  .foot{text-align:center;color:var(--faint);font-size:13px;margin-top:30px}

  /* laptops: you can't dial from here, so hand them a QR that dials from their phone */
  .desk{display:none}
  @media (hover:hover) and (pointer:fine) and (min-width:760px){
    .desk{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:30px;text-align:left}
    .desk .qr{flex:none;width:96px;height:96px;background:#fff;border-radius:10px;padding:6px}
    .desk .qr svg{width:100%;height:100%;display:block}
    .desk p{margin:0;font-size:14px;line-height:1.4;color:var(--dim)}
  }

  @media (prefers-reduced-motion:reduce){.bar{transition:none}}
</style>
</head>
<body>

<main class="call-screen">
  <div class="above"></div>

  <section class="content">
    <h1>This is a voice agent that helps you make a decision</h1>
    <ol class="steps">
      <li><span class="n">1.</span>Call</li>
      <li><span class="n">2.</span>Explain the situation</li>
      <li><span class="n">3.</span>Be honest</li>
    </ol>
    <div class="desk">
      <div class="qr" aria-hidden="true">${qrSvg}</div>
      <p>On a computer? Scan this with your iPhone camera and it will offer to call.</p>
    </div>
  </section>

  <div class="below"></div>

  <a class="bar" href="${tel}" aria-label="Try now — call ${number}">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
    Try now
  </a>
</main>

<section class="more" id="more">
  <h2>After you call</h2>

  <div class="sec"><div class="h">How is this different from ChatGPT?</div>
    <div class="b">ChatGPT answers you. <em>This asks you.</em> It won&#8217;t give you advice &#8212; it asks questions until the answer you already have becomes obvious.</div></div>

  <div class="sec"><div class="h">What should I bring to it?</div>
    <div class="b">Anything you&#8217;ve been going back and forth on. It can be small &#8212; you don&#8217;t have to start with the big one. It has a way of finding what&#8217;s underneath.</div></div>

  <div class="sec"><div class="h">Do I have to know what to say?</div>
    <div class="b">No. It starts by asking you a question. Give it as much of the situation as you can &#8212; <em>your only job is to be honest.</em></div></div>

  <div class="sec"><div class="h">What do I walk away with?</div>
    <div class="b">A decision in your own words, and the next step. If you use an AI assistant, it can hand that step to it.</div></div>

  <div class="sec"><div class="h">Who hears this?</div>
    <div class="b">Only you. Your call is saved to a private library that belongs to you, and deleted from the voice provider.</div></div>

  <a class="save" href="/next-mission.vcf"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4z"/></svg>Save to contacts</a>

  <p class="foot">${number}</p>
</section>

</body>
</html>`;
}
