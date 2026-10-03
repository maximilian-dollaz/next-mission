/**
 * Standalone dev server for the voice engine.
 *
 * Deliberately self-contained — plain `node:http` plus `ws`, no dependency on
 * `src/server.ts` (chat 03's) so the two can be built and run independently.
 * When the real surface lands, chat 06 mounts `attachVoiceBridge` on the main
 * server and this file can go away.
 *
 *   npx tsx src/voice/dev-server.ts
 *   → http://localhost:4343
 *
 * Env:
 *   GEMINI_API_KEY      required
 *   GEMINI_LIVE_MODEL   defaults to the native-audio preview model
 *   GEMINI_VOICE        defaults to Kore
 *   VOICE_PACING        PATIENT (default) | SWIFT | MEDITATIVE
 *   VOICE_PORT          defaults to 4343
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, resolve } from 'node:path';

import { WebSocketServer } from 'ws';

import { attachVoiceBridge } from './bridge.ts';
import { presetFromEnv } from './pacing.ts';
import { PROTOCOL_PATH } from './instruction.ts';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, 'public');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error(
    'GEMINI_API_KEY is not set.\n' +
      'Copy .env.example to .env and fill in GEMINI_API_KEY (https://aistudio.google.com/apikey),\n' +
      'then run with:  node --env-file=.env node_modules/.bin/tsx src/voice/dev-server.ts',
  );
  process.exit(1);
}

const pacing = presetFromEnv(process.env.VOICE_PACING);
const port = Number(process.env.VOICE_PORT ?? 4343);

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);

  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, pacing, protocolPath: PROTOCOL_PATH }));
    return;
  }

  const requested = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
  // Keep path traversal out: resolve, then confirm it is still under publicDir.
  const filePath = join(publicDir, normalize(requested));
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const body = await readFile(filePath);
    res.writeHead(200, { 'content-type': MIME[extname(filePath)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
});

const wss = new WebSocketServer({ server, path: '/voice' });

attachVoiceBridge(wss, {
  apiKey,
  pacing,
  ...(process.env.GEMINI_LIVE_MODEL ? { model: process.env.GEMINI_LIVE_MODEL } : {}),
  ...(process.env.GEMINI_VOICE ? { voiceName: process.env.GEMINI_VOICE } : {}),
  // Persistence seam: chat 03 replaces this with its writer.
  onTurn: (turn) => {
    const latency = turn.responseLatencyMs !== undefined ? ` (${turn.responseLatencyMs}ms)` : '';
    const cut = turn.interrupted ? ' [interrupted]' : '';
    console.log(`[turn ${turn.index}] ${turn.speaker}${latency}${cut}: ${turn.text}`);
  },
});

server.listen(port, () => {
  console.log(`[voice] http://localhost:${port}`);
  console.log(`[voice] pacing=${process.env.VOICE_PACING ?? 'PATIENT'}`, {
    silenceBeforeAgentSpeaksMs: pacing.silenceBeforeAgentSpeaksMs,
    turnDetection: pacing.turnDetection,
    maxAgentTurnSeconds: pacing.maxAgentTurnSeconds,
  });
});
