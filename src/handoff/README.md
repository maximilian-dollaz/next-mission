# The handoff

The decision becomes work an agent can execute. This is the part that answers
the prompt — *build something agents want* — because what agents want is to
execute the tasks their humans need done.

## The flow

```ts
import { buildHandoff, fromBrief, putHandoff, renderSplit } from './handoff/index.js';

const handoff = await buildHandoff(fromBrief(brief, callId));
await putHandoff(handoff);                  // now reachable over MCP
console.log(renderSplit(handoff.tasks));    // what Max rules on
```

`npm run handoff:demo` runs it on the rehearsal decision and prints the split.
`npm run handoff:demo -- brief.json` runs it on a real brief.

## The task schema

Chats 06 and 07 import this from `./types.js`. Every field exists because an
agent that was not on the call needs it.

| field | |
|---|---|
| `id` | `t1`, `t2`… `t1` is the lead domino |
| `title` | imperative, one line |
| `detail` | everything needed to execute, the caller's own words where they said them |
| `owner` | `agent` \| `human` \| `agent_drafts_human_sends` |
| `why_owner` | one line on why this owner — **the field Max argues with** |
| `inputs_needed` | what must be known first |
| `done_when` | **the observable condition that ends it** |
| `agent_done_when` | grey tasks only: where the agent stops |
| `blocked_by` | other task ids |
| `reversible`, `outward_facing` | the two facts the split is made of |
| `status` | `open` \| `claimed` \| `awaiting_human` \| `done` |
| `claimed_by`, `claimed_at`, `completed_at`, `result` | runtime, written over MCP |

`done_when` is the field that makes this real. A task without an observable
completion condition is a wish, so `assertExecutable` refuses the whole set and
names the task — including `done_when`s that only sound observable ("it feels
ready"). The decomposer, `reassign`, and every MCP write run through it.

## Three owners, and the third is the point

- **`agent`** — finishable alone, reversible, reaches nobody. Enforced: an
  `agent` task that is marked irreversible or outward-facing is rejected.
- **`human`** — it *is* them. The conversation, the commitment, the judgment
  call, anything irreversible, anything running on someone's trust in them.
  `claim_task` refuses these and says whose it is.
- **`agent_drafts_human_sends`** — the agent works and stops at a threshold;
  the human performs the last irreversible inch. `complete_task` lands these in
  `awaiting_human`, not `done`, so the agent's half finishing is visibly not
  the task finishing.

The decomposer's split is a **proposal**. `reassign(tasks, id, owner, {...})`
is Max's override, and it re-validates — moving a task to the grey state
requires giving the agent a threshold to stop at. Deciding what an agent can
knock out is a judgment call about his own life; the model does not get the
last word.

## MCP — `src/mcp/server.ts`

```bash
claude mcp add --transport http next-mission https://<host>/mcp
```

One line, no install, no credentials. Stateless (no session id, one Response
per Request), so it runs unchanged on Vercel and one agent's connection cannot
wedge another's.

| tool | |
|---|---|
| `get_decision` | the decision in their words, the reasoning, what is out of scope |
| `list_tasks` | filterable by `owner` and `blocked` |
| `claim_task` | refuses taken, done, blocked, and human tasks, with the reason |
| `complete_task` | grey tasks land in `awaiting_human` |
| `add_context` | the agent writes back what it learned, pinned to a task |

### Why this exists alongside GBrain

Chat 06's rule stands: one context library, and the library is the handoff.
GBrain's own server (`gbrain serve --surface verbs`) is how **Max's** agent
reaches his brain — local-first by design, so reaching it means his hardware,
his DB, his keys. That is right for him and wrong for a judge with their own
laptop, no gbrain install, and no business holding his credentials.

So this is not a second store. It is a second **door** onto the same handoff:
remote, scoped to one decision, carrying the three verbs GBrain's frozen seven
cannot express — claim, complete, and task state. The brief still lands in
GBrain. Nothing here is the system of record.

## Storage

| backend | when |
|---|---|
| Supabase | `handoffs` table present — the real one |
| file | otherwise: one JSON file per handoff under `.handoff/` |

Apply `src/handoff/schema.sql` for Supabase. The fallback is announced, never
silent — `/mcp/info` reports which is live, because a judge being told "local
files" is fine and a judge discovering it is not. The file backend is what
makes the demo work with no database and no setup.

## Files

| file | |
|---|---|
| `types.ts` | the schema, and `assertExecutable` — the one rule |
| `decompose.ts` | one Claude call: decision → tasks; plus `reassign` and `renderSplit` |
| `store.ts` | Supabase, with the announced file fallback |
| `sample.ts` | the rehearsal decision, from chat 06's transcript fixture |
| `cli.ts` | `npm run handoff:demo` |
| `schema.sql` | the one table |
