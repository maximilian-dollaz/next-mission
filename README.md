# Next Mission

**A specialist decision-making agent. You call it, it walks you to a decision you
actually believe, and then it hands your own agent an executable brief.**

Built for the Supabase Select 2026 Hackathon. The prompt was *"build something agents
want."*

---

## Try it in thirty seconds

**Call `+1 (272) 229-7451`.** Bring something you're genuinely undecided about.

Or open **https://next-mission-nu.vercel.app**, type your number, and tap once — the
contact installs on your phone and you call it from there. No password, no account, no
app. **Your phone number is your login.**

### Connect your own agent

```bash
claude mcp add --transport http next-mission https://next-mission-nu.vercel.app/mcp
```

Then ask it to `get_decision` and `list_tasks`. It will see the brief from the call — but
only after a human has approved it.

---

## Why an agent wants this

An agent can do almost anything for its human except the one thing that gates all of it:
**decide.** It can't know what you actually want. So it waits, or it guesses, or it asks a
question you don't have the energy to answer.

This is the piece that was missing. A human talks to a specialist agent for as long as it
takes; out comes a decision in their own words plus a task set written for a machine. Their
own generalist agent — the one that already holds all their tools — picks it up and goes.

The service is deliberately narrow. It does not execute anything. It produces conviction,
and conviction is the input every other agent is starving for.

## The mechanism

A person holds about four things in working memory (Cowan, 2001 — not Miller's seven). A
real decision has more than four. That is why decisions feel heavy: not because they're
hard, but because they don't fit.

So the agent never puts the whole decision in front of you. It holds **two things against
each other at a time**, in an order where each answer makes the next question easier, until
one side is obviously yours. Pairwise comparison and even-swaps, delivered as plain
curiosity — it never names a framework, and you never hear the machinery.

It also refuses to decide for you. That limitation is the product: it can help you find
your truth precisely because it cannot determine it.

## What happens to a call

```
you call  →  conversation  →  decision in your words  →  brief + task set
                                                              ↓
                                            you approve it  (nothing moves until you do)
                                                              ↓
                                               your own agent picks it up over MCP
```

Alongside that, every call is destroyed at the voice provider and kept only in your library:

1. Fetch the transcript and recording from Retell
2. Extract the decision, the next action, and what's worth remembering
3. Write it into your own context library
4. `DELETE` the call at Retell
5. Re-request it and show the 404

**The recording and transcript exist in exactly one place: your database.** Capture is
verified before deletion — never the other way round.

What is honestly true: the live audio passes through a voice provider and a model in real
time. Nothing is retained, nothing is trained on, and you hold the only durable copy —
portable, correctable, withdrawable. That is a different and more defensible claim than
"it never touches a third party," and it is the one this code actually supports.

## Priced like it's used

Free to install. **Metered by talk time**, in sub-cent increments, via Stripe. You pay for
the minutes you spend and the brief you get, not a seat you forgot about.

## Layout

| Path | What lives there |
|---|---|
| `src/web/` | the front door — signup, vCard, caller-ID webhook |
| `src/brain/` | the context library and the capture-then-destroy pipeline |
| `src/handoff/` | decision → task set, and the approval gate |
| `src/mcp/` | the MCP server your agent connects to |
| `src/voice/` | a Gemini Live native-audio surface, as a second way in |
| `src/mpp/`, `src/billing/` | Stripe machine payments and usage metering |
| `src/phone/` | prompt push, call capture, rehearsal harness |
| `prompts/` | the agent's system prompt, and the brief for every workstream |
| `docs/` | the research the conversation design rests on |

`docs/research/02-decision-protocol.md` is the protocol itself.
`docs/findings/01-conversation-principles.md` is the analysis of 112 real calls on the
previous version that it was derived from.

## Running it

```bash
npm install
cp .env.example .env     # fill in the keys
npm run dev
```

`APPLY-THIS-IN-SUPABASE.sql` is the whole schema in one paste.

## Built with

Supabase (the context library) · Stripe (machine payments and metered billing) ·
Claude (the brief) · Retell (voice) · Google Gemini (the native-audio surface) ·
Vercel (hosting) · GBrain, Garry Tan's agent memory system, as the model for a
user-owned library.

## Honest status

This was built in a day. The conversation, the handoff, the approval gate, the MCP server,
the metering and the capture-and-destroy pipeline all work. The per-user library is one
Supabase project with row-level isolation rather than a database provisioned per person —
the right architecture for a product, not a weekend.

The 112-call corpus behind the conversation design is real, and so is the
eighty-year-old who asked what to do with the rest of his life and said the conversation
changed it.
