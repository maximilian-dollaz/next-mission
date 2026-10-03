/**
 * Where a handoff lives between the call ending and the agent picking it up.
 *
 * Two backends, same interface:
 *
 *   Supabase  — one row per handoff, tasks as JSONB. The real one.
 *   file      — one JSON file per handoff under `.handoff/`. Used when
 *               Supabase is not configured or the table is absent, so the MCP
 *               server still answers and the demo still runs with no setup.
 *
 * The fallback is announced, never silent: `backend()` says which one is live
 * and `/mcp/info` reports it, because a judge being told "local files" is fine
 * and a judge discovering it is not.
 *
 * Apply `src/handoff/schema.sql` to get the Supabase backend. One table, no
 * migration ordering, nothing else in the project depends on it.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { db, dbReady } from '../db/client.js';
import { DEMO_TENANT } from '../types.js';
import { assertExecutable, type Handoff, type Task } from './types.js';

const TABLE = 'handoffs';

/** Set once Supabase has answered for real, so we only probe once. */
let supabaseUsable: boolean | null = null;
const mem = new Map<string, Handoff>();

export type Backend = 'supabase' | 'file';

export function backend(): Backend {
  return dbReady() && supabaseUsable !== false ? 'supabase' : 'file';
}

// ── the fallback: one JSON file per handoff, under .handoff/ ─────────
//
// Durable across processes and read-only on a serverless filesystem, which is
// the point: the CLI writes a handoff, the server serves it, and a judge
// connecting needs no database and no setup at all. Gitignored.

const DIR = process.env.HANDOFF_DIR ?? '.handoff';

function filePath(id: string): string {
  // Ids come from call ids and session ids; keep them to one path segment.
  return join(DIR, `${id.replace(/[^A-Za-z0-9._-]/g, '_')}.json`);
}

function writeFile(h: Handoff): void {
  try {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(filePath(h.id), JSON.stringify(h, null, 2));
  } catch (e) {
    // A read-only filesystem is expected on serverless; memory still holds it
    // for the life of the process.
    console.warn(`[handoff] could not write ${filePath(h.id)}: ${(e as Error).message}`);
  }
}

function readFromFile(id: string): Handoff | null {
  try {
    const p = filePath(id);
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, 'utf8')) as Handoff;
  } catch {
    return null;
  }
}

function readAllFiles(): Handoff[] {
  try {
    if (!existsSync(DIR)) return [];
    return readdirSync(DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        try {
          return JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Handoff;
        } catch {
          return null;
        }
      })
      .filter((h): h is Handoff => h !== null);
  } catch {
    return [];
  }
}

/** Mark Supabase unusable and say why. Called when the table is absent. */
function fallback(where: string, message: string): void {
  if (supabaseUsable === false) return;
  supabaseUsable = false;
  console.warn(
    `[handoff] ${where} failed against Supabase (${message}) — falling back to local files under .handoff/. ` +
      'Apply src/handoff/schema.sql for the durable backend.'
  );
}

function row(h: Handoff) {
  return {
    id: h.id,
    tenant: DEMO_TENANT,
    decision: h.decision,
    north_star: h.north_star,
    reasoning: h.reasoning,
    next_action: h.next_action,
    landed: h.landed,
    out_of_scope: h.out_of_scope,
    open_questions: h.open_questions,
    tasks: h.tasks,
    created_at: h.created_at,
    settled_at: h.settled_at,
    status: h.status,
    approved_at: h.approved_at,
  };
}

export async function putHandoff(h: Handoff): Promise<Handoff> {
  mem.set(h.id, h);
  writeFile(h);
  if (!dbReady() || supabaseUsable === false) return h;
  const { error } = await db().from(TABLE).upsert(row(h));
  if (error) {
    fallback('putHandoff', error.message);
    return h;
  }
  supabaseUsable = true;
  return h;
}

export async function getHandoff(id: string): Promise<Handoff | null> {
  if (dbReady() && supabaseUsable !== false) {
    const { data, error } = await db().from(TABLE).select().eq('id', id).maybeSingle();
    if (error) fallback('getHandoff', error.message);
    else {
      supabaseUsable = true;
      if (data) return data as Handoff;
    }
  }
  return mem.get(id) ?? readFromFile(id);
}

/**
 * The newest handoff, approved or not. For the approval screen only — never
 * for an agent. Agents go through `getApproved` / `latestApproved`.
 */
export async function latestHandoff(): Promise<Handoff | null> {
  if (dbReady() && supabaseUsable !== false) {
    const { data, error } = await db()
      .from(TABLE)
      .select()
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) fallback('latestHandoff', error.message);
    else {
      supabaseUsable = true;
      if (data) return data as Handoff;
    }
  }
  const byId = new Map(readAllFiles().map((h) => [h.id, h]));
  for (const h of mem.values()) byId.set(h.id, h); // memory is the fresher copy
  const all = [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return all[0] ?? null;
}

/**
 * Change one task, atomically enough for two agents on the same handoff.
 *
 * `mutate` returns the new task, or null to refuse — a refusal becomes a
 * readable error for the calling agent rather than a silent no-op. Supabase
 * does the read and the write in one request each; the compare-and-set on
 * `status` is what stops two agents claiming the same task.
 */
