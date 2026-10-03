/**
 * The Gemini Live native-audio session.
 *
 * Server-to-server: this runs in Node, holds `GEMINI_API_KEY`, and never exposes
 * it. The browser talks to `bridge.ts` over a plain WebSocket and only ever
 * carries audio.
 *
 * Audio formats are fixed by the API and getting them wrong sounds like noise:
 *   in  — raw 16-bit PCM, 16 kHz, little-endian, mime `audio/pcm;rate=16000`
 *   out — raw 16-bit PCM, 24 kHz, little-endian
 */

import {
  ActivityHandling,
  GoogleGenAI,
  Modality,
  type LiveConnectConfig,
  type LiveServerMessage,
  type Session,
} from '@google/genai';

import { maxOutputTokensFor, type PacingConfig } from './pacing.ts';
import { loadSystemInstruction, type InstructionSource } from './instruction.ts';
import {
  INPUT_MIME_TYPE,
  type SessionState,
  type Speaker,
  type TurnRecord,
  type VoiceSessionCallbacks,
} from './types.ts';

export const DEFAULT_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
/** Documented fallback if the primary model misbehaves (brief 04). */
export const FALLBACK_MODEL = 'gemini-live-2.5-flash-preview-native-audio-09-2025';

export interface VoiceSessionOptions {
  apiKey: string;
  pacing: PacingConfig;
  model?: string;
  /** Prebuilt voice name: Puck | Charon | Kore | Fenrir | Aoede | Zephyr. */
  voiceName?: string;
  /**
   * Send `maxOutputTokens` derived from `pacing.maxAgentTurnSeconds`.
   *
   * Off by default: the seconds-to-tokens rate is uncalibrated, and a hard cap
   * clips the agent mid-word rather than ending the turn cleanly. Brevity is
   * handled in the system instruction instead. Turn on only if the agent
   * actually runs away.
   */
  enforceMaxTurnTokens?: boolean;
  callbacks?: VoiceSessionCallbacks;
}

interface TurnAccumulator {
  text: string;
  startedAt: number;
}

