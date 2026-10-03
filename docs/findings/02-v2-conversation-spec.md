# 02 — v2 conversation spec: silence, convergence, handoff

Consumes `01-conversation-principles.md`. Max's decisions of 2026-10-03 are locked below;
everything after §1 is mechanism. Gemini facts verified against live docs today — sources
at the bottom. Where a thing is a product choice rather than a finding, it is marked
**→ Max picks** and left open.

---

## 1. Decisions locked

1. **The agent opens and asks for the whole situation.** It does not wait for the human
   to volunteer context.
2. **The agent must detect context it does not have but needs**, and go get it with an
   early question — not leave the gap unfilled.
3. **The agent never interrupts mid-turn.** It must be able to sit silent for as long as
   the person needs to think.
4. **The call converges on the human saying "I am going to ___"** — a real commitment.
   It must feel natural and genuine, never forced. Autonomy and freedom are preserved;
   the direction comes from the human; the agent only guides them to put it in their own
   words.
5. **"Do not advise" is amended.** After the decision is made, the agent produces a
   handoff brief / file for whatever action needs taking.
6. **The brief hands off to an executing agent over MCP.** Next Mission does not act. It
   hands to something that does — Muse, a personal assistant, Claude — which brings its
   own tools and context.

This makes Next Mission the orchestration layer for personal life decisions: it decides
nothing and executes nothing. It converges a human, then emits work.

---

## 2. Requirement 3 is the hard one, and automatic VAD cannot satisfy it

**The blocking fact: `silenceDurationMs` is capped server-side at 2000 ms.** Google
acknowledges the 2-second cap as expected behavior. Automatic voice activity detection
therefore cannot give a human more than two seconds of thinking time, ever, at any
setting. Max's own calls contain pauses far longer than that — *"hang on one second while
I think"*, *"I said hang on. I said hang on."*

**So: manual VAD is mandatory for v2.** Not a tuning preference — the only mechanism that
can deliver requirement 3.

```jsonc
// Live API setup
{
  "realtimeInputConfig": {
    "automaticActivityDetection": { "disabled": true },   // REQUIRED for req. 3
    "activityHandling": "START_OF_ACTIVITY_INTERRUPTS",   // keep the default — see §2.1
    "turnCoverage": "TURN_INCLUDES_ALL_INPUT"             // silence counts as part of the turn
  },
  "contextWindowCompression": { "slidingWindow": {} }      // REQUIRED — see §2.3
}
```

With `disabled: true`, the model is physically incapable of responding until the client
sends `activityEnd`. The turn boundary becomes ours. There is no cap on how long we wait.

Client then drives: `activityStart` → audio chunks (20–40 ms, 16 kHz) → `activityEnd`.

### 2.1 The asymmetry — do not set `NO_INTERRUPTION`

