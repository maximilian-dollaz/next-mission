# 01 — Conversation principles for Next Mission v2

Evidence: 112 Retell calls on `agent_830d1cd16db01b1825deaf4e31` ("The Agent Of Truth"),
of which **24 are ≥2 min** and analyzed here; plus Max's written reflections
(`Next Step Life Vol 3.txt`, esp. lines 1185–1188, 1345–1352, 2112) and the v1 system
prompt (Retell LLM `llm_25be0baabce377138e5ac563389d`, identical text at v1 and v3).

---

> **Status 2026-10-03 — Max has decided.** Q1 is resolved in favour of a phased rule
> (draw out until the decision, then construct the brief), and the handoff goes to an
> executing agent over MCP. Q5 is resolved: the agent instructs the context dump in turn
> one. The implementable spec, including the Gemini Live turn-taking mechanism, is in
> **`02-v2-conversation-spec.md`** — read that one to build. This document remains the
> evidence base behind it.

---

## 1. Decision summary

1. **The brief's "N = 4" was wrong — there are 24 substantive calls.** "4 calls, 2.8 min
   avg, 10.8 min longest" is exactly the four *most recent* calls, three of which are
   3–22-second hang-ups. Real corpus: 24 calls ≥2 min, 18 ≥5 min, longest 26.4 min.
   Everything below rests on the 24. **This is the single correction worth reading.**

2. **Max's core belief is confirmed, with a sharper edge: the opening dump predicts
   *decidability*, not depth.** Every call that landed a decision with a named object
   opened with a user monologue of **≥130 words** (133 / 147 / 156 / 260 / 489 / 698).
   Every call that opened under 20 words either stayed emotional or failed outright.
   But a 7-word opening still produced 16 minutes of real depth (`becddd65`) — it just
   never decided. **Strong.** → v2 must *manufacture* the dump, not hope for it.

3. **v1's worst failure is mechanical, not philosophical: it talked too much and cut
   people off.** Across the corpus, average agent turn length correlates with average
   user turn length at **r = 0.65** — the agent *mirrors* the user's verbosity instead of
   staying terse, exactly violating its own "fewest words" rule. In the long-turn calls
   this produced 11 explicit interrupt protests and 5 "give me the short version"
   requests, including `e228af16` → *"I said hang on. I said hang on. Just shut the fuck
   up for a second."* The 12 calls with agent turns under 36 words had **zero**
   protests. **Strong.** → cap agent turns hard; raise barge-in threshold off 0.9.

4. **Convergence has a reproducible 3-move mechanism, and v1 hit it by accident.** It is:
   (a) remove other people from the room → (b) demand a first-person sentence →
   (c) force the action *and its clock*. In `e228af16`: *"Imagine your sister and
   brother-in-law have no opinion… Say it in a simple sentence: 'I choose to ___'"* →
   *"I choose to work for a startup that's already successful."* **Strong.** → make this
   an explicit, mandatory stage, not an emergent one.

5. **Zero of 24 calls produced an agent-executable handoff. The closest thing was v1
   *writing the artifact itself* — which its own prompt forbids.** `9304a3d7` ended by
   drafting the verbatim client message, and drew the most enthusiastic user response in
   the whole corpus: *"Yes. That's perfect. Thank you very, very much."* Every other
   "next step" was human-shaped ("reach out to my buddies", "make a list of songs").
   **Contested** — it conflicts with the prompt's "you do not advise" rule.
   → **Max must decide this one (Q1 below).**

---

## 2. Evidence table

Ordered by date. "Dump" = largest user monologue in the first third of the call.

