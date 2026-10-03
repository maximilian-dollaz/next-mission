# Privacy — what is actually true

This product is used for personal life matters. The decisions people bring to
it are the ones they have not told anyone. So the privacy claim has to be a
property of the system, not a paragraph in a policy — and it has to survive a
technical panel asking the obvious follow-up question.

Everything below is either **checkable with a command you can run**, or marked
as something we cannot prove and are disclosing anyway. Nothing here is a
claim we have not tested.

---

## The short version

**The call leaves nothing behind that we control. What survives is sorted into
your own context library, on your own database, and you can read it, export
it, or withdraw it without asking us.**

That is a narrower claim than "nothing is ever seen by anyone," and the narrow
one is true.

---

## 1. What is true, and how to check it

### 1.1 We keep no transcript and no recording

The transcript exists in one process, for the length of one extraction, and is
never written to disk, never logged, and never returned over the wire.

- `src/brain/pipeline.ts` holds it in a local variable and drops the reference
  when the pipeline returns. There is no file path, no cache key, no log line.
- Our database has a `turns` table and a `destroy_session(session_id)` function
  that empties it ([`supabase/migrations/`](../supabase/migrations/)). The
  pipeline calls it and then **re-selects the rows to confirm the count is
  zero** rather than trusting the delete.

**Check it:**
```bash
npm run brain:demo          # runs the pipeline, prints the receipt
```
The receipt names every store, what happened to it, and the exact request we
made to verify.

### 1.2 The recording can be prevented from ever existing

Better than deleting a recording is never making one. AgentPhone's
`POST /v1/calls` accepts `disableRecording: true` — their words: *"no audio
recording is stored for this call."*

**Check it:**
```bash
npm run brain:status -- <callId>
```
It re-requests the recording and prints the response. For a call created this
way, the recording endpoint returns `404 No recording available for this call`,
permanently. You can run the `curl` it prints yourself.

### 1.3 You hold the only durable copy

What survives a call is written into **GBrain** (`github.com/garrytan/gbrain`),
Garry Tan's agent memory system. GBrain is local-first and single-owner: your
hardware, your database, your keys.

Today this brain runs on **PGLite** — embedded Postgres compiled to WASM, a
single file at `~/.gbrain/brain.pglite`. There is no server, no account, and
no network call involved in storing or reading a memory. `gbrain migrate --to
supabase` moves the same brain onto Postgres + pgvector when you want that
instead; it is still your database.

**Check it:**
```bash
npm run brain:status        # prints the engine and the file path
```

### 1.4 Nothing is trained on

No transcript, no decision, and no context item is used to train a model by us.
We fine-tune nothing. The only model traffic is a single inference request
described in §2.1.

### 1.5 It is portable, and it is withdrawable

GBrain treats correction and withdrawal as first-class operations rather than a
support ticket.

```bash
gbrain export --slug-prefix decisions/ --dir ./my-library   # plain Markdown, yours
gbrain forget <fact-id> --reason "withdrawn"                # expire one fact
gbrain delete decisions/<call-id>                           # remove the brief
```

Withdrawal expires a fact with an audit trail rather than silently erasing the
row, so the fact that you withdrew something is itself recorded. That is the
honest shape: you can take it back, and taking it back is a visible act, not a
rewrite of history.

### 1.6 Every memory carries provenance

GBrain makes `provenance` a **required** argument on every write. Nothing
reaches your library without a record of where it came from. After a call, each
fact reads:

```
provenance: Next Mission call <id>, <timestamp> (transcript destroyed)
```

So you can always answer "why does my brain think this about me?" even though
the source conversation no longer exists.

### 1.7 The memory layer needs no third party at all

In keyless mode GBrain does keyword retrieval with no API key, no embedding
provider, and no network egress. Recall works entirely on your machine. That is
how this brain is configured right now (`gbrain init --pglite --no-embedding`).

---

## 2. What is NOT true — stated before anyone asks

### 2.1 This does not avoid frontier models. It is not local inference.

**We are not claiming that your conversation never touches a large hosted
model, because it does.** Three places:

| Where | What it sees | Why |
|---|---|---|
| **Voice, in the call** | Everything you say, as you say it | The live audio runs on AgentPhone's hosted voice, and the browser surface runs Gemini Live. Both are hosted frontier-model paths. |
| **Extraction, after the call** | The full transcript, once | One request to Anthropic (`claude-opus-5`) turns the conversation into a decision, one action, and the context items. This is the step that lets us destroy the transcript — something has to read it before it goes. |
| **Your own agent, later** | Whatever it recalls from your brain | Memory is only useful if a model can read it. The model in the loop sees what it recalls. |

Anthropic does not train on API inputs, and their API retention is governed by
their policy — but it is **their** policy, not ours, and we cannot delete from
their infrastructure. The same is true of AgentPhone and Google.

