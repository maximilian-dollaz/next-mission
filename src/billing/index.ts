/**
 * Stripe — usage-based, charged by talk time.
 *
 * The model is Max's: free to add, paid only by the second you are actually
 * talking. So the billing primitive is a Stripe **Billing meter**, and a
 * call ending is a meter event.
 *
 * This is NOT the MPP rail in `src/mpp/`. MPP is the agent-to-agent payment
 * for the decision brief — a different payer (another agent), a different
 * event (settlement) and a different protocol (HTTP 402). Both can be true
 * at once: the human pays Stripe for talk time, their agent pays MPP for
 * the brief. They must never be reported as the same money.
 *
 * No card is collected on signup, deliberately: a card field would wreck
 * the one-tap flow. We create the customer, meter the real usage against
 * it, and show the running cost. Attaching a payment method is a separate,
 * later action.
 */

import Stripe from 'stripe';
import { missing, optional, optionalRaw } from '../env.js';
import { accruedUsd, talkRateUsdPerSecond, usd } from '../mpp/index.js';

/** The meter's event name. Stable — changing it orphans past usage. */
export const METER_EVENT_NAME = optional('STRIPE_METER_EVENT_NAME', 'next_mission_call_seconds');

let client: Stripe | null = null;

export function billingReady(): boolean {
  return missing('STRIPE_SECRET_KEY').length === 0;
}

function stripe(): Stripe {
  if (!client) {
    const key = optionalRaw('STRIPE_SECRET_KEY');
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
    client = new Stripe(key);
  }
  return client;
}

// ─────────────────────────────────────────────────────────────
// The meter
// ─────────────────────────────────────────────────────────────

export interface MeterInfo {
  id: string;
  event_name: string;
  status: string;
  created: boolean;
}

/**
 * Find or create the call-seconds meter. Idempotent by event name: Stripe
 * rejects a second meter on the same event, so we look first.
 */
export async function ensureMeter(): Promise<MeterInfo> {
  const s = stripe();
  const existing = await s.billing.meters.list({ limit: 100, status: 'active' });
  const found = existing.data.find((m) => m.event_name === METER_EVENT_NAME);
  if (found) {
    return { id: found.id, event_name: found.event_name, status: found.status, created: false };
  }

  const meter = await s.billing.meters.create({
    display_name: 'Next Mission call seconds',
    event_name: METER_EVENT_NAME,
    default_aggregation: { formula: 'sum' },
    customer_mapping: { type: 'by_id', event_payload_key: 'stripe_customer_id' },
    value_settings: { event_payload_key: 'value' },
  });
  return { id: meter.id, event_name: meter.event_name, status: meter.status, created: true };
}

// ─────────────────────────────────────────────────────────────
// The customer
// ─────────────────────────────────────────────────────────────

/**
 * One Stripe customer per phone number. The number goes in `name` and in
 * metadata so a human looking at the Stripe dashboard during the demo can
 * tell who is who — there is no email to show, by design.
 */
export async function createCustomer(phone: string): Promise<string> {
  const customer = await stripe().customers.create({
    name: phone,
    description: 'Next Mission — identified by phone number',
    metadata: { phone, product: 'next-mission', signup: new Date().toISOString() },
  });
  return customer.id;
}

// ─────────────────────────────────────────────────────────────
// Reporting usage
// ─────────────────────────────────────────────────────────────

export interface MeterReport {
  reported: boolean;
  seconds: number;
  identifier: string;
  reason?: string;
}

/**
 * Report one call's talk time.
 *
 * `identifier` is the call id, which makes this safe to call twice: Stripe
 * dedupes meter events by identifier, so a replayed webhook cannot bill a
 * caller for the same call again.
 */
export async function reportCallSeconds(args: {
  customerId: string;
  seconds: number;
  callId: string;
}): Promise<MeterReport> {
  const seconds = Math.max(0, Math.round(args.seconds));
  const identifier = `call_${args.callId}`;

  if (seconds === 0) {
    return { reported: false, seconds: 0, identifier, reason: 'zero-length call' };
  }

  await stripe().billing.meterEvents.create({
    event_name: METER_EVENT_NAME,
    identifier,
    payload: { stripe_customer_id: args.customerId, value: String(seconds) },
  });

  return { reported: true, seconds, identifier };
}

// ─────────────────────────────────────────────────────────────
// What the page shows
// ─────────────────────────────────────────────────────────────

/** `4m 12s` — minutes only when there are any. */
export function formatSeconds(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

/**
 * The running-cost line. Same rate as the MPP meter, so a caller and their
 * agent are never quoted two different prices for the same second.
 */
export function accruedLine(totalSeconds: number): string {
  if (totalSeconds <= 0) {
    return `Free to add. Talk time is ${usd(talkRateUsdPerSecond() * 60)} a minute.`;
  }
  return `You've used ${formatSeconds(totalSeconds)} — ${usd(accruedUsd(totalSeconds))}.`;
}
