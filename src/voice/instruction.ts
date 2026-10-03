/**
 * System-instruction seam.
 *
 * Precedence, highest first:
 *   1. `VOICE_INSTRUCTION=placeholder` — forces the short test prompt.
 *   2. `src/voice/prompt/system-prompt.md` — the boiled prompt (normal case).
 *   3. `docs/research/02-decision-protocol.md` — chat 02's protocol document.
 *   4. The built-in placeholder.
 *
 * Any of those files may delimit the part that is actually the prompt with
 * SYSTEM-INSTRUCTION markers; without them the whole file is used.
 *
 * The boiled prompt exists because the protocol document is a *design* document
 * — research citations, worked examples, open questions — and sending all 73k
 * chars of it as a system instruction cost a measured ~2s per turn. The boiled
 * version keeps v1's proven voice and fits the decision structure inside it.
 *
 * This module only ever READS `docs/research/`. That directory belongs to 02.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import type { PacingConfig } from './pacing.ts';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * The boiled prompt: v1's proven voice with the decision structure fitted inside
 * it. Takes precedence over the protocol document when it exists.
 *
 * Derived from the live v1 Retell agent's system prompt (8.2k chars, 112 calls)
 * plus `docs/findings/01-conversation-principles.md` and the structural moves in
 * `docs/research/02-decision-protocol.md`. Owned by chat 04.
 */
export const BOILED_PROMPT_PATH = resolve(here, 'prompt/system-prompt.md');

/** Chat 02's protocol document. Read-only here; used when no boiled prompt exists. */
export const PROTOCOL_PATH = resolve(here, '../../docs/research/02-decision-protocol.md');

/** Below this many characters we treat the file as a stub, not a protocol. */
const MIN_PROTOCOL_CHARS = 400;

/**
 * Optional markers delimiting the part of the protocol file that is actually the
 * system instruction.
 *
 * Chat 02's file is a design document — it carries research citations, worked
 * examples, open questions for Max and reconciliation notes alongside the
 * protocol itself. Sending the whole thing to the model wastes context and feeds
 * it its own open questions as if they were instructions.
 *
 * Wrapping the prompt region in these comments is the fix, and it is chat 02's
 * call (or Max's) which region that is — not the voice engine's. Until the
 * markers exist we send the whole file and warn, rather than silently guessing
 * at which sections belong.
 */
const BEGIN_MARKER = '<!-- SYSTEM-INSTRUCTION:BEGIN -->';
const END_MARKER = '<!-- SYSTEM-INSTRUCTION:END -->';

/**
 * Warn above this size. ~4 chars/token, so 20k chars ≈ 5k tokens — past that,
 * connect latency and per-turn cost start to show.
 */
const WARN_CHARS = 20_000;

export type InstructionSource =
  | 'boiled-prompt'
  | 'protocol-file'
  | 'protocol-file-marked'
  | 'placeholder';

export interface LoadedInstruction {
  text: string;
  source: InstructionSource;
  /** Absolute path when `source` is `protocol-file`. */
  path?: string;
  /** Set when the protocol file was found but not usable. */
  note?: string;
}

/**
 * Placeholder protocol — enough to hold a real conversation and test
 * turn-taking, explicitly NOT the designed protocol.
 *
 * Content is only what brief 04 specified verbatim; see `docs/IDEA-BANK-TRIAGE.md`
 * for the idea IDs.
 */
const PLACEHOLDER = `You are a private thinking partner helping one person reach a decision they
actually believe — not a decision you think is right.

- Open by asking for broad context. Let them describe the situation in their own
  terms before you narrow anything.
- Ask one question at a time. One. Wait for the answer.
- Never give advice. Never recommend. Never tell them what you would do. Your job
  is to help them hear their own thinking, not to add yours.
- Never hold more than two or three things against each other at once. If more
  than three options are live, help them set some aside before comparing.
- Say "it seems like" rather than "I think". You reflect; you do not assert.

This is a placeholder for testing the voice engine. The designed conversation
protocol replaces it wholesale.`;

/**
 * Delivery directives derived from the pacing config.
 *
 * Kept separate from protocol content on purpose: these are the native-audio
 * behaviours brief 04 owns (B13 silence, hesitation, brevity). When 02's
 * protocol lands it governs *what* is said; this block governs *how* it is
 * paced and delivered. If the two ever conflict, 02 wins — delete from here.
 */
