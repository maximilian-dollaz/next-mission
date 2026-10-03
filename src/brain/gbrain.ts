/**
 * GBrain, the caller's own context library.
 *
 * GBrain (github.com/garrytan/gbrain) is local-first and single-owner: your
 * hardware, your database, your keys. We write into it over its CLI; the
 * caller's own agent reads out of it over GBrain's MCP server
 * (`gbrain serve --surface verbs`). One brain, both jobs — the context library
 * IS the handoff, which is why this project ships no MCP server of its own.
 *
 * NEVER `npm install gbrain`. The npm package of that name is unrelated and
 * the repo warns about the trap explicitly. Install from GitHub only:
 *   bun install -g github:garrytan/gbrain
 *
 * Engine: whatever `gbrain engine status` reports. PGLite (embedded, nothing
 * leaves the machine) is the keyless default; `gbrain migrate --to supabase`
 * moves the same brain onto Postgres + pgvector without touching this file.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { GBrainKind } from './types.js';

const run = promisify(execFile);

/** The one entity every fact from a call hangs off. */
export const SUBJECT_ENTITY = 'people/me';

export class GBrainError extends Error {
  readonly status = 503;
}

let resolved: string | null = null;

/** Find the gbrain binary. Bun's global bin is not on a server's PATH. */
function bin(): string {
  if (resolved) return resolved;
  const candidates = [
    process.env.GBRAIN_BIN,
    join(homedir(), '.bun', 'bin', 'gbrain'),
    '/opt/homebrew/bin/gbrain',
    '/usr/local/bin/gbrain',
  ].filter((p): p is string => typeof p === 'string' && p.length > 0);

  for (const c of candidates) if (existsSync(c)) return (resolved = c);
  return (resolved = 'gbrain'); // fall back to PATH
}

async function gbrain(args: string[], stdin?: string): Promise<string> {
  try {
    const child = run(bin(), args, { maxBuffer: 16 * 1024 * 1024 });
    if (stdin !== undefined) {
      child.child.stdin?.end(stdin);
    }
    const { stdout } = await child;
    return stdout;
  } catch (err) {
    const e = err as { stderr?: string; stdout?: string; message: string };
    throw new GBrainError(
      `gbrain ${args[0]} failed: ${(e.stderr || e.stdout || e.message).slice(0, 500)}`
    );
  }
}

async function gbrainJson<T>(args: string[], stdin?: string): Promise<T> {
  const out = await gbrain([...args, '--json'], stdin);
  const start = out.indexOf('{');
  if (start < 0) throw new GBrainError(`gbrain ${args[0]} returned no JSON: ${out.slice(0, 200)}`);
  return JSON.parse(out.slice(start)) as T;
}

// ─────────────────────────────────────────────────────────────

export interface EngineStatus {
  effective_engine: 'pglite' | 'postgres';
  database_path: string | null;
  database_url: string | null;
  db_url_source: string;
}

/** Which engine this brain is actually on. Goes straight into the receipt. */
export async function engineStatus(): Promise<EngineStatus> {
  return gbrainJson<EngineStatus>(['engine', 'status']);
}

export async function available(): Promise<boolean> {
  try {
    await gbrain(['--version']);
    return true;
  } catch {
    return false;
  }
}

export interface RememberResult {
  id: string;
  status: 'inserted' | 'duplicate' | 'superseded';
  entity_slug: string | null;
}

/**
 * Save one fact, with provenance. GBrain makes provenance mandatory, which is
 * why this is the right store for us: nothing lands in the library without a
 * record of where it came from — even after the transcript is gone.
 */
export async function remember(args: {
  fact: string;
  provenance: string;
  entity?: string;
  kind?: GBrainKind;
}): Promise<RememberResult> {
  return gbrainJson<RememberResult>([
    'remember',
    args.fact,
    '--provenance',
    args.provenance,
    '--entity',
    args.entity ?? SUBJECT_ENTITY,
    '--kind',
    args.kind ?? 'fact',
  ]);
}

/**
 * Withdraw a fact. GBrain expires with an audit trail rather than deleting,
 * so a withdrawal is itself a recorded act — which is the honest shape for
 * "you can take it back".
 */
export async function forget(id: string, reason: string): Promise<{ id: string; expired: boolean }> {
  return gbrainJson<{ id: string; expired: boolean }>(['forget', id, '--reason', reason]);
}

/** Write (or replace) a canonical Markdown page. Provenance rides along. */
export async function putPage(args: {
  slug: string;
  markdown: string;
  sourceUri: string;
  force?: boolean;
}): Promise<void> {
  const flags = [
    'put',
    args.slug,
    '--source-kind',
    'put_page',
    '--source-uri',
    args.sourceUri,
    '--ingested-via',
    'next-mission:zero-retention-pipeline',
  ];
  if (args.force) flags.push('--force');
  await gbrain(flags, args.markdown);
}

export async function getPage(slug: string): Promise<string | null> {
  try {
    return await gbrain(['get', slug]);
  } catch {
    return null;
  }
}

export interface RecalledFact {
  id: number;
  fact: string;
  kind: string;
  source: string | null;
  expired_at: string | null;
}

export async function recall(entity = SUBJECT_ENTITY): Promise<RecalledFact[]> {
  const res = await gbrainJson<{ facts?: RecalledFact[] }>(['recall', entity]);
  return res.facts ?? [];
}
