# `src/voice/` — Gemini Live native-audio engine

Owned by chat 04. The seams other chats plug into are **`onTurn`** (persistence),
**`docs/research/02-decision-protocol.md`** (what the agent says), and
**`pacing.ts`** (how fast it says it).

## Run it

```bash
node --env-file=.env node_modules/.bin/tsx src/voice/dev-server.ts
```

Then open <http://localhost:4343>, click **Start talking**, and talk.

Needs `GEMINI_API_KEY` in `.env`. Optional: `VOICE_PACING=PATIENT|SWIFT|MEDITATIVE`,
`VOICE_PORT`, `GEMINI_LIVE_MODEL`, `GEMINI_VOICE`.

Microphone capture requires a secure context: `localhost` is fine, any other host
needs HTTPS.

## Architecture — server-to-server

```
browser                     node                        Google
mic ──PCM16 16kHz──▶ ws ──▶ bridge.ts ──▶ session.ts ──▶ Live API
speaker ◀─PCM16 24kHz─ ws ◀──────────────────────────────┘
```

`GEMINI_API_KEY` never leaves the server. The browser carries audio and small
JSON control messages only — no ephemeral tokens needed.

| File | Role |
|---|---|
| `session.ts` | the Live session: connect, stream audio, turns, barge-in |
| `bridge.ts` | browser ↔ session over WebSocket; `attachVoiceBridge(wss, opts)` |
| `pacing.ts` | **Decision 6 seam** — silence threshold, turn length, latency target |
| `instruction.ts` | **protocol seam** — reads chat 02's file, falls back to a placeholder |
| `types.ts` | `TurnRecord`, `VoiceSessionCallbacks` |
| `dev-server.ts` | standalone server; delete once chat 06 mounts the bridge |
| `public/` | minimal test page. **Not a design** — chat 06 owns the surface |

## For chat 03 — persistence

Pass a writer as `onTurn`. The voice engine never touches the database.

```ts
import { WebSocketServer } from 'ws';
import { attachVoiceBridge } from './voice/bridge.ts';
import { PATIENT } from './voice/pacing.ts';

attachVoiceBridge(new WebSocketServer({ server, path: '/voice' }), {
  apiKey: process.env.GEMINI_API_KEY!,
  pacing: PATIENT,
  onTurn: (turn) => saveTurn(turn),   // ← your module
});
```

`onTurn` fires once per completed turn, both speakers, in order. Throwing from it
is caught and surfaced as an error event — it will not drop the conversation.

```ts
interface TurnRecord {
  sessionId: string;              // stable per Live session
  index: number;                  // monotonic from 0, both speakers
  speaker: 'user' | 'agent';
  text: string;                   // transcript
  startedAt: string;              // ISO
  endedAt: string;                // ISO
  responseLatencyMs?: number;     // agent turns, when measurable
  interrupted?: boolean;          // agent turns cut short by barge-in
}
```

## For chat 05 — decision extraction

Both directions are transcribed (`inputAudioTranscription` /
`outputAudioTranscription`), so the full text of the conversation arrives through
`onTurn` without a separate STT pass. Read turns in `index` order.

`interrupted: true` is a real signal: the person cut the agent off.

## For chat 06 — the surface

Mount `attachVoiceBridge` on the main server and reuse the wire protocol in
`bridge.ts`'s header comment. Worth putting on screen:

- `state` — `listening | thinking | speaking | closed`
- `partial` — streaming captions
- `waiting` — the model is deliberately holding silence. **Show "listening",
  never a prompt.** Nudging here is the exact behaviour B13 rules out.
- `interrupted` — flush queued playback immediately

Copy the playback scheduling out of `public/index.html` rather than rewriting it:
chunks must be scheduled against `AudioContext.currentTime`, and barge-in has to
stop every queued source. Naive `.play()` per chunk stutters.

## Checks

All three run without an API key and take seconds.

```bash
node src/voice/checks/audio-format.mjs          # PCM/resampling/byte order
npx tsx src/voice/checks/config.ts              # config + instruction seam
npx tsx src/voice/checks/probe-api-fields.ts    # what the service accepts
```

Run the probe after any `@google/genai` bump — setup validation happens before
auth, so a dummy key is enough to learn which fields the service still takes.

## What is verified, and what is not

Verified without an API key:

- Audio format chain end to end — 16 kHz PCM16LE in, 24 kHz out, little-endian,
  base64 round-trip, resampling from 44.1/48 kHz. This is the failure that sounds
  like noise rather than erroring, so it was checked first.
- Every `LiveConnectConfig` field probed against the live service. Setup
  validation runs before auth, so this costs nothing.

**Not yet verified: a real spoken conversation.** That needs `GEMINI_API_KEY`.

## API drift found while probing

The SDK typings are ahead of the service on this preview model.

| Field | Status |
|---|---|
| `proactivity.proactiveAudio` | **REJECTED** — `Unknown name "proactivity" at 'setup'`. Typechecks, kills the session. Not sent; see the note in `session.ts`. |
| `enableAffectiveDialog` | accepted — this is the "hears hesitation" feature |
| `inputAudioTranscription` / `outputAudioTranscription` | accepted |
| `automaticActivityDetection` incl. `silenceDurationMs: 3000` | accepted — **long holds are not clamped**, so patient pacing works in server mode |
| `automaticActivityDetection: { disabled: true }` | accepted — client-side VAD available |
| `contextWindowCompression`, `maxOutputTokens`, `activityHandling` | accepted |

Re-run the probe after an SDK bump — these are preview endpoints and move.

## How silence is handled

Three mechanisms, since the one that would have been cleanest is unavailable:

1. **`silenceDurationMs`** (default 1200 ms) — VAD does not end the turn until
   the person has been quiet this long. Verified unclamped to at least 3000 ms.
2. **`endOfSpeechSensitivity: LOW`** — the API's own "ends speech less often".
3. **The instruction** tells the model not to fill gaps, and interpolates the
   live threshold so prose and config cannot drift apart.

`serverContent.waitingForInput` surfaces as `onWaitingForInput` — the model
signalling it expects more. Forward it to the UI; never prompt on it.

`proactiveAudio` would have let the model itself decline to speak. It is
rejected by the service, so it is not part of the current behaviour.

## Pacing — Decision 6 is still open

`PATIENT` (default), `SWIFT`, `MEDITATIVE` in `pacing.ts`. The page has buttons to
switch mid-call so the two can be compared inside one conversation.

`VoiceSession.setPacing()` changes pacing live, which is what makes chat 02's
per-phase proposal (protocol §8 Q2) buildable. One limit, enforced by the API:
`realtimeInputConfig` is fixed at connect, so in `server` mode the silence window
will **not** change mid-session — only `maxAgentTurnSeconds` and
`latencyTargetMs` move, and `setPacing` returns `false` to say so. Per-phase
pacing therefore requires `turnDetection: 'client'`, where the silence window is
enforced in the browser's energy gate and nothing is frozen.
