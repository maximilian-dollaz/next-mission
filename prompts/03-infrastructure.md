# Executor brief 03 — Infrastructure and tool wiring

**Owns:** `src/db/`, `src/mpp/`, `supabase/`, `scripts/`, `.env.example`, deploy config.
Do not touch `src/voice/`, `docs/research/`, or `docs/findings/` — other chats own those.
**Model:** Sonnet.
**Time box:** working deploy by **14:30 PDT**. Hackathon ends **17:30 PDT today**.

## Your job

Make the plumbing real and get it on the internet early. You are the reason the demo does
not die at 17:00. **Deploy a hello-world to Vercel in your first 30 minutes**, before
building anything — first deploys always break and you want to know now.

Repo: `/Users/maxmuzones/Hackathon 10-3-2026`. Already installed: `mppx@0.9.3`,
`stripe@19.3.0`, `@supabase/supabase-js`, `@anthropic-ai/sdk`, `hono`, `tsx`.
CLIs available: `supabase`, `stripe`, `cloudflared`, `gh`.
Read `docs/ROADMAP.md` and `docs/CRITICAL-PATH.md` first. Keys go in `.env` (see
`.env.example`); Max is populating them now — build against missing keys gracefully and
fail with a clear message rather than a stack trace.

## 1. Supabase — the context library

Schema lives in `supabase/migrations/`. Tables, at minimum:

- `sessions` — one voice conversation. Timestamps, duration, status, the phase it reached.
- `turns` — transcript, speaker, timestamp, ordered. This is the context library's raw material.
- `context_items` — the durable library: themes, people, commitments, prior decisions,
  extracted from turns. Carries a source reference back to the turn that produced it.
- `decisions` — the output artifact. The decision in the person's own words, the one next
  action, the reasoning, and a `dispatched_at`.
- `receipts` — MPP payments: amount, cadence, payer, Stripe reference.

Two design requirements, both load-bearing to the pitch:

**Destroy-on-exit.** A session must be deletable such that the raw transcript is gone and
only the user-owned context items the person chose to keep remain. Implement it as a real
callable operation, not a flag. This is a demoable moment — make it work.

**User-owned and portable.** A single export call returns one person's entire context
library as portable JSON. Nothing in the schema should make that hard.

Enable RLS with sensible policies. One demo tenant is fine; do not build multi-tenancy.
Service-role key is server-only — never shipped to a browser, never put into a model prompt.

## 2. Stripe MPP — metered talk time, settled on the brief

This carries Best Use of Stripe, so it has to actually work, not be a stub.

Follow `https://docs.stripe.com/payments/machine/mpp/quickstart` — fetch it, do not work
from memory. The shape:

```ts
import { Mppx, stripe } from 'mppx/server';
```
Build an HTTP 402 challenge endpoint, verify payment, return the resource with a receipt.
`STRIPE_PROFILE_ID` is the `networkId`. Use the **sandbox** key all day; `livemode` is
derived from whether the key contains `_test_`.

Pricing model, already decided (idea F1): **talk time streams in sub-cent increments; the
decision brief is the settlement event.** Shared Payment Tokens are the shorter path — do
SPT first and get it green. Add the Tempo/USDC stablecoin leg only once SPT validates.

Write `scripts/stripe-profile.ts` (fetch and print the `profile_` id) and
`scripts/tempo-deposit-address.ts`, wired to the `mpp:profile` and `mpp:deposit` npm scripts
that already exist in `package.json`.

**Self-grade with `npx mppx@latest validate http://localhost:4242`.** It tests discovery,
challenge format, error handling and the full payment round trip. Do not report MPP working
until validate passes — paste its output into your summary.

## 3. Deploy

Vercel. Free tier is fine and still counts for the category — do not block on the credit
redemption, which is request-and-wait. Set env vars in the Vercel project. Confirm the
deployed URL serves the 402 challenge correctly, not just localhost.

## 4. Interfaces other chats depend on

Publish these early and tell the orchestrator chat the moment they exist, because 04, 05
and 06 are waiting on them:

- a typed `Session` / `Turn` / `Decision` module other code imports
- a function to append a turn, used by the voice chat
- a function to write a decision, used by the brief chat
- the export and destroy operations

Keep them small and boring. Other chats must not have to read your internals.

## Report back

When done, or at 14:30 whichever is first: what works, what does not, the deployed URL,
the `mppx validate` output, and anything that needs a decision from Max. Max optimises for
simplicity and clarity — tell him plainly what is green and what is not. Make no creative
decisions; surface options instead. Ask questions in normal chat.
