/**
 * Pacing config — the seam for ROADMAP Decision 6 (open, creative).
 *
 * Max has two contradictory recorded instructions, both his:
 *   B13 — long meditative pauses, patient, "very aware and in tune with me"
 *   B11 — "shorter turns — it needs to be swifter, faster"
 *
 * This file does NOT resolve that. It exposes every knob and ships three named
 * presets. Change the demo's feel by changing one line in `dev-server.ts`
 * (or whatever mounts the bridge) — nothing else needs to move.
 */

import { EndSensitivity, StartSensitivity } from '@google/genai';

/**
 * How end-of-turn is decided.
 *
 * - `server`: Gemini's own voice-activity detection commits the turn after
 *   `silenceBeforeAgentSpeaksMs` of quiet. Lower latency, far simpler. The API
 *   may clamp very long silence windows, so this caps how patient we can be.
 *
 * - `client`: we disable server VAD and send explicit activityStart/activityEnd
 *   signals from our own energy gate. Nothing clamps the hold time, so genuinely
 *   long thinking pauses (5s, 10s) are possible. Costs a little latency and more
 *   moving parts.
 *
 * Default is `server`. Switch to `client` if B13's long pauses turn out to be
 * longer than the API will honour — see the note in `session.ts`.
 */
export type TurnDetection = 'server' | 'client';

export interface PacingConfig {
  /**
   * Silence threshold before the agent is allowed to speak.
   *
   * This is the single most important number in the build. B13: when someone is
   * thinking, the agent must not fill the gap. Raise it to make the agent more
   * patient; lower it to make the exchange snappier.
   */
  silenceBeforeAgentSpeaksMs: number;

  /**
   * How long someone must be speaking before we count it as a turn starting.
   * Keeps a throat-clear, an "um", or a keyboard clack from grabbing the floor.
   */
  speechStartPaddingMs: number;

  /**
   * How readily the model decides a person has stopped talking.
   * LOW ends speech less often — the patient choice, and what B13 wants.
   */
  endOfSpeechSensitivity: EndSensitivity;

  /**
   * How readily the model decides a person has started talking.
   * LOW is less twitchy around background noise.
   */
  startOfSpeechSensitivity: StartSensitivity;

  /**
   * Soft ceiling on how long the agent talks in one turn.
   *
   * Converted to `maxOutputTokens` via AUDIO_TOKENS_PER_SECOND below, and also
   * stated in words in the system instruction — the instruction does most of
   * the work; the token cap is a backstop against a runaway monologue.
   */
  maxAgentTurnSeconds: number;

  /**
   * Target time from the person finishing to the first sound back, measured
   * end to end in the browser.
   *
   * Not enforceable — the model takes as long as it takes. Used to flag
   * measured latency that misses the target, so regressions are visible
   * rather than vibes.
   */
  latencyTargetMs: number;

  /** See {@link TurnDetection}. */
  turnDetection: TurnDetection;

  /**
   * Energy level (0..1 RMS) above which a mic frame counts as speech.
   *
   * Always used for latency measurement. Used for turn-taking too when
   * `turnDetection` is `client`.
   */
  speechEnergyThreshold: number;

  /**
   * Whether the model is told to attend to *how* something was said, not just
   * the words — hesitation, wavering, flatness.
   *
   * This is the native-audio claim (`enableAffectiveDialog`). B13 wants an agent
   * "very aware and in tune with me"; C2's completion gate needs to tell real
   * resonance from politeness. A wavering "yeah, I guess" is not agreement.
   */
  affectiveDialog: boolean;

  /**
   * **Not currently supported by the service — this knob is inert.**
   *
   * `proactivity.proactiveAudio` would let the model decline to answer: in the
   * API's own words, "ignore out of context speech or stay silent if the user
   * did not make a request, yet." That is B13 handled by the model rather than
   * by a timer, so it is worth wanting.
   *
   * It exists in the SDK typings but the service rejects it at setup on
   * `gemini-2.5-flash-native-audio-preview-12-2025`:
   *   code 1007 — Unknown name "proactivity" at 'setup': Cannot find field.
   *
   * Kept here, unsent, so re-enabling is a one-line change in `session.ts` if a
   * later preview adds it. Silence handling currently comes from
   * `silenceBeforeAgentSpeaksMs`, `endOfSpeechSensitivity` and the instruction.
   */
  proactiveAudio: boolean;
}

/**
 * Rough audio-token-per-second rate for native audio output, used only to turn
 * `maxAgentTurnSeconds` into `maxOutputTokens`.
 *
 * NOT calibrated — measured properly this should be replaced with a real number.
 * It is deliberately generous so the cap acts as a backstop and does not clip
 * the agent mid-sentence during the demo.
 */
const AUDIO_TOKENS_PER_SECOND = 40;

/**
 * Default: patient but not sleepy.
 *
 * A one-second-plus hold is long enough that a thinking pause mid-sentence does
 * not hand the floor over, and short enough that a normal back-and-forth does
 * not feel like it is buffering. This is the shipped default the brief asked
 * for — it is a starting point for Max, not an answer to Decision 6.
 */
export const PATIENT: PacingConfig = {
  silenceBeforeAgentSpeaksMs: 1200,
  speechStartPaddingMs: 300,
  endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
  startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
  maxAgentTurnSeconds: 20,
  latencyTargetMs: 1500,
  turnDetection: 'server',
  speechEnergyThreshold: 0.012,
  affectiveDialog: true,
  proactiveAudio: true,
};

/**
 * B11 — "shorter turns, swifter, faster."
 *
 * Snappy. Short agent turns, quick to take the floor. Reads as responsive, and
 * will cut across someone who pauses to think.
 */
export const SWIFT: PacingConfig = {
  ...PATIENT,
  silenceBeforeAgentSpeaksMs: 500,
  speechStartPaddingMs: 150,
  endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
  startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
  maxAgentTurnSeconds: 8,
  latencyTargetMs: 800,
};

/**
 * B13 at full strength — meditative.
 *
 * Long holds. Uses client-side turn detection because server VAD may clamp a
 * silence window this long. Expect the agent to feel like it is genuinely
 * waiting; expect it to feel slow in a 2-minute demo.
 */
export const MEDITATIVE: PacingConfig = {
  ...PATIENT,
  silenceBeforeAgentSpeaksMs: 3000,
  speechStartPaddingMs: 400,
  maxAgentTurnSeconds: 30,
  latencyTargetMs: 3500,
  turnDetection: 'client',
};

export const PRESETS = { PATIENT, SWIFT, MEDITATIVE } as const;
export type PresetName = keyof typeof PRESETS;

/**
 * Resolve a preset by name, case-insensitively, falling back to PATIENT.
 * Lets the demo's pacing be set with an env var instead of a code edit.
 */
export function presetFromEnv(value: string | undefined): PacingConfig {
  if (!value) return PATIENT;
  const key = value.trim().toUpperCase() as PresetName;
  return PRESETS[key] ?? PATIENT;
}

/** `maxAgentTurnSeconds` as a token budget. */
export function maxOutputTokensFor(pacing: PacingConfig): number {
  return Math.round(pacing.maxAgentTurnSeconds * AUDIO_TOKENS_PER_SECOND);
}
