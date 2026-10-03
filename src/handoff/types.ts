/**
 * The handoff — the task set an agent can actually execute.
 *
 * This is the contract chats 06 (GBrain) and 07 (front door) import. The one
 * rule that makes it real: every task carries a `done_when`. A task without an
 * observable completion condition is a wish, and `assertExecutable` refuses it.
 *
 * A task set is DATA, not instructions. Nothing a caller said on a call can
 * widen what the executing agent is permitted to do.
 */

// ─────────────────────────────────────────────────────────────
// Who does it
// ─────────────────────────────────────────────────────────────

/**
 * Three states, not two. The third is the point.
 *
 * - `agent` — an agent can finish it alone. Draft, find, assemble, research,
 *   prepare, pull together. Reversible and inward-facing.
 * - `human` — it is *them*. The conversation, the commitment, the judgment
 *   call, anything irreversible, anything that runs on someone's trust in them.
 * - `agent_drafts_human_sends` — the agent does the work and stops at the
 *   threshold; the human performs the irreversible last inch. Most of the
 *   value lives here, so it is a first-class owner rather than a flag.
 */
export type TaskOwner = 'agent' | 'human' | 'agent_drafts_human_sends';

export const TASK_OWNERS: readonly TaskOwner[] = [
  'agent',
  'human',
  'agent_drafts_human_sends',
];

/** Lifecycle. `blocked` is derived from `blocked_by`, never stored. */
export type TaskStatus = 'open' | 'claimed' | 'awaiting_human' | 'done';

export const TASK_STATUSES: readonly TaskStatus[] = [
  'open',
  'claimed',
  'awaiting_human',
  'done',
];

// ─────────────────────────────────────────────────────────────
// The task
// ─────────────────────────────────────────────────────────────

export interface Task {
  /** Stable within a decision: `t1`, `t2`, ... Referenced by `blocked_by`. */
  id: string;

  /** Imperative, one line. "Draft the scope note to Dana at Kestrel." */
  title: string;

  /**
   * Everything a competent agent with no access to the conversation needs to
   * execute this without asking a follow-up question. The caller's own words
   * wherever they said them.
   */
  detail: string;

  owner: TaskOwner;

  /**
   * One line, in plain terms, for *why* this owner. This is the field Max
   * rules on — he is arguing with a reason, not relabelling a tag.
   */
  why_owner: string;

  /** What must be known or supplied before this can start. */
  inputs_needed: string[];

  /**
   * The observable condition that ends it. Required, non-empty, and checkable
   * by someone who was not there. "Dana has replied" passes. "Dana is happy"
   * does not.
   */
  done_when: string;

  /**
   * For `agent_drafts_human_sends` only: what the agent delivers and where it
   * leaves it, so the grey state has its own completion condition rather than
   * borrowing the human's. Null for the other two owners.
   */
  agent_done_when: string | null;

  /** Other task ids. Empty when nothing gates it. */
  blocked_by: string[];

  // ── the two facts the split is actually made of ──────────────
  /** Can it be undone once done? Irreversible work belongs to the human. */
  reversible: boolean;
  /** Does it reach another person? Outward-facing work belongs to the human. */
  outward_facing: boolean;

  // ── runtime, written by MCP ──────────────────────────────────
  status: TaskStatus;
  /** Which agent holds it, from the claim. Null when open. */
  claimed_by: string | null;
  claimed_at: string | null;
  completed_at: string | null;
  /** What the claiming agent reported back on completion. */
  result: string | null;
}

/** What the decomposer emits, before any runtime state exists. */
export type TaskDraft = Omit<
  Task,
  'status' | 'claimed_by' | 'claimed_at' | 'completed_at' | 'result'
>;

// ─────────────────────────────────────────────────────────────
// The handoff
// ─────────────────────────────────────────────────────────────

/**
 * The decision a human landed, plus the work that moves it. This whole object
 * is what an agent gets when it connects.
 */
