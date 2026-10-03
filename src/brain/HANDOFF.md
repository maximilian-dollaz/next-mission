# Patch for `src/phone/capture.ts` — chat 05

`capture.ts` currently ends at a decision row and a `/tmp/brief-<id>.json`.
Two things the product promises are missing from that path:

1. **The brief never reaches the brain.** The handoff shape we agreed on is
   that the brief lands in GBrain and the caller's own agent reads it from
   there — which is why this project ships no MCP server of its own.
2. **Nothing is destroyed.** `appendTurn` puts the full transcript in Supabase
   and it stays there. The `/tmp` JSON stays too. So the zero-retention claim
   is currently true only of `npm run brain:demo`, not of the live path.

`src/brain/handoff.ts` does both and takes your `Brief` as-is. It is
structurally typed, so there is no import from `src/phone` into `src/brain`
and no circular dependency.

## The change — two lines plus a block

```diff
@@ imports @@
 import { generateBrief, renderBrief, type Brief } from './brief.js';
 import { getCall, getTranscript, listRecentCalls, normaliseTurns, type Turn } from './calls.js';
+import { archiveAndDestroy } from '../brain/index.js';
```

Then after the decision is written (currently line 76), before the settlement
block:

```ts
// Into the caller's own brain, and the transcript stops existing.
const receipt = await archiveAndDestroy({
  callId,
  sessionId: session.id,
  brief,
  turnCount: turns.length,
  tmpFile: out,
  recordingWasPrevented: call.recordingAvailable !== true,
});

console.log(`\nbrain page: ${receipt.kept.brain_page}  (${receipt.kept.fact_count} facts)`);
for (const c of receipt.claims) console.log(`  ✓ ${c}`);
for (const r of receipt.residual_exposure) console.log(`  ! ${r}`);
```

That is the whole integration. `archiveAndDestroy` returns the same
`CallReceipt` the UI renders, so it can go straight to the screen.

## What it does, in order

1. Writes `decisions/<callId>` into GBrain from your `Brief` — the full §5
   shape, gate signals included.
2. Saves the decision, the north star, the next action, the cost of not
   deciding and each retired question as facts on `people/me`, each with a
   mandatory provenance string naming the call.
3. Calls `destroy_session(session.id)` and **re-selects the turns to confirm
   the count is zero** rather than trusting the delete.
4. Unlinks the `/tmp` brief and stats the path to confirm.
5. Attempts the AgentPhone deletion and records their answer — today that is
   `405 allow: GET`, reported as `retained_by_third_party`, never hidden.

## One thing to get right

Pass `recordingWasPrevented` honestly. The line above derives it from
`call.recordingAvailable !== true`, which is correct for this account
(recording is a paid add-on and is off). If recording is ever enabled, the
flag must come from how the call was created — `POST /v1/calls` with
`disableRecording: true` — because the receipt is the thing a judge reads and
a wrong flag makes it a false claim.

## Prerequisite

GBrain has to be installed on the machine running capture. Never from npm —
that package is unrelated:

```bash
bun install -g github:garrytan/gbrain
gbrain init --pglite --no-embedding
npm run brain:status          # confirms the engine and the file
```

`archiveAndDestroy` throws if GBrain is unreachable rather than returning a
half-receipt, so a broken install fails loudly instead of looking like a clean
destruction.
