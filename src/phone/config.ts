/**
 * Live-stage call configuration.
 *
 * Every value here is set for one situation: Max on speakerphone, in a loud room,
 * on stage, with ~90 seconds. Comments say what each one buys, because on the day
 * someone will want to change one and needs to know what it costs.
 */

export const AGENT_ID = 'cmusu4komlqatqbflw5zl30rv';
export const PHONE_NUMBER = '+12032086667';

/** The one swappable file. Logic never changes when the protocol does. */
export const SPRINT_PROMPT_FILE = 'src/phone/prompt.sprint.md';

export const STAGE_CONFIG = {
  /**
   * hosted = AgentPhone's LLM owns the realtime loop from systemPrompt.
   * Deliberate: our own webhook adding latency or timing out mid-sentence is the
   * highest-probability stage failure, and hosted removes that whole class.
   */
  voiceMode: 'hosted',

  /**
   * The load-bearing judgment on the call is which engine move turn 3 picks.
   * 'max' buys that; it costs first-token latency. Measured in rehearsal — if the
   * call overruns, this is the first dial to turn down to 'balanced'.
   */
  modelTier: 'max',

  /** ~90s budget cannot absorb +200ms per turn. Reverse if ASR mishears on stage. */
  sttMode: 'fast',

  /**
   * LOUD ROOM. The aggressive mode is documented for callers "in cars, cafes, or
   * near TVs" — a conference stage is that. Without this, crosstalk from the room
   * reads as caller speech and the agent talks over itself.
   */
  denoisingMode: 'noise-and-background-speech-cancellation',

  /** No synthetic room tone. The real room supplies plenty and it only confuses. */
  ambientSound: 'none',

  /**
   * NEVER CUT HIM OFF / never get cut off by the room.
   * 0 = agent is never interrupted, 1 = agent stops at the first sound. Default 0.8
   * means ambient chatter halts the agent mid-sentence — a demo-killer. 0.3 keeps
   * Max able to barge in deliberately while the room cannot.
   */
  interruptionSensitivity: 0.3,

  /**
   * OFF. Backchannel "uh-huh" while he is thinking is the single most likely way
   * the agent appears to interrupt him, and the protocol requires silence on a
   * trailing-off turn.
   */
  enableBackchannel: false,

  /** Clear over a speakerphone beats fast. Raise to 1.1 only if rehearsal overruns. */
  voiceSpeed: 1.0,

  /** 10 min. Deliberately long: the line must never hang up on a thinking pause. */
  maxSilenceMs: 600000,

  /** Voice is unrestricted; outbound SMS is registration_required. Hard off. */
  enableMessaging: false,

  language: 'en-US',
} as const;
