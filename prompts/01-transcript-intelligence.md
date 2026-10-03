# Executor brief 01 — Transcript Intelligence

**Owner:** this chat, and only this chat. Do not build product code.
**Recommended model:** Opus. The whole v2 conversation design rests on this output.
**Deliverable:** `docs/findings/01-conversation-principles.md` in the Hackathon repo.
**Time box:** 45 minutes. Ship something complete at 45 minutes rather than something
perfect at 90.

## Why this exists

We are rebuilding a voice agent called **Next Mission** (v2). Its job: walk a human
through structured decision-making until they reach **a firm decision made by the human**,
plus **the exact next steps an agent can execute**. The system does not take the action —
it hands the brief to the human's own personal agent.

v1 was called **The Agent Of Truth**. Your job is to extract, from the real evidence, the
conversation fundamentals that made it work and the ones that made it fail — stated as
principles v2 can be built on.

## Sources, in order of weight

1. **`~/Downloads/Next Step Life Vol 3.txt`** (~2,125 lines). Max's own running reflections
   on what makes these conversations work. **Weight this highest.** The key passage is near
   line 1345 but the file is long — search it for every mention of the agent, the
   conversation, context dumps, honesty, and next steps. Read widely, not just that line.
2. **The 4 Retell transcripts** for agent `agent_830d1cd16db01b1825deaf4e31`
   ("The Agent Of Truth"). Fetch with:
   ```bash
   cd ~/Desktop/"I am AI" && set -a && . ./.env.local && set +a
   curl -s -X POST https://api.retellai.com/v2/list-calls \
     -H "Authorization: Bearer $RETELL_API_KEY" -H "Content-Type: application/json" \
     -d '{"filter_criteria":{"agent_id":["agent_830d1cd16db01b1825deaf4e31"]},"limit":100}'
   ```
   Paginate if there are more than 100. Use `transcript_object` for turn-by-turn with
   speaker labels, and `duration_ms` / `call_analysis` for outcome signal.
   **Never print the API key.** Source it, never echo it.
3. **`~/Downloads/Voice Agent Prototype_ Private Contact Library-Transcript.txt`** — the v2
   concept memo. Context for where this is going, not evidence of what worked.
4. The v1 agent's actual prompt/config in `~/Desktop/I am AI` (check `app/`, `lib/`, and any
   Retell agent config) — this tells you what the agent was *instructed* to do, so you can
   separate design intent from what actually happened.

## Hard constraint on honesty

**N = 4 calls.** That is a tiny sample: 2.8 min average, 10.8 min longest. Do not dress up
four conversations as a dataset. Where a claim rests on one call, say so. Where Max's
written reflections and the transcripts disagree, say that plainly — the disagreement is
the most valuable thing you can find. If the transcripts are too thin to support a
principle, say the evidence is thin and lean on the written source.

Transcribed audio in these sources garbles words. Known substitutions: "contacts" →
**context**, "contact stump"/"contact dump" → **context dump**, "G brain" → **second
brain**, "super bass" → **Supabase**. Read through the garbling.

## What to analyze

For each of the 4 calls, first classify the outcome:

- **Reached a firm decision + concrete next step?** (the only real success criterion)
- Where did it stall, loop, or go abstract?
- Did the human get more honest as it went, or more guarded?
- How long before the conversation found the real thread?

Then extract principles across these dimensions:

1. **Opening / context acquisition.** Max believes a broad early context dump is decisive.
   Does the evidence support that? What did the agent ask first, and did it work?
2. **Thread selection.** How did the agent decide what to pull on? When did it pick right,
   and when did it chase the wrong thing?
3. **Pushing into discomfort.** Max says truth lives at the edge of discomfort and the
   agent should not dodge. Where did the agent push well? Where did it flinch or get
   therapeutic and vague?
4. **Steering vs following.** Max says the human steers with their first couple of
   responses. What does that imply the agent must do differently in turn 1–3?
5. **Convergence.** How did a conversation actually land on a decision? What preceded the
   moment it crystallized? This is the mechanism v2 must reproduce on purpose.
6. **The handoff.** Did it produce next steps specific enough for an agent to execute
   without the conversation? Judge each next step against: could a competent agent execute
   this with no further questions?
7. **Failure modes to design out.** Name them concretely.

## Output format

Write `docs/findings/01-conversation-principles.md`, structured as:

1. **Decision summary** — 5 bullets max, at the very top. What v2 must do differently.
   Written so Max can read only this section and decide.
2. **Evidence table** — one row per call: duration, outcome, where it turned, where it
   failed.
3. **What worked** — each principle with the evidence behind it and a confidence level
   (strong / thin / contested).
4. **What did not work** — same treatment.
5. **Transferable principles for v2** — numbered, each phrased as an instruction a prompt
   engineer can implement. This is the section the voice-engine chat will consume.
6. **Open questions for Max** — what the evidence cannot settle and he must decide.

Optimize for simplicity and clarity. Max wants exactly the information needed to decide,
spelled out practically. No preamble, no restating the brief back.

## Do not

- Do not write product code or touch anything outside `docs/findings/`.
- Do not make creative decisions about v2 — surface options and let Max choose.
- Do not invent quotes. Quote the transcripts exactly or paraphrase and mark it.
- Do not commit anything to git.
