/**
 * The demo runner.
 *
 *   npm run brain:demo                 # rehearsal transcript, proves the pipeline
 *   npm run brain:demo -- <callId>     # a real AgentPhone call
 *
 * Prints the receipt the way a judge should read it: what was kept, what was
 * destroyed with the proof, and what we could not destroy and who holds it.
 */

import { runPipeline } from './pipeline.js';
import { REHEARSAL_CALL } from './fixtures.js';
import * as brain from './gbrain.js';
import type { CallReceipt } from './types.js';

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const OFF = '\x1b[0m';

function print(r: CallReceipt): void {
  console.log(`\n${BOLD}── RECEIPT ─ call ${r.call_id} ─────────────────────${OFF}`);

  console.log(`\n${BOLD}KEPT${OFF}`);
  console.log(`  page        ${r.kept.brain_page}`);
  console.log(`  decision    ${r.kept.decision || '(none — the call did not land)'}`);
  console.log(`  next action ${r.kept.next_action}`);
  console.log(`  facts       ${r.kept.fact_count} (ids ${r.kept.fact_ids.join(', ') || '—'})`);
  console.log(`  landed      ${r.kept.landed ? `${GREEN}yes${OFF}` : `${YELLOW}no — reported honestly${OFF}`}`);

  console.log(`\n${BOLD}DESTROYED${OFF}`);
  for (const s of r.destroyed) {
    const mark =
      s.outcome === 'destroyed' || s.outcome === 'never_created'
        ? `${GREEN}✓${OFF}`
        : s.outcome === 'failed'
          ? `${RED}✗${OFF}`
          : `${YELLOW}!${OFF}`;
    console.log(`  ${mark} ${BOLD}${s.store}${OFF}  ${s.outcome}`);
    console.log(`     ${DIM}${s.holds}${OFF}`);
    if (s.verification) {
      console.log(
        `     ${DIM}proof: ${s.verification.method} ${s.verification.target}${OFF}`
      );
      console.log(`     ${DIM}   →   ${s.verification.evidence}${OFF}`);
    }
    if (s.note) console.log(`     ${DIM}${s.note}${OFF}`);
  }

  if (r.residual_exposure.length) {
    console.log(`\n${BOLD}${YELLOW}WHAT WE COULD NOT DESTROY${OFF} ${DIM}(stated, not hidden)${OFF}`);
    for (const e of r.residual_exposure) console.log(`  · ${e}`);
  }

  console.log(`\n${BOLD}TAKE IT BACK${OFF}`);
  console.log(`  export    ${r.withdrawal.export}`);
  console.log(`  withdraw  ${r.withdrawal.forget_fact}`);
  console.log('');
}

async function main(): Promise<void> {
  if (!(await brain.available())) {
    console.error(
      'gbrain is not installed. Install it from GitHub — NEVER from npm, that package is unrelated:\n' +
        '  bun install -g github:garrytan/gbrain\n' +
        '  gbrain init --pglite --no-embedding'
    );
    process.exit(1);
  }

  const callId = process.argv[2];
  const receipt = callId
    ? await runPipeline({ callId })
    : await runPipeline({
        callId: `rehearsal-${Date.now().toString(36)}`,
        turns: REHEARSAL_CALL,
        recordingWasPrevented: true,
      });

  print(receipt);
  if (process.env.RECEIPT_JSON) console.log(JSON.stringify(receipt, null, 2));
}

main().catch((err) => {
  console.error(`\n${RED}pipeline failed:${OFF}`, err instanceof Error ? err.message : err);
  process.exit(1);
});
