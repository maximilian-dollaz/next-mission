#!/usr/bin/env tsx
/**
 * Get a Tempo crypto deposit address — the stablecoin (USDC) leg of MPP.
 *
 *   npm run mpp:deposit
 *
 * Reuses an existing address if the account already has one, and creates one
 * otherwise. Copy the printed address into TEMPO_DEPOSIT_ADDRESS in .env.
 *
 * This is the second leg: get Shared Payment Tokens green first.
 */

import { optionalRaw } from '../src/env.js';

const API_VERSION = '2026-07-29.preview';
const ENDPOINT = 'https://api.stripe.com/v1/crypto/deposit_addresses';

type Address = { address?: string; network?: string; id?: string };

async function call(key: string, method: 'GET' | 'POST'): Promise<Response> {
  const url = method === 'GET' ? `${ENDPOINT}?network=tempo` : ENDPOINT;
  return fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Stripe-Version': API_VERSION,
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    ...(method === 'POST' ? { body: new URLSearchParams({ network: 'tempo' }) } : {}),
  });
}

async function main() {
  const key = optionalRaw('STRIPE_SECRET_KEY');
  if (!key) {
    console.error('STRIPE_SECRET_KEY is not set in .env. Use a sandbox key (sk_test_...).');
    process.exit(1);
  }

  // Prefer an address the account already has — creating these is cheap but
  // the docs recommend keeping the call off the request path.
  const existing = await call(key, 'GET');
  if (existing.ok) {
    const body = (await existing.json()) as { data?: Address[] };
    const found = body.data?.find((a) => a.address);
    if (found?.address) {
      console.log(found.address);
      console.error(`\nReusing an existing Tempo address. Add to .env:\n  TEMPO_DEPOSIT_ADDRESS=${found.address}`);
      return;
    }
  }

  const created = await call(key, 'POST');
  const text = await created.text();
  if (!created.ok) {
    console.error(`Stripe returned ${created.status}:`);
    console.error(text);
    console.error(
      '\nStablecoin payments may not be enabled on this account. This is the optional\n' +
        'second leg of MPP — Shared Payment Tokens work without it.'
    );
    process.exit(1);
  }

  const address = (JSON.parse(text) as Address).address;
  if (!address) {
    console.error('No `address` in the response:');
    console.error(text);
    process.exit(1);
  }

  console.log(address);
  console.error(`\nAdd this to .env:\n  TEMPO_DEPOSIT_ADDRESS=${address}`);
  console.error(
    key.includes('_test_')
      ? '  (sandbox key — mppx configures Tempo testnet automatically)'
      : '  (LIVE key — this address moves real funds)'
  );
}

main().catch((err: unknown) => {
  console.error((err as Error).message);
  process.exit(1);
});