function deliveryDirectives(pacing: PacingConfig): string {
  const seconds = Math.round(pacing.silenceBeforeAgentSpeaksMs / 100) / 10;
  return `## Delivery

Silence is allowed. When the person goes quiet, they are usually thinking, not
finished. Do not fill the gap. Do not prompt them, do not ask if they are still
there, and do not restate your question into the pause. A pause of around
${seconds} seconds or less is part of their turn, not an invitation. Waiting is
the single most important thing you do.

Listen to how things are said, not only to the words. Hesitation, a wavering
tone, a flat or dutiful "yeah, I guess" — none of those are agreement. When what
you hear in someone's voice does not match what their words claim, trust the
voice, and gently name what you noticed rather than accepting the words.

Keep your turns short — under about ${pacing.maxAgentTurnSeconds} seconds of
speech. Say one thing and stop. Never stack a reflection and a question and a
summary into one turn.

If the person interrupts you, stop immediately and listen. They have the floor.`;
}

/**
 * Read a file and return the marked region if it has one, the whole trimmed file
 * otherwise. Returns undefined when the file is missing or too short to be real.
 */
function readMarked(path: string): string | undefined {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8').trim();
  } catch {
    return undefined;
  }
  const begin = raw.indexOf(BEGIN_MARKER);
  const end = raw.indexOf(END_MARKER);
  if (begin !== -1 && end > begin) {
    const inner = raw.slice(begin + BEGIN_MARKER.length, end).trim();
    return inner.length >= MIN_PROTOCOL_CHARS ? inner : undefined;
  }
  return raw.length >= MIN_PROTOCOL_CHARS ? raw : undefined;
}

/**
 * Build the full system instruction: prompt (boiled, protocol, or placeholder)
 * plus the pacing-derived delivery block.
 */
export function loadSystemInstruction(pacing: PacingConfig): LoadedInstruction {
  const delivery = deliveryDirectives(pacing);

  let protocol: string | undefined;
  let marked = false;
  let note: string | undefined;

  // Escape hatch: force the short placeholder regardless of what is on disk.
  // Needed to isolate how much of the response latency is the prompt's size,
  // and as a fallback if the protocol file is too large to demo with.
  if (process.env.VOICE_INSTRUCTION === 'placeholder') {
    return {
      text: `${PLACEHOLDER}\n\n${delivery}`,
      source: 'placeholder',
      note: 'forced by VOICE_INSTRUCTION=placeholder',
    };
  }

  // Highest precedence: the boiled prompt.
  const boiled = readMarked(BOILED_PROMPT_PATH);
  if (boiled) {
    return {
      text: `${boiled}\n\n${delivery}`,
      source: 'boiled-prompt',
      path: BOILED_PROMPT_PATH,
    };
  }

  try {
    const raw = readFileSync(PROTOCOL_PATH, 'utf8').trim();

    const begin = raw.indexOf(BEGIN_MARKER);
    const end = raw.indexOf(END_MARKER);
    if (begin !== -1 && end > begin) {
      protocol = raw.slice(begin + BEGIN_MARKER.length, end).trim();
      marked = true;
    } else if (raw.length >= MIN_PROTOCOL_CHARS) {
      protocol = raw;
      if (raw.length > WARN_CHARS) {
        note =
          `Protocol file is ${Math.round(raw.length / 1000)}k chars (~${Math.round(raw.length / 4000)}k tokens) ` +
          `and has no ${BEGIN_MARKER} / ${END_MARKER} markers, so the whole document — citations, ` +
          `worked examples and open questions included — is going to the model as its system ` +
          `instruction. Wrap the prompt region in those markers to send only that.`;
      }
    } else if (raw.length > 0) {
      note = `${PROTOCOL_PATH} exists but is only ${raw.length} chars — treating as a stub and using the placeholder.`;
    }
  } catch {
    // Not written yet. Expected before chat 02 lands; placeholder covers it.
  }

  if (protocol) {
    return {
      text: `${protocol}\n\n${delivery}`,
      source: marked ? 'protocol-file-marked' : 'protocol-file',
      path: PROTOCOL_PATH,
      ...(note ? { note } : {}),
    };
  }

  return {
    text: `${PLACEHOLDER}\n\n${delivery}`,
    source: 'placeholder',
    ...(note ? { note } : {}),
  };
}
