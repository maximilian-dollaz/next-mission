# Keys checklist

Use `mkmuzones@gmail.com` everywhere. Target: done in 20 minutes.

**First, make the file you'll paste into:**

```bash
cd "/Users/maxmuzones/Hackathon 10-3-2026" && cp .env.example .env && open -e .env
```

Order matters: step 1 provisions in the background while you do 2–4.

---

## 1. Supabase — do this first, it provisions while you work

1. Go to https://supabase.com/dashboard → **New project**
2. Name it `next-mission`, pick **West US (North California)** (closest to SF, lowest latency)
3. Generate a database password — let the browser save it
4. Click **Create new project**. It provisions for ~2 minutes. **Leave the tab open and move on to step 2.**
5. Come back, then → **Project Settings → API keys**, copy:
   - Project URL → `SUPABASE_URL`
   - `anon` `public` key → `SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
6. Redeem credits: **Organization Settings → Billing → Credits → Redeem code**
   → `SUPAHACK-4QYK-ZH93-P1M8-ZFS4`

> The `service_role` key bypasses all row-level security. Server-side only — never in the
> browser, never pasted into a model prompt.

---

## 2. Stripe — the one most likely to surprise you

1. Go to https://dashboard.stripe.com
2. Top-left account switcher → **Sandboxes** → **Create sandbox**, name it `next-mission`.
   Stay in the sandbox for the whole hackathon.
3. **Developers → API keys** → reveal the **Secret key** (`sk_test_...`)
   → `STRIPE_SECRET_KEY`
4. You also need a business profile ID. Once the key is in `.env`, run:

```bash
cd "/Users/maxmuzones/Hackathon 10-3-2026" && set -a && . ./.env && set +a && curl -s https://api.stripe.com/v2/network/business_profiles/me -u "$STRIPE_SECRET_KEY:" -H "Stripe-Version: 2026-07-29.preview"
```

   Copy the `id` (starts with `profile_test_`) → `STRIPE_PROFILE_ID`.
   If that returns an error, tell the orchestrator chat the exact message — it means the
   sandbox needs a profile created first, and that path changes.

---

## 3. Anthropic — $100 credit

1. Open the offer link:
   https://platform.claude.com/offers/acde68e9-e684-42c2-b25b-fa350b972c91
2. Sign in, accept the credit. Confirm the balance shows under **Billing**.
3. **API keys → Create key**, name it `next-mission`. Copy it once — it is never shown
   again → `ANTHROPIC_API_KEY`

---

## 4. Google AI Studio — Gemini voice (fastest, ~2 min)

1. Go to https://aistudio.google.com/apikey (same Google account)
2. **Create API key** → pick or create a project → copy → `GEMINI_API_KEY`
3. No billing needed. The free tier covers a one-day demo.

---

## 5. Optional — only if you have slack

**Vercel ($30 AI Gateway + Pro trial).** Request-and-wait, so it may not land before 17:30.
Deploying on the free tier still counts for Best Use of Vercel.
1. vercel.com → your team → **Settings → General** → copy **Team ID** (starts with `team_`)
2. https://credits.vercel.sh → email + Team ID + code `SUPASELE-4T9F-SM6E` → **Redeem Code**

**OpenAI ($100).** Only if chasing Best Use of Codex, which the plan skips.
`platform.openai.com/p/5FZKYNYPFCYUZSLQ`

---

## Verify, then you're done

```bash
cd "/Users/maxmuzones/Hackathon 10-3-2026" && set -a && . ./.env && set +a && for k in ANTHROPIC_API_KEY GEMINI_API_KEY SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY STRIPE_SECRET_KEY STRIPE_PROFILE_ID; do [ -n "${(P)k}" ] && echo "ok   $k" || echo "MISSING $k"; done
```

Six `ok` lines means executor chats 02–05 are unblocked.

**AgentPhone is not on this list.** It only matters if you choose a phone surface over a
browser voice surface (decision D5). Skip it until that's decided.
