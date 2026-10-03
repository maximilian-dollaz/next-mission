/**
 * src/handoff — the decision becomes work an agent can execute.
 *
 * The public surface. Chats 06 and 07 import from here and from `./types.js`.
 *
 *   import { buildHandoff, putHandoff, renderSplit } from './handoff/index.js';
 *   import type { Task, Handoff, DecisionInput } from './handoff/types.js';
 *
 * The flow is three calls:
 *
 *   const handoff = await buildHandoff(fromBrief(brief, callId));
 *   await putHandoff(handoff);        // now reachable over MCP
 *   console.log(renderSplit(handoff.tasks));   // what Max rules on
 */

export { buildHandoff, decompose, openTasks, reassign, renderSplit } from './decompose.js';
export {
  approve,
  backend,
  dropTask,
  editTask,
  getApproved,
  getHandoff,
  latestApproved,
  latestHandoff,
  markSettled,
  putHandoff,
  seedMemory,
  updateTask,
  type Backend,
} from './store.js';
export {
  assertExecutable,
  claimable,
  isReady,
  onTheHuman,
  TASK_OWNERS,
  TASK_STATUSES,
  type DecisionInput,
  type Handoff,
  type HandoffStatus,
  type Task,
  type TaskDraft,
  type TaskOwner,
  type TaskStatus,
} from './types.js';

import type { DecisionInput } from './types.js';

/**
 * Chat 05's `Brief` normalised into a `DecisionInput`.
 *
 * Typed structurally rather than importing `src/phone/brief.js`, so this
 * module does not depend on another workstream's file and chat 06's
 * `Extraction` can feed the same door.
 */
export interface BriefLike {
  decision: string;
  north_star: string;
  why_now?: string;
  out_of_scope?: string[];
  open_questions?: string[];
  lead_domino: {
    action: {
      verb: string;
      object: string;
      channel?: string;
      if_then?: string;
      deadline?: string | null;
      success_test?: string;
      payload?: string | null;
    };
    why_this_one?: string;
  };
  gate?: { landed?: boolean };
}

export function fromBrief(brief: BriefLike, id: string): DecisionInput {
  const a = brief.lead_domino.action;
  return {
    id,
    decision: brief.decision,
    north_star: brief.north_star,
    reasoning: [brief.why_now, brief.lead_domino.why_this_one].filter(Boolean).join(' '),
    next_action: `${a.verb} ${a.object}`.trim(),
    landed: brief.gate?.landed ?? true,
    out_of_scope: brief.out_of_scope ?? [],
    open_questions: brief.open_questions ?? [],
    action_notes: [
      a.channel ? `channel: ${a.channel}` : '',
      a.if_then ? `when: ${a.if_then}` : '',
      a.deadline ? `deadline: ${a.deadline}` : '',
      a.success_test ? `their own success test: ${a.success_test}` : '',
      a.payload ? `payload: ${a.payload}` : '',
    ]
      .filter(Boolean)
      .join('; '),
  };
}