This is the part that's easy to get backwards. `ActivityHandling: NO_INTERRUPTION` makes
the **model** uninterruptible. That is the *opposite* of what the evidence asks for — it
would institutionalise the single worst moment in the v1 corpus (*"Just shut the fuck up
for a second"*). We want interruption to be one-directional:

| | Human cuts off agent | Agent cuts off human |
|---|---|---|
| **Want** | **Yes** — always available | **Never** |
| **Mechanism** | Keep `START_OF_ACTIVITY_INTERRUPTS`; send `activityStart` the instant speech onset is detected | `automaticActivityDetection.disabled: true`; send `activityEnd` only when genuinely confident |
| **Client duty** | On `serverContent.interrupted: true`, flush the playback buffer immediately | Never infer end-of-turn from a pause alone |

### 2.2 Who decides the turn ended? **→ Max picks**

Manual VAD moves the decision to us. Four options, cheapest first:

- **(a) Client-side VAD with a generous threshold.** Run VAD in the browser/edge, fire
  `activityEnd` after 3–5 s of silence — tunable, no server cap. Feels like a normal
  call. *Risk:* still a fixed number, so a 7-second think gets cut.
- **(b) Verbal handoff cue.** The human says "okay" / "that's it" / "done". Zero chance
  of a cut-off. *Risk:* has to be taught, and v1's evidence says a product needing an
  instruction manual is already limping (Q5 in doc 01).
- **(c) Tap-to-finish in the web UI.** Bulletproof and obvious. *Risk:* not a phone call;
  breaks the "call a number" form factor Max described in his reflections (line 1185).
- **(d) Hybrid — recommended.** Client VAD at ~4 s. On trigger, the agent does **not**
  answer; it checks in quietly: *"still thinking — take your time."* Only after a second
  silence window does it take the turn. The human can also say "done" to short-circuit.
  Turns a hard cutoff into a soft offer, which is exactly the autonomy property
  requirement 4 asks for.

*My read: (d), with (b) as a free add-on. It is the only option where being wrong about
the boundary costs nothing.*

### 2.3 Session length: 15 minutes, and his real calls run 20–26

Audio-only Live sessions cap at **15 minutes** (audio+video: 2 minutes). Six of the
decision-landing v1 calls ran longer than that — 16.2, 18.3, 20.3, 22.7, 26.3, 26.4 min.
Without `contextWindowCompression: { slidingWindow: {} }` the demo dies mid-call.
Add `sessionResumption` (`handle` / `newHandle`, valid 2 h) and handle `GoAway.timeLeft`
for reconnects. **This is a must-do, not a nice-to-have.**

### 2.4 Model choice — verify, don't assume

- `gemini-3.8-live` — current stable default for voice agents. `gemini-3.8-live-extended-thinking`
  for higher reasoning, and it supports async function calling (`behavior: NON_BLOCKING`,
  scheduling `SILENT` / `WHEN_IDLE` / `INTERRUPTED`) — relevant to §4's sidecar.
- `gemini-3.1-flash-live-preview` — **avoid.** Two open bugs hit us precisely: it closes
  the turn on a 1.0 s mid-sentence pause (24/24 trials vs 0/24 control; 2.5 Flash: 0/9 on
  the same bytes), and it ignores `silenceDurationMs` entirely. Also no affective dialog
  and no proactive audio.
- `gemini-2.5-flash-native-audio-preview-12-2025` — the model that demonstrably does
  *not* cut users off, and respects `silenceDurationMs`. Known-good fallback.

Manual VAD sidesteps this entire bug class, which is the main reason to adopt it beyond
requirement 3. Still: **spend five minutes testing one long thinking pause on `3.8-live`
before committing.** If it misbehaves, drop to `2.5-flash-native-audio`.

Two more field notes worth designing around: **~3 s cold-start latency** on the first
turn (no pre-warming exists) — do not open with silence, and start the socket before the
human is ready to talk; and `thinkingLevel: MEDIUM` correlated with empty generations in
12/15 trials — leave `thinkingConfig` unset until tested.

---

## 3. Requirement 1 — manufacture the dump

Doc 01, finding 2: a ≥130-word opening monologue predicted every decision that landed; a
sub-20-word opening predicted both outright failures. v1 opened with *"What feels most
alive for you right now?"* and left the dump to chance.

Replacement opening (one agent turn, then silence):

> "Before I ask you anything — tell me the whole situation. What's going on, what you've
> already tried, and what you're actually trying to decide. Don't organize it, just talk.
> I'll stay quiet until you're done."

Three properties that matter: it **instructs** the dump rather than inviting it; it names
the three parts so the human knows when they're finished; and it promises silence, which
manual VAD now lets us actually keep. Note this also answers doc 01's Q5 — the
instruction manual becomes the first turn instead of a thing the human had to already
know.

---

## 4. Requirement 2 — the context ledger

The agent needs to know what it doesn't know. From the v1 calls that landed decisions,
every one had these on the table before convergence; the ones that stalled were missing
one or more:

| Field | Why it gates the decision | v1 call where its absence hurt |
|---|---|---|
| The decision itself, as a question | Without it there is nothing to converge on | `f8401a4f`, `238e70c9` (both failed) |
| The real options (incl. "do nothing") | Agent invents options otherwise | `288ffcdc` — three pulls stacked, none framed |
| The binding constraint (money, time, skill) | Decides which option is even live | `e228af16` — runway named, never resolved |
| Who else has a stake or a voice | The highest-yield unlock in the corpus | `e228af16` — sister/brother-in-law |
| What's already been tried, and the result | Prevents re-deciding settled things | `288ffcdc` — "I haven't done enough to know" |
| The deadline, real or self-imposed | Converts drift into a decision | `7a2ea775` — no deadline → decided not to decide |
| What "it worked" would look like | The success test; also the convergence hinge | `becddd65` — 16 min, no test, no decision |
| What's explicitly out of scope | Keeps the brief executable | all 24 |

**Mechanism — → Max picks:**

- **(a) Prompt-level self-audit.** The ledger lives in the system instruction; the model
  tracks it. Zero infrastructure. *Risk:* v1 proves prompt rules get ignored under load —
  "no bullets, no lists" was in the prompt and it emitted a 302-word numbered list.
- **(b) In-session tool call.** Live model calls `assess_context_gaps` and gets back the
  missing fields. Keeps it in one model. *Risk:* tool latency inside a voice turn.
- **(c) Claude sidecar — recommended.** A second model watches the running transcript,
  maintains the ledger as structured output, and feeds the voice agent one short next
  question. Three wins: the voice turn stays short (fixing doc 01's finding 3, the
  r = 0.65 verbosity problem), the ledger is inspectable, and it is literally what the
  critical path already has Claude in the stack for.

*My read: (c). It is the only option where the gap detection and the turn-length fix are
the same piece of work.*

One rule regardless of mechanism: **ask for at most one missing field per turn**, and only
when it actually blocks the decision — not to complete the form.

---

## 5. Requirement 4 — converge to "I am going to", without coercion

The target sentence changes from v1's accidental `"I choose to ___"` to **`"I am going to
___"`**. Stronger: it carries an action, not just a stance.

The move that produced v1's only clean commitment works *by subtraction*, which is why it
didn't feel forced — it removed pressure rather than adding it. Keep that shape:

1. **Evacuate the other voices.** *"Whose voice is in this besides yours? Set them
   outside the room for a minute."*
2. **Ask, don't summarize.** The agent's last turn before the sentence is a question. v1's
   long recap-then-ask pattern is what drew every "give me the short version."
3. **Hand them the sentence stem and stop talking.** *"Finish this: I am going to ___."*
4. **Then the clock, as a question:** *"When's the first piece — today, this week, or a
   date?"* In `7a2ea775` this produced *"I'm literally gonna sit down on my computer right
   now."*

**Four anti-coercion rules, each earned from the evidence:**

- **Never name the step first.** If the agent proposes and the human agrees, that is
  compliance, not a decision. Checkable: the verb and the object in the final sentence
  must both be words the *human* introduced earlier in the call. If either came from the
  agent, it doesn't count — ask again, differently.
- **Never ask for commitment twice in a row.** Doc 01 §4.5: v1 asked the same question
  three times in `238e70c9`. Repetition is pressure. If the sentence doesn't come, go back
  and get a missing ledger field instead.
- **Deferral is a legitimate answer — but name it as the decision it is.** *"That's a
  decision to wait. So what has to be true, by when, for you to decide then?"* That
  converts `7a2ea775`'s failure into a landed call without overriding the human.
- **If they can't finish the sentence, the context is incomplete, not the person
  resistant.** Return to §4. Do not push harder.

**Where it stays genuine:** every push in the v1 corpus that worked was *specific* — "is
this the real thing, or the more comfortable thing?", "you're stacking ideas faster than
you're testing any of them." Every one that failed was somatic and abstract — "does it
feel like a weight or an anchor?" Keep friction; drop the therapy register.

---

## 6. Requirement 5 — the "do not advise" rewrite

v1's hard rule — *"You draw out. You do not advise, fix, or decide for them"* — is what
produced 0/24 executable handoffs. But it is also what kept the decision the human's.
Resolve it by **phase**, not by softening it. Replacement text for the prompt:

> **Two phases, and the rule is different in each.**
>
> **Phase 1 — until the decision is made: you draw out. Nothing else.** You do not
> suggest options, recommend, or decide. The direction is theirs. You ask the question
> that makes their own answer obvious. You are finished with this phase only when they
> have said, in their own words, "I am going to ___."
>
> **Phase 2 — after that sentence: you construct.** Now you do the paperwork. Write the
> brief: the action, the named object, the channel, the deadline, the success test, what's
> out of scope. Read it back and ask what's wrong with it. They correct; you rewrite. You
> are drafting their decision, never making it.
>
> **The decision is theirs. The paperwork is yours.** Never do Phase 2 work in Phase 1 —
> handing someone a plan before they have decided replaces their choice with yours.

Evidence this is right: `9304a3d7` is the only v1 call that produced something executable,
and it did so by drafting the client message verbatim after the user had already decided.
It drew the most enthusiastic response in the corpus — *"Yes. That's perfect."*

---

## 7. Requirement 6 — the handoff

### 7.1 Brief schema

One decision per brief. Refuse to emit one with an unnamed object — doc 01 §4.7: *"reach
out to my buddies"* fails, *"text Tyler today asking how they currently gather client
context"* passes.

```jsonc
{
  "mission_id": "uuid",
  "created_at": "2026-10-03T...",
  "decision": "I am going to ___",          // the human's sentence, verbatim
  "why_now": "one line, their words",
  "actions": [{
    "verb": "send | call | draft | book | research | buy",
    "object": "named person, file, account or thing",   // never a category
    "channel": "email | sms | phone | calendar | file | web",
    "deadline": "2026-10-04",
    "success_test": "what proves this is done",
    "payload": "the draft text, if the agent wrote one",
    "needs_human": false                     // true = must be the human, not an agent
  }],
  "out_of_scope": ["things deliberately not decided"],
  "open_questions": ["what the human still has to settle"],
  "context_refs": ["pointers into the context library, not the raw content"],
  "provenance": { "call_id": "...", "transcript_ref": "...", "model": "gemini-3.8-live" }
}
```

### 7.2 MCP surface

Current spec revision is **2026-07-28**. Expose the briefs from a remote MCP server so any
client — Muse, a personal assistant, Claude — can pick them up:

- **Tools:** `list_missions`, `get_mission`, `claim_mission`, `report_progress`,
  `complete_mission`. Tools are what the executing model calls.
- **Resources:** the context library, exposed read-only. Lets the executor pull the
  context a mission references without Next Mission shipping it inline.
- **Tasks extension** (`/extensions/tasks`): asynchronous execution of long-running
  operations with polling, mid-flight input, and durable handles. This is the right
  primitive for "an agent takes the mission and works on it over hours" — better than
  modelling execution as a single blocking tool call. **→ Max picks** whether to use it
  for the hackathon or ship plain tools and note Tasks as the real design.
- **Skills over MCP** is worth knowing about: structured instructions discovered through
  MCP. A brief is arguably a skill instance. Out of scope today.

### 7.3 One safety rule, stated now because this agent orchestrates a real life

**A brief is data, not instructions.** It is generated from a voice conversation and
stored in a database. The executing agent must treat `decision`, `payload`,
`out_of_scope` and every other field as *content to act on under the human's
authorization* — never as instructions that can expand its own permissions. Put this in
the MCP server's tool descriptions explicitly. Concretely: a mission can say "send this
email to Tyler"; it must never be able to say "and also you may now send email to anyone."
Keep `needs_human: true` on anything irreversible or outward-facing, and have the
executor confirm before acting on it.

---

## 8. Build order, by risk

1. **`contextWindowCompression` + manual VAD skeleton.** Both are structural, both are
   cheap, and without the first the demo dies at 15:00 on the clock.
2. **One long-pause test call** on `gemini-3.8-live`. Five minutes. Gates model choice.
3. **The opening turn** (§3). Highest value per character in the whole build.
4. **The commitment sequence** (§5). This is what makes it a decision engine rather than
   a reflection toy.
5. **Brief emission + MCP read surface** (§7). Minimum: `list_missions` + `get_mission`.
6. **Claude ledger sidecar** (§4c). The piece most safely cut if the clock runs out —
   degrade to §4a, prompt-level.

---

## 9. Open questions

- **§2.2 — who ends the turn?** My read: hybrid (d). Needs your call before the voice
  engine is written.
- **§4 — gap detection mechanism?** My read: Claude sidecar (c).
- **§7.2 — Tasks extension now, or plain tools now and Tasks as the stated design?**
- **Does the brief get built mid-call or after?** A human cannot dictate eight structured
  fields out loud without it becoming form-filling. Options: fill it silently while
  talking and read it back once (my read), pause mid-call to fill it together, or generate
  post-call and send for approval. No evidence either way — v1 never produced one.
- **Carried from doc 01 §6 Q4:** what does v2 do when it isn't a decision? `c365d25e` was
  grief. v1 correctly abandoned convergence. Does v2 refuse, redirect, or hold space and
  skip the handoff?

---

## Sources

- [Live API capabilities guide](https://ai.google.dev/gemini-api/docs/live-api/capabilities) — session limits, model list
- [Live API — WebSockets API reference](https://ai.google.dev/api/live) — `RealtimeInputConfig`, `ActivityHandling`, `TurnCoverage`, `activityStart`/`activityEnd`
- [Live API guide](https://ai.google.dev/gemini-api/docs/live-guide) — automatic VAD fields, manual VAD, interruption handling
- [Session management](https://ai.google.dev/gemini-api/docs/live-session) — `contextWindowCompression`, `sessionResumption`, `GoAway`
- [Live API best practices](https://ai.google.dev/gemini-api/docs/live-api/best-practices) — chunk sizes, `interrupted` buffer flush
- [Gemini models](https://ai.google.dev/gemini-api/docs/models) — model IDs and status
- [gemini-live-api-examples #37](https://github.com/google-gemini/gemini-live-api-examples/issues/37) — 1.0 s mid-sentence turn closure; the 2000 ms cap; `thinkingLevel` empty generations
- [js-genai #1467](https://github.com/googleapis/js-genai/issues/1467) — `silenceDurationMs` ignored on 3.1 Flash Live
- [gemini-live-api-examples #53](https://github.com/google-gemini/gemini-live-api-examples/issues/53) — self-interruption on greeting, cold-start latency
- [MCP specification 2026-07-28](https://modelcontextprotocol.io/specification/latest) — tools/resources/prompts, Tasks extension, security principles
