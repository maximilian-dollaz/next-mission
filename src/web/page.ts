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
    position:relative;
    min-height:100vh; min-height:100svh;
    max-width:440px; margin:0 auto;
    display:flex; flex-direction:column;
    padding:calc(env(safe-area-inset-top) + 16px) 24px calc(env(safe-area-inset-bottom) + 64px);
  }
  /* Balanced: equal space above and below the group, measured between the top
     of the screen and the arrow. Inside the group, the two gaps are equal too. */
  .above{flex:1 1 0}
  .below{flex:1 1 0}

  .content{text-align:center}
  /* Two lines, always. The longer line is 11.5em wide, so the size is derived
     from the screen width and can never force a third line. */
  .content h1{
    margin:0; font-weight:600; line-height:1.15; letter-spacing:-.4px; color:#fff;
    font-size:min(32px, calc((100vw - 48px) / 12));
  }
  .content h1 span{display:block; white-space:nowrap}

  /* centered as a block, left-aligned inside so the numbers line up */
  .steps{list-style:none; margin:34px auto 0; padding:0; width:fit-content; text-align:left}
  .steps li{font-size:clamp(19px, 5.2vw, 21px); line-height:1.3; padding:6px 0; color:#fff; font-weight:400}
  .steps .n{display:inline-block; min-width:1.6em; color:#fff; font-weight:600; font-variant-numeric:tabular-nums}

  /* the one button: a green pill across the bottom */
  .bar{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:62px;margin-top:34px;
       border-radius:31px;background:var(--green);color:#fff;text-decoration:none;
       font-size:19px;font-weight:600;letter-spacing:-.2px;-webkit-tap-highlight-color:transparent;
       transition:transform .1s, filter .1s}
  .bar svg{width:22px;height:22px;fill:#fff}

  /* ── on a phone, each element is pinned to where the body already is ──
     Percentages of the visible screen (100svh, Safari's bars excluded):
       30%   the headline's center: the upper third, where the eye lands first
       75%   the button's center: the resting arc of a one-handed thumb
             (about two-thirds down the physical glass on an iPhone 15)
       52.5% the list's center: halfway between them. The headline and the
             button are within 4px of the same height, so halfway between their
             centers is also halfway between the headline's last line and the
             button's top edge. */
  .call-screen{height:100vh; height:100svh}
  .content h1,.steps,.bar{position:absolute; margin:0; transform:translateY(-50%)}
  .content h1{top:30%; left:24px; right:24px}
  .steps{top:52.5%; left:50%; transform:translate(-50%,-50%); width:max-content; white-space:nowrap}
  .bar{top:75%; left:24px; right:24px; width:auto}

  /* a laptop, or a phone on its side: too short to pin, so stack them */
  @media (hover:hover) and (pointer:fine) and (min-width:760px), (max-height:520px){
    .call-screen{height:auto}
    .content h1,.steps,.bar{position:static; transform:none}
    .steps{margin:34px auto 0}
    .bar{margin-top:34px; width:100%}
  }
  .bar:active{transform:scale(.98);filter:brightness(.92)}
  .bar:focus-visible{outline:3px solid #fff;outline-offset:4px}

  /* a faint V just above Safari's address bar: there's more below */
  html{scroll-behavior:smooth}
  .down{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + 8px);transform:translateX(-50%);
        width:44px;height:44px;display:flex;align-items:center;justify-content:center;
        -webkit-tap-highlight-color:transparent;animation:blink 2.4s ease-in-out infinite}
  .down svg{width:24px;height:12px;fill:none;stroke:#fff;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
  @keyframes blink{0%,100%{opacity:.14}50%{opacity:.45}}

  /* ── below the fold: for after they've tried it ── */
  .more{max-width:440px;margin:40vh auto 0;padding:48px 24px calc(env(safe-area-inset-bottom) + 56px)}
  .sec{margin:0 0 40px}
  .sec .h{margin:0 0 10px;font-size:20px;font-weight:600;line-height:1.25;letter-spacing:-.2px;color:var(--fg)}
  .sec .b{margin:0;font-size:17px;line-height:1.5;color:var(--dim)}
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

  @media (prefers-reduced-motion:reduce){.bar{transition:none}.down{animation:none;opacity:.3}html{scroll-behavior:auto}}
</style>
</head>
<body>

<main class="call-screen">
  <div class="above"></div>

  <section class="content">
    <h1><span>This is a voice agent that</span> <span>helps you make a decision</span></h1>
    <ol class="steps" role="list">
      <li><span class="n">1.</span>Call</li>
      <li><span class="n">2.</span>Explain the situation</li>
      <li><span class="n">3.</span>Be honest</li>
    </ol>
<a class="bar" href="${tel}" aria-label="Try now — call ${number}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
      Try now
    </a>
    <div class="desk">
      <div class="qr" aria-hidden="true">${qrSvg}</div>
      <p>On a computer? Scan this with your iPhone camera and it will offer to call.</p>
    </div>
  </section>

  <div class="below"></div>

  <a class="down" href="#more" aria-label="More about this"><svg viewBox="0 0 24 12" aria-hidden="true"><polyline points="2,2 12,10 22,2"/></svg></a>
</main>

<section class="more" id="more">
  <div class="sec"><h2 class="h">How is this any different than ChatGPT?</h2>
    <p class="b">Right now, it&#8217;s not; this is a prompt you can run on ChatGPT. The idea is to think about AI counterintuitively: having it prompt you instead of you prompting it.</p></div>

  <div class="sec"><h2 class="h">What&#8217;s the premise?</h2>
    <p class="b">When it comes to determining your next mission, you are the source of the answer. It cannot be found outside, only revealed within. AI acts as an ego-less mirror, reflecting yourself back to you, helping you see the truth.</p></div>

  <div class="sec"><h2 class="h">What problem is this solving?</h2>
    <p class="b">Fear-based decision making, clouded by ego-based judgements and misperceptions.</p></div>

  <div class="sec"><h2 class="h">What&#8217;s the point?</h2>
    <p class="b">To make better, faster, more aligned decisions.</p></div>

  <a class="save" href="/next-mission.vcf"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4z"/></svg>Save to contacts</a>

  <p class="foot">${number}</p>
</section>

</body>
</html>`;
}
