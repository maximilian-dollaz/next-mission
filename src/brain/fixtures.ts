/**
 * One rehearsal transcript, so the pipeline can be proven without a live call.
 *
 * Shaped to docs/research/02-decision-protocol.md §1.6.4: a two-option fork,
 * ~90 words of dump, a 60/40 lean, reversible, no third party's motives in it.
 * The caller's turns are what a real sprint-mode dump sounds like.
 */

import type { RawTurn } from './agentphone.js';

export const REHEARSAL_CALL: RawTurn[] = [
  { speaker: 'agent', text: "In one sentence — what's the decision?" },
  {
    speaker: 'human',
    text: "Whether to lead the demo tomorrow with the privacy thing or with the voice quality. Privacy is the part nobody else has — the call deletes itself and what's left is in your own database. Voice quality is the part people feel in the first five seconds. I keep going back and forth. My brother thinks I should lead with voice because it's flashier. Honestly I think the privacy angle is the real thing but I'm scared it sounds boring on stage.",
  },
  { speaker: 'agent', text: "If the right one works, what's different next week?" },
  {
    speaker: 'human',
    text: "Someone from the panel emails me wanting to talk about it. That's it. That's the whole thing — I want one serious conversation out of this, not applause.",
  },
  { speaker: 'agent', text: "Whose voice is in this besides yours?" },
  {
    speaker: 'human',
    text: "My brother's, mostly. And he's not in the room tomorrow and he's never been to one of these. Yeah. Set him outside. Without him it's — it's privacy, clearly.",
  },
  { speaker: 'agent', text: "Finish it — I'm going to…" },
  {
    speaker: 'human',
    text: "I'm going to open with the deletion demo. Show the recording URL dying on stage, in the first thirty seconds, before I explain anything. Let them watch it break and then tell them why.",
  },
  { speaker: 'agent', text: "And if you just didn't? What happens?" },
  {
    speaker: 'human',
    text: "Then I give the same demo as four other teams and nobody emails me. No, I'm doing it. The deletion is the only thing I've got that they can't hand-wave.",
  },
  { speaker: 'agent', text: "When — what's happening right before?" },
  {
    speaker: 'human',
    text: "Tonight after I close the laptop, before I go to bed, I'll rewrite the first slide so it's just the terminal and nothing else.",
  },
];
