/**
 * End-to-end smoke test: a real conversation against the live API, no browser
 * and no human.
 *
 * Feeds real speech (generated with macOS `say`) into a VoiceSession at
 * real-time pace, so the API's VAD sees a genuine utterance followed by genuine
 * silence. Captures the agent's audio to a WAV you can listen to, prints both
 * transcripts, and measures response latency.
 *
 *   node --env-file=.env node_modules/.bin/tsx src/voice/checks/live-conversation.ts
 *
 * Optional: VOICE_PACING=SWIFT|PATIENT|MEDITATIVE, VOICE_CHECK_OUT=<dir>
 *
 * Costs real API tokens. It is the only check here that does.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { VoiceSession } from '../session.ts';
import { presetFromEnv } from '../pacing.ts';
import { OUTPUT_SAMPLE_RATE, type TurnRecord } from '../types.ts';

const FRAME_MS = 20;
const FRAME_BYTES = (16_000 / 1000) * FRAME_MS * 2; // 16 kHz, 16-bit mono
/** How long to wait for the agent to finish after we stop speaking. */
const REPLY_TIMEOUT_MS = 25_000;

const UTTERANCES = [
  "I need to decide whether to take the job offer in Denver or stay where I am.",
  "Honestly, the money is better but I'd be leaving my whole team behind.",
];

