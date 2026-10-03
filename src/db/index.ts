/**
 * The context library — public API.
 *
 * This is the whole surface other workstreams need. Import from here and
 * from `../types.js`; nothing else in `src/db/` is yours to read.
 *
 *   import { appendTurn, writeDecision, exportLibrary, destroySession } from './db/index.js';
 *   import type { Session, Turn, Decision } from './types.js';
 *
 * Every function throws a readable Error (MissingConfigError, status 503,
 * when keys are absent). None of them swallow failures.
 */

import { db, dbReady, unwrap } from './client.js';
import {
  DEMO_TENANT,
  type ContextItem,
  type Decision,
  type DestroyResult,
  type LibraryExport,
  type NewContextItem,
  type NewDecision,
  type NewReceipt,
  type NewSession,
  type NewTurn,
  type Receipt,
  type Session,
  type SessionPhase,
  type SessionStatus,
  type Turn,
} from '../types.js';

export { dbReady };
export const DEFAULT_SUBJECT = 'demo-subject';

// ─────────────────────────────────────────────────────────────
// Sessions
// ─────────────────────────────────────────────────────────────

/** Start a session. Call this once when a conversation begins. */
export async function createSession(input: NewSession = {}): Promise<Session> {
  return unwrap(
    await db()
      .from('sessions')
      .insert({
        tenant: DEMO_TENANT,
        subject_id: input.subject_id ?? DEFAULT_SUBJECT,
        phase: input.phase ?? 'opening',
        metadata: input.metadata ?? {},
      })
      .select()
      .single(),
    'createSession'
  ) as Session;
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const { data, error } = await db().from('sessions').select().eq('id', sessionId).maybeSingle();
  if (error) throw new Error(`getSession failed: ${error.message}`);
  return (data as Session) ?? null;
}

export async function listSessions(
  subjectId = DEFAULT_SUBJECT,
  limit = 20
): Promise<Session[]> {
  return unwrap(
    await db()
      .from('sessions')
      .select()
      .eq('subject_id', subjectId)
      .order('started_at', { ascending: false })
      .limit(limit),
    'listSessions'
  ) as Session[];
}

/** Move the session's phase forward. The voice layer drives this. */
export async function setSessionPhase(
  sessionId: string,
  phase: SessionPhase
): Promise<Session> {
  return unwrap(
    await db().from('sessions').update({ phase }).eq('id', sessionId).select().single(),
    'setSessionPhase'
  ) as Session;
}

/**
 * End a session and record how long it ran. `durationSeconds` is what MPP
 * meters, so pass the real wall-clock talk time.
 */
export async function endSession(
  sessionId: string,
  durationSeconds: number,
  status: SessionStatus = 'completed'
): Promise<Session> {
  return unwrap(
    await db()
      .from('sessions')
      .update({
        status,
        ended_at: new Date().toISOString(),
        duration_seconds: Math.max(0, Math.round(durationSeconds)),
      })
      .eq('id', sessionId)
      .select()
      .single(),
    'endSession'
  ) as Session;
}

// ─────────────────────────────────────────────────────────────
// Turns — what the voice chat calls
// ─────────────────────────────────────────────────────────────

/**
 * Append one turn to a session's transcript. `seq` is assigned by the
 * database, so call this in speaking order and ignore ordering yourself.
 */
export async function appendTurn(input: NewTurn): Promise<Turn> {
  return unwrap(
    await db()
      .from('turns')
      .insert({
        session_id: input.session_id,
        speaker: input.speaker,
        text: input.text,
        offset_ms: input.offset_ms ?? null,
        spoken_at: input.spoken_at ?? new Date().toISOString(),
      })
      .select()
      .single(),
    'appendTurn'
  ) as Turn;
}

/** The transcript in order. Returns `[]` after destroy-on-exit. */
export async function listTurns(sessionId: string): Promise<Turn[]> {
  return unwrap(
    await db().from('turns').select().eq('session_id', sessionId).order('seq'),
    'listTurns'
  ) as Turn[];
}

// ─────────────────────────────────────────────────────────────
// Context items — the durable library
// ─────────────────────────────────────────────────────────────

/** Record an extracted context item. Many at once is cheaper; see below. */
export async function addContextItem(input: NewContextItem): Promise<ContextItem> {
  const [item] = await addContextItems([input]);
  if (!item) throw new Error('addContextItem returned nothing');
  return item;
}

export async function addContextItems(inputs: NewContextItem[]): Promise<ContextItem[]> {
  if (inputs.length === 0) return [];
  return unwrap(
    await db()
      .from('context_items')
      .insert(
        inputs.map((i) => ({
          tenant: DEMO_TENANT,
          subject_id: i.subject_id ?? DEFAULT_SUBJECT,
          session_id: i.session_id,
          kind: i.kind,
          label: i.label,
          body: i.body,
          turn_id: i.turn_id ?? null,
          source_quote: i.source_quote ?? null,
          confidence: i.confidence ?? 0.5,
          kept: i.kept ?? false,
        }))
      )
      .select(),
    'addContextItems'
  ) as ContextItem[];
}

/**
 * The person chooses what to keep. Only kept items survive
 * `destroySession`, so this call is what makes the library theirs.
 */
