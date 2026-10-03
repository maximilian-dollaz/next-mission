/**
 * The decision from the rehearsal call, so the handoff can be proven and the
 * split can be argued over without waiting for a live call.
 *
 * This is NOT a fabricated example. It is the decision that comes out of the
 * rehearsal transcript in `src/brain/fixtures.ts` (chat 06) — shaped to
 * protocol §1.6.4, in Max's own voice, with his own words quoted verbatim
 * below. A live call replaces it by passing a real brief to `fromBrief`.
 */

import type { DecisionInput } from './types.js';

export const REHEARSAL_DECISION: DecisionInput = {
  id: 'rehearsal-01',
  decision:
    "I'm going to open with the deletion demo. Show the recording URL dying on stage, in the first thirty seconds, before I explain anything. Let them watch it break and then tell them why.",
  north_star:
    'Someone from the panel emails me wanting to talk about it. That\'s the whole thing — I want one serious conversation out of this, not applause.',
  reasoning:
    'The fork was privacy versus voice quality. His brother argued for voice because it is flashier, but his brother is not in the room and has never been to one of these, so that voice was set outside. "Without him it\'s — it\'s privacy, clearly." The cost of not doing it: "Then I give the same demo as four other teams and nobody emails me." The deletion is the only thing on the board that cannot be hand-waved.',
  next_action:
    'Rewrite the first slide so it is just the terminal and nothing else — tonight after closing the laptop, before bed.',
  landed: true,
  out_of_scope: [
    'Leading with voice quality. Decided against, and his brother\'s argument for it was explicitly set outside.',
    'Explaining the privacy architecture before the demo runs. The order is: break it, then explain.',
  ],
  open_questions: [
    'Whether the deletion demo survives a failure on stage — there is no stated fallback if the URL still resolves.',
  ],
  action_notes:
    'channel: the slide deck; when: tonight after I close the laptop, before I go to bed; their own success test: the first slide is the terminal and nothing else',
};

/**
 * The rib call — Max's real 414-second call, `call_d97d5e49f4c74329be485e7bb8a`.
 *
 * Kept because of what it proves about the protocol: the decision that landed
 * is NOT the one he called about. He opened on whether to see a doctor about a
 * possibly fractured rib. The agent's best moment was reframing the question —
 * "is it about whether to see a doctor, or about whether you're willing to
 * change your workouts?" — and he said "Oh shit, yeah, you're right."
 *
 * So `decision` below is the one he actually reached, not the topic he opened
 * with. A decomposer that works from the opening topic produces the wrong task
 * set entirely.
 *
 * It is also the test case for the generative register: his own examples of
 * what he wanted handed to him were "go find a video on modifying workouts"
 * and "put together tips or mindset around working out with an injury" —
 * neither of which appears in the decision as stated.
 */
export const RIB_DECISION: DecisionInput = {
  id: 'call_d97d5e49f4c74329be485e7bb8a',
  decision:
    "I'm going to keep working out, but modify the workouts — stay within what I'm comfortable with, no full-blast training until the rib heals.",
  north_star: 'Not losing the habit while the rib heals.',
  reasoning:
    'He called about whether to see a doctor about a possibly fractured rib. The agent reframed it — whether this is about the doctor, or about whether he is willing to change his workouts — and he said "Oh shit, yeah, you\'re right." That was the real fork. He is not seeing a doctor; the decision is to modify rather than stop.',
  next_action:
    'Modify the next workout rather than skipping it — stay inside what is comfortable.',
  landed: true,
  out_of_scope: [
    'Seeing a doctor about the rib. He decided against it on this call.',
    'Stopping training altogether. The whole point is modifying rather than stopping.',
  ],
  open_questions: [
    'Whether the rib is actually fractured — he has not had it looked at and chose not to.',
    'How long "until it heals" is, which he did not put a number on.',
  ],
  action_notes: 'channel: his own training; their own success test: he trains and the rib does not get worse',
};
