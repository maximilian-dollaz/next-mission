/**
 * Destroy every copy we hold, then prove it by asking for it again.
 *
 * The proof is the point. A deletion nobody can check is a promise; a deletion
 * you can watch fail to come back is a property of the system. So every store
 * here is re-requested after the delete and the response is recorded verbatim
 * enough for a judge to repeat the request themselves.
 */

import { db, dbReady } from '../db/client.js';
import type { StoreRecord, Verification } from './types.js';

/**
 * Our own database copy of the transcript.
 *
 * Calls the `destroy_session` RPC (supabase/migrations — it deletes the turns
 * and the unkept context items in one transaction), then re-selects the turns
 * to confirm the table is empty for that session.
 */
export async function destroyOurTranscript(sessionId: string | null): Promise<StoreRecord> {
  const base = {
    store: 'next-mission.turns',
    holds: 'Our own row-per-utterance copy of the transcript, in Supabase.',
    controller: 'us' as const,
  };

  if (!sessionId || !dbReady()) {
    return {
      ...base,
      outcome: 'not_applicable',
      verification: null,
      note: sessionId
        ? 'Supabase is not configured, so no copy was ever written here.'
        : 'This call was processed in memory and never written to our database.',
    };
  }

  const client = db();
  const { error: destroyError } = await client.rpc('destroy_session', { p_session_id: sessionId });

  // Verify independently of what the RPC claimed: ask for the rows back.
  const { count, error: readError } = await client
    .from('turns')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId);

  const verification: Verification = {
    method: 'SELECT count(*)',
    target: `turns where session_id = ${sessionId}`,
    at: new Date().toISOString(),
    evidence: readError
      ? `read-back failed: ${readError.message}`
      : `${count ?? 0} rows remain`,
    passed: !readError && (count ?? -1) === 0,
  };

  return {
    ...base,
    outcome: verification.passed ? 'destroyed' : 'failed',
    verification,
    note: destroyError ? `destroy_session reported: ${destroyError.message}` : undefined,
  };
}

/**
 * The transcript we held in this process.
 *
 * We never write it to disk, so there is no file to unlink. What we can do is
 * drop the reference and say so honestly: this is a statement about how the
 * pipeline is built, not a deletion we performed.
 */
export function noteInMemoryOnly(turnCount: number): StoreRecord {
  return {
    store: 'next-mission.process',
    holds: 'The transcript while it was being read.',
    controller: 'us',
    outcome: 'destroyed',
    verification: {
      method: 'by construction',
      target: 'process memory',
      at: new Date().toISOString(),
      evidence: `${turnCount} turns were held in memory for the length of one extraction and never written to disk. There is no file, no log line, and no cache entry containing them.`,
      passed: true,
    },
    note: 'Verifiable by reading src/brain/pipeline.ts rather than by a request — stated as a property of the code, not as a checked deletion.',
  };
}

/**
 * Anthropic saw the transcript once, during extraction.
 *
 * This is disclosed, not destroyed. We cannot delete from someone else's
 * infrastructure and we do not claim to.
 */
export function noteExtractionExposure(model: string): StoreRecord {
  return {
    store: 'anthropic.extraction',
    holds: 'The transcript, for the length of one API request.',
    controller: 'model-provider',
    outcome: 'retained_by_third_party',
    verification: null,
    note: `The transcript was sent to Anthropic once, to ${model}, to extract the decision. We hold no copy afterwards and we cannot delete theirs. Anthropic's API does not train on API inputs; their retention is governed by their policy, not ours. See docs/privacy.md.`,
  };
}
