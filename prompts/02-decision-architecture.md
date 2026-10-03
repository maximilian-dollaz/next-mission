# Executor brief 02 — Decision architecture

**Owns:** `docs/research/` only. Write nothing else, no product code, no git commits.
**Model:** Opus. Every other workstream consumes this.
**Deliverable:** `docs/research/02-decision-protocol.md`
**Time box:** 90 minutes. Ship complete at 90 rather than perfect at 150.
Hackathon ends **17:30 PDT today**.

## What you are producing

Not a literature review. **A conversation protocol an engineer can implement today.**

The product is a voice agent that walks a person to a decision they actually believe, then
emits a firm decision plus next steps an agent can execute. Your job: find the best
decision-making science and conversational method that exists, and fuse it into one
concrete protocol.

## The hard constraint — read twice

**The effect must be unmistakable. The machinery must be invisible.**

The person should feel the conversation working on them. They must never hear the
technique named. No "let's do a SWOT." No "I'm going to use even swaps here." No visible
scaffolding, no stage directions, no therapy-speak.

Meanwhile, **your instructions to the engineer must be concrete, not vague.** Every move
needs a trigger condition, an example utterance, and an exit condition. "Build rapport" is
useless. "When they name two options in one breath, reflect both back in their own words
and ask which one they would regret not trying" is usable.

## The capacity constraint that drives everything

Working memory is **about four chunks** (Cowan 2001, *The Magical Number 4 in Short-Term
Memory*), not seven — Miller's 7±2 measured performance including rehearsal and chunking.

So the protocol must **never hold more than two or three items against each other at once**,
and must sequence those comparisons so each one makes the next easier. That sequencing is
the core intellectual problem. Solve it explicitly.

## Research leads — start here, then go wider

Do not rediscover SWOT. These are already identified; verify, go deeper, and find what is
better. Prefer primary sources and real papers.

**Structured decision methods**
- **Even Swaps** — Hammond, Keeney & Raiffa, HBR 1998, and *Smart Choices*. Sequentially
  eliminates objectives by making them irrelevant, then drops dominated alternatives.
  **This is the closest existing match to what we want. Start here.**
- **Analytic Hierarchy Process** — Saaty 1977. Pairwise comparison; Saaty justified his
  scale by citing Miller's limit directly.
- **Elimination by Aspects** — Tversky 1972. How people already narrow, one attribute at a time.
- Multi-attribute utility theory (Keeney & Raiffa 1976); Kepner-Tregoe; WRAP (Heath);
  pre-mortem (Klein); regret minimisation; Munger inversion; Bezos two-way doors;
  satisficing and bounded rationality (Simon).

**Conversational method — this half matters more and is usually skipped**
- **Motivational Interviewing** (Miller & Rollnick). Clinically validated, large evidence
  base, built entirely around helping a person reach their *own* decision without being
  told. Mine it hard: change talk, evocative questions, rolling with resistance.
- **Clean Language** (David Grove). A questioning syntax designed to introduce *none* of
  the practitioner's assumptions. Near-perfect fit for "the agent cannot know your truth."
- Solution-Focused Brief Therapy (miracle question, scaling questions); Socratic
  questioning; Immunity to Change (Kegan & Lahey); GROW; cognitive load theory (Sweller).

**Do not cite these.** Both are in the popular canon and both will cost credibility with
technical judges: the Iyengar & Lepper jam study / choice overload (Scheibehenne
meta-analysis puts the mean effect near zero), and decision fatigue / ego depletion
(Baumeister; severe replication problems).

## Max's own material — this is not optional

He has recorded 113 ideas, in `docs/knowledge/Intuition_Voice_Agent_Idea_Bank.md`, each
with an ID. The protocol must be recognisably *his*, not a generic coaching script. Load-bearing:

- **A3** — it helps find the truth *because* it cannot determine the truth itself
- **C1** — north star → current situation → reconciliation (the three-act spine)
- **C2** — the human resonates, the agent checks coherence; **only the human knows when it
  has reached the right depth.** This is your completion gate — define it operationally.
- **C5** — the one thing / lead domino. Output is *one* next action, not a list.
- **C7** — frameworks on tap, selected per situation
- **B12** — broad context up front, then know which thread to pull
- **B1, B2, B5, B7, B14** — ask don't tell; genuine curiosity then silence; not a yes-man;
  "it seems like" never "I think"; create safety
- **C12** — what would you tell someone else with this problem
- **C14** — true insight brings you *into* the present moment; noise takes you out

Also read `docs/findings/01-conversation-principles.md` if it exists — another chat analysed
the real v1 call corpus (112 calls, 24 substantive). Reconcile with it; if you disagree with
it, say so and say why.

## Output format

`docs/research/02-decision-protocol.md`:

1. **The protocol** — first and longest. Turn-by-turn phases. For each: entry trigger, what
   the agent is doing, 3–5 example utterances in the agent's actual voice, exit condition,
   and the failure mode if it moves on too early.
2. **The comparison engine** — how you decide *which* two or three items to put against
   each other next, and in what order. The heart of this document.
3. **The completion gate** — how the agent knows the person has landed, operationally.
   Must handle the person who says yes to be agreeable.
4. **The brief** — exact output schema: the decision in the person's own words, the one next
   action, why it is the lead domino, and what an agent needs to execute it.
5. **Sources** — what each move is grounded in, with real citations. Mark anything
   contested or thin.
6. **Open questions for Max** — creative calls you must not make yourself.

Lead with a decision summary of five bullets or fewer. Max optimises for simplicity and
clarity: give exactly what he needs to decide, spelled out practically.

## Do not

- Do not invent citations. If you cannot verify a paper exists, say so.
- Do not make creative decisions — surface options and let Max pick.
- Do not write a script with stage directions a user could ever see.
- Do not touch any path outside `docs/research/`.
