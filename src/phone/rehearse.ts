/**
 * The stopwatch. Run it, then dial — it waits for the call, tails the turns live,
 * and when you hang up it reports MEASURED numbers, not impressions.
 *
 *   npm run phone:rehearse            watch for the next call and time it
 *   npm run phone:rehearse -- --last  re-report the most recent call
 *   npm run phone:rehearse -- <id>    report one specific call
 *   npm run phone:rehearse -- --check  verify the frozen config before you demo
 *
 * Retell, not AgentPhone. Retell returns word-level timings on every turn
 * (`transcript_object[].words[].start/.end`), which is the whole reason this file
 * can answer the only question that matters — "did it let me think?" — with a
 * number instead of a feeling.
 *
 * The two numbers to read:
 *   LONGEST PAUSE IT RODE OUT   the biggest mid-sentence silence you took where it
 *                               stayed quiet and let you finish. Want this high.
 *   SHORTEST SILENCE IT BROKE   how little quiet it needed before it started talking.
 *                               This is the measured endpointing threshold. Want this high.
 *                               Anything under ~1.5s is what being cut off feels like.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Scope: this file only ever touches the Next Mission v2 agent. */
const AGENT_ID = 'agent_e81ba747b2d4e05bc12af01ba5';
const PHONE_NUMBER = '+12722297451';
const API = 'https://api.retellai.com';

/** A silence this long or longer is a deliberate think, worth logging on its own line. */
const THINK_MS = 1.5;
/** Below this, the agent answering reads to a human as "it jumped in". */
const TOO_EAGER = 1.5;

