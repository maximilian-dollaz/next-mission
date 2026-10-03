# Executor brief 05 — The phone line (THE DEMO)

**Owns:** `src/phone/`, `api/phone/`. Do not touch `src/voice/` (chat 04),
`src/db/` `src/mpp/` `supabase/` (chat 03), or `docs/research/` (chat 02).
**Model:** Opus.
**Deadline: a real phone call that works end to end by 15:30 PDT.** Hackathon ends 17:30.

## Why this is the most important workstream

Max is going to **call this number live, on stage, in front of judges, and make a real
decision on the call.** This is the demo. If the line doesn't work, there is no demo.

Everything else is a supporting act. Optimise for *it never fails*, not for features.

## What already exists — verified, do not rebuild

The AgentPhone account is live and working (`AGENTPHONE_API_KEY` in `.env`, auth confirmed):

- **Number: `+12032086667`** — US, active, `inboundCallsEnabled: true`,
  `voiceRouting: {method: "agent"}`. Already purchased. Do not buy another.
- **Agent: `cmusu4komlqatqbflw5zl30rv`** — "Maximilian Muzones's Agent", currently
  `voiceMode: "hosted"` with AgentPhone's stock demo prompt.
- Base URL `https://api.agentphone.ai/v1`, bearer auth.
- SDK `agentphone@1.0.23` is installed; `node_modules/agentphone/reference.md` is the full
  API reference (5,700 lines) — read it rather than guessing.

**Note:** `outboundSms` is `registration_required`. Voice is unrestricted. **Do not build
anything that sends SMS.**

## The one architectural decision — read carefully

`voiceMode` is either:

- **`hosted`** — AgentPhone's own LLM runs the call from a `systemPrompt`. They own
  turn-taking, latency, interruption, barge-in.
- **`webhook`** — they transcribe, POST text to your endpoint, you return text, they speak it.
  You run every turn.

**Start with `hosted`. This is deliberate.** On a live stage call the highest-probability
failure is our own webhook adding latency or timing out mid-sentence, and `hosted` removes
that entire class of failure by letting AgentPhone own the realtime loop. The conversation
protocol from chat 02 is *written as a system prompt anyway*, so it drops straight in.

Claude still does the work that earns the category: **after the call**, pull the transcript
and have Claude generate the decision brief. That is the payoff moment and it is not on the
realtime path.

If `hosted` proves to give too little control over the protocol, *then* evaluate `webhook` —
but only if you have a working `hosted` call first, and tell the orchestrator chat before
switching.

## Build order — do not reorder

1. **Make a real call in your first 20 minutes.** Update the agent's `systemPrompt` to
   anything recognisable, then actually dial `+12032086667` from a phone and confirm you
   hear it. Until you have done this, nothing else you build is known to work.
2. **Install the protocol.** Chat 02 is writing `docs/research/02-decision-protocol.md`,
   including a **SPRINT mode that reaches a decision in ~90 seconds** — that is the one the
   demo uses. If it isn't there yet, build the plumbing with a placeholder and swap it in.
   Keep the prompt in **one file** so it can be swapped without redeploying logic.
3. **Capture the call.** On call end, fetch the transcript and persist it via chat 03's
   module (`src/db/`). Do not write your own database code.
4. **Generate the brief.** Transcript → Claude → the decision in Max's own words, the one
   next action, why it is the lead domino, and what an agent needs to execute it. Schema
   comes from chat 02's protocol document.
5. **Dispatch + settle.** Hand the brief to the MCP server (chat 05b/03) and trigger the MPP
   settlement event. Metered talk time streams during the call; the brief is the settlement.
6. **Only then**, polish.

## Hard requirements for a live stage call

- **A loud room.** Max will be on speakerphone with ambient noise. Check how the agent
  behaves with background chatter — if it interrupts itself or hears crosstalk as a turn,
  that is a demo-killer. Tune the turn detection.
- **Never cut him off mid-thought.** He will pause while thinking; a pause is not the end of
  his turn.
- **It must land in ~90 seconds.** Time the rehearsal calls with a stopwatch and report the
  actual number.
- **Rehearsal recording.** AgentPhone stores recordings and transcripts — make sure
  recording is on for every call, so there is a replayable artifact if the live call fails.
- **Know the failure mode.** If the call drops mid-demo, what happens? Write down the
  recovery (idea F2 is "call back and resume"; a simple version is enough).

## Report to the orchestrator chat

Immediately when: the first real call works; the sprint protocol is installed; the brief
generates. And by 15:30 regardless.

Report the **measured** time-to-decision on a rehearsal call. That number decides whether
the demo is viable, and Max needs it with time left to react.

Max optimises for simplicity and clarity. Make no creative decisions — surface options and
ask him in normal chat.
