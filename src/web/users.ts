/**
 * Provisioning — "a database is created on their behalf".
 *
 * One Supabase project, one isolated store per phone number. The honest
 * version of the claim: a `users` row keyed by E.164, a `subject_id` equal
 * to that number, and RLS policies that make another number's rows
 * unreachable (see supabase/migrations/20261003160000_front_door.sql).
 *
 * The context library itself is chat 06's GBrain schema, keyed by
 * `subject_id`. We do not define a second one — provisioning sets up the
 * key that schema already hangs off.
 *
 * `provision_user` and `record_call` are database functions, so signing up
 * twice and calling before signing up both converge on one row without any
 * read-modify-write race in application code.
 */

import { db, dbReady } from '../db/client.js';
import { createCustomer, billingReady } from '../billing/index.js';

export { dbReady };

export interface User {
  phone: string;
  subject_id: string;
  stripe_customer_id: string | null;
  source: string;
  created_at: string;
  last_seen_at: string;
  call_count: number;
  total_seconds: number;
}

/** Create (or find) this number's library. Idempotent. */
export async function provisionUser(phone: string, source = 'signup'): Promise<User> {
  const { data, error } = await db().rpc('provision_user', { p_phone: phone, p_source: source });
  if (error) throw new Error(`provision_user failed: ${error.message}`);
  // The function returns a single composite row; supabase-js may hand it
  // back bare or wrapped in a one-element array depending on the shape.
  const row = (Array.isArray(data) ? data[0] : data) as User | undefined;
  if (!row) throw new Error('provision_user returned no row');
  return row;
}

export async function getUser(phone: string): Promise<User | null> {
  const { data, error } = await db().from('users').select().eq('phone', phone).maybeSingle();
  if (error) throw new Error(`getUser failed: ${error.message}`);
  return (data as User) ?? null;
}

/**
 * Attach a Stripe customer, once. A failure here must never fail a signup:
 * the identity and the library are the product, billing is downstream of
 * them. It returns null and says nothing to the user.
 */
export async function ensureStripeCustomer(user: User): Promise<string | null> {
  if (user.stripe_customer_id) return user.stripe_customer_id;
  if (!billingReady()) return null;

  try {
    const customerId = await createCustomer(user.phone);
    const { error } = await db()
      .from('users')
      .update({ stripe_customer_id: customerId })
      .eq('phone', user.phone)
      // Only claim the slot if it is still empty, so two concurrent
      // signups cannot overwrite each other's customer.
      .is('stripe_customer_id', null);
    if (error) throw new Error(error.message);
    return customerId;
  } catch (err) {
    console.error('[billing] could not attach a Stripe customer:', (err as Error).message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Caller ID is the login
// ─────────────────────────────────────────────────────────────

export interface RecordedCall {
  call: {
    id: string;
    call_id: string;
    phone: string | null;
    duration_seconds: number;
    metered_at: string | null;
  };
  user: User | null;
  user_created: boolean;
}

/**
 * Match a caller to their library and write the call. An unknown number is
 * provisioned here, on the fly — a first-time caller who never visited the
 * page still gets a library and still gets recognised next time.
 */
export async function recordCall(args: {
  callId: string;
  fromNumber: string | null;
  toNumber?: string | null;
  seconds?: number;
  startedAt?: string | null;
  endedAt?: string | null;
  reason?: string | null;
}): Promise<RecordedCall> {
  const { data, error } = await db().rpc('record_call', {
    p_call_id: args.callId,
    p_from_number: args.fromNumber,
    p_to_number: args.toNumber ?? null,
    p_seconds: Math.max(0, Math.round(args.seconds ?? 0)),
    p_started_at: args.startedAt ?? null,
    p_ended_at: args.endedAt ?? null,
    p_reason: args.reason ?? null,
  });
  if (error) throw new Error(`record_call failed: ${error.message}`);
  return data as RecordedCall;
}

/** Mark a call as metered, with the meter event name that carried it. */
export async function markMetered(callId: string, eventName: string): Promise<void> {
  const { error } = await db()
    .from('calls')
    .update({ metered_at: new Date().toISOString(), stripe_event_name: eventName })
    .eq('call_id', callId);
  if (error) throw new Error(`markMetered failed: ${error.message}`);
}

// ─────────────────────────────────────────────────────────────
// The payload lands before it is read
// ─────────────────────────────────────────────────────────────

/**
 * Write the raw webhook body down first, verbatim, before anything tries to
 * interpret it. The agent keeps no transcript and no recording, so this row
 * is the only copy that will ever exist — a bug in the processing path must
 * not be able to lose it.
 */
export async function landDelivery(args: {
  provider?: string;
  eventType: string | null;
  callId: string | null;
  fromNumber: string | null;
  signatureOk: boolean;
  payload: unknown;
}): Promise<string | null> {
  try {
    const { data, error } = await db()
      .from('webhook_deliveries')
      .insert({
        provider: args.provider ?? 'retell',
        event_type: args.eventType,
        call_id: args.callId,
        from_number: args.fromNumber,
        signature_ok: args.signatureOk,
        payload: args.payload ?? {},
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return (data as { id: string }).id;
  } catch (err) {
    // Loud, and the handler still runs. A landing failure is bad; refusing
    // the call because of it would be worse.
    console.error('[webhook] COULD NOT LAND PAYLOAD:', (err as Error).message);
    console.error('[webhook] payload follows so it exists somewhere:');
    console.error(JSON.stringify(args.payload));
    return null;
  }
}

export async function closeDelivery(id: string | null, errorMessage?: string): Promise<void> {
  if (!id) return;
  await db()
    .from('webhook_deliveries')
    .update({
      processed_at: new Date().toISOString(),
      process_error: errorMessage ?? null,
    })
    .eq('id', id);
}
