/**
 * Environment access with clear failures.
 *
 * Nothing here throws at import time. A missing key surfaces as a readable
 * message at the moment it is actually needed, so a half-populated .env
 * still boots the server and still serves /health.
 */

/** Thrown when a feature is used before its key exists. Carries a 503. */
export class MissingConfigError extends Error {
  readonly status = 503;
  readonly keys: string[];
  constructor(feature: string, keys: string[], hint?: string) {
    super(
      `${feature} is not configured. Missing in .env: ${keys.join(', ')}.` +
        (hint ? ` ${hint}` : ' See .env.example.')
    );
    this.name = 'MissingConfigError';
    this.keys = keys;
  }
}

function read(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== '' ? v.trim() : undefined;
}

/** Which keys of a set are missing. Empty array means the feature is ready. */
export function missing(...names: string[]): string[] {
  return names.filter((n) => read(n) === undefined);
}

/** Read a required key, or throw a MissingConfigError naming the feature. */
export function require_(feature: string, name: string, hint?: string): string {
  const v = read(name);
  if (v === undefined) throw new MissingConfigError(feature, [name], hint);
  return v;
}

export function optional(name: string, fallback: string): string {
  return read(name) ?? fallback;
}

export function optionalRaw(name: string): string | undefined {
  return read(name);
}

export const env = {
  port: Number(optional('PORT', '4242')),
  logLevel: optional('LOG_LEVEL', 'info'),
  publicBaseUrl: optionalRaw('PUBLIC_BASE_URL'),

  supabaseUrl: () => require_('Supabase', 'SUPABASE_URL'),
  supabaseAnonKey: () => require_('Supabase', 'SUPABASE_ANON_KEY'),
  /** Server-only. Bypasses RLS. Never return this over HTTP or to a model. */
  supabaseServiceRoleKey: () => require_('Supabase', 'SUPABASE_SERVICE_ROLE_KEY'),

  stripeSecretKey: () =>
    require_('Stripe MPP', 'STRIPE_SECRET_KEY', 'Use a sandbox key (sk_test_...).'),
  stripeProfileId: () =>
    require_('Stripe MPP', 'STRIPE_PROFILE_ID', 'Populate it with: npm run mpp:profile'),
  tempoDepositAddress: () => optionalRaw('TEMPO_DEPOSIT_ADDRESS'),

  /** Settlement price for the decision brief, USD decimal string. */
  mppSettlementUsd: () => optional('MPP_SETTLEMENT_USD', optional('MPP_PRICE_USD', '0.50')),
  /** Metered talk time, USD per second. Sub-cent by design. */
  mppPerSecondUsd: () => optional('MPP_TALK_USD_PER_SECOND', '0.004'),
} as const;

/** A readiness snapshot. Safe to serve publicly — names only, no values. */
export function configReport() {
  return {
    supabase: { ready: missing('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY').length === 0,
                missing: missing('SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY') },
    stripe:   { ready: missing('STRIPE_SECRET_KEY', 'STRIPE_PROFILE_ID').length === 0,
                missing: missing('STRIPE_SECRET_KEY', 'STRIPE_PROFILE_ID'),
                livemode: !(optionalRaw('STRIPE_SECRET_KEY') ?? '_test_').includes('_test_'),
                tempo: optionalRaw('TEMPO_DEPOSIT_ADDRESS') !== undefined },
    anthropic: { ready: missing('ANTHROPIC_API_KEY').length === 0 },
    gemini:    { ready: missing('GEMINI_API_KEY').length === 0 },
  };
}
