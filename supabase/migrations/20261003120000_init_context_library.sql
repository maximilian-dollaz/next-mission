-- ─────────────────────────────────────────────────────────────
-- Next Mission v2 — the context library
--
-- One demo tenant. RLS on. Two load-bearing operations are real
-- callable database functions, not application conveniences:
--
--   destroy_session(uuid)  -- the raw transcript is gone; kept context survives
--   export_library(text)   -- one call, one person's whole library as JSON
-- ─────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- The single demo tenant. Not multi-tenancy — a seam, so that adding
-- real tenants later is a policy change and not a migration.
create domain tenant_id as text
  check (value = 'demo');

create type session_status as enum ('active', 'completed', 'abandoned', 'destroyed');
create type session_phase  as enum ('opening', 'framing', 'exploring', 'converging', 'committed', 'dispatched');
create type speaker        as enum ('human', 'agent');
create type context_kind   as enum ('theme', 'person', 'commitment', 'constraint', 'prior_decision');
create type receipt_cadence as enum ('stream', 'settlement');

-- ── sessions ─────────────────────────────────────────────────

create table sessions (
  id               uuid primary key default gen_random_uuid(),
  tenant           tenant_id not null default 'demo',
  subject_id       text not null default 'demo-subject',
  status           session_status not null default 'active',
  phase            session_phase not null default 'opening',
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

create index sessions_subject_idx on sessions (subject_id, started_at desc);

-- ── turns — the raw transcript, and the thing destroy-on-exit removes ──

create table turns (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  seq        integer not null,
  speaker    speaker not null,
  text       text not null,
  offset_ms  integer,
  spoken_at  timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (session_id, seq)
);

create index turns_session_seq_idx on turns (session_id, seq);

-- seq is assigned by the database so callers never have to count.
create or replace function assign_turn_seq()
returns trigger
language plpgsql
as $$
begin
  if new.seq is null then
    select coalesce(max(seq), 0) + 1 into new.seq
      from turns where session_id = new.session_id;
  end if;
  return new;
end;
$$;

create trigger turns_assign_seq
  before insert on turns
  for each row execute function assign_turn_seq();

-- ── context_items — the durable library ──────────────────────
--
-- turn_id is ON DELETE SET NULL on purpose: destroying the transcript
-- severs the source reference automatically. source_quote is a copy,
-- so a kept item still carries the person's own words afterwards.

create table context_items (
  id           uuid primary key default gen_random_uuid(),
  tenant       tenant_id not null default 'demo',
  subject_id   text not null default 'demo-subject',
  session_id   uuid references sessions (id) on delete set null,
  kind         context_kind not null,
  label        text not null,
  body         text not null,
  turn_id      uuid references turns (id) on delete set null,
  source_quote text,
  confidence   real not null default 0.5 check (confidence between 0 and 1),
  kept         boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index context_items_subject_idx on context_items (subject_id, created_at desc);
create index context_items_session_idx on context_items (session_id);
create index context_items_kept_idx    on context_items (subject_id, kept);

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger context_items_touch
  before update on context_items
  for each row execute function touch_updated_at();

-- ── decisions — the output artifact. Never destroyed. ────────

create table decisions (
  id              uuid primary key default gen_random_uuid(),
  tenant          tenant_id not null default 'demo',
  subject_id      text not null default 'demo-subject',
  session_id      uuid references sessions (id) on delete set null,
  statement       text not null,
  next_action     text not null,
  reasoning       text not null default '',
  next_steps      jsonb not null default '[]'::jsonb,
  conviction      real not null default 0.5 check (conviction between 0 and 1),
  dispatch_target text,
  dispatched_at   timestamptz,
  created_at      timestamptz not null default now()
);

create index decisions_subject_idx on decisions (subject_id, created_at desc);
create index decisions_session_idx on decisions (session_id);

-- ── receipts — MPP payments ──────────────────────────────────
--
-- amount_usd is numeric(12,6): talk time streams in sub-cent increments,
-- so two decimal places would round the whole pricing model away.

create table receipts (
  id               uuid primary key default gen_random_uuid(),
  tenant           tenant_id not null default 'demo',
  session_id       uuid references sessions (id) on delete set null,
  cadence          receipt_cadence not null,
  amount_usd       numeric(12, 6) not null check (amount_usd >= 0),
  currency         text not null default 'usd',
  payer            text,
  payment_method   text,
  stripe_reference text,
  billed_seconds   integer,
  livemode         boolean not null default false,
  raw              jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

create index receipts_session_idx on receipts (session_id, created_at);
create index receipts_cadence_idx on receipts (cadence, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- Destroy-on-exit
--
-- A real operation. After it runs, the raw transcript does not exist in
-- this database. What survives is exactly what the person chose to keep,
-- plus their decisions, which are their own output.
-- ─────────────────────────────────────────────────────────────

create or replace function destroy_session(p_session_id uuid)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_turns      integer;
  v_discarded  integer;
  v_kept       integer;
  v_decisions  integer;
  v_now        timestamptz := now();
begin
  if not exists (select 1 from sessions where id = p_session_id) then
    raise exception 'session % not found', p_session_id using errcode = 'no_data_found';
  end if;

  -- Unkept context items go with the transcript: the person did not
  -- choose to keep them, so they are not theirs to retain.
  delete from context_items
   where session_id = p_session_id and kept = false;
  get diagnostics v_discarded = row_count;

  -- The transcript itself. ON DELETE SET NULL on context_items.turn_id
  -- severs the source reference as a side effect of this delete.
  delete from turns where session_id = p_session_id;
  get diagnostics v_turns = row_count;

  select count(*) into v_kept
    from context_items where session_id = p_session_id and kept = true;

  select count(*) into v_decisions
    from decisions where session_id = p_session_id;

  update sessions
     set status   = 'destroyed',
         ended_at = coalesce(ended_at, v_now),
         metadata = metadata || jsonb_build_object('destroyed_at', v_now)
   where id = p_session_id;

  return jsonb_build_object(
    'session_id',               p_session_id,
    'turns_destroyed',          v_turns,
    'context_items_kept',       v_kept,
    'context_items_discarded',  v_discarded,
    'decisions_retained',       v_decisions,
    'destroyed_at',             v_now
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Export — one call, the whole library, portable JSON
-- ─────────────────────────────────────────────────────────────

create or replace function export_library(p_subject_id text default 'demo-subject')
returns jsonb
language sql
security invoker
stable
as $$
  with s as (
    select se.*,
           coalesce(
             (select jsonb_agg(to_jsonb(t) order by t.seq)
                from turns t where t.session_id = se.id),
             '[]'::jsonb
           ) as turns
      from sessions se
     where se.subject_id = p_subject_id
     order by se.started_at
  ),
  ci as (select * from context_items where subject_id = p_subject_id order by created_at),
  d  as (select * from decisions      where subject_id = p_subject_id order by created_at),
  r  as (
    select rc.* from receipts rc
      left join sessions se on se.id = rc.session_id
     where se.subject_id = p_subject_id or rc.session_id is null
     order by rc.created_at
  )
  select jsonb_build_object(
    'format',        'next-mission.library',
    'version',       1,
    'exported_at',   now(),
    'subject_id',    p_subject_id,
    'sessions',      coalesce((select jsonb_agg(to_jsonb(s)) from s), '[]'::jsonb),
    'context_items', coalesce((select jsonb_agg(to_jsonb(ci)) from ci), '[]'::jsonb),
    'decisions',     coalesce((select jsonb_agg(to_jsonb(d)) from d), '[]'::jsonb),
    'receipts',      coalesce((select jsonb_agg(to_jsonb(r)) from r), '[]'::jsonb),
    'counts',        jsonb_build_object(
      'sessions',      (select count(*) from s),
      'turns',         (select coalesce(sum(jsonb_array_length(turns)), 0) from s),
      'context_items', (select count(*) from ci),
      'decisions',     (select count(*) from d),
      'receipts',      (select count(*) from r)
    )
  );
$$;

-- ─────────────────────────────────────────────────────────────
-- RLS
--
-- One demo tenant. Every table is readable and writable for rows in it.
-- The service-role key bypasses RLS and is server-only; the anon key gets
-- exactly the demo tenant and nothing else.
-- ─────────────────────────────────────────────────────────────

alter table sessions      enable row level security;
alter table turns         enable row level security;
alter table context_items enable row level security;
alter table decisions     enable row level security;
alter table receipts      enable row level security;

create policy demo_tenant_all on sessions
  for all to anon, authenticated
  using (tenant = 'demo') with check (tenant = 'demo');

-- turns carry no tenant column of their own; they inherit their session's.
create policy demo_tenant_all on turns
  for all to anon, authenticated
  using (exists (select 1 from sessions s where s.id = session_id and s.tenant = 'demo'))
  with check (exists (select 1 from sessions s where s.id = session_id and s.tenant = 'demo'));

create policy demo_tenant_all on context_items
  for all to anon, authenticated
  using (tenant = 'demo') with check (tenant = 'demo');

create policy demo_tenant_all on decisions
  for all to anon, authenticated
  using (tenant = 'demo') with check (tenant = 'demo');

create policy demo_tenant_all on receipts
  for all to anon, authenticated
  using (tenant = 'demo') with check (tenant = 'demo');

grant execute on function destroy_session(uuid)  to anon, authenticated;
grant execute on function export_library(text)   to anon, authenticated;