| Call | Date | Len | Dump | Outcome | Where it turned | Where it failed |
|---|---|---|---|---|---|---|
| `288ffcdc` | 05-30 | 26.4m | 133w | **Decision + 24h action** | *"What's kept you from already reaching out?"* → block dissolved on the call | Ran out of clock, not out of question; 30-day plan left explicitly unfinished |
| `9a28f6e7` | 05-31 | 8.9m | 82w | No decision | — | Ended on a reflection prompt, not a choice; user hung up |
| `89c58f2f` | 06-07 | 10.9m | 31w | Decision (song to Lucas, 4 days) | Named a person + a deadline | Deadline came from the user, not the agent |
| `050043a9` | 06-10 | 5.9m | 54w | No decision | — | Drifted into self-care; user ended by asking what model it was |
| `1fa533b5` | 07-01 | 18.3m | 147w | Tentative ("2-week trial") | Reframing commitment as an experiment | "Tentative" accepted as landing |
| `4431aad4` | 07-03 | 5.7m | 18w | No decision | — | Closed by *affirming* the user — the prompt's named failure mode |
| `83346629` | 07-03 | 15.5m | 698w | Direction + named person (Oliver) | Huge unprompted dump | 5 interrupt protests; no concrete step |
| `c365d25e` | 07-03 | 10.5m | 50w | None — grief | Correctly stopped pushing | Right call, but shows the agent has no "this isn't a decision" branch |
| `f8401a4f` | 07-13 | 3.4m | 4w | **Failed** | never | Five "I don't know"s; degraded into binary guessing; landed on "the weather" |
| `7a2ea775` | 07-20 | 26.3m | 260w | **Decision to not decide** | — | Agent affirmed deferral: *"no decision this month actually feels like relief"* |
| `e228af16` | 08-04 | 20.3m | 489w | **Firm decision** ("I choose to…") | Removing sister/brother-in-law from the room | Answered the identity question; never answered the logistics question he opened with. 3 interrupt protests. User hung up mid-close → **no handoff at all** |
| `9304a3d7` | 08-18 | 22.7m | 156w | **Decision + verbatim artifact** ($350/agent, one-time, post-value) | Agent *drafted the message* | Only call with a usable artifact — produced by breaking the prompt's rules |
| `0919` ×11 | 09-19 | 2.9–16.2m | 4–66w | 7 reflections, 3 decisions, 1 outright fail | Short turns, no interruptions | Public-demo strangers, cold start, no context → mostly surface |
| `238e70c9` | 09-19 | 2.9m | 11w | **Failed** (`call_successful=false`) | never | Asked the *same* feel-question 3× over garbled ASR; no repair attempt |
| `becddd65` | 09-19 | 16.2m | 7w | No decision | Found real material (hiking, "the system") | 16 min of depth closed with "keep noticing" — an invitation, not a step |
| `6a129b97` | 09-29 | 10.8m | 31w | Boundary decision (friends ≠ clients) | Isolating *which* case the discomfort attached to | No action, no date |

**Two populations, not one.** The May–Aug phone calls are Max himself: long, dense,
decision-shaped, interruption-plagued. The 09-19 cluster is 11 strangers in 2.5 hours —
a demo-booth day: cold start, no context, short turns, mostly surface. **Do not pool
them.** v2's real user is the first population; the second is the cold-start stress test.

---

## 3. What worked

### 3.1 The context dump — **strong**
Quantified above: ≥130-word opening → decision; <20-word opening → no decision or
failure. `e228af16` opens with a 489-word unprompted dump covering clients, dollar
amounts, contract dates, the cofounder, and the emotional state, and the agent's first
substantive question is already aimed correctly. This is the clearest confirmation of
Max's written claim (line 1345: *"the most important part is to do a broad enough
context dump early"*).

