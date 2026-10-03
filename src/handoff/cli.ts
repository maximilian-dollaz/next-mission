/**
 * npm run handoff:demo — decompose a decision and print the split.
 *
 * Runs on the rehearsal decision in `./sample.ts` by default, or on a brief
 * JSON file: `npm run handoff:demo -- path/to/brief.json`.
 *
 * Seeds the in-memory store too, so `npm run dev` in the same process serves
 * the result over /mcp immediately. Against Supabase it persists.
 */

import { readFile } from 'node:fs/promises';
import { buildHandoff, fromBrief, putHandoff, renderSplit, type BriefLike } from './index.js';
import { backend } from './store.js';
import { REHEARSAL_DECISION } from './sample.js';
import type { DecisionInput } from './types.js';

async function input(): Promise<DecisionInput> {
  const path = process.argv[2];
  if (!path) return REHEARSAL_DECISION;
  const brief = JSON.parse(await readFile(path, 'utf8')) as BriefLike;
  return fromBrief(brief, path.replace(/.*\//, '').replace(/\.json$/, ''));
}

const decision = await input();
console.log(`\ndecision: "${decision.decision}"\n`);
console.log('decomposing...\n');

const handoff = await buildHandoff(decision);
await putHandoff(handoff);

console.log(renderSplit(handoff.tasks));
console.log(`\nstored in: ${backend()}   handoff id: ${handoff.id}`);
console.log(`\nthe split, counted:`);
for (const owner of ['agent', 'agent_drafts_human_sends', 'human'] as const) {
  const n = handoff.tasks.filter((t) => t.owner === owner).length;
  console.log(`  ${owner.padEnd(26)} ${n}`);
}
console.log(
  `\nTo move one across the line:\n  reassign(handoff.tasks, 't2', 'agent', { why_owner: '...' })\n`
);
