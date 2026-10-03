/**
 * The judge-facing proof. Two modes:
 *
 *   npm run brain:status                # what the brain holds, and on what engine
 *   npm run brain:status -- <callId>    # attempt the deletion on a real call and
 *                                       # show the verification request + response
 *
 * The second mode is the one that matters. It makes the destruction request,
 * then re-requests the transcript and the recording and prints exactly what
 * came back — including when the vendor refuses to delete. Repeat the printed
 * curl yourself; the output should match.
 */

import { destroyCallArtifacts } from '../src/brain/agentphone.js';
import * as brain from '../src/brain/gbrain.js';
import { optional } from '../src/env.js';

const B = '\x1b[1m', D = '\x1b[2m', G = '\x1b[32m', Y = '\x1b[33m', R = '\x1b[31m', O = '\x1b[0m';

async function status(): Promise<void> {
  const engine = await brain.engineStatus();
  console.log(`\n${B}THE BRAIN${O}`);
  console.log(`  engine    ${engine.effective_engine}`);
  console.log(`  location  ${engine.database_path ?? engine.database_url ?? '(unset)'}`);
  console.log(`  url from  ${engine.db_url_source}`);
  console.log(
    `  ${D}${engine.effective_engine === 'pglite'
      ? 'Embedded Postgres on this machine. No server, no account, nothing leaves the disk.'
      : 'Postgres + pgvector. Your database, your credentials.'}${O}`
  );

  const facts = await brain.recall();
  console.log(`\n${B}WHAT IT HOLDS${O}  ${facts.length} fact(s) on people/me`);
  for (const f of facts.slice(0, 12)) {
    console.log(`  #${f.id} ${D}[${f.kind}]${O} ${f.fact.slice(0, 80)}`);
    console.log(`       ${D}provenance: ${f.source ?? '(none)'}${O}`);
  }
  console.log(`\n  ${D}Every fact carries provenance because GBrain makes it mandatory.`);
  console.log(`  Withdraw any one: gbrain forget <id> --reason "withdrawn"${O}\n`);
}

async function prove(callId: string): Promise<void> {
  const baseUrl = optional('AGENTPHONE_BASE_URL', 'https://api.agentphone.ai/v1');
  console.log(`\n${B}DESTRUCTION PROOF — call ${callId}${O}`);
  console.log(`${D}Attempting deletion, then re-requesting both artifacts.${O}\n`);

  const records = await destroyCallArtifacts(callId, { recordingWasPrevented: false });

  for (const r of records) {
    const ok = r.outcome === 'destroyed' || r.outcome === 'never_created';
    const mark = ok ? `${G}✓${O}` : r.outcome === 'failed' ? `${R}✗${O}` : `${Y}!${O}`;
    console.log(`${mark} ${B}${r.store}${O} — ${r.outcome}`);
    if (r.verification) {
      console.log(`   request   ${r.verification.method} ${r.verification.target}`);
      console.log(`   response  ${r.verification.evidence}`);
      console.log(`   gone      ${r.verification.passed ? `${G}yes${O}` : `${R}no${O}`}`);
    }
    if (r.note) console.log(`   ${D}${r.note}${O}`);
    console.log('');
  }

  console.log(`${B}Repeat it yourself:${O}`);
  console.log(`  ${D}curl -i -H "Authorization: Bearer $AGENTPHONE_API_KEY" \\`);
  console.log(`    ${baseUrl}/calls/${callId}/recording${O}`);
  console.log(`  ${D}curl -i -H "Authorization: Bearer $AGENTPHONE_API_KEY" \\`);
  console.log(`    ${baseUrl}/calls/${callId}/transcript${O}\n`);
}

const callId = process.argv[2];
(callId ? prove(callId) : status()).catch((e) => {
  console.error(`${R}failed:${O}`, e instanceof Error ? e.message : e);
  process.exit(1);
});