### 3.2 The convergence ladder — **strong**
`288ffcdc` runs an eight-move sequence that is fully reconstructible: ground in hard
facts (*"where has most of your actual money come from — not where you wish it came
from"*) → name the fork → hold up the user's two contradicting sentences → bound the
choice in time (*"for just the next 30 days"*) → define the success test → **ask what
has stopped them already** → ask for the smallest 24-hour move → have them say it back.
Move six is where it broke open: *"Now the uncomfortable part. If you're honest, what's
the main thing that's kept you from already reaching out?"* → *"this conversation is
helping me figure out what I would actually do."*

### 3.3 Removing other people from the room — **strong**
The single highest-yield intervention in the corpus (`e228af16` [43]). The user had
already said the decision twice, but couldn't own it because his sister and
brother-in-law wanted it. Explicitly evacuating them, then demanding `"I choose to
____"`, produced the only clean first-person commitment in 24 calls.

### 3.4 Pushing into discomfort — **strong where attempted**
Real examples, not therapeutic hedges: *"does spending the next 30 days doing exactly
that feel like obedience… or like a way to delay stepping into the new thing?"*;
*"you're stacking ideas faster than you're actually testing any of them. That's you
staying in 'potential' instead of committing to a bet."*; *"this extra work exists
because I under-scoped, not because she changed the ask. That's honest."* When the agent
pushed, the user went more honest, every time. No call shows a user becoming more
guarded after a push.

### 3.5 Writing the artifact — **contested but the strongest single data point**
`9304a3d7` [80]: the agent drafted the exact client message, pricing and framing
included, then asked *"does your body feel more 'yes, that's me'"*. Response: *"Yes.
That's perfect. Thank you very, very much."* This is the only moment in the corpus that
produced something an agent could pick up and execute. It also directly violates the
prompt's hard rule *"You draw out. You do not advise, fix, or decide for them."* Max's
own reflections side with the violation: line 1351, *"It danced in between giving me
things that helped me figure things out, versus pulling the truth out of me."*

---

## 4. What did not work

### 4.1 Agent verbosity and interruption — **strong**
r = 0.65 between user turn length and agent turn length: the agent mirrors instead of
staying terse. Max's calls drew 47–64-word average agent turns, peaking at **302 words
in a single spoken voice turn**, delivered as numbered lists and em-dash bullets — on a
phone call, from a prompt that says *"no lists, no bullets, no headers."* Consequences:
11 interrupt protests, 5 requests to shorten the question, and the user repeatedly
having to defend his own thinking time (*"hang on, I'm not done yet"* ×3 in one call).
`interruption_sensitivity: 0.9` on the agent config makes this worse: the agent treats a
mid-thought pause as a turn boundary.

### 4.2 Decision deferral accepted as success — **strong**
`7a2ea775`, 26 minutes: the user decides not to decide until after a podcast, and the
agent validates it (*"So 'no decision this month' actually feels like relief, not
danger"*). `call_successful=true`. By Next Mission's own criterion this is a failure.
`1fa533b5` is the softer version: "tentatively open to a two-week trial" treated as a
landing.

### 4.3 Answering a different question than the one asked — **strong (n=1, but severe)**
`e228af16` opens with a concrete operational problem: *"I can't even make the time to
job search because of having to build and maintain the agents… help me figure this the
fuck out."* It closes 20 minutes later with an identity decision — *"I choose to work
for a startup"* — and the scheduling problem he actually asked about is never touched.
The agent even *named* the blocking contradiction (*"your current plan depends on
building more features, more prompts, more robustness, across three clients, before
you're really out"*) and then dropped it and never returned. That is the flinch.

### 4.4 Cold start with no context — **strong**
`f8401a4f` (5× "I don't know" → "the weather") and `238e70c9` (`call_successful=false`)
are the same failure: the opening question *"What feels most alive for you right now?"*
assumes a human who arrives loaded. When they don't, the agent has nothing to pull on
and degrades into offering binary choices — eventually *"pick the one that feels least
wrong."*

### 4.5 Looping on garbled input — **thin (n=1, but trivially fixable)**
`238e70c9`: ASR returns fragments ("take a Jazz", "efforts to always come", "I see
very") and the agent asks its *same* weight-or-anchor question three times rather than
repairing the transcript. It also forced a gut answer at turn 5, before any context
existed.

### 4.6 Closing on an invitation instead of a step — **strong**
`becddd65` (16 min), `050043a9`, `4431aad4`, `9a28f6e7`: all end with "keep noticing",
"consider", or an affirmation. `4431aad4` closes by *praising the user's
self-awareness* — precisely the "comfortable echo" the prompt warns against.

### 4.7 No handoff, ever — **strong**
Judged against *"could a competent agent execute this with no further questions?"*:
0 / 24. Best cases and why they fail: *"reach out to one of those OS-builder guys"* (no
name, no channel, no message); *"make a list of songs we might play at this bar"* (no
bar, no candidates); *"finish and send the song to Lucas within four days"* (closest —
has a person and a date, but nothing an agent can act on). The v1 prompt never asks for
an executable step: it asks for *"one next step — something real they can take this
week"* and *"a distillation… the seed for any deeper thinking they do later."* v1 was
built to produce a feeling of clarity, not a brief. **v2 is a different product, and
this is the gap it has to close.**

---

## 5. Transferable principles for v2

Phrased as implementable instructions.

1. **Manufacture the context dump in turn 1.** Do not open with "what's alive for you."
   Open by instructing the dump and naming its three parts: *"Before I ask you anything
   — take two or three minutes and tell me the whole situation. What's going on, what
   you've already tried, and what you're actually trying to decide. Don't organize it.
   I'll stay quiet."* Then stay silent until they stop.
2. **Hard-cap agent turns at ~40 spoken words and one question.** No numbered lists, no
   bullets, no multi-part questions. Five users asked v1 to shorten its questions; zero
   asked it to say more. Enforce in the prompt *and* verify in transcripts, because v1's
   prompt already said this and it was ignored.
3. **Lower barge-in aggression and add an explicit thinking-time rule.** Drop
   `interruption_sensitivity` from 0.9. Instruct: *"If they trail off, pause, or say
   'hang on', say nothing. Silence is not your turn."* Eleven protests across the corpus
   trace to this one setting.
4. **Separate "what they asked" from "what came up," and close both.** Log the opening
   ask verbatim in turn 1. Before converging, state both out loud: *"You came in asking
   X. We've ended up on Y. Which one are we deciding today?"* This directly fixes 4.3.
5. **Make the three convergence moves a mandatory stage, in order.**
   (a) *"Whose voice is in this besides yours? Take them out of the room."*
   (b) *"Finish this sentence: I choose to ____."*
   (c) *"When are you doing the first piece — today, this week, or a date?"*
   Do not accept a decision that skips (b). Do not accept a step that skips (c).
6. **Treat deferral as an unlanded call.** If the user's output is "I'll decide later,"
   name it and convert it: *"That's a decision to wait. So what's the decision you're
   making about the waiting — what has to be true by what date for you to decide then?"*
7. **Run the unlock question before trying to close.** *"What's stopped you from already
   doing this?"* was the highest-yield question in the corpus. Fire it once the fork is
   named and before asking for the step.
8. **Mandate an executable brief, not a next step.** Replace v1's "one next step" with a
   structured handoff the conversation must fill before it can end — and read it back
   for confirmation: **action verb · named object (person / file / account) · channel ·
   deadline · success test · what's explicitly out of scope.** Refuse to close on a step
   with an unnamed object. *"Reach out to my buddies"* fails; *"text Tyler today asking
   how they currently gather client context before an OS build"* passes.
9. **Add a no-context branch.** If the user cannot name a subject within two exchanges,
   stop asking open questions and switch to retrieval: *"Then let's start from what's on
   your plate. What's the next thing on your calendar you're not looking forward to?"*
   Do not offer binary feeling-choices — that is where both failed calls died.
10. **Add an ASR-repair rule.** On a fragmentary or implausible user turn, repeat back
    what you heard and ask for correction *once*, before asking anything new. Never ask
    the same question twice; if it didn't land, change the question.
11. **Keep the friction, drop the therapy voice.** The pushes that worked were specific
    and short (*"is this the real thing, or the more comfortable thing?"*). The ones that
    failed were somatic and abstract (*"does it feel like a weight or an anchor?"*) —
    those questions only work on a user already in context.

---

## 6. Open questions for Max

**Q1 — the big one. Does v2 write the artifact, or only draw it out?**
The best moment in 24 calls is the agent drafting the client message verbatim
(`9304a3d7`). The v1 prompt forbids exactly that. And Next Mission's purpose — a brief
an agent can execute — probably *requires* it: an executable brief is a constructed
object, not something a human says out loud. Three options:
- **(a) Pure draw-out, v1 rules kept.** Highest fidelity to "it's theirs." Accepts that
  the handoff stays vague. Evidence says this will keep producing 0/24 handoffs.
- **(b) Draw out the decision, construct the brief.** Agent never decides, but once the
  human has committed, the agent drafts the brief and the human approves or corrects it
  line by line. Matches `9304a3d7` and matches line 1351 of Max's own reflections.
- **(c) Construct freely throughout.** Fastest to a brief; highest risk of becoming the
  advisor v1 was explicitly built not to be.
*My read: (b). But this is a product decision, not an evidence finding — your call.*

**Q2 — Does the brief get written mid-call or after?**
A human on voice cannot dictate a six-field structured brief without it feeling like
form-filling and killing the conversation. Options: fill it silently as you go and read
it back once at the end; pause mid-call to fill it together; or generate it post-call
and send it for approval. No evidence either way — v1 never produced one.

**Q3 — What is the hard floor on turn length?**
I recommend ~40 words. v1's short-turn calls (16–36 avg) had zero interruptions but also
less depth; the long-turn calls had the real breakthroughs *and* all the protests. The
confound is that Max himself talks in 300-word blocks. Worth one test call.

**Q4 — What happens when it isn't a decision?**
`c365d25e` is grief, not a decision, and v1 handled it decently by abandoning
convergence. v2 is explicitly a decision engine. Does it refuse, redirect, or hold space
and skip the handoff?

**Q5 — Does v2 coach the human on how to use it?**
Max's line 1345 is instructions *to the human*: dump broadly, steer with your first
responses, be brutally honest, don't dodge. The transcripts show those behaviors predict
success and that **v1 never told anyone to do them.** Does v2 say this out loud in the
first 20 seconds, or is a product that needs an instruction manual already broken?

---

## 7. Honesty notes

- **The legendary call is not in the corpus.** Max's line 1348: *"I wish that
  conversation was recorded… when I realized I wasn't gonna get the transcript, I was
  crushed."* The call he describes at line 1345 — the one that produced the Clay email —
  is absent. The analysis above cannot verify his account of it. What it *can* say:
  `288ffcdc` runs the same moves he describes (30-day frame, one concrete outcome,
  self-set bar for a breakthrough, protection-vs-calling), so the structure he remembers
  is recoverable from evidence even though the call itself is gone.
- **Two of the three contested points favor Max's written account over the prompt's
  design intent**, not the other way around. Specifically: his "it danced between adding
  things and pulling truth out of me" contradicts the prompt's hard "do not advise" rule,
  and the transcripts side with him.
- `call_analysis.call_successful` is **not** a usable success signal: it reads `true` for
  `7a2ea775` (26 minutes ending in a refusal to decide) and `true` for `f8401a4f` (five
  "I don't know"s ending on "the weather"). Every outcome classification above is mine,
  read off the transcripts.
- **n is small per claim.** The r = 0.65 correlation is across 24 calls. The dump
  threshold rests on 6 decision-landing calls. §4.3 rests on one call. Treat every
  number here as directional, not as a measurement.
