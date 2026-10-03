/**
 * Shared domain types for Next Mission v2.
 *
 * This is the contract other workstreams import. Keep it small and boring.
 * Field names here match the Supabase column names exactly (snake_case) so a
 * row and a value of these types are the same shape.
 */

/** The single demo tenant. One person, one library. */
export const DEMO_TENANT = 'demo' as const;

// ─────────────────────────────────────────────────────────────
// Sessions
// ─────────────────────────────────────────────────────────────

/** How far the conversation got before it ended. */
export type SessionPhase =
  | 'opening' // gathering what's actually on their mind
  | 'framing' // naming the real decision
  | 'exploring' // weighing it
  | 'converging' // narrowing to one direction
  | 'committed' // they said the decision out loud
  | 'dispatched'; // the brief went to their agent

export const SESSION_PHASES: readonly SessionPhase[] = [
  'opening',
  'framing',
  'exploring',
  'converging',
  'committed',
  'dispatched',
];

export type SessionStatus =
  | 'active' // live right now
  | 'completed' // ended normally
  | 'abandoned' // ended without a decision
  | 'destroyed'; // raw transcript has been destroyed on exit

export interface Session {
  id: string;
  tenant: string;
  /** Opaque id for the person. One value for the demo. */
  subject_id: string;
  status: SessionStatus;
  phase: SessionPhase;
  started_at: string;
  ended_at: string | null;
  /** Wall-clock seconds of conversation. Drives MPP metered talk time. */
  duration_seconds: number;
  /** Free-form notes from the voice layer (model, voice name, call sid...). */
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface NewSession {
  subject_id?: string;
  phase?: SessionPhase;
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// Turns — the raw transcript. Destroyed on exit.
// ─────────────────────────────────────────────────────────────

export type Speaker = 'human' | 'agent';

export interface Turn {
  id: string;
  session_id: string;
  /** 1-based, monotonic within a session. Assigned by the database. */
  seq: number;
  speaker: Speaker;
  text: string;
  /** Milliseconds from session start, if the voice layer knows it. */
  offset_ms: number | null;
  spoken_at: string;
  created_at: string;
}

export interface NewTurn {
  session_id: string;
  speaker: Speaker;
  text: string;
  offset_ms?: number | null;
  spoken_at?: string;
}

// ─────────────────────────────────────────────────────────────
// Context items — the durable library. Survives destroy-on-exit.
// ─────────────────────────────────────────────────────────────

export type ContextKind =
  | 'theme' // a recurring preoccupation
  | 'person' // someone who matters to the decision
  | 'commitment' // something they said they would do
  | 'constraint' // something that is not negotiable for them
  | 'prior_decision'; // a decision from an earlier session

export const CONTEXT_KINDS: readonly ContextKind[] = [
  'theme',
  'person',
  'commitment',
  'constraint',
  'prior_decision',
];

export interface ContextItem {
  id: string;
  tenant: string;
  subject_id: string;
  /** The session that produced it. Survives destroy-on-exit as a tombstone. */
  session_id: string | null;
  kind: ContextKind;
  label: string;
  /** The substance, in the person's own framing where possible. */
  body: string;
  /**
   * Where this came from. `turn_id` goes null when the transcript is
   * destroyed; `source_quote` is the person's own words, kept because they
   * chose to keep this item.
   */
  turn_id: string | null;
  source_quote: string | null;
  /** 0..1 — how sure the extractor was. */
  confidence: number;
  /**
   * True once the person has chosen to keep this. Destroy-on-exit keeps
   * kept items and deletes the rest.
   */
  kept: boolean;
  created_at: string;
  updated_at: string;
}

export interface NewContextItem {
  session_id: string;
  kind: ContextKind;
  label: string;
  body: string;
  subject_id?: string;
  turn_id?: string | null;
  source_quote?: string | null;
  confidence?: number;
  kept?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Decisions — the output artifact
// ─────────────────────────────────────────────────────────────

/** One thing an agent can execute without asking a follow-up question. */
export interface NextStep {
  /** Imperative, specific, and checkable. */
  action: string;
  /** Why this step, in one line — so the agent can explain itself. */
  rationale?: string;
  /** ISO date or a plain phrase like "before Friday". */
  due?: string;
}

export interface Decision {
  id: string;
  tenant: string;
  subject_id: string;
  session_id: string | null;
  /** The decision in the person's own words. Verbatim where possible. */
  statement: string;
  /** The one next action. Deliberately singular. */
  next_action: string;
  /** How they got there, in their framing. */
  reasoning: string;
  /** Additional executable steps, if any. The first is `next_action`. */
  next_steps: NextStep[];
  /** 0..1 — how firmly they committed. */
  conviction: number;
  /** Who the brief was handed to, e.g. "intuitive". */
  dispatch_target: string | null;
  /** Set when the brief actually left. Null means drafted, not dispatched. */
  dispatched_at: string | null;
  created_at: string;
}

export interface NewDecision {
  session_id: string;
  statement: string;
  next_action: string;
  reasoning: string;
  subject_id?: string;
  next_steps?: NextStep[];
  conviction?: number;
  dispatch_target?: string | null;
}

// ─────────────────────────────────────────────────────────────
// Receipts — MPP payments
// ─────────────────────────────────────────────────────────────

/** `stream` = metered talk time. `settlement` = the decision brief. */
export type ReceiptCadence = 'stream' | 'settlement';

export interface Receipt {
  id: string;
  tenant: string;
  session_id: string | null;
  cadence: ReceiptCadence;
  /** Decimal string, USD. Sub-cent values are expected for `stream`. */
  amount_usd: string;
  currency: string;
  /** Which agent paid. From the MPP payer credential where available. */
  payer: string | null;
  payment_method: string | null;
  /** Stripe PaymentIntent / MPP payment reference. */
  stripe_reference: string | null;
  /** Seconds of talk time this receipt covers. */
  billed_seconds: number | null;
  livemode: boolean;
  raw: Record<string, unknown>;
  created_at: string;
}

export interface NewReceipt {
  session_id: string | null;
  cadence: ReceiptCadence;
  amount_usd: string;
  payer?: string | null;
  payment_method?: string | null;
  stripe_reference?: string | null;
  billed_seconds?: number | null;
  livemode?: boolean;
  raw?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// Export — the portable library
// ─────────────────────────────────────────────────────────────

/**
 * Everything one person owns, in one JSON document. This is the whole
 * promise of "user-owned and portable": no server needed to read it.
 */
export interface LibraryExport {
  format: 'next-mission.library';
  version: 1;
  exported_at: string;
  subject_id: string;
  sessions: Array<Session & { turns: Turn[] }>;
  context_items: ContextItem[];
  decisions: Decision[];
  receipts: Receipt[];
  counts: {
    sessions: number;
    turns: number;
    context_items: number;
    decisions: number;
    receipts: number;
  };
}

/** What `destroySession` actually did. Shown in the demo. */
export interface DestroyResult {
  session_id: string;
  /** Raw transcript turns deleted. */
  turns_destroyed: number;
  /** Context items the person kept, which survived. */
  context_items_kept: number;
  /** Unkept context items removed along with the transcript. */
  context_items_discarded: number;
  /** Decisions are the person's output and are never destroyed. */
  decisions_retained: number;
  destroyed_at: string;
}
