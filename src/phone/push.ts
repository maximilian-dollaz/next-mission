/**
 * Push the sprint prompt + stage config to the live agent, then print back what the
 * API says is actually set. Run:  npm run phone:push  [-- "begin message"]
 *
 * Passing no argument clears beginMessage (agent generates its own opener).
 */
import { getAgent, pushStageConfig } from './agent.js';
import { PHONE_NUMBER, SPRINT_PROMPT_FILE } from './config.js';

const arg = process.argv[2];
const beginMessage = arg === undefined || arg === '' ? null : arg;

const updated = await pushStageConfig(beginMessage);
const live = await getAgent();

console.log(`pushed ${SPRINT_PROMPT_FILE} -> agent ${live.id}`);
console.table({
  voiceMode: live.voiceMode,
  modelTier: live.modelTier,
  sttMode: live.sttMode,
  denoisingMode: live.denoisingMode,
  ambientSound: live.ambientSound,
  interruptionSensitivity: live.interruptionSensitivity,
  enableBackchannel: live.enableBackchannel,
  voiceSpeed: live.voiceSpeed,
  maxSilenceMs: live.maxSilenceMs,
  enableMessaging: live.enableMessaging,
  language: live.language,
  voice: live.voice,
  promptChars: live.systemPrompt?.length ?? 0,
  beginMessage: live.beginMessage ?? '(none — agent generates)',
});

const numbers = (live.numbers ?? []).map((n) => n.phoneNumber ?? JSON.stringify(n));
console.log('attached numbers:', numbers.length ? numbers.join(', ') : '(none)');
if (!numbers.some((n) => String(n).includes('2032086667'))) {
  console.error(`WARNING: ${PHONE_NUMBER} is not attached to this agent`);
}
console.log(`\nDial ${PHONE_NUMBER}`);

void updated;
