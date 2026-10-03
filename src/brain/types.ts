/**
 * The zero-retention pipeline: what we keep, what we destroy, and the proof.
 *
 * The honesty rule for this whole module: a receipt may only claim what was
 * actually verified. Every destruction carries the request we re-issued and
 * the response we got back. A store we cannot delete from is named as such,
 * not quietly omitted.
 */

// ─────────────────────────────────────────────────────────────
// What survives the call
// ─────────────────────────────────────────────────────────────

/** Mirrors ContextKind in ../types.ts, plus GBrain's `kind` taxonomy. */
export type KeepKind = 'theme' | 'person' | 'commitment' | 'constraint' | 'prior_decision';

/** GBrain's frozen fact kinds (MEMORY_VERBS_v1 `remember.kind`). */
export type GBrainKind = 'event' | 'preference' | 'commitment' | 'belief' | 'fact';

/** One thing worth keeping out of a call. Written to GBrain as a fact. */
export interface KeepItem {
  kind: KeepKind;
  /** Short handle — the person, the theme, the commitment. */
  label: string;
  /** The substance, in the caller's own framing. One sentence. */
  body: string;
  /**
   * The caller's own words. This is the ONLY verbatim transcript fragment
   * allowed to survive, and it survives because the extractor judged the item
   * worth keeping. Keep it short — a clause, not a paragraph.
   */
  source_quote: string | null;
  /** 0..1 — how sure the extractor was. */
  confidence: number;
}

/** What Claude pulls out of a transcript. Shaped by docs/research/02-decision-protocol.md §5. */
export interface Extraction {
  /** The decision in the caller's own words. Verbatim where possible. */
  decision: string;
  /** Their ≤12-word north star, verbatim, if the call installed one. */
  north_star: string | null;
  /** The one next action. Deliberately singular. */
  next_action: string;
  /** The if-then cue, in their words. Null when the call never got one. */
  if_then: string | null;
  /** Why this one — C5, their words. */
  why_this_one: string | null;
  /** How they got there, in their framing. */
  reasoning: string;
  /** 0..1 — how firmly they committed. */
  conviction: number;
  /** Explicitly retired questions. Keeps the brief honest about scope. */
  out_of_scope: string[];
  /** Still unsettled. */
  open_questions: string[];
  /** The context library deltas. */
  keep: KeepItem[];
  /**
   * False when the completion gate did not pass. A false landing is reported,
   * never papered over — see protocol §1.5.6.
   */
  landed: boolean;
}

// ─────────────────────────────────────────────────────────────
// What gets destroyed, and the proof
// ─────────────────────────────────────────────────────────────

export type StoreOutcome =
  /** We deleted it, and a re-request confirmed it is gone. */
  | 'destroyed'
  /** It was never created. A re-request confirms it does not exist. */
  | 'never_created'
  /** There was nothing of this kind in this call. */
  | 'not_applicable'
  /**
   * A third party holds a copy and exposes no delete. We cannot destroy it and
   * we do not claim to. This is disclosed, never hidden.
   */
  | 'retained_by_third_party'
  /** We tried to delete and could not confirm it. Loudest possible outcome. */
  | 'failed';

/** The re-request we made after deleting, and what came back. */
export interface Verification {
  /** The exact request a judge can repeat. */
  method: string;
  target: string;
  at: string;
  /** What came back, verbatim enough to be checkable. */
  evidence: string;
  /** True when the evidence shows the artifact is gone or was never there. */
  passed: boolean;
}

/** One place a copy could live, and what happened to it. */
export interface StoreRecord {
  /** Stable id, e.g. `agentphone.recording`. */
  store: string;
  /** What this store would hold, in plain words. */
  holds: string;
  /** Who controls it. `us` means we can delete; `agentphone` means we cannot. */
  controller: 'us' | 'agentphone' | 'model-provider';
  outcome: StoreOutcome;
  /** Null only when the outcome is `not_applicable`. */
  verification: Verification | null;
  note?: string;
}

/** What the UI shows after a call. The whole promise, auditable. */
export interface CallReceipt {
  call_id: string;
  processed_at: string;

  kept: {
    /** The GBrain page slug holding the decision brief. */
    brain_page: string;
    decision: string;
    next_action: string;
    /** GBrain fact ids — the handles `gbrain forget <id>` takes. */
    fact_ids: string[];
    fact_count: number;
    landed: boolean;
  };

  /** Every store we know of, including the ones we do not control. */
  destroyed: StoreRecord[];

  /** Plain-language statements that are true and were checked. */
  claims: string[];

  /**
   * Plain-language statements about what we could NOT destroy. Empty only when
   * it is genuinely empty. docs/privacy.md says the same things.
   */
  residual_exposure: string[];

  /** How the caller takes it back or removes it. */
  withdrawal: {
    export: string;
    forget_fact: string;
    forget_everything: string;
  };
}
