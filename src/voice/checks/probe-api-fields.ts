/**
 * Probe which LiveConnectConfig fields the API actually accepts.
 *
 * The SDK's typings are ahead of the service on this preview model, so a field
 * that typechecks can still be rejected at setup. Setup validation runs before
 * auth, so this works with a dummy key and costs nothing.
 *
 * Reports: ACCEPTED (setup passed, then auth failed — the expected good case),
 * REJECTED (field name unknown / invalid), or OTHER.
 */
import { ActivityHandling, EndSensitivity, GoogleGenAI, Modality, StartSensitivity, type LiveConnectConfig } from '@google/genai';

const MODEL = process.env.GEMINI_LIVE_MODEL ?? 'gemini-2.5-flash-native-audio-preview-12-2025';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? 'dummy_probe_key' });

const base: LiveConnectConfig = { responseModalities: [Modality.AUDIO] };

const cases: Array<[string, LiveConnectConfig]> = [
  ['baseline (AUDIO only)', {}],
  ['systemInstruction', { systemInstruction: 'Be brief.' }],
  ['speechConfig.prebuiltVoice', { speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } }],
  ['inputAudioTranscription', { inputAudioTranscription: {} }],
  ['outputAudioTranscription', { outputAudioTranscription: {} }],
  ['enableAffectiveDialog', { enableAffectiveDialog: true }],
  ['proactivity.proactiveAudio', { proactivity: { proactiveAudio: true } }],
  ['contextWindowCompression.slidingWindow', { contextWindowCompression: { slidingWindow: {} } }],
  ['realtimeInputConfig.activityHandling', { realtimeInputConfig: { activityHandling: ActivityHandling.START_OF_ACTIVITY_INTERRUPTS } }],
  ['automaticActivityDetection (tuned)', {
    realtimeInputConfig: {
      automaticActivityDetection: {
        disabled: false,
        silenceDurationMs: 1200,
        prefixPaddingMs: 300,
        endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
        startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
      },
    },
  }],
  ['automaticActivityDetection (disabled)', { realtimeInputConfig: { automaticActivityDetection: { disabled: true } } }],
  ['silenceDurationMs = 3000 (long hold)', { realtimeInputConfig: { automaticActivityDetection: { disabled: false, silenceDurationMs: 3000 } } }],
  ['maxOutputTokens', { maxOutputTokens: 800 }],
];

function classify(reason: string): string {
  if (/API key|API_KEY|authentication|credential|permission|UNAUTHENT/i.test(reason)) return 'ACCEPTED';
  if (/Unknown name|Cannot find field|Invalid JSON payload|invalid value|INVALID_ARGUMENT/i.test(reason)) return 'REJECTED';
  return 'OTHER';
}

for (const [label, extra] of cases) {
  const result = await new Promise<string>((resolve) => {
    const done = (s: string) => resolve(s);
    const timer = setTimeout(() => done('TIMEOUT (no setup response)'), 12000);

    ai.live
      .connect({
        model: MODEL,
        config: { ...base, ...extra },
        callbacks: {
          onmessage: (m) => {
            if (m.setupComplete) { clearTimeout(timer); done('ACCEPTED (setupComplete)'); }
          },
          onerror: (e) => { clearTimeout(timer); done(`${classify(String(e?.message ?? e))} :: ${String(e?.message ?? e).slice(0, 150)}`); },
          onclose: (e) => { clearTimeout(timer); done(`${classify(e?.reason ?? '')} :: code=${e?.code} ${(e?.reason ?? '').slice(0, 150)}`); },
        },
      })
      .catch((e) => { clearTimeout(timer); done(`${classify(String(e?.message ?? e))} :: ${String(e?.message ?? e).slice(0, 150)}`); });
  });

  console.log(`${result.startsWith('ACCEPTED') ? 'OK  ' : 'BAD '} ${label.padEnd(40)} ${result}`);
}
process.exit(0);
