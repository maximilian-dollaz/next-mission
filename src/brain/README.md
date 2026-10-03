# src/brain — the context library and the zero-retention pipeline

The differentiator. A call ends, we take what matters out of it, and then the
call itself stops existing everywhere we control.

Read [`docs/privacy.md`](../../docs/privacy.md) for the claim we make and the
exposure we disclose. This file is the wiring.

## The pipeline

```
call ends
   │
   ├─ 1. fetch        AgentPhone transcript + recording state     agentphone.ts
   ├─ 2. extract      decision · one next action · what to keep   extract.ts
   ├─ 3. write        GBrain page + facts, with provenance        gbrain.ts, page.ts
   ├─ 4. destroy      every copy, then re-request to prove it     destroy.ts, agentphone.ts
   └─ 5. receipt      what was kept, what was destroyed, what we  pipeline.ts
                      could not destroy and who holds it
```

**Step 4 is the product and step 5 is what makes it believable.** Every
destruction carries the request we re-issued and the response we got, in text a
judge can repeat with `curl`.

## Run it

```bash
npm run brain:demo                   # rehearsal transcript, full pipeline, receipt
npm run brain:demo -- <callId>       # a real AgentPhone call
npm run brain:status                 # engine, location, what the brain holds
npm run brain:status -- <callId>     # destruction proof on a real call
```

## The engine

GBrain runs on **PGLite** — embedded Postgres via WASM, one file at
`~/.gbrain/brain.pglite`, keyless, no server, no account, no egress. This was a
clock decision, not a preference: `PostgresEngine` needs a direct
`postgres://` connection string and the project only carries Supabase's REST
credentials.

Moving it is one command and changes no code in this directory:

```bash
export GBRAIN_DATABASE_URL='postgresql://...'   # Supabase → Settings → Database
gbrain migrate --to supabase
```

The rest of the product (sessions, decisions, receipts) already runs on
Supabase, so the Supabase story does not depend on where the brain lives.

## Installing GBrain

**Never `npm install gbrain`.** That npm package is unrelated to Garry Tan's
GBrain and the repo warns about the trap explicitly. GitHub only:

```bash
bun install -g github:garrytan/gbrain      # Bun 1.4+ required
gbrain init --pglite --no-embedding
```

On Claude Code the plugin is faster: `/plugin marketplace add garrytan/gbrain`
then `/plugin install gbrain@gbrain`.

## The handoff — for the phone workstream

**GBrain's MCP server is the dispatch target. There is no second MCP server in
this project, by design.** The brief lands in the brain; the caller's own agent
reads it from there. The context library *is* the handoff.

Wire a caller's agent to their brain:

```bash
claude mcp add gbrain -- gbrain serve --surface verbs
```

That exposes exactly the seven frozen memory verbs (`recall`, `remember`,
`entity`, `synthesize`, `forget`, `context_pack`, `delta`). After a call the
agent finds the brief two ways:

- the page, at slug `decisions/<callId>` — `gbrain get decisions/<callId>`
- the facts, on `people/me` — `recall(entity: "people/me")`

```ts
import { runPipeline } from './brain/index.js';

const receipt = await runPipeline({
  callId,
  sessionId,                    // our session row, if the voice layer made one
  recordingWasPrevented: true,  // true when the call was created with disableRecording
  mode: 'sprint',
});
```

`runPipeline` returns the `CallReceipt` the UI renders. It throws rather than
returning a half-receipt, so a failure is visible instead of silently looking
like a clean destruction.

### Two things the phone workstream has to do

1. **Create outbound calls with `disableRecording: true`.** It is the only
   way the recording never exists, and "never created" is a stronger and
   simpler claim than "deleted." It is available on `POST /v1/calls` only —
   `CreateWebCallRequest` has no such field and inbound calls have no request
   body, so an inbound or web demo cannot prevent the recording.
2. **Pass `recordingWasPrevented` honestly.** If it is wrong, the receipt is
   wrong, and the receipt is the thing a judge reads.

## What this module will not claim

- It will not report a deletion it did not verify.
- It will not report a landing the caller did not make (`landed: false` is a
  normal outcome and the brief says so in its own text).
- It will not quietly omit a store it cannot delete from. AgentPhone's refusal
  appears in every receipt for a real call.

## Files

| File | |
|---|---|
| `types.ts` | `Extraction`, `StoreRecord`, `CallReceipt` — the honesty contract |
| `agentphone.ts` | fetch artifacts; attempt destruction; verify by re-request |
| `extract.ts` | the one Claude call: transcript → decision, action, keeps |
| `gbrain.ts` | thin wrapper over the `gbrain` CLI |
| `page.ts` | the decision brief as a GBrain page |
| `destroy.ts` | our own stores, and the exposures we disclose |
| `pipeline.ts` | the five steps, and the receipt |
| `fixtures.ts` | one rehearsal transcript shaped to protocol §1.6.4 |
| `cli.ts` | `npm run brain:demo` |
