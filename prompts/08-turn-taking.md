# Executor brief 08 — Turn-taking and rehearsal

**Owns:** the Retell agent config for `agent_e81ba747b2d4e05bc12af01ba5`, and
`src/phone/rehearse.ts`. Touch no other Retell agent or number.
**Model:** Sonnet.
**Deadline: frozen config by 16:30 PDT.** Max submits at 17:00.

## The one requirement

Max: *"It needs to pause when I am thinking. If I stop talking for a second, it needs to
pause."*

This is the feature he is least willing to compromise on. The v1 call corpus backs him:
**11 explicit interrupt protests**, including *"I said hang on. I said hang on."* The 12
calls with short agent turns had zero. Being cut off mid-thought is the failure that
actually happens and it ruins the conversation.

## What is already verified and set — do not re-derive this

I probed every candidate field by PATCHing then GETting back. Current verified state on
`agent_e81ba747b2d4e05bc12af01ba5`:

| Field | Value | Why |
|---|---|---|
| `responsiveness` | **0.3** | the primary dial. Was 1 (maximum eagerness) — this was the bug |
| `reminder_max_count` | **0** | the agent can never nudge during silence |
| `reminder_trigger_ms` | 60000 | backstop |
| `interruption_sensitivity` | **0.1** | was 0.9 |
| `stt_mode` | **"accurate"** | pauses stop being misread as end-of-turn |
| `end_call_after_silence_ms` | 120000 | won't hang up while he thinks |
| `enable_backchannel` | false | no "mm-hm" over his thinking |
| `backchannel_frequency` | 0 | — |
| `denoising_mode` | "noise-cancellation" | room noise isn't heard as speech |
| `voice_speed` | 0.95 | — |

## The trap that will cost you an hour if you miss it

**`PATCH /update-agent` silently accepts unknown fields and returns 200.** These six do
**not** exist and were all "accepted": `turn_taking_mode`, `endpointing_ms`,
`min_endpointing_delay_ms`, `silence_timeout_ms`, `user_away_timeout_ms`, `ambient_sound`.

**Never trust a 200. Always GET the agent back and confirm the value actually persisted.**
If a field does not appear in the GET response, it does not exist, no matter what the PATCH
returned.

## Your job

1. **Test it on real calls.** Max calls `+12722297451`. Have him deliberately pause
   mid-sentence for 2, 4 and 8 seconds. Log what happens each time.
2. **Tune from evidence, not theory.** If it still jumps in, the next move is
   `responsiveness` toward **0.0** — but that also slows legitimate responses, so find the
   lowest value that still feels alive. There is no separate endpointing-delay dial;
   `responsiveness` plus `stt_mode` is the whole mechanism, so do not go looking for one.
3. **Watch the other direction too.** Over-patient is also a failure: if it sits silent
   after he has clearly finished, the demo dies a different death. Report both failure
   modes with the settings that produced them.
4. **Reinforce in the prompt, not just config.** `prompts/agent-of-truth-v2.md` already
   says *"Never interrupt a long answer. If they're mid-thought, let the silence run."*
   If config alone is not enough, strengthen that language — but config first, prompt
   second, because the prompt cannot override endpointing.
5. **Point `rehearse.ts` at Retell** (it was written for AgentPhone, which is gone) so Max
   gets a stopwatch on every rehearsal: time to the "I choose to —" sentence, and whether
   he was cut off.

## Report

The settings you froze, the measured behaviour at 2s / 4s / 8s pauses, and the stopwatch
number from a real rehearsal call. By 16:30 regardless.

Do not make creative decisions. Surface options and ask Max in normal chat. He optimises
for simplicity and clarity.
