import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, missing, MissingConfigError } from '../env.js';

let cached: SupabaseClient | null = null;

/**
 * The server-side Supabase client. Uses the service-role key, so it bypasses
 * RLS — this must never be constructed in, or its key shipped to, a browser.
 *
 * Throws MissingConfigError (status 503) with a readable message if the keys
 * are not in .env yet, rather than failing somewhere deeper.
 */
export function db(): SupabaseClient {
  if (cached) return cached;
  const gaps = missing('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY');
  if (gaps.length > 0) {
    throw new MissingConfigError('The context library (Supabase)', gaps);
  }
  cached = createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** True when Supabase keys are present. Lets callers degrade instead of throw. */
export function dbReady(): boolean {
  return missing('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY').length === 0;
}

/** Unwrap a supabase-js result, turning its error into a thrown Error. */
export function unwrap<T>(
  result: { data: T | null; error: { message: string; code?: string } | null },
  what: string
): T {
  if (result.error) {
    throw new Error(`${what} failed: ${result.error.message}`);
  }
  if (result.data === null) {
    throw new Error(`${what} returned no data`);
  }
  return result.data;
}
