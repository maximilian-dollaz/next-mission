#!/usr/bin/env tsx
/**
 * Seed the demo. An empty state looks unfinished; three past sessions with a
 * real context library behind them looks like a product.
 *
 *   npm run db:seed
 *
 * Writes two completed sessions with decisions dispatched and receipts, plus
 * one already destroyed — so the destroy-on-exit story is visible in the UI
 * before anyone presses the button live.
 */

import {
  addContextItems,
  appendTurn,
  createSession,
  dbReady,
  destroySession,
  endSession,
  keepContextItems,
  markDispatched,
  writeDecision,
  writeReceipt,
} from '../src/db/index.js';
import { accruedUsd, settlementUsd, usdPrecise } from '../src/mpp/index.js';
import type { NewContextItem, Speaker } from '../src/types.js';

type Seed = {
  seconds: number;
  turns: Array<[Speaker, string]>;
  context: Array<Omit<NewContextItem, 'session_id'> & { keep: boolean }>;
  decision: { statement: string; next_action: string; reasoning: string; steps: string[]; conviction: number };
  destroy?: boolean;
};

const SEEDS: Seed[] = [
  {
    seconds: 263,
    turns: [
      ['agent', "What's actually on your mind right now?"],
      ['human', "The hiring thing. I've had the same open role for five months and I keep not closing it."],
      ['agent', 'Five months. What happens each time you get close?'],
      ['human', "I talk myself out of the candidate. Nobody's been obviously right, so I wait."],
      ['agent', "Is waiting cheaper than being wrong, or does it just feel cheaper?"],
      ['human', "...it just feels cheaper. The role being empty is costing me more than a mediocre hire would."],
      ['agent', 'So what are you deciding?'],
      ['human', "I'm hiring Dana. She's not perfect but she's good and she's available, and five more months of this is worse."],
    ],
    context: [
      {
        kind: 'theme',
        label: 'waiting as a way of not choosing',
        body: 'Defers decisions by framing delay as prudence. Named it himself in this session.',
        source_quote: 'it just feels cheaper',
        confidence: 0.9,
        keep: true,
      },
      {
        kind: 'person',
        label: 'Dana',
        body: 'Candidate for the open role. Good, not perfect, available now.',
        confidence: 0.95,
        keep: true,
      },
      {
        kind: 'constraint',
        label: 'the role cannot stay open past this month',
        body: 'Decided the cost of the vacancy now exceeds the cost of an imperfect hire.',
        confidence: 0.8,
        keep: true,
      },
      {
        kind: 'theme',
        label: 'mentions being tired',
        body: 'Said he was tired early in the call. Low signal.',
        confidence: 0.2,
        keep: false,
      },
    ],
    decision: {
      statement: "I'm hiring Dana. She's not perfect but she's good and she's available, and five more months of this is worse.",
      next_action: 'Send Dana the offer today at the number we discussed, with a start date two weeks out.',
      reasoning: 'The vacancy is costing more than an imperfect hire would. Waiting was never prudence.',
      steps: [
        'Send Dana the offer today at the number we discussed, with a start date two weeks out.',
        'Tell the other two candidates today, not next week.',
        'Put a 30-day check-in on the calendar now, so "good not perfect" has a review point.',
      ],
      conviction: 0.9,
    },
  },
  {
    seconds: 184,
    turns: [
      ['agent', 'Where do you want to start?'],
      ['human', "I need to decide about the conference talk. I said yes months ago and now I resent it."],
      ['agent', 'What would you be giving up to do it?'],
      ['human', 'Two weeks of prep I do not have, right when the release lands.'],
      ['agent', 'And what would you be giving up by pulling out?'],
      ['human', "Some face. Not much else, honestly. I think I'm more worried about looking flaky than about actually being flaky."],
      ['agent', 'So?'],
      ['human', "I'm pulling out. I'd rather be honest eight weeks early than bad on stage."],
    ],
    context: [
      {
        kind: 'theme',
        label: 'says yes early, resents it later',
        body: 'Commits months ahead to things he would decline at the time. Recognised the pattern unprompted.',
        source_quote: 'I said yes months ago and now I resent it',
        confidence: 0.85,
        keep: true,
      },
      {
        kind: 'commitment',
        label: 'protect the release window',
        body: 'The release takes precedence over outside commitments this quarter.',
        confidence: 0.8,
        keep: true,
      },
    ],
    decision: {
      statement: "I'm pulling out of the talk. I'd rather be honest eight weeks early than bad on stage.",
      next_action: 'Email the organisers tonight withdrawing, and offer to suggest a replacement speaker.',
      reasoning: 'The release matters more, and the real cost of withdrawing is pride, not relationship.',
      steps: [
        'Email the organisers tonight withdrawing, and offer to suggest a replacement speaker.',
        'Name two people who would be good for the slot and ask them before you email.',
      ],
      conviction: 0.95,
    },
  },
  {
    seconds: 96,
    turns: [
      ['agent', "What's on your mind?"],
      ['human', "Honestly this one is small. Whether to move the standup to 10."],
      ['agent', 'What makes it worth deciding out loud?'],
      ['human', "Because I keep bringing it up and never changing it. Move it to 10. Done."],
    ],
    context: [
      {
        kind: 'theme',
        label: 'reopens settled small decisions',
        body: 'Returns repeatedly to low-stakes choices he has effectively already made.',
        confidence: 0.7,
        keep: true,
      },
      {
        kind: 'theme',
        label: 'mentioned the weather',
        body: 'Small talk. No signal.',
        confidence: 0.1,
        keep: false,
      },
    ],
    decision: {
      statement: 'Move the standup to 10. Done.',
      next_action: 'Change the recurring calendar invite to 10:00 and post it in the team channel.',
      reasoning: 'Already decided; the only thing missing was saying it once and acting.',
      steps: ['Change the recurring calendar invite to 10:00 and post it in the team channel.'],
      conviction: 1.0,
    },
    destroy: true,
  },
];