export async function keepContextItems(
  ids: string[],
  kept = true
): Promise<ContextItem[]> {
  if (ids.length === 0) return [];
  return unwrap(
    await db().from('context_items').update({ kept }).in('id', ids).select(),
    'keepContextItems'
  ) as ContextItem[];
}

export async function listContextItems(
  opts: { subjectId?: string; sessionId?: string; keptOnly?: boolean } = {}
): Promise<ContextItem[]> {
  let q = db()
    .from('context_items')
    .select()
    .eq('subject_id', opts.subjectId ?? DEFAULT_SUBJECT);
  if (opts.sessionId) q = q.eq('session_id', opts.sessionId);
  if (opts.keptOnly) q = q.eq('kept', true);
  return unwrap(await q.order('created_at', { ascending: false }), 'listContextItems') as ContextItem[];
}

// ─────────────────────────────────────────────────────────────
// Decisions — what the brief chat calls
// ─────────────────────────────────────────────────────────────

/**
 * Write the decision artifact. `dispatched_at` stays null until the brief
 * actually leaves — use `markDispatched` for that, so "drafted" and
 * "handed to their agent" never get confused.
 */
export async function writeDecision(input: NewDecision): Promise<Decision> {
  return unwrap(
    await db()
      .from('decisions')
      .insert({
        tenant: DEMO_TENANT,
        subject_id: input.subject_id ?? DEFAULT_SUBJECT,
        session_id: input.session_id,
        statement: input.statement,
        next_action: input.next_action,
        reasoning: input.reasoning,
        next_steps: input.next_steps ?? [],
        conviction: input.conviction ?? 0.5,
        dispatch_target: input.dispatch_target ?? null,
      })
      .select()
      .single(),
    'writeDecision'
  ) as Decision;
}

/** Stamp a decision as handed off. Also advances the session to `dispatched`. */
export async function markDispatched(
  decisionId: string,
  dispatchTarget: string
): Promise<Decision> {
  const decision = unwrap(
    await db()
      .from('decisions')
      .update({ dispatched_at: new Date().toISOString(), dispatch_target: dispatchTarget })
      .eq('id', decisionId)
      .select()
      .single(),
    'markDispatched'
  ) as Decision;

  if (decision.session_id) {
    await setSessionPhase(decision.session_id, 'dispatched').catch(() => {});
  }
  return decision;
}

export async function getDecisionForSession(sessionId: string): Promise<Decision | null> {
  const { data, error } = await db()
    .from('decisions')
    .select()
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getDecisionForSession failed: ${error.message}`);
  return (data as Decision) ?? null;
}

export async function listDecisions(
  subjectId = DEFAULT_SUBJECT,
  limit = 20
): Promise<Decision[]> {
  return unwrap(
    await db()
      .from('decisions')
      .select()
      .eq('subject_id', subjectId)
      .order('created_at', { ascending: false })
      .limit(limit),
    'listDecisions'
  ) as Decision[];
}

// ─────────────────────────────────────────────────────────────
// Receipts — MPP
// ─────────────────────────────────────────────────────────────

export async function writeReceipt(input: NewReceipt): Promise<Receipt> {
  return unwrap(
    await db()
      .from('receipts')
      .insert({
        tenant: DEMO_TENANT,
        session_id: input.session_id,
        cadence: input.cadence,
        amount_usd: input.amount_usd,
        payer: input.payer ?? null,
        payment_method: input.payment_method ?? null,
        stripe_reference: input.stripe_reference ?? null,
        billed_seconds: input.billed_seconds ?? null,
        livemode: input.livemode ?? false,
        raw: input.raw ?? {},
      })
      .select()
      .single(),
    'writeReceipt'
  ) as Receipt;
}

export async function listReceipts(
  opts: { sessionId?: string; limit?: number } = {}
): Promise<Receipt[]> {
  let q = db().from('receipts').select();
  if (opts.sessionId) q = q.eq('session_id', opts.sessionId);
  return unwrap(
    await q.order('created_at', { ascending: false }).limit(opts.limit ?? 50),
    'listReceipts'
  ) as Receipt[];
}

// ─────────────────────────────────────────────────────────────
// The two load-bearing operations
// ─────────────────────────────────────────────────────────────

/**
 * Destroy-on-exit. Deletes the raw transcript outright and discards every
 * context item the person did not keep. What remains is their kept context
 * and their decisions. Not a flag — the rows are gone.
 *
 * Idempotent: running it twice just reports zero turns the second time.
 */
export async function destroySession(sessionId: string): Promise<DestroyResult> {
  const { data, error } = await db().rpc('destroy_session', { p_session_id: sessionId });
  if (error) throw new Error(`destroySession failed: ${error.message}`);
  return data as DestroyResult;
}

/**
 * The whole library for one person, as portable JSON. One call, one
 * document, no server needed to read it afterwards.
 */
export async function exportLibrary(subjectId = DEFAULT_SUBJECT): Promise<LibraryExport> {
  const { data, error } = await db().rpc('export_library', { p_subject_id: subjectId });
  if (error) throw new Error(`exportLibrary failed: ${error.message}`);
  return data as LibraryExport;
}
