# The phone line — stage runbook

**Number: `+12032086667`.** Agent `cmusu4komlqatqbflw5zl30rv`, `voiceMode: hosted`.

## Before walking on

```bash
npm run phone:push          # prompt + stage config live, prints what the API confirms
```

Check the printed table says `hosted`, `interruptionSensitivity 0.3`,
`enableBackchannel false`, `denoisingMode noise-and-background-speech-cancellation`.
If any of those are wrong, the room will break the call.

Then, with a stopwatch running in another window:

```bash
npm run phone:rehearse      # watches for the call, timestamps every turn
```

## On stage

1. Speakerphone. Dial `+12032086667`.
2. Bring **one real fork** — two named options. The opening question is
   "what are you deciding between", and it is answerable in ten seconds only if
   you already know the two things.
3. **Say "done" when you finish a thought.** There is no caller-side
   endpointing dial on this API (see Known limits), so the verbal handoff cue is
   the thing that stops it waiting on you or talking over you.
4. Expect five agent turns. If it has not reached "I'm going to —" by ~70s,
   it will not land in 90. Let it run — an honest unlanded brief is the designed
   outcome and a better answer to a judge than a faked landing.

## After the call

```bash
npm run phone:capture       # transcript -> db -> Claude brief -> settlement
```

Prints the brief, writes it to `/tmp/brief-<callId>.json`, persists the session
and decision through `src/db`, and files the MPP settlement receipt.

## If it fails — in order of likelihood

| Failure | What you see | Do this |
|---|---|---|
| **Call drops mid-demo** | line dies | **Redial the same number.** The agent has no memory of the dropped call, so re-state the fork in one sentence — you have 90 seconds and the opening question is the cheapest turn. The dropped call's partial transcript is still fetchable by its call id, so nothing is lost for the brief. |
| **Room noise cuts the agent off mid-sentence** | agent stops talking when the audience does | `interruptionSensitivity` is already 0.3. Drop it to 0.0 (`src/phone/config.ts`) and re-push — at 0.0 it cannot be interrupted at all, which costs you the ability to barge in. |
| **It talks over you while you think** | you pause, it jumps in | Say "done" to hand the turn back deliberately. There is no dial for this (Known limits). |
| **It overruns 110s** | no commitment by ~90s | `modelTier: 'max'` -> `'balanced'` and `voiceSpeed: 1.0` -> `1.1`, re-push. Costs move-selection quality, buys clock. |
| **Empty transcript after the call** | `phone:capture` exits with EMPTY TRANSCRIPT | No brief is possible and `capture` deliberately refuses to invent one. Fall back to a rehearsal call's brief as the artifact — which is why every rehearsal is captured. |
| **Agent answers with AgentPhone's stock demo prompt** | it asks what you're building | The push did not take. Re-run `npm run phone:push` and confirm `promptChars` is ~7400, not ~2000. |
| **Brief generation fails** | `phone:capture` throws | The transcript is already persisted by then. Re-run `npm run phone:capture -- <callId>` — it is idempotent in the sense that it creates a fresh session each run, so the earlier turns are not lost. |

## Known limits — real, and worth knowing before a judge asks

- **No caller-side VAD / endpointing control.** The API exposes
  `interruptionSensitivity` (how easily *you* interrupt *the agent*) but nothing
  for how long it waits before deciding your pause ended your turn. The protocol
  (§1.5.7) wants a 1.2–1.5s window; that dial does not exist. Mitigated with the
  verbal handoff cue, `enableBackchannel: false`, and a prompt rule that silence
  is not its turn.
- **Recording is a paid account add-on** (`POST /credits/recording/enable`,
  $5/mo). Until it is enabled, `recordingAvailable` is `false` on every call and
  there is no replayable audio artifact — transcripts are unaffected and are what
  the brief is built from.
- **The opener is a fixed string.** Hosted mode's `beginMessage` is static by
  construction, which contradicts §1.0's "nothing is scripted". Clearing it makes
  the agent generate turn 1 (honest to the protocol) at the cost of ~3s of dead
  air opening the demo. Currently set; pass an empty string to `phone:push` to clear.
- **No SMS.** `outboundSms` is `registration_required` on this account and
  `enableMessaging` is pinned `false`. Nothing here sends a message.