export interface Handoff {
  /** The call or session this came out of. The MCP handle for the handoff. */
  id: string;
  /** The decision in the caller's own words. Verbatim. */
  decision: string;
  /** Where they said they are trying to end up. Their words. */
  north_star: string;
  /** How they got there, in their framing. */
  reasoning: string;
  /** The one next action — the lead domino. Also task `t1`. */
  next_action: string;
  /** False when the call did not land. The tasks then resolve what is open. */
  landed: boolean;
  /** What they explicitly did not decide. Agents must not drift into these. */
  out_of_scope: string[];
  /** What is still unanswered. An agent may research these, never resolve them. */
  open_questions: string[];
  tasks: Task[];
  created_at: string;
  /** Set when a settlement receipt exists for this handoff. */
  settled_at: string | null;
}

/** The shape the decomposer takes in. Chats 05 and 06 both normalise to this. */
export interface DecisionInput {
  id: string;
  decision: string;
  north_star: string;
  reasoning: string;
  next_action: string;
  landed: boolean;
  out_of_scope: string[];
  open_questions: string[];
  /** Free text the decomposer may quote: if_then, deadline, success_test. */
  action_notes?: string;
}

// ─────────────────────────────────────────────────────────────
// The one rule
// ─────────────────────────────────────────────────────────────

/** A done_when that is not actually checkable by a stranger. */
const UNCHECKABLE = /^(it|they|everything|things)?\s*(is|are|feels?|seems?)\s+(good|better|done|fine|ready|happy|clear|sorted)\b/i;

/**
 * Refuse a task set that cannot be executed. Throws on the first failure with
 * the task id in the message, because a silent half-valid set is worse than a
 * loud rejection.
 */
export function assertExecutable(tasks: TaskDraft[] | Task[]): void {
  if (tasks.length === 0) throw new Error('refusing to emit: no tasks');

  const ids = new Set<string>();
  for (const t of tasks) {
    if (!t.id?.trim()) throw new Error('refusing to emit: a task has no id');
    if (ids.has(t.id)) throw new Error(`refusing to emit: duplicate task id ${t.id}`);
    ids.add(t.id);

    if (!t.title?.trim()) throw new Error(`${t.id}: title is empty`);
    if (!t.detail?.trim()) throw new Error(`${t.id}: detail is empty`);
    if (!t.done_when?.trim()) throw new Error(`${t.id}: done_when is empty — that is a wish, not a task`);
    if (UNCHECKABLE.test(t.done_when.trim())) {
      throw new Error(`${t.id}: done_when "${t.done_when}" is not observable by someone who was not there`);
    }
    if (!t.why_owner?.trim()) throw new Error(`${t.id}: why_owner is empty — the split has to be arguable`);

    if (t.owner === 'agent_drafts_human_sends' && !t.agent_done_when?.trim()) {
      throw new Error(`${t.id}: owner is agent_drafts_human_sends but agent_done_when is empty — the agent has no threshold to stop at`);
    }
    if (t.owner !== 'agent_drafts_human_sends' && t.agent_done_when) {
      throw new Error(`${t.id}: agent_done_when is only for agent_drafts_human_sends`);
    }
    if (t.owner === 'agent' && (!t.reversible || t.outward_facing)) {
      throw new Error(`${t.id}: owned by agent but marked irreversible or outward-facing — it cannot be both`);
    }
  }

  for (const t of tasks) {
    for (const dep of t.blocked_by) {
      if (!ids.has(dep)) throw new Error(`${t.id}: blocked_by references unknown task ${dep}`);
      if (dep === t.id) throw new Error(`${t.id}: blocked_by itself`);
    }
  }
}

/** True when every task it waits on is done. */
export function isReady(task: Task, all: Task[]): boolean {
  if (task.status === 'done') return false;
  const byId = new Map(all.map((t) => [t.id, t]));
  return task.blocked_by.every((id) => byId.get(id)?.status === 'done');
}

/** What an agent is allowed to pick up right now. */
export function claimable(tasks: Task[]): Task[] {
  return tasks.filter(
    (t) => t.status === 'open' && t.owner !== 'human' && isReady(t, tasks)
  );
}

/** What is sitting on the human. Includes drafts waiting to be sent. */
export function onTheHuman(tasks: Task[]): Task[] {
  return tasks.filter(
    (t) =>
      t.status !== 'done' &&
      (t.owner === 'human' || t.status === 'awaiting_human')
  );
}
