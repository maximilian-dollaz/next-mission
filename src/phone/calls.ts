import { phoneClient } from './agent.js';

/**
 * listCalls/getCallTranscript are typed `unknown` by the SDK, so these are
 * deliberately loose — the shape is probed live rather than guessed, and the
 * normalisers below are the single place that shape is interpreted.
 */

export type RawCall = Record<string, unknown>;

export async function listRecentCalls(limit = 10): Promise<RawCall[]> {
  const res = (await phoneClient().calls.listCalls({})) as unknown;
  const arr = Array.isArray(res)
    ? res
    : ((res as { calls?: unknown[]; data?: unknown[]; items?: unknown[] })?.calls ??
       (res as { data?: unknown[] })?.data ??
       (res as { items?: unknown[] })?.items ??
       []);
  return (arr as RawCall[]).slice(0, limit);
}

export async function getCall(callId: string) {
  return (await phoneClient().calls.getCall({ call_id: callId })) as RawCall;
}

export async function getTranscript(callId: string) {
  return (await phoneClient().calls.getCallTranscript({ call_id: callId })) as unknown;
}

export async function getRecording(callId: string) {
  return (await phoneClient().calls.getCallRecording({ call_id: callId })) as unknown;
}

export interface Turn {
  role: 'agent' | 'caller';
  text: string;
}

/** Collapse whatever the API returns into an ordered agent/caller turn list. */
export function normaliseTurns(raw: unknown): Turn[] {
  const candidates = Array.isArray(raw)
    ? raw
    : ((raw as { transcript?: unknown[] })?.transcript ??
       (raw as { turns?: unknown[] })?.turns ??
       (raw as { messages?: unknown[] })?.messages ??
       (raw as { utterances?: unknown[] })?.utterances ??
       []);

  if (!Array.isArray(candidates)) return [];

  return (candidates as Record<string, unknown>[])
    .map((t) => {
      const rawRole = String(t.role ?? t.speaker ?? t.from ?? t.source ?? '').toLowerCase();
      const text = String(t.text ?? t.content ?? t.message ?? t.transcript ?? '').trim();
      const role: Turn['role'] =
        rawRole.includes('agent') || rawRole.includes('assistant') || rawRole.includes('bot')
          ? 'agent'
          : 'caller';
      return { role, text };
    })
    .filter((t) => t.text.length > 0);
}

/** Flat text form, which is what the brief generator reads. */
export function transcriptText(turns: Turn[]): string {
  return turns.map((t) => `${t.role === 'agent' ? 'AGENT' : 'MAX'}: ${t.text}`).join('\n');
}
