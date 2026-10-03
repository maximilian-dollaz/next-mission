# 02 — The decision protocol

**What this is:** one conversation protocol, turn by turn, that an engineer can implement
today. Not a literature review. Every move has a trigger, specimen utterances, and an exit.
Two clocks on one engine: **full mode** (§1, 10–25 min) and **sprint mode** (§1.5, ~90 s, for
the live stage demo).

Consumes `01-conversation-principles.md` (the v1 call corpus) and
`02-v2-conversation-spec.md` (Max's locked decisions + the Gemini mechanism).
Reconciliation and the four places I disagree with them are in §7.

---

## Cold-start live demo: yes, in ~110 seconds. Read §1.6, not §1.5.

**Revised 2026-10-03 after Max rejected the pre-loaded-library condition. He is right and I
had an error in my arithmetic; the correction is in §1.6.1. §1.6 supersedes §1.5.1–§1.5.5 and
§1.5.7. §1.5.6 — do not fake the landing — stands unchanged and matters more in a cold start,
not less.**

- **My error:** I claimed loading a problem costs 8–20 minutes. That is the cost of the agent
  *excavating* a tangled problem question by question. It is not the cost of a human
  *delivering* a small one. Doc 01's own evidence makes this obvious in hindsight: the
  ≥130-word dump that predicted every decision that landed is **52 seconds of speech.** For a
  deliberately simple fork, a complete dump is 60–90 words — **24 to 36 seconds.** Cold start
  is viable and I should have modelled it.
- **The clock:** a complete cold-start run — dump, north star, one engine move, commitment,
  if-then cue, and the full gate — is **~110 seconds** including VAD and cold-start latency
  (§1.6.2). 90 seconds fits only by dropping either the if-then cue or the offered exit, and
  both are load-bearing. **Take the full 2-minute slot and target 110.**
- **The one dial he controls is the problem he brings**, and it moves the total almost
  linearly: a 60-word dump lands ~95 s, 90 words ~108 s, 130 words ~124 s. So the spec of what
  to bring *is* the clock spec. **§1.6.4 is one paragraph, written to be read once and picked
  against — it is the highest-value thing in this document for the next three hours.**
- **Cold start is the better demo and he's right about that too.** It can't be accused of
  being pre-baked, and it exercises Phase 0, which is the actual product. What it costs: a
  thinner brief and live ASR risk on the first turn.
- **One real bug my own spec had:** §1.5.7's 1.2–1.5 s VAD window will cut him off mid-dump,
  because people pause inside a 35-second monologue. The window must be phase-dependent —
  generous through the dump, tight afterwards. §1.6.5. Eleven interrupt protests in the v1
  corpus say this is the failure most likely to wreck the demo live.

---

## Decision summary

1. **The north star goes first because it is a memory device, not a philosophy.** Working
   memory holds ~4 chunks and the focus of attention holds about one (Cowan 2001;
   Oberauer 2002). Comparing two options across five things that matter is a 10-item
   problem — unholdable in speech. Installing one persistent reference ("what I'm actually
   going for") turns every later question into *one option vs. one reference* — a 2-item
   question. **C1's three acts are load management.** That is the finding this whole
   document rests on.

2. **Even Swaps is the right engine, but its actual question is unusable on voice.** It
   asks you to *match* ("how much salary offsets 30 more minutes of commute?"). Matching
   and choosing produce different weights in the same person (Tversky, Sattath & Slovic
   1988). Replacement move, same effect, asked as a choice: **"If the money were the same
   on both, which one are you taking?"** Equalize by fiat, then ask for a choice. Three
   items, no arithmetic, sounds like curiosity.

3. **One invariant to put in code: the live item count never goes up.** After mapping,
   every single agent turn must delete an option or delete a thing-that-matters. If a turn
   does neither, it was a wasted turn. `len(options) + len(attributes)` monotonically
   non-increasing is assertable, loggable, and is the entire difference between a decision
   engine and a nice chat.

4. **The completion gate is 3 of 4 signals, and one of them is an offered exit.** Commitment
   verb ("I'm going to", not "I should" — Amrhein et al. 2003 found commitment *strength*
   predicted outcomes where desire, ability, reasons and need did not); words the agent
   never said; unprompted elaboration after the sentence; and **it survives an easy way
   out that the agent hands them**. The offered exit is the only thing here that catches
   the person saying yes to be agreeable.

5. **Nothing is scripted, and the stakes come before the north star.** Every utterance is
   generated from the person's own live words — **the only fixed strings in the system are
   theirs** (§1.0). And Phase 2 now asks what it costs them to leave undecided, before any
   comparison work. That is the same question as the gate's offered exit, fired early on
   purpose: pre-decisional, it produces exploratory thinking; post-decisional, it produces
   self-justification (Lerner & Tetlock 1999). Early it buys investment; late it tests the
   commitment.

**Six calls are yours, not mine (§8). One blocks the build:** may the agent ever name an
option the human didn't? The engine works either way, but the answer changes A3 and it
changes the code.

---

## 1. The protocol

Ten phases, 0–9. Phases 0–5 load the problem; 6–7 collapse it; 8–9 emit the work.

**This is full mode — 10–25 minutes, the real product.** Sprint mode (~110 s, cold start, for
the live demo) is the same engine with Phases 1–5 collapsed into a single bounded dump; it is
specified in **§1.6** and it changes nothing below.

### 1.0 Nothing is scripted — how the agent speaks

**The agent has no sentences. It has jobs, constraints, and the person's own words.**

This is a hard requirement, not a polish item. A fixed string is a tell: the second call
sounds like the first, the human hears a product instead of attention, and the whole A3
claim collapses — a thing reciting lines is obviously not discovering anything. Every
utterance below marked *specimen* is an illustration of shape for the engineer, **never a
string to ship.** None of them should appear verbatim in the prompt, the code, or a fallback
path.

What replaces the script, per phase: a **job** (what this turn must accomplish), the
**material** it must be built from, **hard constraints**, and an **exit test**. The model
generates; the constraints are what you actually implement and check.

| Generation rule | Why | Check |
|---|---|---|
| **Every question must contain at least one content word from the person's last three turns.** | This is Clean Language's syntax made mechanical: the agent introduces no nouns of its own. It is also what makes every turn automatically dynamic — the material is different because *they* are different. | Token intersection with their recent turns ≥1. Fail → regenerate. |
| **The only fixed strings permitted anywhere are the human's own words**, quoted back verbatim (the north star, their stakes figure, their commitment sentence). | Repeating *their* phrase is one chunk and builds trust; repeating *yours* is a script. | Any literal in the prompt must be traceable to a captured field. |
| **No agent utterance may repeat across calls.** | A returning caller must never hear the same opening twice. | Hash n-grams (n=6) of every agent turn into a per-user store; overlap → regenerate. For the hackathon, a 3-call store is enough to catch it. |
| **The phase's job is in the prompt; the phase's name is not.** | The model needs to know what it's doing. The human must never hear it. | Blocklist from §1's global rules, enforced on output. |
| **Build each question from the ledger, not from a template library.** | The question is a slot-fill at the *semantic* level — "neutralize attribute *k* between options *i* and *j*" — rendered fresh in their vocabulary each time. | The sidecar emits the *move* (`#4, attribute=money, options=[A,B]`); the voice model renders it. Two components, separately testable. |

The one genuinely hard case is **Phase 0**, which has no prior words to build from. Generate
it from what *is* known — time of day, returning or not, what the context library holds — and
hold it to the three functional properties in Phase 0 rather than to any wording.

**Global rules that hold in every phase.** These are the ones to put at the top of the
system prompt, because they are what the v1 corpus actually died of.

| Rule | Why | Check |
|---|---|---|
| **One question per turn. One *item* per question.** | Doc 01 found v1's agent turns correlate r=0.65 with the user's and peaked at 302 spoken words. But word count is a proxy — the real constraint is items. A 25-word turn holding three things is worse than a 45-word turn holding one. | Count the nouns the listener must hold. >3 → split the turn. |
| **Never say a framework name, a stage name, or what you are about to do.** | The machinery is invisible. "Let's weigh these" is already too much. | Blocklist: *framework, weigh, trade-off, matrix, exercise, step back, hold space, process, let's explore*. |
| **"It seems like", never "I think".** (B7) | Keeps the agent out of the equation; makes every reflection correctable rather than authoritative. | Ban first-person opinion verbs. |
| **Silence is not your turn.** | Manual VAD exists for this (`02-v2-conversation-spec.md` §2). | On a trailing-off turn, emit nothing. |
| **Never ask the same question twice.** If it didn't land, change the question. | v1 asked one question 3× over garbled ASR and the call was logged as failed. | Semantic-similarity check against the last 3 agent turns. |
| **Agent introduces no options.** Attributes it may neutralize; options it may not invent. | A3/A5: direction is the human's. | Token-set check (see §3). → **but see open question Q1.** |

---

### Phase 0 — Frame and dump

**Entry:** call connects.

**What the agent is doing:** manufacturing the context dump (B12, H3) and setting the
contract so the human knows this is on them. One turn, then total silence.

**Material:** time of day; returning or first call; whatever the context library holds.
Nothing else exists yet.

**Three properties the generated turn must have** — these are the spec, not the words:
it **instructs** the dump rather than inviting it; it **names its parts** so the human knows
when they're finished; it **promises silence**, which manual VAD now lets us actually keep.

**Specimens** (shape, not strings — see §1.0):
- "Before I ask you anything — tell me the whole situation. What's going on, what you've
  already tried, and what you're actually trying to decide. Don't organise it. I'll stay
  quiet until you're done."
- "Give me the whole thing first. Messy is fine — I'd rather have it messy than tidy."
- *(returning caller, context library loaded)* "I've got last time. What's changed?"

**Exit:** the human stops talking and the manual-VAD check-in ("still thinking — take your
time") draws no further speech. **Not** on a pause.

**Failure if it moves on early:** this is v1's worst failure mode. Opening with "what feels
most alive for you?" produced both of the two outright failed calls — five "I don't know"s
and a landing on "the weather." A sub-20-word opening never produced a decision in 24 calls.
If the dump doesn't come, go to the no-context branch (§6).

---

### Phase 1 — Mirror, and name the two questions

**Entry:** dump complete.

**What the agent is doing:** (a) reflecting the situation back in cleaner words than they
used (B8) — this was the most-felt moment in the corpus; (b) logging the opening ask
verbatim; (c) **splitting the ask from whatever came up, out loud, and retiring one.**

**Material:** the dump, almost entirely. The mirror is built from their nouns, compressed —
their words in fewer of them, which is the whole effect (B8). Not one word of assessment.

**Specimens** (shape, not strings):
- "So: three clients, a cofounder who's half-in, and six weeks of runway — and underneath
  it, a question about whether you want to be running this at all. Is that it?"
- "You came in asking how to make time to job search. But most of what you just told me is
  about whether you want the job. Which one are we settling today?"
- "Did I miss anything that matters?"

**Exit:** the human confirms or corrects the mirror, **and** names which question is today's.
Log the other into `out_of_scope`.

**Failure if it moves on early:** `e228af16` — opened on a concrete scheduling problem,
closed 20 minutes later on an identity decision, never touched the scheduling. Doc 01 calls
this the flinch. The fix is not "come back to it later"; it is to retire it explicitly in
minute two so the human is not quietly waiting for it.

---

### Phase 2 — Stakes

**Entry:** today's question is named. **Conditional** — see the trigger below.

**What the agent is doing:** having the human say, in their own words and preferably with a
number or a date in it, **what this costs if it stays undecided.** Two things, in this order:
the stakes of the decision, then the stakes of *not leaving this call with a step*.

The purpose is investment. A person who has just heard themselves say "another month of this
costs me about eight grand and I'll have missed the window" is in a different conversation
than one who hasn't — they elaborate more, dodge less, and stop skimming. That is the
mechanism Max is pointing at, and it is a real one: personal relevance drives effortful,
issue-relevant thinking rather than shortcut processing (Petty & Cacioppo 1979), and
**pre-decisional** accountability produces exploratory thought where post-decisional
accountability produces self-justification (Lerner & Tetlock 1999). The order matters:
before any comparison, this opens the person up; after the commitment, the same question
only produces defence of what they already said.

**Trigger — do not fire this blind.** If the dump already came in hot — a deadline named, a
number named, visible pressure — asking how much it matters is tone-deaf and insulting, and
you will lose the room. Default:

- **Fire the full phase** when the dump was thin (ledger has ≤3 fields), flat, or has no
  deadline and no cost in it. This is also the skimmer, which is the case Max is describing.
- **Fire one line only** — reflect the stakes they already stated, as a question — when they
  arrived with the cost already on the table.
- **Skip to Phase 3** if they have named both a cost and a deadline unprompted.

**Material:** their situation, and a time horizon the agent supplies (a month, the quarter) —
the horizon is the only thing the agent may introduce here, because it is a unit, not a
judgment.

**Specimens** (shape, not strings):
- "If this is still exactly where it is a month from now — what's that actually cost you?"
- "Put a number or a date on it if you can."
- "And what's it cost if we hang up and you're still turning it over?"
- "Is this the thing, or is it the thing you're thinking about while the real thing waits?"
- *(stakes already stated)* "You said the window closes in March. Is that the clock we're
  working against?"

**Hard constraints — this is where this phase goes wrong:**
- **The agent never asserts the stakes.** It asks; the cost comes from them. "This is really
  important" is manipulation and it is also a lie the agent is in no position to tell.
- **Never use their stakes as leverage later.** Quoting their own words back once, as a
  question, is reflection (B8). Quoting them back to push — *"but you said this was costing
  you eight grand"* — is coercion, and it breaks the anti-coercion rules in
  `02-v2-conversation-spec.md` §5. One is a question mark; the other is an argument.
- **If the honest answer is "not much," accept it and say so.** A low-stakes decision gets a
  short call and a small brief. Forcing weight onto something light is how you lose
  someone's trust in the first two minutes.

**Exit:** a cost is on the table in their words — a number, a date, a named consequence —
**or** they have said it genuinely doesn't matter much, in which case log
`stakes: low` and run the rest of the protocol short.

**Failure if it moves on early:** you get the call Max is describing — the person skims the
surface, gives the agreeable answer at every fork, and the brief is built on material they
were never invested in. Phase 9's commitment will pass S1 and S2 and fail in the world.

**Note the symmetry, and build it once:** this question and the gate's offered exit (§4.1 S4)
are the same question at two different times. Asking it here makes the later one sharper,
because the later one can be their own number handed back: *"you said a month of this costs
eight grand — so what happens if this is still open in a month?"* Store the answer as
`cost_of_not_deciding` and reuse it in both places.

---

### Phase 3 — Install the north star

**Entry:** stakes on the table (or honestly low).

**What the agent is doing:** getting one sentence that will serve as the fixed reference for
every comparison in Phase 7. This is C1 act 1, and §2 explains why it must be here and not
later. Keep it short and in their words — it has to be re-sayable in six words or it is not
a usable reference.

**Material:** their own language about what they want, taken from the dump where possible —
ask for the sentence, never offer a candidate.

**Specimens** (shape, not strings):
- "Forget the options for a second. If this goes right, what's different in a year?"
- "Say that in one sentence — the version you'd tell a friend, not the version you'd put in
  a pitch."
- "So the thing you're actually going for is *being somewhere already working, building*.
  Yeah?"
- *(if they give three)* "Which of those three would you keep if you could only have one?"

**Exit:** a single ≤12-word phrase, in their nouns, that the human confirms. Store verbatim
as `north_star`. **Do not paraphrase it ever again** — re-say it word for word each time it
is used, so it stays one chunk instead of becoming a new one.

**Failure if it moves on early:** every later question costs 3–6 items instead of 2, and the
call becomes the 16-minute call that found real material and closed on "keep noticing"
(`becddd65`).

---

### Phase 4 — Ground truth

**Entry:** north star stored.

**What the agent is doing:** C1 act 2. Hard facts only, and specifically the facts that
contradict the story. Numbers, dates, names. No feelings yet — feelings are only reliable
once the facts are on the table (doc 01 §4.5: the somatic questions only worked on a user
already in context).

**Material:** the gaps in the ledger, in the fill order given in §7 item 3. One field per
turn, and only when it blocks the decision — not to complete the form.

**Specimens** (shape, not strings):
- "Where has most of your actual money come from in the last six months — not where you
  wish it came from."
- "When's the real deadline, and who set it?"
- "What have you already tried, and what happened?"
- "What's the thing that has to be true for any of this to work?"

**Exit:** the binding constraint is named (money, time, a person, or a skill) and at least
one *tried-already* fact is on the table. These are the two ledger fields whose absence
killed calls in doc 01 §4.

**Failure if it moves on early:** the agent ends up narrowing between options that aren't
live, and the human knows it before the agent does.

---

### Phase 5 — Map, silently

**Entry:** constraint named.

**What the agent is doing:** **nothing out loud except one confirmation.** This is the only
point in the call where more than three items exist, and the *agent* holds them, not the
human. Build the grid: real options (including "do nothing") × things that matter. Five of
each is fine — in the sidecar, never in speech.

Then say back only the options, and only to check the set is complete:

**Specimens** (shape, not strings):
- "So it's: keep all three clients and search around the edges, hand one back, or stop
  searching and go all in. Anything I'm missing?"
- "Is doing nothing for another month on that list?"

**Exit:** the option set is confirmed complete. Now freeze it (Q1 permitting) and start the
invariant: from this turn on, item count only goes down.

**Failure if it moves on early:** the agent starts narrowing a set the human doesn't agree
is the set, which reads as being railroaded and produces exactly the compliance Phase 8
is built to detect.

---

### Phase 6 — Free deletions

**Entry:** option set frozen.

**What the agent is doing:** deleting everything that can be deleted for nothing. Cheapest
moves first, always. See §3 for the ordering rule and why these are first.

**Material:** the live grid. The sidecar names the move and the target; the voice model
renders it in their vocabulary.

**Specimens** (shape, not strings):
- "Whose voice is in this besides yours?" → *"My sister and her husband."* → "Set them
  outside the room for a minute. Does it change?"
- "Sounds like the money's about the same either way, give or take. Fair?"
- "Does handing one back get you closer to *being somewhere already working* — or just make
  this month calmer?"

**Exit:** no further column or option can be removed with a 2-item question.

**Failure if it moves on early:** you spend the expensive comparisons in Phase 7 on items
that were about to delete themselves. In `e228af16` the single highest-yield intervention in
24 calls — evacuating the sister and brother-in-law — is structurally just *a free column
deletion*: an attribute whose owner was not the decider. It costs one question and removes a
whole dimension. Doing it late wastes the whole middle of the call.

---

### Phase 7 — Narrow (the engine)

**Entry:** no free deletions left, ≥2 options live.

**What the agent is doing:** running the loop in §3. Each turn: one move, ≤3 items, and the
live set gets smaller. It should feel like the agent is just following its own curiosity.

**Material:** the live grid plus `lean` (§3.3). The move is computed; the sentence is not.

**Specimens** (shape, not strings):
- "If the money were identical on both — same number, same timing — which one are you
  taking?"
- "Is there anything keeping all three gives you that handing one back doesn't? Other than
  the money."
- "A year from now, which one do you not want to have skipped?"
- "If someone you liked told you exactly this story, what would you tell them?"
- "What would have to be true for the other one to be obviously right?"

**Exit:** one option left, **or** the human volunteers a comparison the agent didn't ask for
("honestly, B only exists because I'm scared of A") — that means they've taken the engine
over, which is the actual goal. Stop steering immediately when that happens.

**Failure if it moves on early:** you get the tentative landing. `1fa533b5` accepted
"tentatively open to a two-week trial" as a decision; `7a2ea775` spent 26 minutes and
validated a decision not to decide, and the system logged both as successes.

---

### Phase 8 — The unlock

**Entry:** one option is standing, before any request for commitment.

**What the agent is doing:** the highest-yield question in the entire v1 corpus. This is not
a motivational move; it surfaces the real constraint that the ledger missed, and it is the
last chance to catch it before the brief is wrong.

**Material:** the surviving option, the block if they've hinted at one, and
`cost_of_not_deciding` from Phase 2 — this is where their own number comes back, once, as a
question.

**Specimens** (shape, not strings):
- "What's stopped you from already doing this?"
- "Now the uncomfortable part — is this the real thing, or the more comfortable thing?"
- "If you did nothing about this for another month, what happens?"
- "What's the strongest case against it?"

**Exit:** either the block dissolves on the call (`288ffcdc`: *"this conversation is helping
me figure out what I would actually do"*) **or** a new hard constraint surfaces — in which
case go back to Phase 4, add it, and re-run Phase 6. Do not push through it.

**Failure if it moves on early:** the brief ships with a step the human already knows they
won't take, and the executing agent does work that gets abandoned.

Note: the last two specimens double as the **offered exit** in the completion gate (§4).
Fire one here deliberately, and log what happens. It is Phase 2's question again — which is
why it is now a *test* rather than an opening: post-decisional, it draws self-justification
(Lerner & Tetlock 1999), so a person who takes the exit anyway is telling you something real.

---

### Phase 9 — Commit, domino, brief

**Entry:** block named or dissolved. One option standing.

All three sub-moves are specimens, as everywhere else. The **sentence stem** is the single
exception worth arguing about: *"I'm going to ___"* is load-bearing because the verb form is
what S1 tests for, so the *grammatical frame* is fixed even though the sentence around it is
generated. Hand them that frame however it comes out naturally.

**9a. The sentence.** Hand them the stem and stop talking. Never ask twice in a row.
- "Finish this: I'm going to ___."
- *(if it doesn't come)* don't repeat — go get a missing fact instead, then come back.

**9b. The lead domino** (C5). One action, not a list. The one that makes the rest easier.
- "What's the one piece that, once it's done, makes the rest of it easy?"
- "What's the first piece — today, this week, or a date?"
- "When exactly? Like, what's happening right before you do it?" ← this gets the if-then
  cue, and it is the single highest-value question in the whole brief (Gollwitzer & Sheeran
  2006: if-then plans, d≈0.65 over goal intentions alone across 94 studies).

**9c. The brief.** The *construct* half of the "do not advise" rule
(`02-v2-conversation-spec.md` §6): now the agent constructs. Fill it silently, read it back
once, and ask what's *wrong* with
it — never "does that sound good?"
- "Here's what I've got. Tell me what's wrong with it."
- "What's still unsettled?"

**Exit:** the completion gate in §4 passes, and the read-back is corrected or confirmed.

**Failure if it moves on early:** `9304a3d7` is the only v1 call that produced something
executable, and it did it by drafting the actual client message *after* the human had
decided — drawing the most enthusiastic response in the corpus. Doing that same thing one
phase earlier replaces their decision with yours.

---

## 1.5 Sprint mode — first pass (**partly superseded — build from §1.6**)

> **Do not build from this section.** §1.5.1–§1.5.5 and §1.5.7 assumed a pre-loaded context
> library; Max rejected that and the demo is a cold start. **§1.6 is the build spec.** Kept
> here because three parts are still live and §1.6 refers back to them: **§1.5.5** (the
> engine-move priority list), **§1.5.6** (do not fake the landing — unchanged, and more
> important cold), and **§1.5.8** (what you give up).

Everything above is **full mode**: 10–25 minutes, the real product. Sprint mode is the same
mechanism, aggressively truncated, for the stage. One engine, two clocks.

### 1.5.1 Why the truncation works at all

The protocol's cost is almost entirely in **loading** the problem, not in collapsing it. Of
the ten phases, 0–5 load and 6–9 decide. The worked example in §3.5 collapses a real
three-option decision in **five one-line questions** — maybe 45 seconds of talking. The
20-minute calls in the v1 corpus were 20 minutes because of the dump, the ledger and the
drift, not because convergence is slow.

So sprint mode does not speed the engine up. **It skips the loading by sourcing it
elsewhere** — the context library — and enters the protocol at Phase 6. Nothing about the
move selection, the item limits, or the gate changes.

### 1.5.2 The 15-second opening — the hardest part, solved

B12 wants broad context up front, and doc 01's evidence is that a ≥130-word dump predicted
every decision that landed. **You cannot get broad context in 15 seconds, and you should not
try.** The two failed v1 calls both died exactly here, trying to open an unloaded human.

What you *can* get in 15 seconds is **narrow and deep on one axis: the fork.**

> **Specimen:** "One sentence — what are you deciding between?"

That single question returns two of the eight ledger fields, and specifically the two whose
absence killed calls: *the decision as a question*, and *the real options*. It is answerable
in ten seconds by anyone who actually has a live decision. What a person cannot do quickly is
explain their context; what they can always do quickly is name the fork.

**Why skipping the rest of the ledger is not cheating here.** The ledger exists for two
reasons: to stop the agent inventing options, and to make the brief executable. With both
options named by the human in the first turn, the agent has nothing to invent — the A3/A5
boundary holds. Brief quality is the thing that genuinely degrades, and that is listed as a
cost in §1.5.7, not hidden.

**If the library is not loaded by 17:00**, this question is still the opening — it just means
the north-star turn has to carry more, and the sprint gets riskier rather than impossible.

### 1.5.3 The budget

Five agent turns. ~70 words of agent speech total — comfortably inside the 40-word cap
without trying.

| Clock | Turn | Buys |
|---|---|---|
| 0–12 s | **Fork.** *"One sentence — what are you deciding between?"* | decision-as-question + option set |
| 12–30 s | **North star, with the stakes folded in.** *"If the right one works, what's different next week?"* | the reference chunk **and** the stakes, in one question |
| 30–55 s | **One engine move**, chosen by the sidecar from the §3.2 table | kills an option or an attribute → one option standing |
| 55–72 s | **Commit + clock.** *"Finish it: I'm going to ___."* then *"When — what's happening right before?"* | the sentence (S1, S2) + the if-then cue |
| 72–88 s | **The offered exit.** *"And if you just didn't? What happens?"* | S4 — the landing, tested |
| on hangup | brief generated post-call, renders on screen | the handoff |

Folding stakes into the north-star question is the one real compression: *"if the right one
works, what's different next week?"* returns where they're going and what it's worth in a
single answer. The near-term horizon ("next week" rather than "in a year") is deliberate — it
keeps the answer concrete enough to be usable as a reference immediately.

### 1.5.4 What survives, collapses, and drops

| Phase | Sprint |
|---|---|
| 0 Frame and dump | **dropped** — replaced by the fork question |
| 1 Mirror / split the ask | **dropped.** Biggest risk taken: no Phase 1 means no protection against doc 01 §4.3's flinch (deciding a different question than the one asked). Mitigated only by the fork question being narrow by construction |
| 2 Stakes | **collapsed** into the north-star turn |
| 3 North star | **survives** — carries double duty. Non-negotiable; see below |
| 4 Ground truth | **dropped** — sourced from the library, or absent |
| 5 Map | **collapsed** to the fork answer. No "do nothing" probe (see Q1) |
| 6 Free deletions | **merged** into the single engine turn — if a free deletion is available, that *is* the move |
| 7 Narrow | **one move only** |
| 8 Unlock | **dropped as a phase.** Its offered-exit half is kept as S4 and does the work |
| 9 Commit / domino / brief | **survives.** Commit and clock on the call; brief post-call |

### 1.5.5 Which single phase carries the weight

**Phase 3, the north star — and the engine move is what you see.**

That looks backwards, so: in 90 seconds you can only afford 2-item questions (§2). The north
star is the only thing that makes a 2-item question possible, because it is the fixed
reference the comparison runs against. Without it, every question costs 3+ items and the
sprint cannot pay for even one. **One turn buys the affordability of every turn after it.**

What the audience experiences as the moment is the engine move at 30–55 s. So the sprint has
exactly one load-bearing judgment in it: **which single move the sidecar picks.** Get it
right and it lands; pick a 3-item move when a free deletion was available and the clock is
gone. This is the only thing worth rehearsing.

Priority when only one move is affordable — tighter than §3.2:

1. **Evacuate a voice** (#1) if any attribute's owner is not the decider. Cheapest, highest
   yield in the whole v1 corpus, and it lands emotionally as well as structurally.
2. **North-star check** (#3) if either option is visibly off-axis. Kills an option in one
   2-item question.
3. **Equalize-then-choose** (#4) otherwise. The workhorse, 3 items, always available.
4. **Self-distance** (#7) only if the first three somehow don't apply. Powerful, but on stage
   it can end the call before the commitment turn.

### 1.5.6 The gate does not get cut — and the failure is designed

Still 3 of 4 signals. The gate is the cheapest part of the whole protocol — ~20 seconds — and
it is the part that must not be touched, because *a decision that doesn't land is worse on
stage than no demo.* S1 and S2 are free (the stem and a token check). S3 is free (it either
happens or it doesn't). S4 costs one 16-second exchange and is non-negotiable: it is the only
signal that catches a person agreeing to be agreeable, and a live audience is exactly the
condition that manufactures agreeable yeses.

**If the gate does not pass on stage, the agent must not fake a landing.** Define this path
and build it, because it is the one most likely to run:

- It names what is unsettled, in their words, as a question — not an apology, no meta-talk
  about the conversation.
- It emits a brief anyway, whose **action is resolving the unsettled thing**, with
  `gate.signals_passed` short and honest and `decision` recording the open question rather
  than a fabricated commitment.
- Nothing in the voice changes. No "we didn't get there."

An agent that declines to claim a landing it did not get is a live demonstration of A3 —
it cannot determine your truth, so it will not pretend to have found it. That is a better
90 seconds than a smooth fake, and it is the version that survives a judge asking a hard
question afterwards.

### 1.5.7 Config deltas — the biggest clock saving is not in the script

| Setting | Full | Sprint | Why |
|---|---|---|---|
| Client VAD window | ~4 s + soft check-in | **1.2–1.5 s, no check-in** | At 4 s across five turns this is ~20 s of dead air — **22% of the entire budget.** The soft check-in (*"still thinking"*) costs a further turn and 3 s. Max knows the protocol and will not take long pauses; a stranger would, which is another reason sprint mode is not for strangers |
| Verbal handoff cue | optional | **on** — "done" / "that's it" short-circuits the wait | doc 02 §2.2(b). Free, and it removes the cutoff risk that dropping the VAD window introduces |
| Socket | opened when ready | **pre-warmed before walking on** | ~3 s cold-start latency on the first turn, no pre-warming API (doc 02 §2.4). Three seconds of silence as the demo opens is the worst three seconds available |
| `contextWindowCompression` | required | not needed at 90 s | leave it on; it costs nothing |
| Brief | read back on the call | **post-call, rendered on screen** | the read-back costs ~20 s the sprint does not have. It is also a better visual: the brief appearing as the call ends. This resolves doc 02's open question *for sprint mode only* |

### 1.5.8 What you give up — plainly

- **Brief quality.** No success test, no out-of-scope, thin constraint. The action will have a
  named object and an if-then cue (those are enforced), but the executing agent gets less
  context than full mode would give it. Visible to a judge who reads the JSON.
- **The flinch protection.** No Phase 1 split means if he brings a surface question with a
  real one underneath, the sprint decides the surface one. Choosing what to bring is the only
  control here.
- **Depth.** Phase 8's unlock — *"what's stopped you from already doing this?"* — was the
  highest-yield question in 24 calls and the sprint cannot afford it as a phase. The decision
  will be real but it will not be the one that cracks something open.
- **The stranger case.** Sprint mode is not a product mode. It is a demo mode for a loaded,
  rehearsed caller. If a judge asks to try it themselves, that is **full mode**, and the
  honest answer is "this takes ten minutes — want to?"
- **Margin.** Five turns at 90 seconds has no slack. One clarifying exchange, one ASR repair,
  one long pause and it is 120 seconds. Plan the demo at 90 and be ready for 120.

### 1.5.9 Rehearsal (superseded by §1.6.6)

Run it three times before 17:00, on three real decisions, and log per run: which engine move
the sidecar chose, wall-clock to the commitment sentence, and which gate signals fired. If
two of three runs pick the wrong move or overrun 110 seconds, the thing to change is the
move-priority list in §1.5.5, not the clock.

---

## 1.6 Sprint mode, revised for cold start — **this is the build spec**

**Supersedes §1.5.1–§1.5.5 and §1.5.7.** No context library, no returning-user assumption.
Max states the problem live. §1.5.6 (do not fake the landing) is unchanged and still binds.
This is the section chat 05 should install against.

### 1.6.1 The correction

I said loading a problem costs 8–20 minutes. That conflated two different costs:

| | What it is | Cost |
|---|---|---|
| **Excavation** | the agent pulling the ledger out question by question, ~15–20 s per exchange, 20+ exchanges on a tangled problem | **8–20 min** — real, and what the v1 corpus shows |
| **Delivery** | the human saying it all in one monologue | **the length of the monologue** |

Sprint mode needs delivery, not excavation. And delivery is cheap: doc 01's threshold dump —
≥130 words, which predicted every v1 decision that landed — is **52 seconds of speech** at a
normal 150 wpm. A deliberately simple fork needs 60–90 words, so **24–36 seconds.**

The thing that makes delivery work instead of excavation is Phase 0 doing exactly its job:
**instruct the dump, name its parts, bound it out loud, then go silent.** The time bound is
the mechanism that replaces the library. Say the number:

> **Specimen:** "Give me the whole thing in about thirty seconds — what you're deciding
> between, and what's pulling each way. I'll stay quiet."

~22 words. Instructs rather than invites, names its parts, bounds the clock, promises silence.
Generated fresh per §1.0, but those four properties are the spec.

### 1.6.2 Where the 110 seconds goes

Agent turns are **8–12 words, 3–5 s** in sprint. The 40-word cap in §1 is a ceiling, not a
target; short questions are the whole reason this fits.

| Clock | Who | Turn | Buys |
|---|---|---|---|
| 0–9 s | agent | bounded dump instruction (~22 w) | Phase 0 |
| 9–45 s | **human** | **the dump (~90 w)** | decision-as-question, options, constraint, whose voice, what's tried |
| 45–49 s | agent | *"If the right one works, what's different next week?"* | — |
| 49–61 s | human | answer | **north star + stakes** (Phases 2–3 folded) |
| 61–65 s | agent | the one engine move, chosen per §1.5.5's priority list | — |
| 65–78 s | human | answer | one option standing (Phases 5–7) |
| 78–81 s | agent | *"Finish it — I'm going to…"* | — |
| 81–88 s | human | the sentence | **S1, S2** |
| 88–91 s | agent | the offered exit, from their own stakes answer | — |
| 91–99 s | human | answer | **S4 — the landing, tested** |
| 99–102 s | agent | *"When — what's happening right before?"* | — |
| 102–108 s | human | answer | the if-then cue |
| on hangup | — | brief renders on screen | the handoff |

**+ ~3 s** first-turn cold-start latency and **~6 s** total VAD settling across five short
turns → **~117 s worst case, ~108 s if it runs clean.**

Six agent turns, ~70 words of agent speech in total. The human talks for roughly 75 of the
110 seconds, which is the correct ratio and the opposite of v1's failure.

### 1.6.3 The dial: the dump length sets the total, almost linearly

| Dump | Spoken | Total run | Fits a 2-min slot with… |
|---|---|---|---|
| 60 words | 24 s | **~95 s** | 25 s for framing and the brief on screen |
| 90 words | 36 s | **~108 s** | 12 s — tight, call-is-the-demo |
| 130 words | 52 s | **~124 s** | nothing. Over slot |

Every other term is fixed by the protocol. **The problem he picks is the clock.** If the
2-minute slot has to also carry a sentence of framing and a look at the brief, he needs a
60–75 word problem, which is §1.6.4's lower bound.

### 1.6.4 **The decision to bring — the spec**

> Bring a **two-option fork you already feel both sides of, that turns on two things at
> most** — three if one of them is obviously equal on both sides and can be waved away in a
> breath. Aim for a **60/40 lean, not 90/10 and not 50/50**: enough tension that the landing
> is real, enough lean that a single question can resolve it. You must be able to state the
> whole thing in **under 90 words, in about thirty seconds, with no backstory** — the test is
> that you never say "because" more than once and you never name a person, company or project
> the room hasn't already heard of. It must be **genuinely undecided right now** (if it
> isn't, the gate will pass hollow and anyone sharp will read it as theatre), and it should be
> **reversible** — a two-way door decided in ninety seconds reads as decisive, an
> irreversible one reads as reckless. **What blows the budget:** three or more live options;
> four or more criteria; anything that needs another person's motives ("how my cofounder
> would feel" is a column you can't evaluate without a conversation you haven't had);
> anything resting on a number you'd have to recall or estimate out loud; anything where the
> real question is underneath the stated one, because the sprint has no Phase 1 split and
> will decide the surface.

Shapes that work: which of two things to ship first; which of two people to call first;
whether to do X tonight or tomorrow morning; which of two framings to lead with. Shapes that
don't: whether to take a job, how to price something, anything involving the cofounder,
anything you've been chewing on for months — those are full-mode decisions and they are the
*reason* full mode exists.

**On picking a decision about the hackathon itself:** it is the most available honest option
and it demos well. It also risks reading as cute to a judge. That is a taste call, so it is
yours, but the shape spec above is what matters, not the subject.

### 1.6.5 Config — the VAD fix is mandatory

**§1.5.7's flat 1.2–1.5 s window is a bug in a cold start.** People pause inside a 35-second
monologue, and the v1 corpus has 11 interrupt protests — including *"I said hang on. I said
hang on"* — proving this is the failure that actually happens. Make the window
**phase-dependent**:

| Phase | VAD window | Why |
|---|---|---|
| **The dump** (0–45 s) | **3.5–4 s, plus the verbal cue** | A cut-off here kills the demo outright. This is the one turn where being wrong is unrecoverable, so pay the 4 s |
| **Everything after** | **1.2–1.5 s, no soft check-in** | Answers are short and he knows what's coming. The check-in costs a turn and 3 s |

Also: **verbal handoff cue on** (doc 02 §2.2b) — "done" / "that's it" short-circuits the dump
wait, and it is the thing that makes a 4 s window cost nothing in practice. Teach it in the
opening turn or not at all; one clause is enough. And **pre-warm the socket before walking
on** — 3 s of silence opening the demo is the worst 3 s available.

Everything else from §1.5.7 holds: brief generated post-call and rendered on screen, not read
back on the call.

### 1.6.6 Rehearsal — the actual deliverable

Three runs before 17:00, on three different real decisions that each satisfy §1.6.4. Log per
run: **words in the dump, wall-clock to the commitment sentence, which engine move the
sidecar picked, which gate signals fired.** Then:

- Two of three runs over 115 s → the problems are too big. Tighten to a 60-word dump.
- The sidecar picks a 3-item move when a free deletion was available → fix §1.5.5's priority
  list, not the clock.
- Gate fails on a run → good. That is the §1.5.6 path and you want to have seen it once
  before a judge does.

---

## 2. Why the north star is first — the load argument

This is the part worth getting right, because it is the reason the protocol is shaped the
way it is and it is not obvious.

A decision with *m* options and *n* things that matter is an *m×n* grid. Three options and
four attributes is twelve cells. Nobody holds twelve cells in speech: capacity is about four
chunks (Cowan 2001, *Behavioral and Brain Sciences* 24(1):87–114), and the focus of
attention — the part doing the actual comparing — holds roughly one item at a time
(Oberauer 2002). Miller's 7±2 is the wrong number to design against; it measured performance
including rehearsal and chunking, which a live phone call does not permit.

So the protocol has to decompose the grid into questions of size ≤3. There are only four
question shapes available, and they are not equally cheap:

| Shape | Items the human holds | Example | Cost |
|---|---|---|---|
| One option vs. a **fixed reference** | option + reference | "Does that get you closer to *X*?" | **2** |
| One option vs. **itself over time** | option + future self | "Is that still true in a year?" | **2** |
| Two options on **one** attribute | A + B + attribute | "Which costs you less sleep?" | **3** |
| Two options across all attributes | A + B + n attributes | "So which is better overall?" | **≥4 — never ask** |

The reference-comparison is the cheap one, and it is cheap *only if the reference is already
loaded and stays loaded*. That is what the north star is: a single chunk, installed once,
re-used for free in every subsequent question. Install it early and most of the call runs on
2-item questions. Skip it and every question is a 3-item question at best, and the call runs
out of clock before it runs out of grid — which is exactly what happened in the 16- and
26-minute v1 calls that found real material and never decided.

This is also why the north star must be re-said **verbatim**. A paraphrase is a new chunk;
the same six words are the same chunk. Cheap to say, and it is the difference between a
2-item question and a 3-item one.

**The three acts, restated as engineering:** act 1 installs the reference, act 2 fills the
cells with facts instead of story, act 3 spends the cheap comparisons first. C1 is a working
memory schedule. It happens also to be true in the way Max means it, but the engineer
doesn't need that part to implement it correctly.

---

## 3. The comparison engine

### 3.1 The invariant

Maintain two live sets: `options` and `attributes`. After Phase 5, **every agent turn must
remove at least one element from one of them.** `len(options) + len(attributes)` is
monotonically non-increasing. Log it per turn. A turn that doesn't shrink the set is either
a Phase 8 unlock question or a bug.

This is the whole engine in one line. Everything below is just how to pick the move.

### 3.2 Move selection — strict priority order

At each turn, take the **first** move that is available. Cheapest first, always: a cheap move
that deletes an item makes every later move cheaper, which is the sequencing property the
whole thing needs.

| # | Move | When it's available | Cost | What it deletes |
|---|---|---|---|---|
| 1 | **Evacuate a voice** — "Whose voice is in this besides yours? Set them outside the room." | any attribute whose owner is not the decider | 2 | a whole attribute, for free |
| 2 | **Collapse an equal attribute** — "Money's about the same either way. Fair?" | two options within noise on one attribute | 2 | that attribute |
| 3 | **North-star check** — "Does that get you closer to *[their six words]*, or just make this month calmer?" | any option | 2 | an option |
| 4 | **Equalize-then-choose** — "If the money were identical, which one are you taking?" | the attribute with the biggest apparent gap | 3 | that attribute *or* an option |
| 5 | **Dominance ask** — "Is there anything A gives you that B doesn't?" | one option looks worse on every live attribute | 3 | an option — *and they delete it, not you* |
| 6 | **Regret probe** — "A year out, which one do you not want to have skipped?" | exactly 2 left, close | 3 | an option (changes which attributes count) |
| 7 | **Self-distance** — "If a friend told you exactly this, what would you tell them?" | stuck: two consecutive turns with no deletion | 2 | collapses the whole grid into one judgment |

Move 4 is the workhorse and it is Even Swaps with the arithmetic removed. Published Even
Swaps asks for a *match* — "how much salary makes this commute acceptable?" — and matching
is both hard out loud and psychometrically different from choosing: the more prominent
attribute gets more weight in choice than in matching (Tversky, Sattath & Slovic 1988). Since
we want the weights that govern *choice*, we should be asking a choice. "If X were the same
on both, which one?" equalizes the attribute by assumption and then asks for a choice. Same
structural effect — the attribute becomes irrelevant and drops out — in one sentence, with no
numbers.

Move 7 is C12, and it has a real result behind it: cueing people to reason about their own
meaningful problems from a distanced perspective measurably improves the quality of the
reasoning (Kross & Grossmann 2012). Spend it when stuck, not early — it is powerful enough
to end the call prematurely if the grid isn't loaded yet.

### 3.3 Query order — the anti-steering rule

Whichever side of a comparison gets queried first dominates the answer. Johnson, Häubl &
Keinan (2007) showed that merely reordering the queries eliminates the endowment effect, and
can manufacture it without any ownership — value is constructed in the order you ask.

So: **always query both sides of a pair, starting with the side the human did not volunteer.**
If they came in leaning toward A, ask about A's costs first.

- They lean A → "What does A cost you?" *then* "What does B give you?"
- They lean B → "What does B cost you?" *then* "What does A give you?"
- No lean → ask about the option they named *last*, first.

This is the concrete mechanism behind A3 — "it helps find the truth because it cannot
determine the truth itself." An agent that always queried in the order offered would simply
amplify whatever the person walked in with and call it their intuition. Querying against the
lean is how the protocol stays genuinely neutral, and it is one line of state: `lean` ∈
{A, B, none}. From the outside it sounds like nothing but interest.

### 3.4 Dominance, and why the human has to do the deleting

The goal of the whole engine is to reach a state where one option is better on everything
still live — Montgomery (1983) called this *dominance structuring*, and it is a decent
description of what people do naturally: they restructure the problem until one option
dominates, rather than computing a weighted sum. Svenson's differentiation and consolidation
work describes the same shape, pre- and post-decision.

The protocol's job is to make that structure arrive honestly: by deleting attributes the
person agrees don't matter, not by quietly re-weighting them. And when dominance arrives, the
agent must **not announce it.** Announcing it is advising. Ask instead: *"Is there anything A
gives you that B doesn't?"* Silence or "no" and the option is gone, deleted by them. This is
B1 and B4 made mechanical.

### 3.5 Worked example — `e228af16` re-run

Real call from the corpus. Opening ask: *"I can't even make the time to job search because of
having to build and maintain the agents."* v1 took 20 minutes and answered a different
question. Same material through this engine:

| Turn | Move | Live set after |
|---|---|---|
| Phase 1 | split the ask: time problem vs. want-the-job problem; today = the time problem, identity → `out_of_scope` | 3 options × 5 attrs |
| Phase 2 | stakes: *"another month like this and the runway's gone"* — cost named, in his words | `cost_of_not_deciding` |
| Phase 3 | north star: *"somewhere already working, building"* | reference installed |
| Phase 4 | binding constraint: runway, six weeks. Tried already: searching at night, didn't hold. | facts loaded |
| 1 | **#1 evacuate** — sister + brother-in-law out of the room | 3 × **4** |
| 2 | **#3 north star** — "does going all-in on the agency get you *somewhere already working*, or is it the calmer month?" → option C out | **2** × 4 |
| 3 | **#2 collapse** — "obligation to the clients is the same whichever way, right?" | 2 × **3** |
| 4 | **#4 equalize-then-choose** — "if the money were identical for 60 days, are you keeping all three?" → *no* | 2 × **2** |
| 5 | **#5 dominance ask** — "anything keeping all three gives you that handing one back doesn't, other than money?" → *no* | **1** × 2 |
| Phase 8 | **unlock** — "what's stopped you from telling that client already?" then his own number back as the offered exit | the real constraint |
| Phase 9 | "I'm going to hand back the smallest client this week" → domino → if-then cue → brief | emit |

Five engine turns, none of them over three items, each one smaller than the last. The move
that broke the real call open (evacuating the in-laws) is move #1 here because it is the
cheapest deletion available, not because it is emotionally dramatic — and it still lands the
same way for the human.

---

## 4. The completion gate

C2: *"only I know once it's reached the right level of depth."* That is correct and it is
also unimplementable as stated, because the person who says yes to be agreeable says it in
the same words as the person who means it. So: give the human the authority, but **never ask
for it in a yes/no shape.**

### 4.1 Four signals. Require 3 of 4.

| Signal | Test | Grounding |
|---|---|---|
| **S1 — commitment language** | Final sentence contains a commitment verb in first person future ("I'm going to", "I will", "I'm doing"), not desire/ability/need ("I should", "I want to", "I could", "I need to", "that makes sense"). | Amrhein et al. 2003: commitment *strength* predicted outcomes; desire, ability, reasons and need did not. This is the one signal with a prediction study behind it. |
| **S2 — novel content** | The verb **and** the object in their sentence are tokens the agent never uttered in this call. Set-difference against the agent transcript. Fails → it's compliance; go back and ask differently. | `02-v2-conversation-spec.md` §5, made checkable. |
| **S3 — unprompted elaboration** | After the commitment sentence they keep going without being asked: a reason, a detail, a caveat. ≥~15 further words, agent silent. An agreeable yes is short and terminal. | Corpus pattern, not a published finding. **Thin — the cheapest of the four to be wrong about.** |
| **S4 — survives the offered exit** | The agent hands them an easy way out and they decline it. Built from `cost_of_not_deciding` — their own Phase 2 figure, handed back as a question — or failing that, "what's the strongest case against it?" Taking the exit → not landed. | Inverts the known failure: models and the human preference data behind them reward agreement over correctness (Sharma et al. 2023). Build a test that rewards disagreement, and the sycophancy loop can't satisfy it. Post-decisional, this question draws self-justification by default (Lerner & Tetlock 1999) — so someone who takes the exit anyway is giving you real information. |

**S4 is the one that catches the agreeable yes.** The other three can all be produced by a
cooperative person who wants the call to end.

### 4.2 Ask the negative question

Never *"does that sound right?"* or *"are we done?"* — both are satisfiable by a nod. Ask the
form that presupposes a remainder and makes it cheap to name:

- "What's still unsettled?"
- "Tell me what's wrong with it."
- "What part of that are you least sure about?"

"Nothing" in answer to *"what's still unsettled?"* is a real signal. "Yes" in answer to
*"are we settled?"* is not.

### 4.3 The deferral branch

If the output is "I'll decide later," that is an unlanded call (doc 01 §4.2) — but do not
override them. Convert it: *"That's a decision to wait. So what has to be true, by when, for
you to decide then?"* Then the brief's action is the thing that makes the later decision
possible, and `decision` records the wait. A landed call, honestly.

### 4.4 Max's own tell — C14, and I'd ship it as telemetry, not as a gate

C14: true insight brings you *into* the present; noise takes you out. There is a plausible
voice signature — after a real landing, speech gets shorter, slower, concrete and
present-tense (*"okay. yeah. I'm doing that tonight."*); after a false one it gets abstract
and future-conditional (*"I think that would probably be good for me in general"*). The v1
corpus is consistent with this, but 24 calls with no labels is not evidence.

**Recommendation:** log it (tense, word count, speech rate on the post-commitment turn), show
it in the demo UI, and do **not** let it gate anything today. It is the most interesting thing
in here to measure and the least defensible thing to depend on.

---

## 5. The brief

Extends the schema in `02-v2-conversation-spec.md` §7.1. Three additions, each earning its
place: the **if-then cue** (the one change most likely to make the action actually happen),
the **domino rationale** (C5/C16 — the *why this one*), and **gate provenance** (so the
receiving agent and the judges can both see how firm this is).

```jsonc
{
  "mission_id": "uuid",
  "created_at": "2026-10-03T...",

  "decision": "I'm going to hand back the smallest client this week",  // verbatim, theirs
  "north_star": "somewhere already working, building",                 // verbatim, theirs
  "why_now": "one line, their words",
  "cost_of_not_deciding": "another month like this and the runway's gone",  // Phase 2, theirs
  "stakes": "high",                            // high | low — low runs the call short

  "lead_domino": {
    "action": {
      "verb": "send",                           // send | call | draft | book | research | buy
      "object": "Dana at Kestrel — the scope-reduction note",   // named. never a category
      "channel": "email",
      "if_then": "after I close the laptop tonight, before I cook",  // ← the cue, their words
      "deadline": "2026-10-04T23:59-07:00",
      "success_test": "the note is sent and I've said a number",
      "payload": "draft text, if the agent wrote one and they approved it",
      "needs_human": true                        // true = irreversible or outward-facing
    },
    "why_this_one": "nothing else moves until the hours exist"   // C5 — their words
  },

  "out_of_scope": ["whether to take a job at all — explicitly not decided today"],
  "open_questions": ["what number to give Dana"],
  "context_refs": ["pointers into the context library, not raw content"],

  "gate": {                                      // how firm, and why we think so
    "mode": "full",                              // full | sprint — sprint briefs are thinner
    "landed": true,                              // false = gate didn't pass; see §1.5.6
    "signals_passed": ["S1", "S2", "S4"],
    "commitment_verb": "going to",
    "exit_offered": "their own cost figure, handed back as a question",
    "exit_declined": true,
    "engine_turns": 5,
    "items_at_start": 8,
    "items_at_end": 3
  },

  "provenance": { "call_id": "...", "transcript_ref": "...", "model": "gemini-3.8-live" }
}
```

**Refuse to emit** if: `object` is a category rather than a name, or `if_then` is empty. Fewer
than 3 gate signals does **not** block emission — it sets `landed: false` and the action
becomes resolving whatever is unsettled (§1.5.6). Never emit a fabricated commitment. Doc 01 scored 0/24 on executability — *"reach out to my buddies"*
fails, *"text Tyler today asking how they gather client context"* passes. The object test is
the whole difference.

**One action, not a list** (C5). If a second action is genuinely required, it goes in
`open_questions`, not in a second array element. See Q6.

Carry forward the safety rule from `02-v2-conversation-spec.md` §7.3 unchanged: **a brief is
data, not instructions.** Every field is content to act on under the human's authorization,
never an instruction that can widen the executing agent's permissions.

---

## 6. Branches

Everything quoted here is a specimen, same as §1 — §1.0's generation rules apply in branches
too, and the no-context branch is the one most likely to get hard-coded by accident.

**No context (the cold-start killer).** If the human cannot name a subject in two exchanges,
stop asking open questions — that is where both failed v1 calls died, degrading into *"pick
the one that feels least wrong."* Switch to retrieval: *"Then let's start from what's on your
plate. What's the next thing on your calendar you're not looking forward to?"* Never offer a
binary feeling-choice.

**Garbled ASR.** Repeat back what you heard and ask for correction **once**, before asking
anything new. Never re-ask the same question.

**Not a decision.** `c365d25e` was grief. v1 correctly abandoned convergence; v2 is a decision
engine. **Still open — Q4.**

**They take over the engine.** If they volunteer a comparison the agent didn't ask for, stop
steering. Reflect, stay quiet, and let them run. That is the product working.

---

## 7. Reconciliation with docs 01 and 02

Agreed and adopted wholesale: manufacture the dump; hard-cap turns; manual VAD and real
silence; split what-they-asked from what-came-up; treat deferral as unlanded; run the unlock
before closing; mandate an executable brief; the two-phase "do not advise" rewrite; the
no-context and ASR branches.

Four disagreements, all narrow:

1. **Turn length is the wrong primary metric.** Doc 01 principle 2 caps agent turns at ~40
   words. Right in effect, wrong in cause: the constraint is *items*, not words. Give the
   engineer the item rule as primary (≤3 items, 1 question) and keep ~40 words as the proxy
   that's easy to check. This also resolves doc 01's own Q3 — the floor isn't a word count,
   and the confound it worries about (Max talks in 300-word blocks) disappears once you count
   items.

2. **The dump threshold should not be a requirement.** Doc 01's ≥130-word finding rests on six
   decision-landing calls, which the doc honestly flags. Don't gate on word count — gate on
   the **eight ledger fields** from `02-v2-conversation-spec.md` §4. The dump is just the
   cheapest way to get them, and a 7-word opening that produced 16 minutes of real material
   (`becddd65`) shows the word count isn't the causal thing.

3. **Specify the ledger's fill order; right now it's a set.** Doc 02 §4 says ask at most one
   missing field per turn, which is right, but leaves order open — and order is exactly what
   determines the constructed answer (§3.3). Fill order: *decision-as-question → north star →
   binding constraint → options → whose voices → tried-already → success test → deadline*. The
   north star is second, not last, for the reason in §2.

4. **§4.3's "answering a different question" wasn't the wrong answer — it was the unretired
   question.** Doc 01 reads `e228af16` as a flinch because it closed on identity and never
   touched logistics. I'd argue the identity decision was probably the right one; the failure
   was leaving the human waiting on a question nobody ever closed or cancelled. Hence Phase 1
   retiring it out loud and `out_of_scope` carrying it, rather than a rule about returning to
   it.

5. **Doc 02 §3 ships a fixed opening string; that is now disallowed.** Its replacement
   opening is quoted verbatim as the turn to use. The three properties it identifies —
   instructs rather than invites, names its parts, promises silence — are exactly right and
   are kept as Phase 0's spec. But the string itself must not ship (§1.0): a returning caller
   hearing the identical sentence twice learns that nothing is listening. Same for doc 02 §5's
   quoted convergence moves — keep the moves, generate the words.

**Doc 02's open questions I'd answer the same way it does:** hybrid turn-end detection (§2.2d);
Claude sidecar for the ledger (§4c) — and note the sidecar is also where the live-set invariant
and the query-order state live, so it earns its place twice; fill the brief silently and read
it back once.

---

## 8. Open questions for Max

**Q1 — May the agent ever name an option the human didn't? This one blocks the build.**
The engine never needs to: it only neutralizes attributes. But two real cases push on it — the
option "do nothing for another month" (Phase 5), which humans almost never volunteer and which
the corpus shows matters; and move #6, where a regret probe sometimes surfaces a third path.
Options: (a) never — strictest A3/A5, and the engine still works; (b) only "do nothing", as a
completeness check; (c) the agent may name an option but must immediately hand it back
("that's probably not it, but is it on the list?"). *My read: (b). It is one hard-coded
exception, not a judgment call the model gets to make.* **Your call — it changes the code and
it changes the claim.**

**Q2 — Pacing: fast or slow?** B11 wants shorter, swifter turns; B13 wants long pauses and
meditative pacing. Both yours, both right. Concrete proposal: fast in Phases 1, 4, 5, 6 (fact
and bookkeeping work, short questions); slow in 0, 2, 3, 7, 8 (dump, stakes, north star,
narrowing, unlock). One flag per phase. **Pick, or tell me it's two modes.**

**Q3 — Always run the offered exit (S4)?** It is the only signal that catches the agreeable
yes, and it risks deflating a genuine moment by asking someone to argue against what they just
committed to. Options: (a) always; (b) only when ≤2 of the other three signals fired;
(c) never on a first-time caller. *My read: (b) — but this is a feel call about your product,
not an evidence call.*

**Q4 — What happens when it isn't a decision?** Still open from doc 01 Q4 and doc 02 §9.
`c365d25e` was grief. Refuse, redirect, or hold space and skip the handoff? The protocol needs
one of the three; I won't pick it.

**Q5 — Does the north star get asked, or loaded?** If BYOCL (D1/D2) already holds it, Phase 3
could be a one-line confirmation on a returning caller — cheaper and it makes the context
library visibly earn its place in the demo. But a stale north star silently mis-steers the
entire engine. Ask every time, confirm-only, or confirm with an expiry?

**Q6 — How hard is "one action"?** C5 says one. If the lead domino genuinely needs two steps
(call, then send), does the brief emit two actions, or refuse and force a smaller domino? *My
read: force the smaller domino* — but that is your idea and your call.

**Q7 — When someone understates their own stakes, may the agent push?** The new Phase 2
creates a case the rest of the protocol doesn't have. Someone says "eh, it's not that big a
deal" about a thing that, from their own dump, clearly is. B5 says don't be a yes-man; the
anti-coercion rules say don't tell them what their life costs. Options: (a) accept it and run
the short call — safest, occasionally lets someone off the hook they called about;
(b) reflect the contradiction once, as a question, and accept whatever comes back ("you also
said the window closes in March — is that not pressing?"); (c) treat minimisation as a block
and route it to Phase 8's unlock. *My read: (b) — one observation, asked, then drop it. It is
B7's "can I make an observation?" exactly.* **Your call; it is a tone decision about your
product.**

**Q8 — Does sprint mode ship, or is it demo-only?** I've written it as demo-only (§1.5.8): it
assumes a loaded library and a rehearsed caller, and on a cold stranger it reproduces the
exact condition that killed both failed v1 calls. But "90-second decision" is a far better
consumer hook than "ten-minute call," and F1's pay-by-talk-time model makes short calls
cheap for the user. Options: (a) demo-only, full mode is the product; (b) ship both and let
the caller pick; (c) ship sprint as the default and escalate to full when the fork question
doesn't return two options — *this is the interesting one and it is maybe 20 lines of routing
logic.* **Your call.**

**Noted, not a question:** `CRITICAL-PATH.md` frames the demo as agents buying phone capability,
while this protocol and docs 01/02 describe a human calling in. The protocol is the same either
way — the brief is the product in both — but the submission copy has to pick a subject for the
sentence "who is on the phone." Flagging only because it is cheaper to notice now than at 16:15.

---

## 9. Sources

Verified: every item below was checked against a publisher, abstract or indexed record today.
Nothing here is reconstructed from memory.

**The capacity constraint (§2)**
- Cowan, N. (2001). The magical number 4 in short-term memory: A reconsideration of mental
  storage capacity. *Behavioral and Brain Sciences*, 24(1), 87–114.
  doi:10.1017/S0140525X01003922 — capacity is 3–5 chunks; Miller's 7±2 was a rough estimate
  including rehearsal and chunking. Also Cowan (2010), *The Magical Mystery Four*, *Current
  Directions in Psychological Science*, for the shorter restatement.
- Oberauer, K. (2002). Access to information in working memory: Exploring the focus of
  attention. *JEP: LMC*, 28(3), 411–421. doi:10.1037/0278-7393.28.3.411 — the focus of
  attention holds roughly one item; object-switch costs. This is why ≤3 items, not ≤4.
- Sweller, J. (1988). Cognitive load during problem solving. *Cognitive Science*, 12(2),
  257–285. Background for the one-question-per-turn rule. Not load-bearing here.

**The engine (§3)**
- Hammond, J. S., Keeney, R. L., & Raiffa, H. (1998). Even swaps: A rational method for making
  trade-offs. *Harvard Business Review*, 76(2), March–April. Also *Smart Choices* (1999).
  The structural backbone of §3: make an attribute irrelevant, then drop dominated
  alternatives. **Caveat applied:** its published question is a matching question.
- Tversky, A., Sattath, S., & Slovic, P. (1988). Contingent weighting in judgment and choice.
  *Psychological Review*, 95(3), 371–384. The prominence effect — the more prominent attribute
  weighs more in choice than in matching; weighting depends on response mode (compatibility).
  **This is the justification for replacing Even Swaps' matching question with a choice.**
- Johnson, E. J., Häubl, G., & Keinan, A. (2007). Aspects of endowment: A query theory of value
  construction. *JEP: LMC*, 33(3), 461–474. Reordering queries eliminates the endowment effect
  and can produce endowment-like effects without ownership. **Grounds the query-order rule
  (§3.3).** Note: a query-theory meta-analysis exists (2025) — worth a look post-hackathon.
- Montgomery, H. (1983). Decision rules and the search for a dominance structure. In Humphreys
  et al. (eds.), *Analysing and Aiding Decision Processes*, North-Holland. Dominance
  structuring: people restructure until one option dominates. Frames §3.4.
- Svenson, O. (1992). Differentiation and consolidation theory of human decision making.
  *Acta Psychologica*, 80(1–3), 143–168. Pre-decision differentiation, post-decision
  consolidation. Supporting, not load-bearing. **Descriptive theories — well cited, not
  heavily experimentally adjudicated. Marked soft.**
- Tversky, A. (1972). Elimination by aspects: A theory of choice. *Psychological Review*,
  79(4), 281–299. How people already narrow, one attribute at a time — the descriptive
  counterpart to Even Swaps' prescription.
- Saaty, T. L. (1977). A scaling method for priorities in hierarchical structures. *Journal of
  Mathematical Psychology*, 15(3), 234–281. Pairwise comparison, justified via Miller's limit.
  **Deliberately not used:** full AHP needs n(n−1)/2 numeric comparisons, which is a form, not
  a conversation. Cited for the lineage of "compare two at a time."
- Keeney, R. L., & Raiffa, H. (1976). *Decisions with Multiple Objectives*. Wiley. The formal
  parent of Even Swaps.
- Simon, H. A. (1956). Rational choice and the structure of the environment. *Psychological
  Review*, 63(2), 129–138. Satisficing — background for why "good enough on what's left" is a
  legitimate stopping rule.

**The conversation (§1, §4)**
- Miller, W. R., & Rollnick, S. (2023). *Motivational Interviewing: Helping People Change and
  Grow* (4th ed.). Guilford. Evocative questions, change talk, rolling with resistance.
- Amrhein, P. C., Miller, W. R., Yahne, C. E., Palmer, M., & Fulcher, L. (2003). Client
  commitment language during motivational interviewing predicts drug use outcomes. *Journal of
  Consulting and Clinical Psychology*, 71(5), 862–878. **Commitment strength predicted
  outcome; desire, ability, reasons and need did not. The strongest single result behind the
  completion gate — and the reason the target sentence is "I'm going to", not "I want to".**
- Miller, W. R., Benefield, R. G., & Tonigan, J. S. (1993). Enhancing motivation for change in
  problem drinking: A controlled comparison of two therapist styles. *JCCP*, 61(3), 455–461.
  More therapist confrontation → more client drinking at 1 year. **The empirical reason the
  agent asks instead of tells (B1).** n=42; directional.
- Braun, J. D., Strunk, D. R., Sasso, K. E., & Cooper, A. A. (2015). Therapist use of Socratic
  questioning predicts session-to-session symptom change in cognitive therapy for depression.
  *Behaviour Research and Therapy*, 70, 32–37. Questioning as the active ingredient, not just
  rapport. Correlational.
- Grove, D. — Clean Language. Primary practitioner text: Lawley, J., & Tompkins, P. (2000).
  *Metaphors in Mind: Transformation through Symbolic Modelling*. Developing Company Press.
  Academic treatment: Tosey, P., Lawley, J., & Meese, R. (2014). Eliciting metaphor through
  Clean Language: An innovation in qualitative research. *British Journal of Management*,
  25(3), 629–646. doi:10.1111/1467-8551.12042. **Thin on outcome evidence** — there is no
  controlled trial of Clean Language. What it earns its place for is the *syntax*: repeat the
  person's exact words, introduce no nouns of your own. That is directly implementable as the
  verbatim-north-star rule (§1 Phase 3), the one-word-of-theirs generation rule (§1.0) and
  the S2 token test (§4.1), and it is the best
  available articulation of A3. **Mark as method, not as evidence.**
- Kross, E., & Grossmann, I. (2012). Boosting wisdom: Distance from the self enhances wise
  reasoning, attitudes, and behavior. *JEP: General*, 141(1), 43–48. doi:10.1037/a0024158.
  Grounds C12 / move #7. See also Grossmann & Kross (2014), *Psychological Science*, on
  Solomon's paradox.
- de Shazer, S. (1988). *Clues: Investigating Solutions in Brief Therapy*. Norton. The miracle
  question — the shape of the Phase 3 north-star question. SFBT's outcome literature is
  mixed; the question form is what we're borrowing.
- Rogers, C. R. (1957). The necessary and sufficient conditions of therapeutic personality
  change. *Journal of Consulting Psychology*, 21(2), 95–103. Behind B14 (safety).

**The stakes phase (§1, Phase 2)**
- Petty, R. E., & Cacioppo, J. T. (1979). Issue involvement can increase or decrease
  persuasion by enhancing message-relevant cognitive responses. *JPSP*, 37(10), 1915–1926.
  Personal relevance drives effortful, issue-relevant thinking; low relevance drives shortcut
  processing. Extended as the Elaboration Likelihood Model in Petty & Cacioppo (1986),
  *Communication and Persuasion*, Springer. **This is the mechanism behind "they invest more
  and stop skimming."** Caveat: the ELM's home territory is persuasion by an external message,
  and here the person is elaborating on their own situation — the transfer is plausible and
  standard but it is an extension, not a direct result.
- Lerner, J. S., & Tetlock, P. E. (1999). Accounting for the effects of accountability.
  *Psychological Bulletin*, 125(2), 255–275. **Pre**-decisional accountability to an audience
  whose views are unknown prompts exploratory thought; **post**-decisional accountability
  prompts confirmatory, self-justifying thought. **This is why stakes go at Phase 2 and the
  same question becomes a test rather than an opening at Phase 8.** A review, so the effect is
  well-attested in aggregate and the moderators are many — the directional pre/post asymmetry
  is the part being relied on.

**The action (§5)**
- Gollwitzer, P. M., & Sheeran, P. (2006). Implementation intentions and goal achievement: A
  meta-analysis of effects and processes. *Advances in Experimental Social Psychology*, 38,
  69–119. 94 studies, d≈0.65 over goal intentions alone. **The reason the brief has an
  `if_then` field and refuses to emit without it.**
- Mitchell, D. J., Russo, J. E., & Pennington, N. (1989). Back to the future: Temporal
  perspective in the explanation of events. *Journal of Behavioral Decision Making*, 2(1),
  25–38. Prospective hindsight — treating a future event as already certain raises the number
  of reasons generated by ~30%. The mechanism under Klein's premortem.
- Klein, G. (2007). Performing a project premortem. *Harvard Business Review*, 85(9), 18–19.
  The practitioner form. Phase 8's "strongest case against it."
- Gilovich, T., & Medvec, V. H. (1995). The experience of regret: What, when, and why.
  *Psychological Review*, 102(2), 379–395. Inaction regret dominates over long horizons.
  Grounds move #6's "which do you not want to have skipped?"

**The failure mode we are designing against**
- Sharma, M., Tong, M., Korbak, T., et al. (2023/2024). Towards Understanding Sycophancy in
  Language Models. arXiv:2310.13548; ICLR 2024. Five frontier assistants show sycophancy
  across free-form tasks, and the human preference data itself rewards agreement over
  correctness. **This is why S4 exists:** a model optimized toward agreement cannot pass a
  test that requires the human to decline an offered exit.
- Also located and read, not relied on: *Auditing Stealth Sycophancy in Mental-Health
  Dialogue* (arXiv:2605.03472, May 2026) — proposes state-transition diagnostics for empathy
  that reinforces avoidance. Real preprint, relevant adjacent work, **not peer-reviewed and
  does not address agreeable-yes detection.** Do not cite it in the submission.

**Deliberately not cited, per brief:** Iyengar & Lepper's jam study and choice overload
(Scheibehenne, Greifeneder & Todd 2010 meta-analysis puts the mean effect near zero); decision
fatigue / ego depletion (Baumeister; serious replication failures). Both are in the popular
canon and both would cost credibility with this panel.

**Honesty notes.** The capacity numbers, the prominence effect, query theory, implementation
intentions, prospective hindsight and the Amrhein commitment-language result are all real,
indexed, and say what I've claimed. Clean Language has no outcome trial — it contributes
syntax, not evidence. The Miller/Benefield/Tonigan result is n=42. The two stakes-phase
sources are real and well-cited, but both are being *extended* here: the ELM studies
persuasion by an external message rather than a person elaborating on their own situation, and
Lerner & Tetlock is a review with many moderators, of which only the pre/post asymmetry is
load-bearing. S3 (unprompted elaboration) and the C14 voice signature are my reading of Max's
24-call corpus, not findings. The engine's move ordering is my synthesis: the *components* are
sourced, the *priority order* is an engineering judgment derived from the item-cost table in
§2. The Phase 2 trigger thresholds (≤3 ledger fields) are invented defaults — reasonable, and
the first thing to tune on a real call. None of the sequencing or the generation rules has
been tested on anyone.

**On the sprint budget specifically:** §1.6.2 is arithmetic, not measurement — six agent turns
at 150 wpm, plus the VAD and cold-start numbers from doc 02 §2.4. The structural claim behind
it is sound (the human talks for ~75 of the 110 seconds; the engine is five short questions).
What it does *not* support is that any particular person lands in 110 seconds on any
particular night. §1.6.6's three rehearsal runs are the measurement; **trust the stopwatch
over this document.** Note also that my first pass got this materially wrong in one direction
(§1.6.1) — treat the revised numbers as better, not as settled.
