/**
 * Retell, from the privacy side only.
 *
 * Drop-in replacement for `agentphone.ts`. Same two exports, same shapes, so
 * `pipeline.ts` swaps one import line and nothing else changes.
 *
 * Why this exists: AgentPhone was dropped — inbound PSTN never routed, and
 * their API has no voice number type (CreateNumberRequest.Type is only
 * {sms, imessage}). The live stack is Retell.
 *
 * The important difference from the AgentPhone version: Retell's delete
 * actually works. `DELETE /v2/delete-call/{id}` returns 204 and the call is
 * gone, so the verification step proves a real deletion rather than recording
 * a 405 we could not do anything about.
 */

import { optional } from '../env.js';
import type { StoreRecord, Verification } from './types.js';

const BASE = 'https://api.retellai.com';

function key(): string {
  const k = optional('RETELL_API_KEY', '');
  if (!k) throw new Error('RETELL_API_KEY is not set — cannot reach the voice provider.');
  return k;
}

async function call(
  path: string,
  init: RequestInit = {}
): Promise<{ ok: boolean; status: number; body: string; json: unknown }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key()}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = await res.text();
  let json: unknown = null;
  try {
    json = body ? JSON.parse(body) : null;
  } catch {
    /* non-JSON (recordings, 204s) is expected */
  }
  return { ok: res.ok, status: res.status, body, json };
}

// ─────────────────────────────────────────────────────────────
// Fetch
// ─────────────────────────────────────────────────────────────

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
  recording_exists: boolean;
  /** Present only while the call still exists at Retell. Never persisted. */
  recording_url?: string;
}

/**
 * Retell gives both a flat `transcript` string and a structured
 * `transcript_object`. Prefer the structured one — it carries speaker roles —
 * and fall back to parsing the flat form, which is `Agent: ...` / `User: ...`
 * on alternating lines.
 */
function normalizeTurns(raw: Record<string, unknown>): RawTurn[] {
  const obj = raw['transcript_object'];
  if (Array.isArray(obj) && obj.length) {
    return obj
      .map((t) => {
        const e = t as Record<string, unknown>;
        const role = String(e['role'] ?? '').toLowerCase();
        const text = String(e['content'] ?? e['text'] ?? '').trim();
        if (!text) return null;
        return { speaker: role === 'agent' ? 'agent' : 'human', text } as RawTurn;
      })
      .filter((t): t is RawTurn => t !== null);
  }

  const flat = String(raw['transcript'] ?? '');
  if (!flat.trim()) return [];
  const turns: RawTurn[] = [];
  for (const line of flat.split('\n')) {
    const m = /^\s*(Agent|User)\s*:\s*(.*)$/i.exec(line);
    if (!m) {
      // continuation of the previous turn
      if (turns.length && line.trim()) turns[turns.length - 1]!.text += ' ' + line.trim();
      continue;
    }
    const text = (m[2] ?? '').trim();
    if (text) turns.push({ speaker: /agent/i.test(m[1] ?? '') ? 'agent' : 'human', text });
  }
  return turns;
}

export async function fetchCallArtifacts(callId: string): Promise<CallArtifacts> {
  const r = await call(`/v2/get-call/${encodeURIComponent(callId)}`);
  if (!r.ok) throw new Error(`Retell call fetch failed (${r.status}): ${r.body.slice(0, 200)}`);
  const d = (r.json ?? {}) as Record<string, unknown>;

  const recordingUrl = (d['recording_url'] as string | undefined) || undefined;

  return {
    call_id: String(d['call_id'] ?? callId),
    status: String(d['call_status'] ?? 'unknown'),
    direction: String(d['direction'] ?? 'inbound'),
    duration_seconds: Math.round(Number(d['duration_ms'] ?? 0) / 1000),
    turns: normalizeTurns(d),
    recording_exists: Boolean(recordingUrl),
    recording_url: recordingUrl,
  };
}

/** Pull the recording bytes down before the call is deleted. A URL is not storage. */
export async function fetchRecordingBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Destroy
// ─────────────────────────────────────────────────────────────

/**
 * Delete the call at Retell, then re-request it and record what came back.
 *
 * Unlike the AgentPhone path, the delete here is real: `DELETE
 * /v2/delete-call/{id}` is documented to remove "the call and its associated
 * data" and returns 204. So `passed` reflects an actual deletion we performed,
 * not an absence we merely observed.
 */
export async function destroyCallArtifacts(
  callId: string,
  opts: { recordingWasPrevented: boolean }
): Promise<StoreRecord[]> {
  const id = encodeURIComponent(callId);
  const now = () => new Date().toISOString();

  const attempt = await call(`/v2/delete-call/${id}`, { method: 'DELETE' });
  const deleteWorked = attempt.ok || attempt.status === 204;

  // Re-request. 404 is the proof.
  const re = await call(`/v2/get-call/${id}`);
  const gone = re.status === 404;

  const verification: Verification = {
    method: 'GET',
    target: `${BASE}/v2/get-call/${callId}`,
    at: now(),
    evidence: `HTTP ${re.status} after DELETE returned ${attempt.status}`,
    passed: gone,
  };

  return [
    {
      store: 'retell.recording',
      holds: 'The call audio.',
      controller: 'retell',
      outcome: opts.recordingWasPrevented
        ? 'never_created'
        : gone
          ? 'destroyed'
          : deleteWorked
            ? 'destroyed'
            : 'failed',
      verification,
      note: opts.recordingWasPrevented
        ? 'The call was created with recording disabled, so no audio ever existed.'
        : undefined,
    },
    {
      store: 'retell.transcript',
      holds: 'The verbatim transcript of the call.',
      controller: 'retell',
      outcome: gone || deleteWorked ? 'destroyed' : 'failed',
      verification,
    },
  ];
}