export class VoiceSession {
  readonly sessionId = `vs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  readonly instructionSource: InstructionSource;
  readonly instructionNote?: string;
  readonly model: string;

  private session?: Session;
  private readonly instructionText: string;
  private readonly ai: GoogleGenAI;
  private readonly opts: VoiceSessionOptions;
  private readonly cb: VoiceSessionCallbacks;
  private readonly pacing: PacingConfig;

  private state: SessionState = 'connecting';
  private turnIndex = 0;
  /** Live pacing. Starts as `options.pacing`; `setPacing` can move it. */
  private activePacing: PacingConfig;
  /**
   * Turn-detection mode, fixed at connect. `setPacing` cannot change this one:
   * whether server VAD is on or off was decided in the setup message, so
   * switching mid-session would leave the two ends disagreeing about who owns
   * the silence window.
   */
  private readonly turnDetectionMode: PacingConfig['turnDetection'];

  private user?: TurnAccumulator;
  private agent?: TurnAccumulator;

  /**
   * When the browser's energy gate last reported the person stopping.
   * The only honest anchor we have for response latency — the server cannot
   * tell speech from silence, since the mic streams continuously.
   */
  private speechEndedAt?: number;
  /** First agent audio byte of the current turn, for the latency figure. */
  private pendingLatencyMs?: number;
  private agentSpeaking = false;

  constructor(options: VoiceSessionOptions) {
    this.opts = options;
    this.cb = options.callbacks ?? {};
    this.pacing = options.pacing;
    this.activePacing = options.pacing;
    this.turnDetectionMode = options.pacing.turnDetection;
    this.model = options.model ?? DEFAULT_MODEL;
    this.ai = new GoogleGenAI({ apiKey: options.apiKey });

    const instruction = loadSystemInstruction(this.pacing);
    this.instructionSource = instruction.source;
    this.instructionNote = instruction.note;
    this.instructionText = instruction.text;
  }

  /** The config actually sent to the Live API. Exposed so the page can show it. */
  buildConfig(): LiveConnectConfig {
    const p = this.pacing;

    const config: LiveConnectConfig = {
      // Native audio dialog: the model generates speech directly. Not TTS over
      // a text reply — that distinction is the whole Gemini claim here.
      responseModalities: [Modality.AUDIO],

      systemInstruction: this.instructionText,

      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: this.opts.voiceName ?? 'Kore' } },
      },

      // Both directions on: chat 03 stores the text, chat 05 extracts the
      // decision from it. Empty object = let the model detect the language.
      inputAudioTranscription: {},
      outputAudioTranscription: {},

      // Hear hesitation, not just words. Native-audio only. Verified accepted.
      enableAffectiveDialog: p.affectiveDialog,

      // NOTE: `proactivity: { proactiveAudio: ... }` is deliberately NOT sent.
      // It is in the SDK's typings and would typecheck, but the service rejects
      // it outright on this model:
      //   code 1007 — Unknown name "proactivity" at 'setup': Cannot find field.
      // Sending it kills the session at setup, so silence handling rests on
      // silenceDurationMs, endOfSpeechSensitivity and the instruction instead.
      // If the field ships, re-enable it here and flip the page's row back on.

      realtimeInputConfig: {
        // Barge-in: the person taking the floor cuts the model off mid-sentence.
        activityHandling: ActivityHandling.START_OF_ACTIVITY_INTERRUPTS,
        automaticActivityDetection:
          p.turnDetection === 'client'
            ? // We own the silence window entirely — nothing clamps how long we
              // let someone think. Requires activityStart/activityEnd from us.
              { disabled: true }
            : {
                disabled: false,
                silenceDurationMs: p.silenceBeforeAgentSpeaksMs,
                prefixPaddingMs: p.speechStartPaddingMs,
                endOfSpeechSensitivity: p.endOfSpeechSensitivity,
                startOfSpeechSensitivity: p.startOfSpeechSensitivity,
              },
      },

      // A decision conversation can run long. Compress rather than die.
      contextWindowCompression: { slidingWindow: {} },
    };

    if (this.opts.enforceMaxTurnTokens) {
      config.maxOutputTokens = maxOutputTokensFor(p);
    }

    return config;
  }

  async connect(): Promise<void> {
    this.setState('connecting');

    this.session = await this.ai.live.connect({
      model: this.model,
      config: this.buildConfig(),
      callbacks: {
        onopen: () => this.setState('listening'),
        onmessage: (message) => this.handleMessage(message),
        onerror: (event) => {
          this.setState('error');
          this.cb.onError?.(toError(event, 'Live API socket error'));
        },
        onclose: (event) => {
          this.setState('closed');
          this.cb.onClose?.({ code: event?.code, reason: event?.reason });
        },
      },
    });
  }

  /**
   * Change pacing mid-conversation.
   *
   * Chat 02's protocol §8 Q2 proposes pacing per phase — swift during fact work
   * (phases 1, 3, 5), patient during the dump, the north star, narrowing and the
   * unlock (0, 2, 6, 7). This is what makes that possible without dropping the
   * session and losing the conversation's context.
   *
   * What actually takes effect depends on which mode is running, because
   * `realtimeInputConfig` is fixed at connect time by the Live API:
   *
   * - `client` turn detection: fully live. The silence window is ours, enforced
   *   in the browser's energy gate, so every pacing change lands immediately.
   *   Use this mode if per-phase pacing is the answer to Q2.
   * - `server` turn detection: the VAD numbers (silence window, sensitivities)
   *   are frozen at connect and will NOT change. Only `maxAgentTurnSeconds` and
   *   `latencyTargetMs` move. Returns false so callers know the change was
   *   partial rather than assuming it applied.
   *
   * @returns true if the whole config took effect, false if VAD values were
   *          frozen by server-mode connect.
   */
  setPacing(next: PacingConfig): boolean {
    const vadFrozen =
      this.activePacing.turnDetection === 'server' &&
      (next.silenceBeforeAgentSpeaksMs !== this.activePacing.silenceBeforeAgentSpeaksMs ||
        next.speechStartPaddingMs !== this.activePacing.speechStartPaddingMs ||
        next.endOfSpeechSensitivity !== this.activePacing.endOfSpeechSensitivity ||
        next.startOfSpeechSensitivity !== this.activePacing.startOfSpeechSensitivity);

    this.activePacing = next;
    this.cb.onPacingChange?.(next, vadFrozen);
    return !vadFrozen;
  }

  /** The pacing currently in force. */
  get pacingNow(): PacingConfig {
    return this.activePacing;
  }

  /**
   * Stream one chunk of mic audio: raw 16-bit PCM, 16 kHz, little-endian.
   * Call continuously, including during silence — the API's VAD needs the
   * silence to know a pause is happening.
   */
  sendAudio(pcm16le: Buffer): void {
    if (!this.session) return;
    this.session.sendRealtimeInput({
      audio: { data: pcm16le.toString('base64'), mimeType: INPUT_MIME_TYPE },
    });
  }

  /**
   * The browser's energy gate saw speech start or stop.
   *
   * Always used to anchor the latency measurement. In `client` turn-detection
   * mode it also drives the actual turn boundaries, so the silence threshold is
   * ours rather than the API's.
   */
  reportSpeechActivity(active: boolean, msSinceLastSpeech = 0): void {
    if (active) {
      this.speechEndedAt = undefined;
      if (this.turnDetectionMode === 'client') {
        this.session?.sendRealtimeInput({ activityStart: {} });
      }
      return;
    }

    // Backdate to when the person actually stopped, not when the browser's
    // debounce fired. Using the client's elapsed time rather than its clock
    // keeps this free of clock skew between the two machines.
    this.speechEndedAt = Date.now() - Math.max(0, msSinceLastSpeech);
    if (this.turnDetectionMode === 'client') {
      this.session?.sendRealtimeInput({ activityEnd: {} });
    }
  }

  /** Mic turned off. Only valid with automatic (server) activity detection. */
  endAudioStream(): void {
    if (this.turnDetectionMode === 'server') {
      this.session?.sendRealtimeInput({ audioStreamEnd: true });
    }
  }

  close(): void {
    this.flushUserTurn();
    this.flushAgentTurn(false);
    try {
      this.session?.close();
    } catch {
      // Already gone; nothing to do.
    }
    this.session = undefined;
    this.setState('closed');
  }

  // ── message handling ────────────────────────────────────────────────────

  private handleMessage(message: LiveServerMessage): void {
    const content = message.serverContent;
    if (!content) return;

    // Barge-in. Flush playback before anything else so the agent goes quiet
    // the moment the person starts talking.
    if (content.interrupted) {
      this.agentSpeaking = false;
      this.cb.onInterrupted?.();
      this.flushAgentTurn(true);
      this.setState('listening');
    }

    if (content.inputTranscription?.text) {
      this.appendTranscript('user', content.inputTranscription.text);
    }

    if (content.outputTranscription?.text) {
      // The agent has the floor, so the person's turn is over.
      this.flushUserTurn();
      this.appendTranscript('agent', content.outputTranscription.text);
    }

    const audio = audioChunks(content);
    if (audio.length > 0) {
      this.flushUserTurn();
      if (!this.agentSpeaking) {
        this.agentSpeaking = true;
        this.agent ??= { text: '', startedAt: Date.now() };
        if (this.speechEndedAt !== undefined) {
          this.pendingLatencyMs = Date.now() - this.speechEndedAt;
          this.speechEndedAt = undefined;
        }
        this.setState('speaking');
      }
      for (const chunk of audio) this.cb.onAgentAudio?.(chunk);
    }

    // The model is deliberately holding — it expects more from the person.
    // This is B13 enforced by the model, not by our timer.
    if (content.waitingForInput) {
      this.cb.onWaitingForInput?.();
      this.setState('listening');
    }

    if (content.turnComplete) {
      this.agentSpeaking = false;
      this.flushAgentTurn(false);
      this.setState('listening');
    }
  }

  private appendTranscript(speaker: Speaker, delta: string): void {
    const slot = speaker === 'user' ? 'user' : 'agent';
    this[slot] ??= { text: '', startedAt: Date.now() };
    this[slot]!.text += delta;
    this.cb.onPartialTranscript?.(speaker, delta);
  }

  private flushUserTurn(): void {
    const turn = this.user;
    if (!turn) return;
    this.user = undefined;
    this.emitTurn({
      sessionId: this.sessionId,
      index: this.turnIndex++,
      speaker: 'user',
      text: turn.text.trim(),
      startedAt: new Date(turn.startedAt).toISOString(),
      endedAt: new Date().toISOString(),
    });
  }

  private flushAgentTurn(interrupted: boolean): void {
    const turn = this.agent;
    if (!turn) return;
    this.agent = undefined;
    const latency = this.pendingLatencyMs;
    this.pendingLatencyMs = undefined;

    this.emitTurn({
      sessionId: this.sessionId,
      index: this.turnIndex++,
      speaker: 'agent',
      text: turn.text.trim(),
      startedAt: new Date(turn.startedAt).toISOString(),
      endedAt: new Date().toISOString(),
      ...(latency !== undefined ? { responseLatencyMs: latency } : {}),
      ...(interrupted ? { interrupted: true } : {}),
    });
  }

  private emitTurn(turn: TurnRecord): void {
    // A turn with no transcript is noise, not a turn — but keep an interrupted
    // agent turn even if empty, since "it got cut off" is real information.
    if (!turn.text && !turn.interrupted) {
      this.turnIndex--;
      return;
    }
    try {
      this.cb.onTurn?.(turn);
    } catch (error) {
      // A persistence failure downstream must never kill the conversation.
      this.cb.onError?.(toError(error, 'onTurn callback threw'));
    }
  }

  private setState(next: SessionState): void {
    if (this.state === next) return;
    this.state = next;
    this.cb.onStateChange?.(next);
  }
}

/** Every inline PCM chunk in a model turn, in order. */
function audioChunks(content: NonNullable<LiveServerMessage['serverContent']>): Buffer[] {
  const chunks: Buffer[] = [];
  for (const part of content.modelTurn?.parts ?? []) {
    const data = part.inlineData?.data;
    if (data) chunks.push(Buffer.from(data, 'base64'));
  }
  return chunks;
}

function toError(value: unknown, fallback: string): Error {
  if (value instanceof Error) return value;
  if (value && typeof value === 'object' && 'message' in value) {
    return new Error(String((value as { message: unknown }).message));
  }
  return new Error(fallback);
}
