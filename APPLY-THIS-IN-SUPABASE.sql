-- Next Mission v2 — the whole schema, in one paste.
-- Supabase dashboard → SQL Editor → New query → paste → Run.
-- Both migrations, in order. Nothing in the database yet, so this is a clean run.

-- ════════ 1/2  20261003120000_init_context_library.sql ════════

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

-- ════════ 2/2  20261003160000_front_door.sql ════════

-- ─────────────────────────────────────────────────────────────
-- Next Mission v2 — the front door
--
-- The phone number is the identity. There is no password, no account
-- and no app: you type your number once, the contact lands on your
-- phone, and from then on caller ID is the login.
--
-- This migration adds the three things that makes that true:
--
--   users                     one row per E.164 number — the natural key
--   provision_user(text)      the one provisioning entry point, idempotent
--   webhook_deliveries        every inbound payload, landed before it is read
--
-- It does not introduce a second context library. The library from
-- 20261003120000_init_context_library.sql is keyed by `subject_id`, and a
-- provisioned user's subject_id IS their E.164 number — so sessions, turns,
-- context_items and decisions all hang off the phone without a new schema.
-- ─────────────────────────────────────────────────────────────

-- ── users ────────────────────────────────────────────────────
--
-- phone is the primary key, in E.164, checked. subject_id is the same
-- string, stored separately so the join to the context library reads as a
-- join and not as a coincidence.

create table if not exists users (
  phone              text primary key
                       check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  tenant             tenant_id not null default 'demo',
  subject_id         text not null unique,
  stripe_customer_id text,
  source             text not null default 'signup',
  created_at         timestamptz not null default now(),
  last_seen_at       timestamptz not null default now(),
  call_count         integer not null default 0 check (call_count >= 0),
  total_seconds      integer not null default 0 check (total_seconds >= 0),
  metadata           jsonb not null default '{}'::jsonb
);

create index if not exists users_subject_idx on users (subject_id);

-- ── calls — one row per completed call, the usage ledger ─────
--
-- `call_id` is the provider's id and is unique, so a webhook replay
-- updates the row it already wrote instead of double-billing.

create table if not exists calls (
  id                uuid primary key default gen_random_uuid(),
  call_id           text not null unique,
  phone             text references users (phone) on delete set null,
  from_number       text,
  to_number         text,
  session_id        uuid references sessions (id) on delete set null,
  started_at        timestamptz,
  ended_at          timestamptz,
  duration_seconds  integer not null default 0 check (duration_seconds >= 0),
  disconnect_reason text,
  -- Stripe metering. `metered_at` is set only once the meter event is
  -- accepted, so an unmetered call is visible rather than assumed billed.
  metered_at        timestamptz,
  stripe_event_name text,
  created_at        timestamptz not null default now()
);

create index if not exists calls_phone_idx on calls (phone, created_at desc);
create index if not exists calls_unmetered_idx on calls (metered_at) where metered_at is null;

-- ── webhook_deliveries — the payload is landed before it is read ──
--
-- The agent runs with `data_storage_setting: "basic_attributes_only"`, so
-- the provider keeps no transcript and no recording: this payload is the
-- only copy that will ever exist. It is written here first, verbatim, and
-- only then processed. A processing bug therefore cannot lose a call —
-- `process_error is not null` is a replayable queue, not a dropped event.

create table if not exists webhook_deliveries (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null default 'retell',
  event_type    text,
  call_id       text,
  from_number   text,
  signature_ok  boolean not null default false,
  payload       jsonb not null,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  process_error text
);

create index if not exists webhook_deliveries_call_idx on webhook_deliveries (call_id);
create index if not exists webhook_deliveries_unprocessed_idx
  on webhook_deliveries (received_at) where processed_at is null;

-- ─────────────────────────────────────────────────────────────
-- provision_user — "the database is created on their behalf"
--
-- The single provisioning entry point, called on signup and again on the
-- first call from an unknown number. Idempotent by primary key: signing up
-- twice, or calling before signing up, converges on the same one row.
--
-- security definer so it can own the users row while RLS keeps every other
-- role out of rows that are not theirs.
-- ─────────────────────────────────────────────────────────────

create or replace function provision_user(
  p_phone  text,
  p_source text default 'signup'
)
returns users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user users;
begin
  if p_phone is null or p_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'phone % is not E.164', coalesce(p_phone, '(null)')
      using errcode = 'invalid_parameter_value';
  end if;

  insert into users (phone, subject_id, source)
       values (p_phone, p_phone, coalesce(p_source, 'signup'))
  on conflict (phone) do update
      set last_seen_at = now()
  returning * into v_user;

  return v_user;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- record_call — caller ID is the login
--
-- Matches `from_number` to a user, provisioning one if we have never seen
-- it, then writes the call. Returns the call row plus whether the user was
-- created just now, so the webhook can say which happened.
--
-- Upsert on call_id: a replayed webhook refreshes the row and never adds
-- a second billable call.
-- ─────────────────────────────────────────────────────────────

