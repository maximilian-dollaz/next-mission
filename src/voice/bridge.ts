/**
 * WebSocket bridge: browser ↔ VoiceSession.
 *
 * Server-to-server architecture. The browser never sees `GEMINI_API_KEY`; it
 * only carries audio and small JSON control messages.
 *
 * Wire protocol
 *   browser → server
 *     binary                       raw PCM16LE, 16 kHz mic audio
 *     {"t":"speech","active":bool,"msSinceLastSpeech":n}
 *                                  energy gate crossed (latency anchor, and
 *                                  turn boundaries in client-detection mode)
 *     {"t":"stop"}                 mic off
 *   server → browser
 *     binary                       raw PCM16LE, 24 kHz agent audio
 *     {"t":"ready", ...}           session id, model, pacing, instruction source
 *     {"t":"state","state":...}    listening | thinking | speaking | ...
 *     {"t":"partial","speaker","delta"}
 *     {"t":"turn","turn":TurnRecord}
 *     {"t":"interrupted"}          drop queued playback now
 *     {"t":"waiting"}              model is holding for more input
 *     {"t":"error","message"}
 */

import type { WebSocket, WebSocketServer } from 'ws';

import { presetFromEnv, type PacingConfig } from './pacing.ts';
import { VoiceSession, type VoiceSessionOptions } from './session.ts';
import type { TurnRecord } from './types.ts';

export interface BridgeOptions {
  apiKey: string;
  pacing: PacingConfig;
  model?: string;
  voiceName?: string;
  enforceMaxTurnTokens?: boolean;
  /**
   * Called for every completed turn, on every connection.
   *
   * **This is the persistence seam — chat 03 passes its writer in here.** The
   * voice engine does not touch the database. Throwing from this is caught and
   * surfaced as an error event; it will not drop the conversation.
   */
  onTurn?: (turn: TurnRecord) => void;
  /** Optional structured logging. Defaults to console. */
  log?: (event: string, detail?: unknown) => void;
}

/**
 * Attach the bridge to an existing `ws` server. One Live session per connection.
 */
export function attachVoiceBridge(wss: WebSocketServer, options: BridgeOptions): void {
  const log = options.log ?? ((event, detail) => console.log(`[voice] ${event}`, detail ?? ''));

  wss.on('connection', (socket: WebSocket) => {
    void handleConnection(socket, options, log);
  });
}

async function handleConnection(
  socket: WebSocket,
  options: BridgeOptions,
  log: NonNullable<BridgeOptions['log']>,
): Promise<void> {
  const send = (payload: unknown) => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(payload));
  };
  const sendAudio = (pcm: Buffer) => {
    if (socket.readyState === socket.OPEN) socket.send(pcm, { binary: true });
  };

  const sessionOptions: VoiceSessionOptions = {
    apiKey: options.apiKey,
    pacing: options.pacing,
    ...(options.model ? { model: options.model } : {}),
    ...(options.voiceName ? { voiceName: options.voiceName } : {}),
    ...(options.enforceMaxTurnTokens ? { enforceMaxTurnTokens: true } : {}),
    callbacks: {
      onAgentAudio: sendAudio,
      onPartialTranscript: (speaker, delta) => send({ t: 'partial', speaker, delta }),
      onInterrupted: () => send({ t: 'interrupted' }),
      onWaitingForInput: () => send({ t: 'waiting' }),
      onStateChange: (state) => send({ t: 'state', state }),
      onPacingChange: (pacing, vadFrozen) => send({ t: 'pacing', pacing, vadFrozen }),
      onTurn: (turn) => {
        send({ t: 'turn', turn });
        options.onTurn?.(turn);
      },
      onError: (error) => {
        log('error', error.message);
        send({ t: 'error', message: error.message });
      },
      onClose: (info) => {
        log('live-closed', info);
        send({ t: 'state', state: 'closed' });
      },
    },
  };

  const session = new VoiceSession(sessionOptions);

  try {
    await session.connect();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Live API connect failed';
    log('connect-failed', message);
    send({ t: 'error', message });
    socket.close();
    return;
  }

  log('connected', { sessionId: session.sessionId, model: session.model });

  send({
    t: 'ready',
    sessionId: session.sessionId,
    model: session.model,
    instructionSource: session.instructionSource,
    instructionNote: session.instructionNote,
    pacing: options.pacing,
  });

  socket.on('message', (data: Buffer, isBinary: boolean) => {
    if (isBinary) {
      session.sendAudio(data);
      return;
    }

    let msg: { t?: string; active?: boolean; msSinceLastSpeech?: number; preset?: string };
    try {
      msg = JSON.parse(data.toString('utf8'));
    } catch {
      return;
    }

    if (msg.t === 'speech') {
      session.reportSpeechActivity(Boolean(msg.active), msg.msSinceLastSpeech ?? 0);
    } else if (msg.t === 'stop') {
      session.endAudioStream();
    } else if (msg.t === 'pacing' && msg.preset) {
      // Switch preset mid-conversation, so the two candidate answers to
      // Decision 6 can be compared inside one call rather than across two.
      session.setPacing(presetFromEnv(msg.preset));
    }
  });

  socket.on('close', () => {
    log('browser-closed', { sessionId: session.sessionId });
    session.close();
  });

  socket.on('error', (error: Error) => {
    log('socket-error', error.message);
    session.close();
  });
}
