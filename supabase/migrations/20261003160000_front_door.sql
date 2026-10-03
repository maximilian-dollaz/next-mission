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
  v_existing boolean;
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
    v_user := provision_user(p_from_number, 'caller_id');
  else
    v_existing := true;  -- withheld / unparseable caller ID: no user to attach
  end if;

  insert into calls (
    call_id, phone, from_number, to_number,
    duration_seconds, started_at, ended_at, disconnect_reason
  ) values (
    p_call_id, v_user.phone, p_from_number, p_to_number,
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
  if v_user.phone is not null then
    update users u
       set call_count    = agg.n,
           total_seconds = agg.secs,
           last_seen_at  = now()
      from (
        select count(*)::int as n, coalesce(sum(duration_seconds), 0)::int as secs
          from calls where phone = v_user.phone
      ) agg
     where u.phone = v_user.phone
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
revoke all on function provision_user(text, text) from anon, authenticated;
revoke all on function record_call(text, text, text, integer, timestamptz, timestamptz, text)
  from anon, authenticated;
