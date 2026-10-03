#!/usr/bin/env tsx
/**
 * Fetch and print the Stripe business profile id — the `networkId` MPP needs.
 *
 *   npm run mpp:profile
 *
 * Copy the printed `profile_...` into STRIPE_PROFILE_ID in .env.
 */

import { optionalRaw } from '../src/env.js';

const API_VERSION = '2026-07-29.preview';

async function main() {
  const key = optionalRaw('STRIPE_SECRET_KEY');
  if (!key) {
    console.error('STRIPE_SECRET_KEY is not set in .env. Use a sandbox key (sk_test_...).');
    process.exit(1);
  }

  const res = await fetch('https://api.stripe.com/v2/network/business_profiles/me', {
    headers: {
      Authorization: `Bearer ${key}`,
      'Stripe-Version': API_VERSION,
    },
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`Stripe returned ${res.status}:`);
    console.error(text);
    console.error(
      '\nIf this is a 404 or "no business profile", create one in the Stripe Dashboard first:\n' +
        '  https://docs.stripe.com/get-started/account/profile'
    );
    process.exit(1);
  }

  const profile = JSON.parse(text) as { id?: string };
  if (!profile.id) {
    console.error('No `id` in the response:');
    console.error(text);
    process.exit(1);
  }

  console.log(profile.id);
  console.error(`\nAdd this to .env:\n  STRIPE_PROFILE_ID=${profile.id}`);
  console.error(`  (livemode would be ${!key.includes('_test_')})`);
}

main().catch((err: unknown) => {
  console.error((err as Error).message);
  process.exit(1);
});
