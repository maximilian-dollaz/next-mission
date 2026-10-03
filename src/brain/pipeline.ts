/**
 * The zero-retention pipeline. On call end, in this order:
 *
 *   1. Fetch the transcript and recording state from AgentPhone.
 *   2. Extract the decision, the one next action, and what is worth keeping.
 *   3. Write them into GBrain with provenance.
 *   4. Destroy every copy, and verify by re-requesting.
 *   5. Return a receipt: what was kept, what was destroyed, what we could not
 *      destroy and who holds it.
 *
 * Step 4 is the product. Step 5 is what makes step 4 believable.
 *
 * The transcript lives in a local variable for the length of this function and
 * is never written to disk, never logged, and never returned to the caller.
 */

import { optional } from '../env.js';
import { fetchCallArtifacts, destroyCallArtifacts, type RawTurn } from './agentphone.js';
import { extract } from './extract.js';
import * as brain from './gbrain.js';
import { briefSlug, renderBrief } from './page.js';
import { destroyOurTranscript, noteInMemoryOnly, noteExtractionExposure } from './destroy.js';
import type { CallReceipt, Extraction, KeepItem, GBrainKind, StoreRecord } from './types.js';

/** Our context kinds onto GBrain's frozen fact kinds. */
const KIND_MAP: Record<KeepItem['kind'], GBrainKind> = {
  theme: 'belief',
  person: 'fact',
  commitment: 'commitment',
  constraint: 'fact',
  prior_decision: 'event',
};

export interface RunOptions {
  callId: string;
  /** Our session row, when the voice layer created one. Null means in-memory only. */
  sessionId?: string | null;
  /** True when the call was created with `disableRecording: true`. */
  recordingWasPrevented?: boolean;
  mode?: 'full' | 'sprint';
  /** Skip the AgentPhone fetch and use these turns. For rehearsal and tests. */
  turns?: RawTurn[];
}

export async function runPipeline(opts: RunOptions): Promise<CallReceipt> {
  const processedAt = new Date().toISOString();
  const model = optional('ORCHESTRATOR_MODEL', 'claude-opus-5');
  const mode = opts.mode ?? 'sprint';

  // ── 1. Fetch ───────────────────────────────────────────────
  let turns: RawTurn[];
  let recordingExisted = false;
  if (opts.turns) {
    turns = opts.turns;
  } else {
    const artifacts = await fetchCallArtifacts(opts.callId);
    turns = artifacts.turns;
    recordingExisted = artifacts.recording_exists;
  }

  // ── 2. Extract ─────────────────────────────────────────────
  const extraction: Extraction = await extract(turns);

  // ── 3. Write into GBrain, with provenance ──────────────────
  const engine = await brain.engineStatus();
  const provenance = `Next Mission call ${opts.callId}, ${processedAt} (transcript destroyed)`;
  const slug = briefSlug(opts.callId);

  await brain.putPage({
    slug,
    markdown: renderBrief({
      callId: opts.callId,
      extraction,
      processedAt,
      mode,
      engine: engine.effective_engine,
    }),
    sourceUri: `agentphone:call/${opts.callId}`,
    force: true,
  });

  const factIds: string[] = [];

  // The decision itself is a fact as well as a page, so entity-scoped recall
  // on people/me surfaces it without a search.
  if (extraction.decision) {
    const r = await brain.remember({
      fact: extraction.landed
        ? extraction.decision
        : `Did not land: ${extraction.decision || 'no commitment was reached'}`,
      provenance,
      kind: extraction.landed ? 'commitment' : 'event',
    });
    factIds.push(r.id);
  }

  for (const item of extraction.keep) {
    const quote = item.source_quote ? ` — in their words: "${item.source_quote}"` : '';
    const r = await brain.remember({
      fact: `${item.label}: ${item.body}${quote}`,
      provenance,
      kind: KIND_MAP[item.kind],
    });
    factIds.push(r.id);
  }

  // ── 4. Destroy, and verify by re-requesting ────────────────
  const stores: StoreRecord[] = [];
  if (opts.turns) {
    // Rehearsal: these turns never came from AgentPhone, so there is nothing
    // of theirs to delete and a 404 from them would prove nothing. Say so
    // rather than banking a free pass.
    stores.push({
      store: 'agentphone',
      holds: 'Nothing — this run was fed a rehearsal transcript.',
      controller: 'agentphone',
      outcome: 'not_applicable',
      verification: null,
      note: 'No AgentPhone call was involved, so no AgentPhone artifact was fetched, deleted, or verified. Run against a real call id to exercise that path.',
    });
  } else {
    stores.push(
      ...(await destroyCallArtifacts(opts.callId, {
        recordingWasPrevented: opts.recordingWasPrevented ?? !recordingExisted,
      }))
    );
  }
  stores.push(await destroyOurTranscript(opts.sessionId ?? null));
  stores.push(noteInMemoryOnly(turns.length));
  stores.push(noteExtractionExposure(model));

  // Drop the only remaining reference we hold.
  turns = [];

  // ── 5. Receipt ─────────────────────────────────────────────
  return buildReceipt({ opts, processedAt, slug, extraction, factIds, stores, engine });
}

function buildReceipt(a: {
  opts: RunOptions;
  processedAt: string;
  slug: string;
  extraction: Extraction;
  factIds: string[];
  stores: StoreRecord[];
  engine: brain.EngineStatus;
}): CallReceipt {
  const claims: string[] = [];
  const residual: string[] = [];

  for (const s of a.stores) {
    const where = s.verification ? ` (${s.verification.method} ${s.verification.target} → ${s.verification.evidence})` : '';
    switch (s.outcome) {
      case 'destroyed':
        claims.push(`${s.holds} Destroyed and confirmed gone${where}.`);
        break;
      case 'never_created':
        claims.push(`${s.holds} It was never created${where}.`);
        break;
      case 'retained_by_third_party':
        residual.push(`${s.holds} ${s.note ?? 'Held by a third party we cannot delete from.'}`);
        break;
      case 'failed':
        residual.push(`COULD NOT DESTROY — ${s.holds}${where}. Treat this call as not privacy-clean.`);
        break;
      case 'not_applicable':
        break;
    }
  }

  claims.push(
    `The only durable record of this call is in your own brain, on the ${a.engine.effective_engine} engine at ${a.engine.database_path ?? a.engine.database_url ?? 'your database'}.`
  );

  return {
    call_id: a.opts.callId,
    processed_at: a.processedAt,
    kept: {
      brain_page: a.slug,
      decision: a.extraction.decision,
      next_action: a.extraction.next_action,
      fact_ids: a.factIds,
      fact_count: a.factIds.length,
      landed: a.extraction.landed,
    },
    destroyed: a.stores,
    claims,
    residual_exposure: residual,
    withdrawal: {
      export: `gbrain export --slug-prefix decisions/ --dir ./my-library`,
      forget_fact: `gbrain forget <id> --reason "withdrawn"   # ids: ${a.factIds.join(', ') || 'none'}`,
      forget_everything: `gbrain delete ${a.slug} && ${a.factIds.map((i) => `gbrain forget ${i} --reason withdrawn`).join(' && ') || '(no facts)'}`,
    },
  };
}