const outDir = process.env.VOICE_CHECK_OUT ?? mkdtempSync(join(tmpdir(), 'voice-check-'));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Extract raw PCM from a RIFF/WAVE file by walking its chunks. */
function pcmFromWav(path: string): Buffer {
  const buf = readFileSync(path);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${path} is not a RIFF/WAVE file`);
  }
  let offset = 12;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === 'data') return buf.subarray(offset + 8, Math.min(offset + 8 + size, buf.length));
    offset += 8 + size + (size % 2); // chunks are word-aligned
  }
  throw new Error(`no data chunk in ${path}`);
}

/** Minimal 16-bit mono WAV header so the captured audio is listenable. */
function wav(pcm: Buffer, rate: number): Buffer {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); // byte rate
  h.writeUInt16LE(2, 32); // block align
  h.writeUInt16LE(16, 34); // bits
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

function speak(text: string, path: string): Buffer {
  execFileSync('say', ['-o', path, '--data-format=LEI16@16000', text]);
  return pcmFromWav(path);
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY not set. Run with: node --env-file=.env node_modules/.bin/tsx ...');
  process.exit(1);
}

const pacing = presetFromEnv(process.env.VOICE_PACING);
const turns: TurnRecord[] = [];
const agentAudio: Buffer[] = [];
let firstAudioAt = 0;
let lastAudioAt = 0;
let spokeAt = 0;
const latencies: number[] = [];
let interruptions = 0;
let waitingSignals = 0;
let fatal: string | undefined;

const session = new VoiceSession({
  apiKey,
  pacing,
  ...(process.env.GEMINI_LIVE_MODEL ? { model: process.env.GEMINI_LIVE_MODEL } : {}),
  ...(process.env.GEMINI_VOICE ? { voiceName: process.env.GEMINI_VOICE } : {}),
  callbacks: {
    onAgentAudio: (pcm) => {
      lastAudioAt = Date.now();
      if (firstAudioAt === 0 && spokeAt > 0) {
        firstAudioAt = lastAudioAt;
        latencies.push(firstAudioAt - spokeAt);
      }
      agentAudio.push(pcm);
    },
    onTurn: (turn) => {
      turns.push(turn);
      const lat = turn.responseLatencyMs !== undefined ? ` ${turn.responseLatencyMs}ms` : '';
      console.log(`  [turn ${turn.index}] ${turn.speaker}${lat}${turn.interrupted ? ' [cut]' : ''}: ${turn.text}`);
    },
    onInterrupted: () => { interruptions++; },
    onWaitingForInput: () => { waitingSignals++; console.log('  (model is holding silence — waiting for more)'); },
    onError: (e) => { fatal ??= e.message; console.log(`  ERROR: ${e.message}`); },
    onClose: (i) => { if (i.code && i.code !== 1000) fatal ??= `closed ${i.code} ${i.reason ?? ''}`; },
  },
});

console.log(`model    ${session.model}`);
console.log(`pacing   ${process.env.VOICE_PACING ?? 'PATIENT'} — ${pacing.silenceBeforeAgentSpeaksMs}ms silence, ${pacing.maxAgentTurnSeconds}s max turn`);
console.log(`prompt   ${session.instructionSource}`);
if (session.instructionNote) console.log(`         warn: ${session.instructionNote}`);
console.log('');

await session.connect();
console.log('connected\n');

for (const [i, text] of UTTERANCES.entries()) {
  console.log(`you: "${text}"`);
  const pcm = speak(text, join(outDir, `utt${i}.wav`));

  firstAudioAt = 0;
  spokeAt = 0;
  session.reportSpeechActivity(true);

  // Stream at real time so VAD sees a real utterance, not a burst.
  const startedAt = Date.now();
  for (let off = 0; off < pcm.length; off += FRAME_BYTES) {
    session.sendAudio(pcm.subarray(off, Math.min(off + FRAME_BYTES, pcm.length)));
    const target = startedAt + (off / FRAME_BYTES + 1) * FRAME_MS;
    const drift = target - Date.now();
    if (drift > 0) await sleep(drift);
  }

  spokeAt = Date.now();
  session.reportSpeechActivity(false);

  // Keep streaming silence. Server-side VAD decides the turn ended by *hearing*
  // a gap, so it needs the quiet frames too — stop sending and the turn never
  // closes and the model never replies. A real mic does this for free; a
  // synthetic harness has to do it on purpose.
  const silence = Buffer.alloc(FRAME_BYTES);
  const silenceUntil = Date.now() + REPLY_TIMEOUT_MS;
  let replyDoneAt = 0;

  while (Date.now() < silenceUntil && !fatal) {
    session.sendAudio(silence);
    await sleep(FRAME_MS);

    if (firstAudioAt === 0) continue;
    // Reply has started; stop once it has been quiet for a beat.
    const lastChunkAt = lastAudioAt;
    if (Date.now() - lastChunkAt > 2000) { replyDoneAt = Date.now(); break; }
  }

  if (firstAudioAt === 0) console.log(`  (no audio within ${REPLY_TIMEOUT_MS / 1000}s)`);
  else if (replyDoneAt === 0) console.log('  (reply still going when the window closed)');
  console.log('');
}

session.close();
await sleep(600);

const pcmOut = Buffer.concat(agentAudio);
const wavPath = join(outDir, 'agent-reply.wav');
writeFileSync(wavPath, wav(pcmOut, OUTPUT_SAMPLE_RATE));

const seconds = pcmOut.length / 2 / OUTPUT_SAMPLE_RATE;
const userTurns = turns.filter((t) => t.speaker === 'user');
const agentTurns = turns.filter((t) => t.speaker === 'agent');

console.log('── results ───────────────────────────────');
console.log(`agent audio      ${(pcmOut.length / 1024).toFixed(0)} KB = ${seconds.toFixed(1)}s of speech at 24 kHz`);
console.log(`turns            ${userTurns.length} user, ${agentTurns.length} agent`);
console.log(`transcription    ${userTurns.every((t) => t.text) ? 'both directions produced text' : 'MISSING on some turns'}`);
console.log(`latency          ${latencies.length ? latencies.map((l) => l + 'ms').join(', ') : 'not measured'}`);
if (latencies.length) {
  const net = latencies.map((l) => Math.max(0, l - pacing.silenceBeforeAgentSpeaksMs));
  console.log(`  minus silence  ${net.map((l) => l + 'ms').join(', ')} — model + network only`);
}
console.log(`interruptions    ${interruptions}`);
console.log(`waiting signals  ${waitingSignals}`);
console.log(`\nlisten:  afplay ${wavPath}`);

const ok = !fatal && agentTurns.length > 0 && seconds > 0.5 && userTurns.some((t) => t.text);
console.log(`\n${ok ? 'PASS — a real spoken conversation happened' : 'FAIL' + (fatal ? ': ' + fatal : '')}`);
process.exit(ok ? 0 : 1);
