/**
 * After the call: transcript -> db -> Claude brief -> settlement.
 *
 *   npm run phone:capture              — newest completed call
 *   npm run phone:capture -- <callId>  — a specific one
 *
 * Persistence goes through src/db (chat 03's module). No DB code lives here.
 */
import { writeFileSync } from 'node:fs';
import { appendTurn, createSession, writeDecision, writeReceipt } from '../db/index.js';
import { settlementUsd } from '../mpp/index.js';
import { generateBrief, renderBrief, type Brief } from './brief.js';
import { getCall, getTranscript, listRecentCalls, normaliseTurns, type Turn } from './calls.js';

function pickCallId(calls: Record<string, unknown>[]): string {
  const done = calls.find((c) => c.status === 'completed');
  const chosen = done ?? calls[0];
  if (!chosen) throw new Error('no calls found');
  return String(chosen.id);
}

/** Rough clock: which turn index holds the commitment, as a share of the call. */
function timeToDecision(turns: Turn[], durationSeconds: number): string {
  const commit = /\b(i'?m going to|i will|i'?m doing|i'?ll)\b/i;
  const idx = turns.findIndex((t) => t.role === 'caller' && commit.test(t.text));
  if (idx < 0) return 'no commitment sentence found in transcript';
  const share = (idx + 1) / turns.length;
  return `commitment at caller turn ${idx + 1}/${turns.length} — approx ${Math.round(share * durationSeconds)}s of a ${durationSeconds}s call (estimate; use the stopwatch number as authoritative)`;
}

const callId = process.argv[2] ?? pickCallId(await listRecentCalls());

const call = await getCall(callId);
const duration = Number(call.durationSeconds ?? 0);
const turns = normaliseTurns(await getTranscript(callId));

console.log(`call ${callId} — ${call.status}, ${duration}s, ${turns.length} turns`);
if (call.recordingAvailable !== true) {
  console.warn('NO RECORDING for this call — recording is a paid account add-on and is not enabled');
}
if (turns.length === 0) {
  console.error('\nEMPTY TRANSCRIPT. Cannot generate a brief. Stopping here rather than inventing one.');
  process.exit(1);
}

console.log('\n--- transcript ---');
for (const t of turns) console.log(`${t.role === 'agent' ? 'AGENT ' : 'MAX   '} ${t.text}`);

// Persist the call through chat 03's module.
const session = await createSession({ metadata: { call_id: callId, mode: 'sprint', source: 'phone' } });
for (const t of turns) {
  await appendTurn({ session_id: session.id, speaker: t.role === 'agent' ? 'agent' : 'human', text: t.text });
}
console.log(`\npersisted as session ${session.id}`);

// Claude generates the brief — off the realtime path, which is the point.
console.log('generating brief with claude-opus-5...');
const brief: Brief = await generateBrief(turns, callId);

console.log(`\n${renderBrief(brief)}\n`);
console.log(`TIME TO DECISION: ${timeToDecision(turns, duration)}`);

const out = `/tmp/brief-${callId}.json`;
writeFileSync(out, JSON.stringify({ ...brief, provenance: { call_id: callId, session_id: session.id, model: 'claude-opus-5' } }, null, 2));
console.log(`brief json: ${out}`);

const a = brief.lead_domino.action;
const decision = await writeDecision({
  session_id: session.id,
  statement: brief.decision,
  next_action: `${a.verb} ${a.object} — ${a.if_then}`,
  reasoning: brief.lead_domino.why_this_one,
  next_steps: [{ action: `${a.verb} ${a.object}`, rationale: brief.lead_domino.why_this_one, due: a.deadline ?? a.if_then }],
  conviction: brief.gate.signals_passed.length / 4,
});
console.log(`decision ${decision.id} written (gate ${brief.gate.signals_passed.length}/4, landed=${brief.gate.landed})`);

// The brief is the settlement event; talk time metered during the call.
const settle = settlementUsd(duration);
try {
  const receipt = await writeReceipt({
    session_id: session.id,
    cadence: 'settlement',
    amount_usd: settle.amount,
    payer: 'phone-demo',
    billed_seconds: settle.seconds,
    raw: { call_id: callId, clamped: settle.clamped, floor: settle.floor, accrued: settle.accrued },
  });
  const note = settle.clamped ? ` (clamped up from ${settle.accrued} to the MPP floor)` : '';
  console.log(`settlement receipt ${receipt.id} — ${settle.amount} USD${note}`);
} catch (err) {
  console.warn('settlement receipt failed (non-fatal):', (err as Error).message);
}
