/**
 * Shared types for the voice engine.
 *
 * `TurnRecord` and `VoiceSessionCallbacks.onTurn` are the integration contract:
 * chat 03 wires persistence to `onTurn`, chat 05 reads the accumulated turns to
 * extract the decision. The voice engine never writes to the database itself.
 */

import type { PacingConfig } from './pacing.ts';

/** Raw audio formats the Live API fixes for us. Wrong values sound like noise. */
export const INPUT_SAMPLE_RATE = 16_000;
export const OUTPUT_SAMPLE_RATE = 24_000;
/** What the Live API expects on `sendRealtimeInput({ audio })`. */
export const INPUT_MIME_TYPE = `audio/pcm;rate=${INPUT_SAMPLE_RATE}`;

export type Speaker = 'user' | 'agent';

/**
 * One completed conversational turn, with its transcript.
 *
 * Emitted once, when the turn is finished — not streamed. For live captions use
 * `onPartialTranscript` instead.
 */
export interface TurnRecord {
  /** Stable id for the Live session this turn belongs to. */
  sessionId: string;
  /** Monotonic from 0 within the session, counting both speakers. */
  index: number;
  speaker: Speaker;
  /** Transcript text. May be empty if transcription produced nothing. */
  text: string;
  startedAt: string;
  endedAt: string;
  /**
   * Agent turns only: ms from the person finishing speaking to the first audio
   * byte back. Present only when the client reported a speech-end boundary.
   */
  responseLatencyMs?: number;
  /** Agent turns only: the person spoke over this turn and it was cut short. */
  interrupted?: boolean;
}

export type SessionState =
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'closed'
  | 'error';

export interface VoiceSessionCallbacks {
  /**
   * A chunk of agent speech: raw 16-bit PCM, 24 kHz, little-endian.
   * Forward to the browser as-is.
   */
  onAgentAudio?: (pcm: Buffer) => void;

  /**
   * A turn finished. **Chat 03 wires persistence here.**
   * Called once per turn, for both speakers, in order.
   */
  onTurn?: (turn: TurnRecord) => void;

  /** Streaming transcript deltas, for live captions. Not for persistence. */
  onPartialTranscript?: (speaker: Speaker, textDelta: string) => void;

  /**
   * The person spoke over the agent. Drop any audio still queued for playback
   * immediately — this is what makes barge-in feel instant.
   */
  onInterrupted?: () => void;

  /**
   * The model has deliberately chosen not to speak yet because it expects the
   * person to keep going. The B13 signal: show "listening", never a prompt.
   */
  onWaitingForInput?: () => void;

  /**
   * Pacing changed mid-conversation (see `VoiceSession.setPacing`).
   * `vadFrozen` is true when server-mode VAD numbers could not be applied
   * because they were fixed at connect — the change was partial.
   */
  onPacingChange?: (pacing: PacingConfig, vadFrozen: boolean) => void;

  onStateChange?: (state: SessionState) => void;
  onError?: (error: Error) => void;
  onClose?: (info: { code?: number; reason?: string }) => void;
}
