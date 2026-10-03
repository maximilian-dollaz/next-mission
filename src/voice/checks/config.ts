/**
 * Offline checks that need no API key: the config we send, the instruction
 * seam, and the pacing presets.
 */
import { VoiceSession } from '../session.ts';
import { PATIENT, SWIFT, MEDITATIVE, presetFromEnv } from '../pacing.ts';
import { loadSystemInstruction, PROTOCOL_PATH } from '../instruction.ts';

let fails = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
  if (!ok) fails++;
};

const session = new VoiceSession({ apiKey: 'offline', pacing: PATIENT });
const cfg = session.buildConfig();

console.log('--- LiveConnectConfig sent to the API ---');
check('responseModalities is AUDIO only', JSON.stringify(cfg.responseModalities) === '["AUDIO"]', JSON.stringify(cfg.responseModalities));
check('input transcription on', cfg.inputAudioTranscription !== undefined);
check('output transcription on', cfg.outputAudioTranscription !== undefined);
check('affective dialog on', cfg.enableAffectiveDialog === true);
// The service rejects this field at setup on the native-audio preview model
// ("Unknown name \"proactivity\"") and sending it kills the session, so the
// correct state is absent, not true.
check('proactivity NOT sent', cfg.proactivity === undefined, 'service rejects it; would kill setup');
check('barge-in enabled', cfg.realtimeInputConfig?.activityHandling === 'START_OF_ACTIVITY_INTERRUPTS');
check('voice name set', cfg.speechConfig?.voiceConfig?.prebuiltVoiceConfig?.voiceName === 'Kore');
check('context compression on', cfg.contextWindowCompression?.slidingWindow !== undefined);
check('no maxOutputTokens by default', cfg.maxOutputTokens === undefined, 'brevity comes from the instruction, not a hard clip');

const vad = cfg.realtimeInputConfig?.automaticActivityDetection;
console.log('\n--- server-mode VAD (PATIENT) ---');
check('VAD enabled', vad?.disabled === false);
check('silence window = 1200ms', vad?.silenceDurationMs === 1200, String(vad?.silenceDurationMs));
check('end sensitivity LOW (ends speech less often)', vad?.endOfSpeechSensitivity === 'END_SENSITIVITY_LOW');
check('start sensitivity LOW', vad?.startOfSpeechSensitivity === 'START_SENSITIVITY_LOW');
check('prefix padding = 300ms', vad?.prefixPaddingMs === 300);

console.log('\n--- client-mode VAD (MEDITATIVE) ---');
const med = new VoiceSession({ apiKey: 'offline', pacing: MEDITATIVE }).buildConfig();
const medVad = med.realtimeInputConfig?.automaticActivityDetection;
check('server VAD disabled', medVad?.disabled === true, 'we own the silence window, nothing clamps it');
check('no silenceDurationMs sent', medVad?.silenceDurationMs === undefined);

console.log('\n--- presets ---');
check('SWIFT is faster than PATIENT', SWIFT.silenceBeforeAgentSpeaksMs < PATIENT.silenceBeforeAgentSpeaksMs, `${SWIFT.silenceBeforeAgentSpeaksMs} < ${PATIENT.silenceBeforeAgentSpeaksMs}`);
check('MEDITATIVE is slower than PATIENT', MEDITATIVE.silenceBeforeAgentSpeaksMs > PATIENT.silenceBeforeAgentSpeaksMs, `${MEDITATIVE.silenceBeforeAgentSpeaksMs} > ${PATIENT.silenceBeforeAgentSpeaksMs}`);
check('unknown preset falls back to PATIENT', presetFromEnv('nonsense') === PATIENT);
check('lowercase preset name resolves', presetFromEnv('swift') === SWIFT);
check('undefined resolves to PATIENT', presetFromEnv(undefined) === PATIENT);

console.log('\n--- instruction seam ---');
const instr = loadSystemInstruction(PATIENT);
check('boiled prompt is the live source', instr.source === 'boiled-prompt', instr.source);
check('boiled prompt is compact', instr.text.length < 20_000, `${instr.text.length} chars — 73k protocol doc cost ~2s/turn`);
check('silence rule present', /Silence is not your turn/.test(instr.text));
check('one-question rule present', /One question per turn/.test(instr.text));
check('north-star-before-comparing present', /north star/i.test(instr.text));
check('monotonic-narrowing invariant present', /only ever goes down|count only goes down/i.test(instr.text));
check('completion gate present', /commitment verb/i.test(instr.text));
check('named-object handoff present', /named object/i.test(instr.text));
check('no-invented-options rule present', /never introduce an option|never add an option/i.test(instr.text));
check('silence directive present', /Silence is allowed/.test(instr.text));
check('silence threshold interpolated', instr.text.includes('1.2 seconds'), 'reflects the live pacing value');
check('hesitation directive present', /trust the\nvoice/.test(instr.text));
check('brevity reflects maxAgentTurnSeconds', instr.text.includes('20 seconds'));
check('B7 phrasing present', /it seems like/i.test(instr.text));
check('interruption directive present', /stop immediately/.test(instr.text));

const swiftInstr = loadSystemInstruction(SWIFT);
check('instruction tracks pacing changes', swiftInstr.text.includes('0.5 seconds') && swiftInstr.text.includes('8 seconds'));

console.log(`\nprotocol file: ${PROTOCOL_PATH}`);
console.log(`instruction source: ${instr.source}${instr.note ? ' — ' + instr.note : ''}`);
console.log(`\n${fails === 0 ? 'ALL CHECKS PASSED' : fails + ' CHECK(S) FAILED'}`);
process.exit(fails === 0 ? 0 : 1);
