/**
 * AgentPhone, from the privacy side only: fetch the artifacts of a finished
 * call, then try to destroy them and record exactly what happened.
 *
 * This is NOT the call-control surface — that is src/phone/ and belongs to the
 * phone workstream. Nothing here starts, answers, or configures a call.
 *
 * ── What we verified against the live API on 2026-10-03 ──────────────────
 * AgentPhone exposes NO delete for calls, transcripts, or recordings.
 *   DELETE /v1/calls/{id}  ->  405, `allow: GET`
 * Their own spec for DELETE /v1/agents/{id} says it outright: "calls
 * associated with the agent will have their agent reference cleared (set to
 * null) but will not be deleted themselves."
 *
 * So we do two things instead of pretending:
 *   1. Prevent. `POST /v1/calls` takes `disableRecording: true` — "no audio
 *      recording is stored for this call." Never created beats deleted, and
 *      the 404 on the recording endpoint is permanent and checkable.
 *   2. Disclose. We attempt the delete anyway, on every run, and put the
 *      vendor's refusal in the receipt. A judge sees the attempt and the 405.
 *
 * If AgentPhone ships a delete, `destroyCallArtifacts` starts succeeding with
 * no other change — the attempt is already wired.
 */

import { require_, optional } from '../env.js';
import type { StoreRecord, Verification } from './types.js';

const RECORDING_PREVENTED_NOTE =
  'Recording was prevented at call creation (disableRecording: true), so no audio ever existed to delete.';

function base(): string {
  return optional('AGENTPHONE_BASE_URL', 'https://api.agentphone.ai/v1').replace(/\/$/, '');
}

function key(): string {
  return require_('AgentPhone', 'AGENTPHONE_API_KEY');
}

async function call(
  path: string,
  init: RequestInit = {}
): Promise<{ status: number; ok: boolean; body: string; allow: string | null }> {
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key()}`, ...(init.headers ?? {}) },
  });
  return {
    status: res.status,
    ok: res.ok,
    body: (await res.text()).slice(0, 400),
    allow: res.headers.get('allow'),
  };
}

// ─────────────────────────────────────────────────────────────
// Fetch
// ─────────────────────────────────────────────────────────────

/** One exchange as AgentPhone returns it. Shape is defensive — theirs varies. */
export interface RawTurn {
  speaker: 'human' | 'agent';
  text: string;
}

export interface CallArtifacts {
  call_id: string;
  status: string;
  direction: string;
  duration_seconds: number;
  turns: RawTurn[];
  /** True when AgentPhone says an audio recording exists for this call. */
  recording_exists: boolean;
}

/**
 * Normalize whatever AgentPhone puts in `transcript`. Their docs say each
 * entry holds "the user utterance and the corresponding agent response (when
 * available)", but the array was empty on every call we could inspect, so
 * this accepts the three plausible shapes rather than guessing one.
 */
function normalizeTurns(raw: unknown): RawTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: RawTurn[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;

    // Shape A: paired { user, agent }
    if (typeof e.user === 'string' || typeof e.agent === 'string') {
      if (typeof e.user === 'string' && e.user.trim()) out.push({ speaker: 'human', text: e.user });
      if (typeof e.agent === 'string' && e.agent.trim())
        out.push({ speaker: 'agent', text: e.agent });
      continue;
    }

    // Shape B/C: { role | speaker, content | text | message }
    const who = String(e.role ?? e.speaker ?? '').toLowerCase();
    const text = e.content ?? e.text ?? e.message;
    if (typeof text === 'string' && text.trim()) {
      out.push({ speaker: who === 'agent' || who === 'assistant' ? 'agent' : 'human', text });
    }
  }
  return out;
}

/** Pull everything AgentPhone holds for a call. Nothing is written to disk. */
export async function fetchCallArtifacts(callId: string): Promise<CallArtifacts> {
  const t = await call(`/calls/${encodeURIComponent(callId)}/transcript`);
  if (!t.ok) throw new Error(`AgentPhone transcript fetch failed (${t.status}): ${t.body}`);
  const data = JSON.parse(t.body || '{}') as Record<string, unknown>;

  const rec = await call(`/calls/${encodeURIComponent(callId)}/recording`, { method: 'HEAD' });

  return {
    call_id: callId,
    status: String(data.status ?? 'unknown'),
    direction: String(data.direction ?? 'unknown'),
    duration_seconds: Number(data.durationSeconds ?? 0),
    turns: normalizeTurns(data.transcript),
    recording_exists: rec.ok,
  };
}

// ─────────────────────────────────────────────────────────────
// Destroy, and tell the truth about it
// ─────────────────────────────────────────────────────────────

/**
 * Try to delete the transcript and the recording, then re-request both and
 * record what came back.
 *
 * `recordingWasPrevented` should be true when the call was created with
 * `disableRecording: true`. It changes the recording outcome from "they keep
 * it" to "it never existed", which is the stronger and still-true claim.
 */
export async function destroyCallArtifacts(
  callId: string,
  opts: { recordingWasPrevented: boolean }
): Promise<StoreRecord[]> {
  const id = encodeURIComponent(callId);
  const now = () => new Date().toISOString();

  // 1. Attempt the delete. We expect 405 today; this is the line that starts
  //    working for free if AgentPhone ever ships one.
  const attempt = await call(`/calls/${id}`, { method: 'DELETE' });
  const deleteWorked = attempt.ok;

  // 2. Re-request the transcript regardless, and report what we actually see.
  const reTranscript = await call(`/calls/${id}/transcript`);
  const transcriptVerification: Verification = {
    method: 'GET',
    target: `${base()}/calls/${callId}/transcript`,
    at: now(),
    evidence: `HTTP ${reTranscript.status}${
      deleteWorked ? '' : ` after DELETE returned ${attempt.status}${attempt.allow ? ` (allow: ${attempt.allow})` : ''}`
    }`,
    passed: reTranscript.status === 404,
  };

  // 3. Re-request the recording.
  const reRecording = await call(`/calls/${id}/recording`);
  const recordingVerification: Verification = {
    method: 'GET',
    target: `${base()}/calls/${callId}/recording`,
    at: now(),
    evidence: `HTTP ${reRecording.status} ${reRecording.body.slice(0, 120)}`,
    passed: reRecording.status === 404,
  };

  return [
    {
      store: 'agentphone.recording',
      holds: 'The call audio.',
      controller: 'agentphone',
      outcome: opts.recordingWasPrevented
        ? recordingVerification.passed
          ? 'never_created'
          : 'failed'
        : recordingVerification.passed
          ? 'never_created'
          : 'retained_by_third_party',
      verification: recordingVerification,
      note: opts.recordingWasPrevented ? RECORDING_PREVENTED_NOTE : undefined,
    },
    {
      store: 'agentphone.transcript',
      holds: 'AgentPhone’s own copy of the words spoken.',
      controller: 'agentphone',
      outcome: transcriptVerification.passed ? 'destroyed' : 'retained_by_third_party',
      verification: transcriptVerification,
      note: transcriptVerification.passed
        ? undefined
        : 'AgentPhone exposes no delete for call transcripts; DELETE /v1/calls/{id} answers 405 with `allow: GET`. We attempt it on every run and report the refusal rather than claiming a deletion we did not get. Their retention is governed by their policy, not ours.',
    },
  ];
}