/** The sentence the protocol lands on. Fallbacks catch a commitment phrased loosely. */
const CHOOSE = /\bi choose to\b/i;
const COMMIT = /\b(i'?m going to|i'?m gonna|i will|i'?m doing|i'?ll|i'?m deciding to)\b/i;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const s = (n: number) => `${n.toFixed(1)}s`;

/**
 * The key lives in the v1 app, which is the only place it has ever been stored.
 * Env wins so .env can take it over later without touching this file.
 */
function apiKey(): string {
  const fromEnv = process.env.RETELL_API_KEY;
  if (fromEnv) return fromEnv;
  const fallback = join(homedir(), 'Desktop', 'I am AI', '.env.local');
  try {
    const line = readFileSync(fallback, 'utf8').split('\n').find((l) => l.startsWith('RETELL_API_KEY='));
    const key = line?.slice('RETELL_API_KEY='.length).trim().replace(/^['"]|['"]$/g, '');
    if (key) return key;
  } catch {
    /* fall through to the error below */
  }
  throw new Error(`RETELL_API_KEY is not set, and no key found in ${fallback}`);
}

async function retell(path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

const listCalls = (limit = 20) =>
  retell('/v2/list-calls', {
    filter_criteria: { agent_id: [AGENT_ID] },
    limit,
    sort_order: 'descending',
  }) as Promise<any[]>;

const getCall = (callId: string) => retell(`/v2/get-call/${callId}`);

interface Turn {
  role: 'agent' | 'user';
  text: string;
  /** Seconds from call start. null when Retell has not attached word timings yet. */
  start: number | null;
  end: number | null;
  words: { word: string; start: number; end: number }[];
}

function turnsOf(call: any): Turn[] {
  return ((call?.transcript_object ?? []) as any[])
    .map((t) => {
      const words = (t.words ?? []) as Turn['words'];
      return {
        role: t.role === 'agent' ? 'agent' : 'user',
        text: String(t.content ?? '').trim(),
        start: words.length ? words[0]!.start : null,
        end: words.length ? words[words.length - 1]!.end : null,
        words,
      } as Turn;
    })
    .filter((t) => t.text.length > 0);
}

interface Silence {
  /** Seconds into the call where the quiet began. */
  at: number;
  length: number;
  /** True when the agent started talking at the end of this silence. */
  broken: boolean;
  /** What Max had just said when he went quiet. */
  after: string;
  /** The agent never spoke again — the call ended in this silence. */
  neverAnswered?: boolean;
}

/**
 * Every stretch of quiet in the call, and who ended it.
 *
 * Two sources, because a pause shows up differently depending on what the agent did:
 *  - the agent stayed quiet  -> the gap sits BETWEEN TWO WORDS of one user turn
 *  - the agent spoke         -> the gap sits between the user turn and the agent turn
 * Reading only the second gives the flattering half of the picture.
 */
function silences(turns: Turn[], callSeconds: number): Silence[] {
  const out: Silence[] = [];

  for (let i = 0; i < turns.length; i++) {
    const t = turns[i]!;
    if (t.role !== 'user') continue;

    // Pauses Max took mid-sentence that the agent rode out.
    for (let w = 1; w < t.words.length; w++) {
      const gap = t.words[w]!.start - t.words[w - 1]!.end;
      if (gap >= THINK_MS) {
        out.push({
          at: t.words[w - 1]!.end,
          length: gap,
          broken: false,
          after: t.words.slice(Math.max(0, w - 6), w).map((x) => x.word).join('').trim(),
        });
      }
    }

    // The silence the agent chose to end.
    //
    // Skip the agent turn that merely CONTINUES a sentence it had already started.
    // Retell splits an agent turn in two when Max says something short over the top
    // of it ("yeah", "I—"), and the second half then looks like the agent starting
    // to talk while Max is mid-word. It is the opposite: Max barged in on the agent.
    // The tell is that the two agent fragments are contiguous in time.
    const next = turns[i + 1];
    const prev = turns[i - 1];
    const agentWasAlreadyTalking =
      prev?.role === 'agent' && prev.end != null && next?.start != null &&
      Math.abs(next.start - prev.end) < 0.05;

    if (next?.role === 'agent' && t.end != null && next.start != null && !agentWasAlreadyTalking) {
      out.push({
        at: t.end,
        length: next.start - t.end,
        broken: true,
        after: t.text.slice(-60),
      });
    }
  }

  // The silence NOTHING ended: Max stopped talking and the agent never came back.
  // Invisible to the loop above, because that only sees a silence with a turn on
  // both sides. This is the over-patient failure, and it is the one that kills a
  // demo quietly — the line just goes dead and the room watches you wait.
  const last = turns[turns.length - 1];
  if (last?.role === 'user' && last.end != null && callSeconds - last.end >= THINK_MS) {
    out.push({
      at: last.end,
      length: callSeconds - last.end,
      broken: false,
      after: last.text.slice(-60),
      neverAnswered: true,
    });
  }

  return out.sort((a, b) => a.at - b.at);
}

function report(call: any) {
  const turns = turnsOf(call);
  const callSeconds = (call.duration_ms ?? 0) / 1000;
  const quiet = silences(turns, callSeconds);
  const rode = quiet.filter((q) => !q.broken && !q.neverAnswered);
  const mute = quiet.filter((q) => q.neverAnswered);
  const broke = quiet.filter((q) => q.broken);
  const cutOff = broke.filter((q) => q.length < 0);
  const eager = broke.filter((q) => q.length >= 0 && q.length < TOO_EAGER);

  // Time to the hinge sentence, in Max's own voice.
  let chooseAt: number | null = null;
  let commitAt: number | null = null;
  for (const t of turns) {
    if (t.role !== 'user' || t.start == null) continue;
    if (chooseAt === null && CHOOSE.test(t.text)) chooseAt = t.start;
    if (commitAt === null && COMMIT.test(t.text)) commitAt = t.start;
  }

  const longestRidden = rode.length ? Math.max(...rode.map((q) => q.length)) : null;
  const shortestBroken = broke.length ? Math.min(...broke.filter((q) => q.length >= 0).map((q) => q.length)) : null;

  console.log('\n──────── every silence over 1.5s ────────');
  if (!quiet.length) console.log('  (none — no pause long enough to test it)');
  for (const q of quiet) {
    if (q.length < THINK_MS && q.length >= 0) continue;
    const verdict = q.length < 0
      ? 'TALKED OVER YOU'
      : q.broken
        ? (q.length < TOO_EAGER ? `it spoke after ${s(q.length)}  <-- jumped in` : `it spoke after ${s(q.length)}`)
        : q.neverAnswered
          ? `WENT MUTE ${s(q.length)} — never answered, you hung up`
          : `stayed quiet ${s(q.length)}  <-- let you think`;
    console.log(`  ${s(q.at).padStart(7)}  ${verdict}`);
    console.log(`           ...after "${q.after}"`);
  }

  console.log('\n════════════════ MEASURED ════════════════');
  console.log(`  LONGEST PAUSE IT RODE OUT   ${longestRidden === null ? 'no pause taken' : s(longestRidden)}`);
  console.log(`  SHORTEST SILENCE IT BROKE   ${shortestBroken === null ? 'n/a' : s(shortestBroken)}`);
  console.log(`  CUT YOU OFF MID-THOUGHT     ${cutOff.length} time(s)${cutOff.length ? '   <-- THE FAILURE' : ''}`);
  console.log(`  JUMPED IN UNDER ${s(TOO_EAGER)}       ${eager.length} time(s)`);
  console.log(`  WENT MUTE ON YOU            ${mute.length ? s(mute[0]!.length) + '   <-- THE OTHER FAILURE' : 'no'}`);
  console.log('  ──');
  console.log(`  TIME TO "I CHOOSE TO —"     ${chooseAt === null ? 'NEVER SAID IT' : s(chooseAt)}`);
  if (chooseAt === null && commitAt !== null) console.log(`    (loose commitment at ${s(commitAt)})`);
  console.log(`  total call                  ${s(callSeconds)}`);
  console.log(`  turns                       ${turns.length}`);
  console.log(`  ended by                    ${call.disconnection_reason ?? '?'}`);
  console.log('══════════════════════════════════════════');
  if (call.recording_url) console.log(`\nrecording: ${call.recording_url}`);
  console.log(`\nnext: npm run phone:rehearse -- ${call.call_id}`);
}

/**
 * The frozen turn-taking config. These ten values ARE the "pause when I'm thinking"
 * feature; there is no separate endpointing dial in Retell.
 *
 * This list exists because on 2026-10-03 another process overwrote `responsiveness`
 * back to 1 (Retell's default, and the original bug) between two reads minutes apart.
 * Run `--check` immediately before demoing. A 200 from PATCH proves nothing — Retell
 * silently accepts fields that do not exist, so only a GET counts.
 */
const FROZEN = {
  responsiveness: 0.3,
  interruption_sensitivity: 0.1,
  stt_mode: 'accurate',
  reminder_max_count: 0,
  reminder_trigger_ms: 60000,
  end_call_after_silence_ms: 120000,
  enable_backchannel: false,
  backchannel_frequency: 0,
  denoising_mode: 'noise-cancellation',
  voice_speed: 0.95,
} as const;

async function check(): Promise<void> {
  const agent = await retell(`/get-agent/${AGENT_ID}`);
  let ok = true;

  console.log(`\nagent ${AGENT_ID}  (v${agent.version})`);
  for (const [k, want] of Object.entries(FROZEN)) {
    const got = agent[k];
    const good = JSON.stringify(got) === JSON.stringify(want);
    if (!good) ok = false;
    console.log(`  ${good ? 'ok  ' : 'BAD '}${k.padEnd(28)}${JSON.stringify(got)}${good ? '' : `   expected ${JSON.stringify(want)}`}`);
  }

  const num = await retell(`/get-phone-number/${PHONE_NUMBER}`);
  const bound = (num.inbound_agents ?? []).map((a: any) => a.agent_id);
  const routed = bound.length === 1 && bound[0] === AGENT_ID;
  if (!routed) ok = false;
  console.log(`\n  ${routed ? 'ok  ' : 'BAD '}${PHONE_NUMBER} -> ${bound.join(', ') || '(nothing)'}`);

  console.log(ok ? '\nREADY — dial it.\n' : '\nNOT READY — a value drifted. Re-apply before demoing.\n');
  if (!ok) process.exitCode = 1;
}

const arg = process.argv[2];

if (arg === '--check') {
  await check();
} else if (arg && arg !== '--last') {
  report(await getCall(arg));
} else if (arg === '--last') {
  const [latest] = await listCalls(1);
  if (!latest) throw new Error(`no calls yet on ${AGENT_ID}`);
  report(await getCall(latest.call_id));
} else {
  const seen = new Set((await listCalls(20)).map((c) => c.call_id as string));
  console.log(`watching ${AGENT_ID}`);
  console.log(`DIAL ${PHONE_NUMBER} now.\n`);

  let callId: string | undefined;
  while (!callId) {
    for (const c of await listCalls(5)) {
      if (!seen.has(c.call_id)) { callId = c.call_id as string; break; }
    }
    if (!callId) await sleep(1000);
  }
  console.log(`call ${callId} connected — stopwatch running\n`);

  let shown = 0;
  for (;;) {
    const call = await getCall(callId);
    const turns = turnsOf(call);
    for (; shown < turns.length; shown++) {
      const t = turns[shown]!;
      const at = t.start === null ? '   ?  ' : s(t.start).padStart(7);
      console.log(`[${at}] ${t.role === 'agent' ? 'AGENT' : 'MAX  '}  ${t.text}`);
    }
    if (call.call_status === 'ended' || call.call_status === 'error') {
      // Retell finishes attaching word timings a moment after the call drops.
      await sleep(2500);
      report(await getCall(callId));
      break;
    }
    await sleep(1000);
  }
}
