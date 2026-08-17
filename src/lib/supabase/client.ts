'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The app runs in one of two modes:
 *
 *  - **local** — no Supabase credentials configured. Everything stays in the
 *    browser, exactly as it did before there was a backend. This is still the
 *    default so the app never breaks by simply being deployed somewhere the
 *    env vars are missing.
 *
 *  - **cloud** — credentials present. Trips live in Postgres, several people
 *    share one trip, and changes stream between them.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (typeof window === 'undefined') return null;
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    });
  }
  return client;
}

/** Throws rather than returning null, for call sites that already checked. */
export function requireSupabase(): SupabaseClient {
  const c = getSupabase();
  if (!c) throw new Error('Supabase is not configured');
  return c;
}

/** Where magic-link and OAuth redirects should land. */
export function authRedirectUrl(next?: string): string {
  if (typeof window === 'undefined') return '';
  const base = `${window.location.origin}/auth/callback`;
  return next ? `${base}?next=${encodeURIComponent(next)}` : base;
}