export async function updateTask(
  handoffId: string,
  taskId: string,
  mutate: (task: Task, all: Task[]) => Task | { refuse: string }
): Promise<{ handoff: Handoff; task: Task }> {
  const handoff = await getHandoff(handoffId);
  if (!handoff) throw new Error(`no handoff ${handoffId}`);

  const current = handoff.tasks.find((t) => t.id === taskId);
  if (!current) throw new Error(`handoff ${handoffId} has no task ${taskId}`);

  const next = mutate(current, handoff.tasks);
  if ('refuse' in next) throw new Error(next.refuse);

  const tasks = handoff.tasks.map((t) => (t.id === taskId ? next : t));
  const updated: Handoff = { ...handoff, tasks };

  mem.set(handoffId, updated);
  writeFile(updated);
  if (dbReady() && supabaseUsable !== false) {
    const { error } = await db().from(TABLE).update({ tasks }).eq('id', handoffId);
    if (error) fallback('updateTask', error.message);
  }
  return { handoff: updated, task: next };
}

/** Record that MPP settled this handoff. Chat 03 owns the rail; we own the flag. */
export async function markSettled(handoffId: string, at = new Date().toISOString()): Promise<void> {
  const handoff = await getHandoff(handoffId);
  if (!handoff) return;
  const settled = { ...handoff, settled_at: at };
  mem.set(handoffId, settled);
  writeFile(settled);
  if (dbReady() && supabaseUsable !== false) {
    const { error } = await db().from(TABLE).update({ settled_at: at }).eq('id', handoffId);
    if (error) fallback('markSettled', error.message);
  }
}

/** Test and demo seam. Does not touch Supabase or disk. */
export function seedMemory(h: Handoff): void {
  mem.set(h.id, h);
}

// ─────────────────────────────────────────────────────────────
// The approval gate
//
// Nothing reaches a connected agent unapproved. These two functions are the
// ONLY read path the MCP server uses, so "invisible until approved" is a
// property of the code rather than a flag someone has to remember to check.
// ─────────────────────────────────────────────────────────────

export async function getApproved(id: string): Promise<Handoff | null> {
  const h = await getHandoff(id);
  return h?.status === 'approved' ? h : null;
}

export async function latestApproved(): Promise<Handoff | null> {
  const h = await latestHandoff();
  if (h?.status === 'approved') return h;
  // The newest may be a draft while an older one is live; fall through.
  const all = [...mem.values(), ...readAllFiles()].filter((x) => x.status === 'approved');
  if (dbReady() && supabaseUsable !== false) {
    const { data, error } = await db()
      .from(TABLE)
      .select()
      .eq('status', 'approved')
      .order('approved_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) fallback('latestApproved', error.message);
    else if (data) return data as Handoff;
  }
  all.sort((a, b) => (b.approved_at ?? '').localeCompare(a.approved_at ?? ''));
  return all[0] ?? null;
}

/**
 * The human approved it. One way only: there is no unapprove, because an
 * agent may already have claimed work off it and retracting that silently is
 * worse than leaving it visible.
 */
export async function approve(id: string): Promise<Handoff> {
  const h = await getHandoff(id);
  if (!h) throw new Error(`no handoff ${id}`);
  if (h.status === 'approved') return h;
  // Edits happen before approval, so this is the last point anything is
  // checked. An unexecutable set must not become visible to an agent.
  assertExecutable(h.tasks);
  const approved: Handoff = {
    ...h,
    status: 'approved',
    approved_at: new Date().toISOString(),
  };
  await putHandoff(approved);
  return approved;
}

/**
 * Edit a task while the handoff is still a draft. This is what the approval
 * screen writes through: the human scans, edits, then approves.
 *
 * Refuses once approved — an agent may already be working off it.
 */
export async function editTask(
  handoffId: string,
  taskId: string,
  patch: Partial<Pick<Task, 'title' | 'detail' | 'owner' | 'why_owner' | 'done_when' | 'agent_done_when' | 'inputs_needed' | 'blocked_by'>>
): Promise<{ handoff: Handoff; task: Task }> {
  const h = await getHandoff(handoffId);
  if (!h) throw new Error(`no handoff ${handoffId}`);
  if (h.status === 'approved') {
    throw new Error(
      `handoff ${handoffId} is already approved — an agent may be working off it. Edits happen before approval.`
    );
  }
  const result = await updateTask(handoffId, taskId, (t) => ({ ...t, ...patch }));
  assertExecutable(result.handoff.tasks);
  return result;
}

/** Drop a task from a draft. The human cutting something they do not want. */
export async function dropTask(handoffId: string, taskId: string): Promise<Handoff> {
  const h = await getHandoff(handoffId);
  if (!h) throw new Error(`no handoff ${handoffId}`);
  if (h.status === 'approved') throw new Error(`handoff ${handoffId} is already approved`);
  const tasks = h.tasks
    .filter((t) => t.id !== taskId)
    .map((t) => ({ ...t, blocked_by: t.blocked_by.filter((d) => d !== taskId) }));
  assertExecutable(tasks);
  return putHandoff({ ...h, tasks });
}
