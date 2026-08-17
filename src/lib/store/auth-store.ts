'use client';

import { create } from 'zustand';
import { authRedirectUrl, getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

/**
 * `disabled` is the important state: it means no Supabase credentials are
 * configured, so the app runs entirely on the device exactly as it did before
 * there was a backend. Nothing in the UI should ask for a login in that mode.
 */
export type AuthStatus = 'disabled' | 'loading' | 'signed-out' | 'signed-in';

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
  /** Set after a magic link is sent, so the UI can say "check your email". */
  linkSentTo: string | null;

  init: (onChange: (user: AuthUser | null) => void) => () => void;
  signInWithEmail: (email: string) => Promise<{ ok: boolean; message: string }>;
  signOut: () => Promise<void>;
  clearLinkSent: () => void;
}

function toUser(raw: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null): AuthUser | null {
  if (!raw) return null;
  const meta = raw.user_metadata ?? {};
  const name =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    (raw.email ? raw.email.split('@')[0] : 'אני');
  return { id: raw.id, email: raw.email ?? '', name };
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: isSupabaseConfigured ? 'loading' : 'disabled',
  user: null,
  error: null,
  linkSentTo: null,

  init(onChange) {
    const supabase = getSupabase();
    if (!supabase) {
      set({ status: 'disabled', user: null });
      return () => {};
    }

    void supabase.auth.getSession().then(({ data }) => {
      const user = toUser(data.session?.user ?? null);
      set({ status: user ? 'signed-in' : 'signed-out', user });
      onChange(user);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = toUser(session?.user ?? null);
      set({ status: user ? 'signed-in' : 'signed-out', user, error: null });
      onChange(user);
    });

    return () => sub.subscription.unsubscribe();
  },

  async signInWithEmail(email) {
    const supabase = getSupabase();
    if (!supabase) return { ok: false, message: 'החיבור לשרת אינו מוגדר.' };

    const address = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(address)) {
      return { ok: false, message: 'כתובת אימייל לא תקינה.' };
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: authRedirectUrl() },
    });

    if (error) {
      set({ error: error.message });
      return { ok: false, message: `שליחת הקישור נכשלה: ${error.message}` };
    }

    set({ linkSentTo: address, error: null });
    return { ok: true, message: 'שלחנו לך קישור כניסה למייל.' };
  },

  async signOut() {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
    set({ user: null, status: 'signed-out', linkSentTo: null });
  },

  clearLinkSent() {
    set({ linkSentTo: null });
  },
}));

/** True when the app should show accounts and sharing at all. */
export function cloudEnabled(): boolean {
  return isSupabaseConfigured;
}
