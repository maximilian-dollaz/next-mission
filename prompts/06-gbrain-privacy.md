# Executor brief 06 — GBrain + the zero-retention pipeline

**Owns:** `src/brain/`, `docs/privacy.md`. Do not touch `src/phone/` (chat 05),
`src/voice/` (chat 04), `src/mpp/` (chat 03), `docs/research/` (chat 02).
**Model:** Opus.
**Time box: working by 16:00 PDT.** Hackathon ends 17:30.

## Why this exists

This is the differentiator from ChatGPT, and Max considers it a major, major piece of the
design. The product is used for **personal life matters**. So:

- The transcript and recording are **deleted immediately** after the call.
- What survives is **sorted into the caller's own context library**, which only they can reach.
- The library is **GBrain** — Garry Tan's agent memory system.

## GBrain — verified facts

Repo: `github.com/garrytan/gbrain`. A clone is already at
`/private/tmp/claude-501/-Users-maxmuzones-Hackathon-10-3-2026/8eb08101-1333-4cc1-ac53-098e62032816/scratchpad/gbrain`
(213MB, TypeScript/Bun). Read `INSTALL_FOR_AGENTS.md`, `AGENTS.md`, `docs/ENGINES.md`,
`docs/TOOL_CATALOG.md`.

- **NEVER `npm install gbrain`.** The npm package of that name is unrelated. Only
  `github:garrytan/gbrain` or a git clone. The repo warns about this explicitly.
- Fastest wiring for Claude Code: `/plugin marketplace add garrytan/gbrain` then
  `/plugin install gbrain@gbrain`.
- **Two storage engines.** `PGLiteEngine` — embedded Postgres via WASM, zero-config, no
  account, the default. `PostgresEngine` — **"backed by Supabase or any Postgres +
  pgvector."** `gbrain migrate --to supabase/pglite` moves between them.
- It runs an **MCP server** (`gbrain mcp expose`). This matters — see below.
- **Keyless mode works.** Keyword retrieval needs no API key at all.

## Decisions already made — do not re-litigate

1. **Target `PostgresEngine` on Max's Supabase.** Credentials are in `.env` and verified
   working. This keeps the Supabase story intact and uses his $100 credit.
   **Fallback: if Supabase wiring is not working by 15:30, switch to PGLite** — zero-config,
   and it arguably tells the privacy story *better* because nothing leaves the machine.
   Make that call on the clock, not on principle, and tell the orchestrator chat.
2. **GBrain's MCP server becomes our dispatch target.** Chat 05 needs somewhere to hand the
   decision brief so the caller's own agent can execute it. Do not build a second MCP
   server — the brief lands in GBrain, and the user's agent reads it from there. One server,
   both jobs: the context library *is* the handoff. Coordinate with chat 05 on the shape.
3. **Do NOT attempt per-user provisioning at signup.** Max asked for a brain created for
   each user when they sign up through the frontend. GBrain is explicitly local-first and
   single-owner — "your hardware, your DB, your keys." Multi-tenant provisioning is a
   product, not an afternoon. **Build Max's own brain, working, end to end.** The per-user
   story is narrated in the pitch, not built today. If you disagree, say so immediately
   rather than spending an hour discovering it.

## The pipeline to build

On call end, in this order:

1. Fetch the transcript and recording from AgentPhone.
2. Extract, with Claude: the **decision** (in the caller's own words), the **one next
   action**, and the **context items** worth keeping — themes, people, commitments, prior
   decisions. Schema comes from `docs/research/02-decision-protocol.md` (read it at that
   absolute path, under the main repo).
3. Write them into GBrain **with provenance** — GBrain supports sources, corrections and
   withdrawal; use them.
4. **Delete the transcript and the recording from AgentPhone, and from anywhere else we
   touched them.** Then **verify the deletion by re-requesting them and showing the failure.**
5. Return a receipt the UI can show: what was kept, what was destroyed.

**Step 4 is the product.** Make it real and make it *demonstrable* — a judge should be able
to watch the recording URL stop working. That verification is worth more than any feature on
the board.

## The claim we can honestly make — get this exactly right

Max described this as "not running through the frontier model." **That is not what we are
building, and claiming it would be false**: the live audio runs on AgentPhone's hosted voice
(and Gemini on the browser surface), both frontier-model paths. A judge will ask.

Write `docs/privacy.md` stating what is actually true, which is still a sharp knife against
ChatGPT:

- **Zero retention.** The transcript and recording are destroyed immediately after the call.
- **You hold the only durable copy**, in your own brain, on your own Postgres, your keys.
- **Nothing is trained on.**
- **It is portable and withdrawable** — GBrain has corrections and withdrawal as first-class
  operations.
- **The memory layer needs no third party at all** — keyless mode, keyword retrieval, your
  own database.
- Against ChatGPT: it retains conversations, trains on them by default, and the memory is
  not yours to take anywhere.

Be precise about residual exposure, the way GBrain's own README is: configured cloud
embedding, reranking and synthesis providers can receive text, and the model in the loop
sees recalled memory. **State the boundary honestly.** An accurate privacy claim is worth
more to a technical panel than an overstated one, and an overstated one is the kind of thing
that loses a category when challenged.

## Report

Tell the orchestrator chat when: GBrain is installed and holding a page; the engine choice
is settled; the delete-and-verify round trip works. And by 16:00 regardless.

Max optimises for simplicity and clarity. Make no creative decisions — surface options and
ask him in normal chat.