If the claim you want is "no frontier model ever sees this," that is a
different product: local STT, a local model, and local TTS. We did not build
it and we are not implying it.

### 2.2 AgentPhone keeps its own transcript, and we cannot delete it

This is the sharpest limit and we found it by testing, not by reading:

```
DELETE /v1/calls/{id}   ->   405 Method Not Allowed,  allow: GET
```

There is no delete endpoint for calls, transcripts, or recordings anywhere in
AgentPhone's API. Their own documentation for deleting an *agent* says so
explicitly: *"calls associated with the agent will have their agent reference
cleared (set to null) but will not be deleted themselves."*

**What we do about it, on every single call:**

1. We **prevent** the recording with `disableRecording: true`, so the most
   sensitive artifact never exists.
2. We **attempt** the transcript delete anyway, every run, and we **record the
   refusal in the receipt** where the user and a judge can both see it.
3. We **disclose** it here and in the receipt rather than rounding it to
   "deleted."

If AgentPhone ships a delete endpoint, the attempt already in
`src/brain/agentphone.ts` starts succeeding with no other change.

**See it yourself:**
```bash
npm run brain:status -- <callId>
```
On a real call the output says `agentphone.transcript — retained_by_third_party`
and prints the 405 we got and the 200 the transcript still returns. We would
rather show you that than a green checkmark we did not earn.

### 2.3 "Deleted from memory" is not "deleted from the universe"

Our receipt only ever claims the stores we actually checked. Where we have no
visibility — a vendor's backups, a cloud provider's replication lag — we say
nothing, because we do not know.

---

## 3. The residual exposure, in full

Everything that can see your words, in one list:

1. **AgentPhone** — hears the call, and keeps its own transcript indefinitely.
   We cannot delete it. We can stop the recording from ever being made.
2. **Google (Gemini Live)** — hears the call on the browser surface.
3. **Anthropic** — receives the transcript once, for the extraction request.
4. **Your own agent's model provider** — sees whatever it recalls from your
   brain, when it recalls it.
5. **Anyone with your machine** — the brain is a file at
   `~/.gbrain/brain.pglite`. Disk encryption is your operating system's job,
   not ours.
6. **A recording URL, if a recording exists.** AgentPhone's recording endpoint
   is documented as a *"public bearer-link endpoint"* — the link is shareable
   by anyone who holds it. This is a second reason we prevent the recording
   rather than manage it.

If you enable GBrain's optional cloud features later, add them to this list:
configured embedding, reranking and synthesis providers receive text —
embedding inputs, queries, candidate passages, and source content. GBrain's own
README says this plainly and so do we. **Keyless mode, which is how this is
configured, sends none of it.**

---

## 4. Against ChatGPT, specifically

This is the comparison the product exists for, so it should be exact.

| | ChatGPT | Next Mission |
|---|---|---|
| **The conversation** | Retained on their servers under their policy | Not retained by us. AgentPhone's copy is disclosed in §2.2; the recording is prevented from existing. |
| **Training** | Conversations are used to improve models by default on consumer tiers | Nothing is trained on. |
| **Where memory lives** | Their infrastructure | A file on your machine, or a Postgres you own. |
| **Who can read it** | Them, and you through their UI | You, and the agents you authorize on your brain. |
| **Taking it with you** | An export of what they chose to give you | `gbrain export` — plain Markdown. It was never in a format you did not own. |
| **Withdrawal** | Delete a memory in their UI; what that does downstream is not visible to you | `gbrain forget <id>` — expires it with an audit trail you can read. |
| **Provenance** | Memories appear without a source | Every fact carries a required provenance string naming the call it came from. |

The honest summary of the difference is not "we are private and they are not."
It is: **the same frontier models are involved on both sides, and the
difference is who ends up holding the durable record.** With ChatGPT it is
them. Here it is you, in a file you can open in a text editor.

---

## 5. Run the whole thing yourself

```bash
# 1. Install the brain. NEVER `npm install gbrain` — that package is unrelated.
bun install -g github:garrytan/gbrain
gbrain init --pglite --no-embedding

# 2. Run the pipeline and read the receipt.
npm run brain:demo

# 3. Look at what the brain holds, and where it lives.
npm run brain:status

# 4. Attempt the destruction on a real call and watch the verification.
npm run brain:status -- <callId>

# 5. Withdraw something, and confirm it is gone.
gbrain forget <fact-id> --reason "withdrawn"
gbrain recall people/me
```

---

## 6. One thing we deliberately did not build

GBrain is single-owner by design — "your hardware, your DB, your keys." We did
**not** build per-user brain provisioning at signup, because a multi-tenant
version of a local-first system is a product decision with real security
consequences, not an afternoon of wiring. What runs today is one real brain,
end to end, owned by one person. The multi-user story is a roadmap item and we
say so rather than demoing a shape we have not secured.

---

*Last verified against the live AgentPhone API and a working GBrain 0.60.37.0
install on 2026-10-03.*
