# Executor brief 07 — The front door

**Owns:** `app/` (or `src/web/`), `api/signup/`, `api/retell-webhook/`, `src/billing/`.
Do not touch `src/voice/` (04), `src/brain/` (06), `src/mpp/` (03), `prompts/`.
**Model:** Sonnet.
**Deadline: 16:40 PDT.** Hackathon ends 17:30 and Max submits at 17:00.

## The whole product, in one flow

> Open the URL → type your phone number → one tap → **Next Mission is in your contacts** →
> you call it → it already knows you.

No password. No account. No app. **The phone number is the identity.**

## 1. The page

One page, deployed on Vercel (project `next-mission` is already linked, and
next-mission-nu.vercel.app serves 200). Mobile-first — it will be opened on a phone.

- One field: phone number. Normalise to E.164. Accept pasted junk gracefully.
- One button. On submit: provision (step 2), then hand back a **vCard**.
- The vCard (`text/vcard`, `Content-Disposition: attachment; filename="Next Mission.vcf"`)
  contains `TEL:+12722297451` and `FN:Next Mission`. iOS Safari renders a contact card with
  an Add button; Android Chrome downloads it and the user opens it. Test on a real phone,
  not a desktop emulator — this is the one interaction that must not be clunky.
- Desktop fallback: show a **QR code** of the same vCard (or a `tel:` link) so someone on a
  laptop can still get it onto their phone. Judges will be on laptops.
- After submit, show the number in large type with a `tel:` link, so they can call
  immediately without the contact step if they prefer.

Keep it quiet and confident. One field, one button, lots of space. This is the first thing
a judge sees — it should feel like a product, not a form.

## 2. Provisioning — "the database is created on their behalf"

On submit, create that user's library in Supabase, keyed to their E.164 number:

- a `users` row (phone as the natural key)
- their GBrain-schema rows / namespace — **coordinate with chat 06, which owns `src/brain/`
  and the GBrain schema. Call its provisioning function; do not invent a second schema.**
- strict per-user isolation via RLS, so one user's rows are unreachable by any other

This is the honest version of "each user gets their own database": one Supabase project,
their own isolated store, exportable and purgeable by them alone. Do **not** attempt
per-project provisioning through the Supabase Management API — it takes ~2 minutes per
signup and is the wrong architecture.

## 3. Caller ID is the login

Retell's `call_ended` webhook carries `from_number`. Match it to the `users` row, load that
person's library, and attach the session to them. A caller we have never seen gets a new
row created on the fly — the flow must never fail because someone called before signing up.

**Privacy:** the agent is being set to `data_storage_setting: "basic_attributes_only"`,
which means **Retell retains no transcript and no recording.** So the webhook payload is
the only copy that will ever exist — capture it in flight and write it straight to the
user's store. There is no deletion step because there is no retention. Chat 06 owns that
pipeline; your job is to make sure the webhook is wired, authenticated, and never drops a
payload.

## 4. Stripe — usage-based, charged by talk time

This is Max's own model (idea F1): *"completely free to download, paid only by talk time."*

Use **Stripe Billing meters** (metered usage), not MPP — MPP is the separate agent-to-agent
rail chat 03 owns for the decision brief, and the two must not be confused:

- a meter for call seconds
- on `call_ended`, report a usage event with the call duration against that customer
- surface the accrued amount on the page: "you've used 4m 12s — $1.01"

**Do not build card collection into the signup flow.** It would wreck the one-tap UX and
Max cannot hand you payment details. For today: create the Stripe customer, meter real
usage, and show the running cost. If there is spare time, add a Stripe Checkout link as a
separate "add a card" action — never in the main path.

Stripe keys are in `.env` (sandbox) and verified working.

## Priority if you run out of time

1. The page + vCard + the number working — **this alone is the demo's front door**
2. Provisioning on submit
3. Caller-ID matching in the webhook
4. Stripe metering
5. The running-cost display

Ship 1 and 2 even if 4 and 5 never land.

## Report

Tell the orchestrator chat when the vCard installs on a real phone, and when a signup
creates a library row. By 16:40 regardless. Max optimises for simplicity and clarity; make
no creative decisions, surface options and ask in normal chat.
