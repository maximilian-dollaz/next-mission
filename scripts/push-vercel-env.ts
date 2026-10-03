#!/usr/bin/env tsx
/**
 * Push the env vars the deployed app needs into the Vercel project.
 *
 *   npm run deploy:env
 *
 * Reads them from the already-loaded .env and shells out to `vercel env add`.
 * Only pushes the keys the server actually reads, so nothing extra ends up in
 * the Vercel project. Values are never printed.
 *
 * Requires `vercel login` and a linked project (`vercel link`) first.
 */

import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** Run a command, writing `input` to its stdin. `vercel env add` reads the value there. */
function runWithStdin(cmd: string, args: string[], input: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(stderr.trim() || `exit ${code}`))
    );
    child.stdin.end(input);
  });
}

/** Exactly what the deployed server reads. Nothing else goes up. */
const KEYS = [
  'ANTHROPIC_API_KEY',
  'ORCHESTRATOR_MODEL',
  'GEMINI_API_KEY',
  'GEMINI_LIVE_MODEL',
  'GEMINI_VOICE',
  'STRIPE_SECRET_KEY',
  'STRIPE_PROFILE_ID',
  'TEMPO_DEPOSIT_ADDRESS',
  'MPP_TALK_USD_PER_SECOND',
  'MPP_SETTLEMENT_USD',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PUBLIC_BASE_URL',
  'LOG_LEVEL',
] as const;

const TARGETS = ['production', 'preview', 'development'];

async function main() {
  const present = KEYS.filter((k) => (process.env[k] ?? '').trim() !== '');
  const absent = KEYS.filter((k) => !present.includes(k));

  if (present.length === 0) {
    console.error('Nothing to push — .env has none of the keys the server reads.');
    process.exit(1);
  }

  console.log(`pushing ${present.length} env vars to Vercel (${TARGETS.join(', ')})`);

  for (const key of present) {
    const value = process.env[key]!.trim();
    for (const target of TARGETS) {
      // Remove first so re-running is idempotent rather than erroring on
      // "already exists". A missing var makes `rm` fail, which is fine.
      await run('npx', ['vercel', 'env', 'rm', key, target, '--yes']).catch(() => {});
      try {
        await runWithStdin('npx', ['vercel', 'env', 'add', key, target], value);
        console.log(`  ok   ${key} → ${target}`);
      } catch (err) {
        console.log(`  FAIL ${key} → ${target}: ${(err as Error).message.split('\n')[0]}`);
      }
    }
  }

  if (absent.length > 0) {
    console.log(`\nnot in .env, skipped: ${absent.join(', ')}`);
  }
  console.log('\nRedeploy for these to take effect: npm run deploy');
}

main().catch((err: unknown) => {
  console.error((err as Error).message);
  process.exit(1);
});
