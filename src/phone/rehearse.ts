/**
 * The stopwatch. Run this, then dial — it watches for the call, timestamps every
 * turn as it appears, and reports a MEASURED time-to-decision.
 *
 *   npm run phone:rehearse
 *
 * Polls rather than using streamCallTranscript, whose SSE shape the SDK types as
 * `unknown`. 1s resolution is ample against a 90s budget and has no stream to break.
 */
import { getCall, getTranscript, listRecentCalls, normaliseTurns, type Turn } from './calls.js';
import { PHONE_NUMBER } from './config.js';

const COMMIT = /\b(i'?m going to|i'?m gonna|i will|i'?m doing|i'?ll)\b/i;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const secs = (ms: number) => (ms / 1000).toFixed(1);

const seenBefore = new Set((await listRecentCalls(50)).map((c) => String(c.id)));
console.log(`watching for a new call. DIAL ${PHONE_NUMBER} now.\n`);

let callId: string | undefined;
while (!callId) {
  for (const c of await listRecentCalls(50)) {
    if (!seenBefore.has(String(c.id))) { callId = String(c.id); break; }
  }
  if (!callId) await sleep(1000);
}

const t0 = Date.now();
console.log(`call ${callId} started — stopwatch running\n`);

const stamped: { at: number; turn: Turn }[] = [];
let commitAt: number | null = null;
let firstAgentAt: number | null = null;

for (;;) {
  const turns = normaliseTurns(await getTranscript(callId));
  while (turns.length > stamped.length) {
    const turn = turns[stamped.length]!;
    const at = Date.now() - t0;
    stamped.push({ at, turn });
    console.log(`[${secs(at).padStart(6)}s] ${turn.role === 'agent' ? 'AGENT ' : 'MAX   '} ${turn.text}`);
    if (turn.role === 'agent' && firstAgentAt === null) firstAgentAt = at;
    if (turn.role === 'caller' && commitAt === null && COMMIT.test(turn.text)) {
      commitAt = at;
      console.log(`\n  *** COMMITMENT SENTENCE at ${secs(at)}s ***\n`);
    }
  }
  const call = await getCall(callId);
  if (call.status !== 'in-progress' && Date.now() - t0 > 5000) {
    const wall = Date.now() - t0;
    console.log(`\ncall ${call.status} — wall clock ${secs(wall)}s, reported ${call.durationSeconds}s`);
    console.log('\n================ MEASURED ================');
    console.log(`  first agent audio:   ${firstAgentAt === null ? 'never' : secs(firstAgentAt) + 's'}`);
    console.log(`  TIME TO DECISION:    ${commitAt === null ? 'NO COMMITMENT SENTENCE DETECTED' : secs(commitAt) + 's'}`);
    console.log(`  total call:          ${call.durationSeconds}s`);
    console.log(`  turns:               ${stamped.length}`);
    console.log(`  recording:           ${call.recordingAvailable === true ? 'yes' : 'NO — paid add-on not enabled'}`);
    console.log('==========================================');
    console.log(`\nnext: npm run phone:capture -- ${callId}`);
    break;
  }
  await sleep(1000);
}
