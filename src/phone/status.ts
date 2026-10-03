/**
 * Operational check: what did the line actually do?
 *   npm run phone:status            — list recent calls
 *   npm run phone:status -- <id>    — dump one call raw (transcript + recording)
 */
import { getCall, getRecording, getTranscript, listRecentCalls, normaliseTurns, transcriptText } from './calls.js';

const callId = process.argv[2];

if (!callId) {
  const calls = await listRecentCalls();
  if (calls.length === 0) {
    console.log('no calls yet');
  } else {
    console.log(`${calls.length} recent call(s):\n`);
    for (const c of calls) {
      console.log(JSON.stringify(c));
    }
  }
  process.exit(0);
}

console.log('=== call ===');
console.log(JSON.stringify(await getCall(callId), null, 2));

console.log('\n=== transcript (raw) ===');
const raw = await getTranscript(callId);
console.log(JSON.stringify(raw, null, 2));

console.log('\n=== transcript (normalised) ===');
console.log(transcriptText(normaliseTurns(raw)) || '(nothing parsed — check raw shape above)');

console.log('\n=== recording ===');
try {
  console.log(JSON.stringify(await getRecording(callId), null, 2));
} catch (err) {
  console.log('recording unavailable:', (err as Error).message);
}