create or replace function record_call(
  p_call_id     text,
  p_from_number text,
  p_to_number   text default null,
  p_seconds     integer default 0,
  p_started_at  timestamptz default null,
  p_ended_at    timestamptz default null,
  p_reason      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing boolean := true;  -- withheld caller ID: nobody to create
  v_phone    text;             -- kept separate from v_user, which may be NULL
  v_user     users;
  v_call     calls;
begin
  if p_call_id is null or p_call_id = '' then
    raise exception 'call_id is required' using errcode = 'invalid_parameter_value';
  end if;

  -- An unknown caller is provisioned on the fly. The flow must never fail
  -- because someone called before signing up.
  if p_from_number ~ '^\+[1-9][0-9]{7,14}$' then
    select exists (select 1 from users where phone = p_from_number) into v_existing;
    v_user  := provision_user(p_from_number, 'caller_id');
    v_phone := p_from_number;
  end if;

  insert into calls (
    call_id, phone, from_number, to_number,
    duration_seconds, started_at, ended_at, disconnect_reason
  ) values (
    p_call_id, v_phone, p_from_number, p_to_number,
    greatest(coalesce(p_seconds, 0), 0), p_started_at, p_ended_at, p_reason
  )
  on conflict (call_id) do update set
    phone             = coalesce(excluded.phone, calls.phone),
    from_number       = coalesce(excluded.from_number, calls.from_number),
    to_number         = coalesce(excluded.to_number, calls.to_number),
    duration_seconds  = greatest(calls.duration_seconds, excluded.duration_seconds),
    started_at        = coalesce(excluded.started_at, calls.started_at),
    ended_at          = coalesce(excluded.ended_at, calls.ended_at),
    disconnect_reason = coalesce(excluded.disconnect_reason, calls.disconnect_reason)
  returning * into v_call;

  -- Roll the user's totals from the ledger rather than incrementing, so a
  -- replay cannot inflate them.
  if v_phone is not null then
    update users u
       set call_count    = agg.n,
           total_seconds = agg.secs,
           last_seen_at  = now()
      from (
        select count(*)::int as n, coalesce(sum(duration_seconds), 0)::int as secs
          from calls where phone = v_phone
      ) agg
     where u.phone = v_phone
    returning u.* into v_user;
  end if;

  return jsonb_build_object(
    'call',         to_jsonb(v_call),
    'user',         to_jsonb(v_user),
    'user_created', not v_existing
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- RLS — one user's rows are unreachable by any other
--
-- Every server path in this app uses the service-role key, which bypasses
-- RLS by design. These policies are what stands between a leaked anon key
-- and someone else's library: with no `request.subject` set, the
-- expressions below are NULL, no row matches, and nothing is readable.
--
-- `demo-subject` stays open because it is the seeded fixture subject, not
-- a person. Every provisioned user's subject_id is their E.164 number and
-- is therefore visible only to a request that already proves that number.
-- ─────────────────────────────────────────────────────────────

alter table users              enable row level security;
alter table calls              enable row level security;
alter table webhook_deliveries enable row level security;

-- The raw payloads and the billing ledger are service-role only. No
-- policy for anon/authenticated means no row, for any query.
revoke all on webhook_deliveries from anon, authenticated;

drop policy if exists users_self on users;
create policy users_self on users
  for all to anon, authenticated
  using      (phone = nullif(current_setting('request.subject', true), ''))
  with check (phone = nullif(current_setting('request.subject', true), ''));

drop policy if exists calls_self on calls;
create policy calls_self on calls
  for all to anon, authenticated
  using      (phone = nullif(current_setting('request.subject', true), ''))
  with check (phone = nullif(current_setting('request.subject', true), ''));

-- Narrow the context library from "any demo row" to "your rows, or the
-- fixture subject". A phone-keyed subject is now isolated per number.
do $$
declare
  t text;
begin
  foreach t in array array['sessions', 'context_items', 'decisions']
  loop
    execute format('drop policy if exists demo_tenant_all on %I', t);
    execute format($f$
      create policy subject_self on %I
        for all to anon, authenticated
        using      (tenant = 'demo' and (subject_id = nullif(current_setting('request.subject', true), '')
                                         or subject_id = 'demo-subject'))
        with check (tenant = 'demo' and (subject_id = nullif(current_setting('request.subject', true), '')
                                         or subject_id = 'demo-subject'))
    $f$, t);
  end loop;
end;
$$;

-- turns inherit their session's subject.
drop policy if exists demo_tenant_all on turns;
drop policy if exists subject_self on turns;
create policy subject_self on turns
  for all to anon, authenticated
  using (exists (
    select 1 from sessions s
     where s.id = session_id and s.tenant = 'demo'
       and (s.subject_id = nullif(current_setting('request.subject', true), '')
            or s.subject_id = 'demo-subject')))
  with check (exists (
    select 1 from sessions s
     where s.id = session_id and s.tenant = 'demo'
       and (s.subject_id = nullif(current_setting('request.subject', true), '')
            or s.subject_id = 'demo-subject')));

-- receipts hang off a session; same inheritance, and a session-less
-- receipt (the flat /paid route) stays readable.
drop policy if exists demo_tenant_all on receipts;
drop policy if exists subject_self on receipts;
create policy subject_self on receipts
  for all to anon, authenticated
  using (session_id is null or exists (
    select 1 from sessions s
     where s.id = session_id
       and (s.subject_id = nullif(current_setting('request.subject', true), '')
            or s.subject_id = 'demo-subject')))
  with check (session_id is null or exists (
    select 1 from sessions s
     where s.id = session_id
       and (s.subject_id = nullif(current_setting('request.subject', true), '')
            or s.subject_id = 'demo-subject')));

-- Provisioning is called by the server, never by a browser.
-- EXECUTE is granted to PUBLIC on every new function, so revoking it from
-- anon and authenticated alone would leave it reachable. Revoke PUBLIC, then
-- grant it back to service_role only.
revoke all on function provision_user(text, text) from public, anon, authenticated;
revoke all on function record_call(text, text, text, integer, timestamptz, timestamptz, text)
  from public, anon, authenticated;
grant execute on function provision_user(text, text) to service_role;
grant execute on function record_call(text, text, text, integer, timestamptz, timestamptz, text)
  to service_role;
