# Executor brief 10 — Frontend

**Owns:** the visual layer of `src/web/` and any new page components.
Do not change the functional contracts — chat 07 owns the signup/vCard logic,
chat 09 owns the handoff routes. **You are making what exists beautiful, not rebuilding it.**
**Model:** Opus.
**Time box: 40 minutes.** Hackathon ends 17:30.

---

# How you work: like an interior designer, not a contractor

**This is the most important instruction in this brief. Read it twice.**

Max's words: *"I want the agent to act essentially like an interior designer who is giving
me options about the types of fonts. I want it to ask me questions and present me with
options so that I can resonate with what feels right in terms of copy, font, color, and
placement. Rather than making assumptions and building something out that it thinks I want,
I want it to ask me what I want and present me with all of the options — kind of like an
interior designer would if they were helping me design the inside of a home I had just
bought."*

So: **you do not build and then show. You show, he chooses, then you build.**

### What that means concretely

- **Present options in small sets.** Three or four at a time, never a wall. One decision per
  round: fonts, then color, then copy, then placement. He is choosing by resonance, and
  resonance needs room.
- **Show, do not describe.** "A warmer serif" is useless. Render the actual headline in each
  face, side by side, at the real size, with the real words. He has to *see* it to know.
  A single HTML page with the options laid out beats any amount of prose.
- **Name the trade-off in one line per option**, the way a designer does: what it buys, what
  it costs. Not a lecture — a sentence.
- **Have an opinion, and say which one you would pick and why.** An interior designer who
  only fans out swatches is useless. One that says "I'd go with this, because the room gets
  its light from the east" is worth paying. But the choice stays his.
- **Then ask, and wait.** Do not proceed to the next decision until he has answered the
  current one. Do not build the page while waiting.
- **Never assume.** If you are unsure whether something is a taste call, treat it as one.

### The order to walk him through

1. **Type** — the display face carries the personality. Show the actual decision sentence
   set in 3–4 candidates.
2. **Color** — ground and accent. Show the same block in each.
3. **Copy** — the headline and the one-line description. Offer several registers; he has
   strong instincts here and field-tested evidence of what lands.
4. **Placement** — where the phone field sits, how much space above it, what comes first.

He is on the clock, so keep each round tight and move as soon as he answers.

---

## His existing design system — the starting point, not the mandate

He has built multiple landing pages in Claude Code already, so there is a real system here.
**Treat it as the strongest candidate, not as settled.** Open every round with it — "here's
what your existing system would do" — and then show two or three genuine alternatives beside
it. Sometimes the answer is his own system; he should get there by seeing it win, not by
being told it already did.

Read both of these before writing anything:

- **`~/Desktop/Upside-ai/upside-ai-style-guide-v3 (1).html`** — the style guide itself.
  Open it. It documents the color system, typography, buttons, a hero gradient, and
  "dotwork spheres" as a signature element.
- **`~/Desktop/Upside-ai/upside-landing/`** — a working Next.js App Router landing page
  built on it. `components/Hero.tsx`, `Navbar.tsx`, `HowItWorks.tsx`, `FinalCTA.tsx`,
  `Testimonial.tsx`. Read these for how he actually composes a page, not just tokens.

### The tokens, extracted

**Type — three roles, already chosen:**
```
--font-display: 'Playfair Display', Georgia, serif    (600/700, italic 600 available)
--font-body:    'DM Sans', sans-serif                 (300/400/500)
--font-mono:    'DM Mono', monospace
```

**Color:**
```
--cream-light: #FDFCF8   --cream: #FAF8F3   --cream-dark: #F0EDE5
--ink: #1E1D18           --body-text: #2F2B22
--muted-text: #7A7268    --dust: #8B8785    --taupe: #A1998B
--ember: #C4723A         --ember-hot: #FF6300          <- the accent, spend it sparingly
--pine: #3D5247          --terrain: #685743  --charcoal: #34362F
--steel: #4A5568         --titanium: #6B7280
```

**Radius:** sm 4 · md 10 · lg 20 · pill 999
**Shadow:** sm `0 1px 4px rgba(30,29,24,0.08)` · md `0 4px 20px rgba(30,29,24,0.10)` ·
lg `0 12px 48px rgba(30,29,24,0.14)`

Cream ground, ink type, ember as the single accent. That is the identity — hold it.

## What to build, in priority order

### 1. The signup page (highest value — it is the front door)

`src/web/page.ts` already works: phone + email, autofill, vCard. **Keep every bit of that
behaviour and make it beautiful.** Non-negotiable mechanics that must survive:

- `<input type="tel" autocomplete="tel" inputmode="tel">` and the email equivalent, inside
  a real `<form>` — iOS only offers one-tap autofill with exactly this markup
- inputs at **16px or larger**, or Safari zooms on focus and it looks broken
- the vCard served `Content-Type: text/vcard` with `Content-Disposition: inline`

Mobile-first. This is opened on a phone, from a link someone sent. One field, one button,
a lot of space, and the phone number large and tappable afterwards.

### 2. The approval screen

The brief a human scans, edits, and approves. Routes are live from chat 09:
`GET /api/handoff?id=`, `PATCH`/`DELETE /api/handoff/:id/tasks/:tid`,
`POST /api/handoff/:id/approve`, `GET /mcp/info`.

- **The decision at the top, large, in Playfair, in their own words.** This is the emotional
  payload — they are reading something *they* decided. Give it room.
- Task rows underneath, quiet: title, owner, `done_when`.
- The owner control has **three** states — `agent` | `human` | `agent_drafts_human_sends`.
  That middle one is where most of the value sits. Give it a real affordance.
- One approve action, in ember.
- After approval, the `mcp_config` block from `/mcp/info`, monospace, with a copy button.

### 3. A landing section above the signup, only if time remains

His own precedent for a tagline is **"Built to hand off."** — which happens to be exactly
what this product does. Use the real material: the 80-year-old who said it changed his life,
24 real calls, "most people prompt AI; I turn AI on myself to prompt me."

## How he builds

From `upside-landing`: Next.js App Router, components in `components/`, tokens in
`globals.css`, one component per section. Match that composition even though this repo is
Hono rather than Next — the structure and naming should feel like his.

## Hard rules

- **Do not break the vCard or the autofill markup.** Those two are the demo.
- Do not restyle away from cream/ink/ember into something generic.
- Light theme committed — his system is a cream ground, not a dual-theme design. Paint
  backgrounds and colors explicitly so it holds anywhere.
- Test the signup page on a real iPhone in Safari before you call it done.

Report what you changed and what you did not get to.

**And remember the posture above all of it: show options, name the trade-off, say what you'd
pick, then ask and wait. He chooses by resonance. Your job is to make choosing easy, not to
decide for him.**
