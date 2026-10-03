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
