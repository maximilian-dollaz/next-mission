# Idea bank triage — against the judging criteria

Source: `docs/knowledge/Intuition_Voice_Agent_Idea_Bank.md` (113 ideas).
Filter: the nine voting categories + the prompt "build something agents want."

**Test applied.** An idea is *forced in* only if leaving it out either (a) makes this a
generic chatbot rather than the Agent of Truth, or (b) forfeits a named judging category.
Everything else is optional today, however good it is.

**Headline: 12 of 113 ideas are forced in.** One of them — F1 — turns out to be the best
Stripe story available, and it was already your business model.

---

## The 12 that must be in

| ID | The idea | Why it is forced | Earns |
|---|---|---|---|
| **A3** | "it is able to help people hone in on the truth [because] it is not able to determine the truth itself" | This is the whole thesis, *and* it is why an agent needs you: an agent cannot determine its human's truth, so it must buy that from somewhere. It connects the product to the hackathon prompt in one sentence. | Innovation, the prompt |
| **A2** | "Most people prompt AI. I turn AI on myself to prompt me." | The pitch line. Nine words, a judge remembers it. | Innovation |
| **A5** | "determining direction is something that only we can do" | The architectural justification for *not* taking the action and dispatching instead. Without it the dispatch design looks arbitrary. | Innovation, Impact |
| **C1** | north star → current situation → reconciliation | The session state machine. Without a defined process a voice agent rambles and "completeness" dies. | Functionality |
| **C2** | "only I know once it's reached the right level of depth" | The **completion gate**. This is how the agent knows the decision is firm enough to dispatch. You cannot claim "a firm decision made by the human" without it. | Functionality |
| **C5** | the one thing / lead domino | Produces the *single* next action rather than a list. This is the output spec. | Functionality, Impact |
| **C16** | "keep the what connected to the why and determine the first step of how" | Literally describes the deliverable artifact. | Functionality |
| **B12** | pull for broad context up front, know what thread to pull | You named this in the v2 memo, and H3 confirms it is what made real sessions work. It is turn 1. | Functionality, UX |
| **B13** | meditative pacing, long pauses, "very aware and in tune with me" | **This is the Gemini category.** Silence tolerance and hearing hesitation require native audio, not speech-to-text → LLM → speech. It is the only honest multimodal claim in the bank. | **Gemini** |
| **C7** | decision frameworks on tap (SWOT, Munger inversion, Bezos two-way door) | **This is the Claude category.** Reasoning about *which* framework fits this human's live situation is exactly what Claude is for, and it demos visibly. | **Claude** |
| **F1** | one number, free, **"paid only by talk time"** | **This is the Stripe category — and it is the best card in the deck.** See below. | **Stripe** |
| **H1** | the 80-year-old: "said it changed his life" | The only hard real-world evidence you have. Over a dozen substantive conversations. Impact is scored on evidence, and this is it. | **Impact** |

---

## F1 × Stripe MPP — put this at the centre of the pitch

Your own business model from September — *"paid only by talk time"* — maps exactly onto
what MPP was built for. MPP supports a **streaming** payment cadence and settles in
**sub-cent increments**.

So: **the human's personal agent pays, by the minute, for its human's conversation.** The
agent is metered-buying clarity on its human's behalf, then receives an executable brief.

That is a genuinely novel answer to "build something agents want," it is not a bolted-on
paywall, and it resolves the open question of who pays. Nothing else in the bank comes
close as a Stripe story.

---

## Three conflicts you have to resolve

**1. E1 (open-source brain) directly costs you two categories.**
You want "an open source model as the brain, preferably the one that is most in alignment
with truth." Best Use of Claude and Best Use of Gemini are 2 of 9 categories. You cannot
have both today.

The clean resolution: **D1 delivers your privacy promise without E1.** "You turn it off and
it's all destroyed, you get to keep the new context… we don't keep any of it" is an
*architecture* claim, not a model claim. Ship destroy-on-exit and user-owned data today;
make the brain a one-line config swap and say so out loud. You keep the conviction, you
keep the categories, and E1 becomes your post-hackathon roadmap instead of your blocker.

**2. B13 and B11 contradict each other.**
B13 wants long pauses and meditative pacing. B11 says "shorter turns — swifter, faster."
Both are yours, both are right, for different moments. Likely answer: two modes, or pacing
that opens fast and slows as it goes deep. **This is a creative call and I will not guess it.**

**3. G2 says your vocabulary is wrong.**
"When I said the word 'context,' that got an eye roll." But the product is a *context*
library and the demo audience is engineers, for whom "context" is the hottest word in the
industry. Your Sep 1 audience was not this audience. G5 also has you doubting "make a
decision" as the headline. The submission copy needs a decision here.

---

## Add if the core is already working, in this order

| ID | Idea | Why it is worth it | Cost |
|---|---|---|---|
| **H4** | record and store every session | You lost your best conversation and wrote "I wish that conversation was recorded." It also *is* the context library. Cheap. | low |
| **D1** | BYOCL + destroy-on-exit, visible in the UI | A designable, memorable moment that makes the privacy promise real. Strong UX card. | low |
| **B8** | reflect back in clearer words than they had | The most felt moment in any real session. Pure Claude. | low |
| **B5/B7** | not a yes-man; "it seems like" not "I think" | Cheap prompt lines that make it feel different from ChatGPT in 10 seconds. | very low |
| **F2** | resume a dropped call | Completeness, and the failure mode most likely to bite you live. | medium |
| **C15** | synthesized growth report over time | The best use of a Vercel-hosted UI. Needs seeded data to look real. | medium |
| **F8** | your own voice | H1 says people kept asking if it was you. Gemini native audio makes a custom voice non-trivial. | medium |

---

## Defer, with reasons

- **E2–E8 (Genesis, training on enlightened beings, implanting the spark).** Your deepest
  vision and not a 6-hour build. Also: this panel is engineers. Lead with the mechanism
  (A3) and let the metaphysics sit underneath. Not a judgment on the idea — a judgment on
  the room and the clock.
- **F11 (human design, charts).** Scope, plus it spends credibility you need for the rest.
- **C10/C11 (17-step emotional clearing, EMDR, subconscious access).** A different product.
- **F6/F7 (human/AI ratio), F5 (monetize on success), G7–G9 (adoption timing).** Business
  model, not build.
- **I1–I7 (adjacent).** All out of scope today. I2 (model decisions and fail on your
  behalf) is the most interesting for later.
- **Codex category.** Still skipped.

---

## What this does to the category sheet

| Category | Carried by |
|---|---|
| Best use of Stripe | **F1** — metered pay-by-talk-time via MPP streaming |
| Best use of Claude | **C7** framework selection + **B8** reflection + brief generation |
| Best use of Gemini | **B13** native-audio pacing, silence, hearing hesitation |
| Best use of Vercel | deployed app + **C15** growth report |
| Functionality | **C1** process + **C2** completion gate + **C5** single next action |
| Innovation | **A3 / A2 / A5** — the agent that cannot know your truth, so it sells you back to yourself |
| UX and design | **D1** destroy-on-exit + **B12** opening + the brief artifact |
| Impact | **H1** the 80-year-old, plus a dozen real conversations |
| Codex | not pursued |

Eight of nine, with every one now traceable to an idea you already had.
