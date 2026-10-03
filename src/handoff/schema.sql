-- The handoff table. One row per decision handed to an agent.
--
-- Deliberately one table and no foreign keys: this is a projection of what a
-- call produced, not a second system of record. GBrain holds the library.
--
-- Apply with:  psql "$SUPABASE_DB_URL" -f src/handoff/schema.sql
-- Without it, src/handoff/store.ts runs in-memory and says so.

create table if not exists public.handoffs (
  id             text primary key,
  tenant         text        not null default 'demo',
  decision       text        not null,
  north_star     text        not null default '',
  reasoning      text        not null default '',
  next_action    text        not null default '',
  landed         boolean     not null default false,
  out_of_scope   jsonb       not null default '[]'::jsonb,
  open_questions jsonb       not null default '[]'::jsonb,
  -- The task set, including runtime status. Updated whole on every claim and
  -- completion; a handoff is small enough that a row rewrite is cheaper than
  -- a second table and a join.
  tasks          jsonb       not null default '[]'::jsonb,
  created_at     timestamptz not null default now(),
  -- Set when the MPP settlement receipt for this handoff exists.
  settled_at     timestamptz
);

create index if not exists handoffs_tenant_created_idx
  on public.handoffs (tenant, created_at desc);

-- The MCP server reads and writes as the service role, and there is one demo
-- tenant, so RLS is on with no public policy: nothing reaches this table on
-- the anon key.
alter table public.handoffs enable row level security;
