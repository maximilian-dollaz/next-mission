/**
 * Stripe MPP — metered talk time, settled on the decision brief.
 *
 * Pricing (idea F1, settled):
 *   Talk time meters in sub-cent increments while the conversation runs.
 *   The decision brief is the settlement event — that is the request an
 *   agent actually pays for, and the amount is the talk time it accrued.
 *
 * Why metering and settlement are separate: Stripe's own floors. Shared
 * Payment Tokens settle at a 0.50 USD minimum and stablecoin at 0.01 USDC,
 * so a sub-cent increment cannot be an individual on-wire settlement today.
 * The meter is therefore sub-cent and the settlement is batched onto the
 * brief, which is also the moment the agent receives something of value.
 *
 * Shape follows https://docs.stripe.com/payments/machine/mpp/quickstart.
 */

import crypto from 'node:crypto';
import StripeClient from 'stripe';
import { Mppx, stripe } from 'mppx/server';
import { env, missing, MissingConfigError, optionalRaw } from '../env.js';

/** USD per second of talk time. 0.004 = 0.4 cents per second. */
export function talkRateUsdPerSecond(): number {
  return Number(env.mppPerSecondUsd());
}

/**
 * Stripe's Shared Payment Token floor. An MPP charge cannot be issued below
 * this over SPT, so settlement is clamped up to it.
 */
export const SPT_MINIMUM_USD = 0.5;

/** Stablecoin (Tempo/USDC) floor, available once a deposit address is set. */
export const STABLECOIN_MINIMUM_USD = 0.01;

/** Format a USD amount the way MPP wants it: a decimal string. */
export function usd(amount: number): string {
  return amount.toFixed(2);
}

/** Sub-cent precision, for the meter and for receipt rows. */
export function usdPrecise(amount: number): string {
  return amount.toFixed(6);
}

/** What the meter has accrued for `seconds` of talk time, before clamping. */
export function accruedUsd(seconds: number): number {
  return Math.max(0, seconds) * talkRateUsdPerSecond();
}

/**
 * What the agent is actually charged at settlement: the accrued talk time,
 * clamped up to the lowest amount MPP can settle.
 */
export function settlementUsd(seconds: number): {
  amount: string;
  accrued: string;
  seconds: number;
  clamped: boolean;
  floor: number;
} {
  const accrued = accruedUsd(seconds);
  const floor = stablecoinEnabled() ? STABLECOIN_MINIMUM_USD : SPT_MINIMUM_USD;
  const charged = Math.max(accrued, floor);
  return {
    amount: usd(charged),
    accrued: usdPrecise(accrued),
    seconds: Math.max(0, Math.round(seconds)),
    clamped: charged > accrued,
    floor,
  };
}

/**
 * The flat price on `/paid`: the configured settlement price, never below the
 * Shared Payment Token floor, because that route offers SPT.
 */
export function flatSettlementUsd(): string {
  return usd(Math.max(Number(env.mppSettlementUsd()), SPT_MINIMUM_USD));
}

export function stablecoinEnabled(): boolean {
  return optionalRaw('TEMPO_DEPOSIT_ADDRESS') !== undefined;
}

/** True when Stripe MPP can run. Lets routes degrade instead of throwing. */
export function mppReady(): boolean {
  return missing('STRIPE_SECRET_KEY', 'STRIPE_PROFILE_ID').length === 0;
}

export function mppMissing(): string[] {
  return missing('STRIPE_SECRET_KEY', 'STRIPE_PROFILE_ID');
}

export type MppxInstance = ReturnType<typeof build>;

let cached: MppxInstance | null = null;

function build() {
  const secretKey = env.stripeSecretKey();
  const profileId = env.stripeProfileId();
  const depositAddress = env.tempoDepositAddress();

  // Binds challenges to their contents so the server can verify that an
  // incoming credential matches a challenge it actually issued.
  // https://mpp.dev/protocol/challenges#challenge-binding
  const mppSecretKey = crypto
    .createHmac('sha256', secretKey)
    .update('mpp-challenge-signing')
    .digest('base64');

  const stripeClient = new StripeClient(secretKey);

  const stripeMachinePayments = stripe.create({
    client: stripeClient,
    networkId: profileId,
    livemode: !secretKey.includes('_test_'),
    // Adding Tempo here makes defaultMethods() offer stablecoin alongside
    // SPT at the same amount, with no other change to the handlers.
    ...(depositAddress ? { depositAddresses: { tempo: depositAddress } } : {}),
  });

  const mppx = Mppx.create({
    methods: stripeMachinePayments.defaultMethods(),
    secretKey: mppSecretKey,
  });

  return mppx;
}

/**
 * The MPP handler. Throws MissingConfigError (503) with a readable message
 * if the Stripe keys are not in .env yet.
 */
export function getMppx(): MppxInstance {
  if (cached) return cached;
  const gaps = mppMissing();
  if (gaps.length > 0) {
    throw new MissingConfigError(
      'Stripe MPP',
      gaps,
      'Use a sandbox key and run `npm run mpp:profile` for the profile id.'
    );
  }
  cached = build();
  return cached;
}

export function livemode(): boolean {
  const key = optionalRaw('STRIPE_SECRET_KEY');
  return key !== undefined && !key.includes('_test_');
}

/** A compact description of the pricing model, for /mpp/pricing and the UI. */
export function pricingSummary() {
  const rate = talkRateUsdPerSecond();
  return {
    model: 'metered talk time, settled on the decision brief',
    meter: {
      unit: 'second of talk time',
      usd_per_second: usdPrecise(rate),
      usd_per_minute: usd(rate * 60),
      increment_note: 'sub-cent per second; accrues continuously during the call',
    },
    settlement: {
      event: 'the decision brief',
      usd: 'accrued talk time, clamped up to the method minimum',
      spt_minimum_usd: usd(SPT_MINIMUM_USD),
      stablecoin_minimum_usd: usdPrecise(STABLECOIN_MINIMUM_USD),
      stablecoin_enabled: stablecoinEnabled(),
    },
    methods: stablecoinEnabled()
      ? ['stripe shared payment tokens (card)', 'stablecoin via tempo (usdc)']
      : ['stripe shared payment tokens (card)'],
    livemode: livemode(),
  };
}
