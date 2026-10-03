# Critical path — Supabase Select 2026

**Hard deadline: Saturday Oct 3, 2026, 17:30 PDT.** Clock started 08:00 PDT.
Onsite: 580 20th Street, San Francisco.
Prompt: **"build something agents want."**

> Target submission time **17:00**, not 17:30. The last 30 minutes are buffer, not work.

## Voting categories (9)

| Category | Our coverage |
|---|---|
| Best use of Stripe | **MPP paywall** — agents pay per call, HTTP 402 |
| Best use of Claude | Orchestrator: planning + structured extraction |
| Best use of multimodal AI for Gemini | Live API **native audio** voice |
| Best use of Vercel | Deployed Next.js/Hono + UI |
| Functionality and completeness | One loop, working end to end |
| Innovation and creativity | Agents buying real-world phone capability |
| User experience and design | Live call feed, receipts |
| Impact and usefulness | Capability an agent genuinely cannot do alone |
| Best use of Codex | ✗ not covered (OpenAI) — deliberately skipped |

Covering 8 of 9 with one build. Codex is the only gap; chasing it costs more than it returns.

## Blockers only you can clear (do these first, in this order)

These are serial and gate everything. I cannot do them — they create accounts
and submit forms under your identity.

1. **Team on hackathon.supabase.com** — "Create team" is still live. No team, no
   submission. I could not find a team under your name on page 1 of the list.
   *~3 min. Do this before anything else.*
2. **Where the submission form lives** — find it now, not at 17:00. Note the URL
   and exactly what it asks for (repo? video? URL? length limit?).
   *~3 min.*
3. **Anthropic API key** — https://platform.claude.com/offers/acde68e9-e684-42c2-b25b-fa350b972c91
   redeems $100, then create a key. *~4 min.*
4. **Gemini API key** — https://aistudio.google.com/apikey. Free tier is enough.
   *~2 min.*
5. **Stripe sandbox key + business profile** — dashboard.stripe.com, use a
   **sandbox**. MPP needs a `profile_test_` id. *~6 min, highest risk of surprise.*
6. **Supabase project** — new project, then redeem `SUPAHACK-4QYK-ZH93-P1M8-ZFS4`.
   Provisioning takes a couple of minutes on its own. *~5 min.*
7. **AgentPhone account + one voice number** — agentphone.ai. *~5 min.*

Paste keys into `.env` (copy from `.env.example`). Total ≈ 30 minutes of clicking.

## Deliberately skipped (the 80/20 calls)

- **SMS / iMessage / WhatsApp.** US A2P 10DLC carrier registration runs days to
  weeks. Any demo depending on outbound SMS to a normal number cannot be
  registered in time. **Voice only.** This is the biggest trap in the whole event.
- **Vercel AI Gateway credits + Pro trial.** The redemption form is
  request-and-wait ("Vercel applies the credits after processing") — it may not
  land before 17:30. Deploying on the free tier still counts for Best Use of
  Vercel. Redeem it if there is slack, but never block on it.
- **OpenAI $100 / Codex category.** A second model provider is scope with no
  payoff for the other eight categories.
- **Live-mode Stripe + real money.** Sandbox only. Live mode needs business
  verification and `hostedFeePayer` explicitly excludes it for Connect.
- **Tempo / USDC stablecoin leg of MPP.** Shared Payment Tokens via `link-cli`
  are the shorter path to a working 402. Add Tempo only if the SPT path is
  already green.
- **Auth / multi-tenancy / RLS polish.** One service-role key, one demo tenant.
- **Tests.** `mppx validate` is the only check that earns its time.

## Timeline

| Time | Milestone | Owner |
|---|---|---|
| 11:00–11:30 | Team created, submission form found, all keys in `.env` | **you** |
| 11:00–12:30 | 402 → pay → place call → transcript → structured result, locally | me |
| 12:30–13:30 | Gemini Live native-audio console | me |
| 13:30–14:30 | UI: live call feed, receipts, run inspector | me |
| 14:30–15:30 | Deploy to Vercel, one real end-to-end phone call | both |
| 15:30–16:15 | Seed demo data, dry-run the demo twice | both |
| 16:15–16:50 | Record 2-min video, write submission copy | **you** |
| 16:50–17:00 | **Submit** | **you** |
| 17:00–17:30 | Buffer | — |

## Rules of engagement for the sprint

- **Demo path is sacred.** If a feature is not in the 2-minute demo, it does not
  get built. Write the demo script before the feature list.
- **Deploy at hour 3, not hour 6.** First deploy always breaks. Find out early.
- **Record the video before you think you are ready.** A rough video of a working
  demo beats no video of a perfect one. Judges cannot score what they cannot see.
- **One phone number, one happy path.** Hard-code the scenario. Do not build a
  scenario builder.
- **Seed the database.** A demo with three past calls already in it looks real;
  an empty state looks unfinished.
- **No live phone call in the video.** Record the real call once, then play it
  back. Live telephony on stage fails at the worst moment.