async function main() {
  if (!dbReady()) {
    console.error('Supabase keys are not in .env yet. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }

  for (const seed of SEEDS) {
    const session = await createSession({ metadata: { source: 'seed' } });

    const turnIds: string[] = [];
    let offset = 0;
    for (const [speaker, text] of seed.turns) {
      const turn = await appendTurn({ session_id: session.id, speaker, text, offset_ms: offset });
      turnIds.push(turn.id);
      offset += Math.round((seed.seconds * 1000) / seed.turns.length);
    }

    // Attribute each item to the first human turn that could have produced it.
    const firstHuman = turnIds[1] ?? null;
    const items = await addContextItems(
      seed.context.map(({ keep, ...item }) => ({
        ...item,
        session_id: session.id,
        turn_id: item.source_quote ? firstHuman : null,
        kept: keep,
      }))
    );

    await keepContextItems(
      items.filter((_, i) => seed.context[i]?.keep).map((i) => i.id),
      true
    );

    const decision = await writeDecision({
      session_id: session.id,
      statement: seed.decision.statement,
      next_action: seed.decision.next_action,
      reasoning: seed.decision.reasoning,
      next_steps: seed.decision.steps.map((action) => ({ action })),
      conviction: seed.decision.conviction,
    });
    await markDispatched(decision.id, 'personal-agent');

    await endSession(session.id, seed.seconds);

    const quote = settlementUsd(seed.seconds);
    await writeReceipt({
      session_id: session.id,
      cadence: 'settlement',
      amount_usd: quote.amount,
      billed_seconds: quote.seconds,
      payment_method: 'mpp',
      payer: 'personal-agent',
      raw: { accrued_usd: usdPrecise(accruedUsd(seed.seconds)), clamped_to_minimum: quote.clamped },
    });

    if (seed.destroy) {
      const result = await destroySession(session.id);
      console.log(
        `seeded ${session.id} — destroyed on exit (${result.turns_destroyed} turns gone, ${result.context_items_kept} kept)`
      );
    } else {
      console.log(
        `seeded ${session.id} — ${seed.turns.length} turns, ${items.length} context items, $${quote.amount} settled`
      );
    }
  }

  console.log('\nseed complete');
}

main().catch((err: unknown) => {
  console.error(`\n${(err as Error).message}`);
  process.exit(1);
});
