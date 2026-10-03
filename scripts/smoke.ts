#!/usr/bin/env tsx
/**
 * End-to-end check of the context library against the real Supabase project.
 *
 *   npm run db:smoke
 *
 * Creates a throwaway session, appends turns, extracts context items, keeps
 * some of them, writes a decision, exports the library, then destroys the
 * session and proves the transcript is actually gone.
 *
 * Safe to run repeatedly. Leaves one destroyed session behind per run, which
 * is useful demo furniture rather than clutter.
 */

import {
  addContextItems,
  appendTurn,
  createSession,
  dbReady,
  destroySession,
  endSession,
  exportLibrary,
  keepContextItems,
  listTurns,
  markDispatched,
  writeDecision,
  writeReceipt,
} from '../src/db/index.js';

const ok = (s: string) => console.log(`  ok   ${s}`);
const fail = (s: string) => console.log(`  FAIL ${s}`);

async function main() {
  if (!dbReady()) {
    console.error('Supabase keys are not in .env yet. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }

  console.log('context library smoke test');

  const session = await createSession({ metadata: { source: 'smoke' } });
  ok(`created session ${session.id}`);

  const t1 = await appendTurn({ session_id: session.id, speaker: 'agent', text: 'What is actually on your mind?' });
  const t2 = await appendTurn({
    session_id: session.id,
    speaker: 'human',
    text: "Whether to take the contract or keep building my own thing. I keep coming back to it.",
  });
  await appendTurn({ session_id: session.id, speaker: 'agent', text: 'What makes it keep coming back?' });
  if (t1.seq === 1 && t2.seq === 2) ok('turns appended in order (seq assigned by the database)');
  else fail(`seq assignment wrong: got ${t1.seq}, ${t2.seq}`);

  const items = await addContextItems([
    {
      session_id: session.id,
      kind: 'theme',
      label: 'autonomy vs. runway',
      body: 'Recurring tension between taking paid work and protecting time for his own build.',
      turn_id: t2.id,
      source_quote: 'keep building my own thing',
      confidence: 0.8,
    },
    {
      session_id: session.id,
      kind: 'constraint',
      label: 'will not give up mornings',
      body: 'Mornings are for his own work and are not negotiable.',
      turn_id: t2.id,
      confidence: 0.6,
    },
  ]);
  ok(`extracted ${items.length} context items`);

  const keeper = items[0];
  if (!keeper) throw new Error('no context item to keep');
  await keepContextItems([keeper.id]);
  ok(`person kept 1 of ${items.length} items`);

  const decision = await writeDecision({
    session_id: session.id,
    statement: 'I am taking the contract, but only three days a week.',
    next_action: 'Email the client tonight proposing Tue/Wed/Thu at the same total rate.',
    reasoning: 'The runway matters more than the purity, and mornings stay mine.',
    next_steps: [
      { action: 'Email the client tonight proposing Tue/Wed/Thu at the same total rate.', due: 'tonight' },
      { action: 'Block Mon and Fri mornings in the calendar as unavailable.' },
    ],
    conviction: 0.85,
  });
  ok(`wrote decision ${decision.id}`);

  await markDispatched(decision.id, 'personal-agent');
  ok('decision dispatched');

  await endSession(session.id, 247);
  ok('session ended, 247s of talk time recorded');

  await writeReceipt({
    session_id: session.id,
    cadence: 'settlement',
    amount_usd: '0.988000',
    billed_seconds: 247,
    payment_method: 'mpp',
  });
  ok('settlement receipt written');

  const before = await exportLibrary();
  ok(`export: ${before.counts.sessions} sessions, ${before.counts.turns} turns, ${before.counts.context_items} context items, ${before.counts.decisions} decisions`);

  // ── the load-bearing one ──
  const result = await destroySession(session.id);
  const turnsAfter = await listTurns(session.id);
  const after = await exportLibrary();

  console.log('\ndestroy-on-exit:');
  console.log(`  ${JSON.stringify(result)}`);
  if (turnsAfter.length === 0) ok('raw transcript is gone (0 turns remain)');
  else fail(`transcript survived: ${turnsAfter.length} turns still present`);
  if (result.context_items_kept === 1) ok('the item the person kept survived');
  else fail(`expected 1 kept item, got ${result.context_items_kept}`);
  if (result.context_items_discarded === items.length - 1) ok('unkept items were discarded');
  else fail(`expected ${items.length - 1} discarded, got ${result.context_items_discarded}`);
  if (result.decisions_retained === 1) ok('the decision was retained');
  else fail(`expected 1 decision retained, got ${result.decisions_retained}`);

  const kept = after.context_items.find((i) => i.id === keeper.id);
  if (kept && kept.turn_id === null && kept.source_quote) {
    ok('kept item lost its transcript reference but kept the person\'s own words');
  } else {
    fail('kept item did not detach from the transcript correctly');
  }

  console.log('\nsmoke test complete');
}

main().catch((err: unknown) => {
  console.error(`\n${(err as Error).message}`);
  process.exit(1);
});
