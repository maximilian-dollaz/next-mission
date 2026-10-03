/**
 * System-instruction seam.
 *
 * The conversation protocol is chat 02's work, landing at
 * `docs/research/02-decision-protocol.md`. This file reads that one path and
 * falls back to a placeholder so the voice engine can be built and tested
 * before it exists. Nothing here invents protocol content.
 *
 * When 02 lands, no code changes: `loadSystemInstruction()` picks the file up
 * and `source` flips from `placeholder` to `protocol-file`. The page shows which
 * one is live so nobody demos the placeholder by accident.
 *
 * This module only ever READS `docs/research/`. That directory belongs to 02.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import type { PacingConfig } from './pacing.ts';

const here = dirname(fileURLToPath(import.meta.url));

/** The one file the real conversation protocol is read from. */
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

export type InstructionSource = 'protocol-file' | 'protocol-file-marked' | 'placeholder';

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
 * Build the full system instruction: protocol (real or placeholder) plus the
 * pacing-derived delivery block.
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
