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
  signInWithEmail: (email: string) => Promise<AuthResult>;
  signInWithGoogle: (next?: string) => Promise<AuthResult>;
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  signUpWithPassword: (email: string, password: string, name: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  clearLinkSent: () => void;
}

export interface AuthResult {
  ok: boolean;
  message: string;
  /** Sign-up succeeded but the project requires the address to be confirmed. */
  needsConfirmation?: boolean;
}

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Supabase answers in English, and its wording assumes you know how it is
 * configured. These are the cases a person actually hits while signing in,
 * said in a way that names the next move.
 */
function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'אימייל או סיסמה שגויים.';
  if (m.includes('email not confirmed')) {
    return 'החשבון נוצר אבל הכתובת עוד לא אושרה. יש קישור אישור במייל.';
  }
  if (m.includes('user already registered') || m.includes('already been registered')) {
    return 'כבר קיים חשבון עם הכתובת הזו — אפשר פשוט להתחבר.';
  }
  if (m.includes('password should be')) {
    return `הסיסמה קצרה מדי — לפחות ${MIN_PASSWORD_LENGTH} תווים.`;
  }
  if (m.includes('provider is not enabled') || m.includes('unsupported provider')) {
    return 'ההתחברות עם Google לא מופעלת בפרויקט. צריך להפעיל אותה ב-Supabase תחת Authentication → Providers.';
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'יותר מדי ניסיונות. כדאי לחכות כמה דקות ולנסות שוב.';
  }
  return message;
}

function validEmail(address: string): boolean {
  return /^\S+@\S+\.\S+$/.test(address);
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
    if (!validEmail(address)) {
      return { ok: false, message: 'כתובת אימייל לא תקינה.' };
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: authRedirectUrl() },
    });

    if (error) {
      set({ error: error.message });
      return { ok: false, message: `שליחת הקישור נכשלה: ${translateAuthError(error.message)}` };
    }

    set({ linkSentTo: address, error: null });
    return { ok: true, message: 'שלחנו לך קישור כניסה למייל.' };
  },

  async signInWithGoogle(next) {
    const supabase = getSupabase();
    if (!supabase) return { ok: false, message: 'החיבור לשרת אינו מוגדר.' };

    // Sends the browser to Google. On success it comes back to /auth/callback,
    // where the client exchanges the code for a session — the same landing
    // spot the magic link uses, so nothing downstream needs to know which of
    // the two got the person in.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: authRedirectUrl(next) },
    });

    if (error) {
      const message = translateAuthError(error.message);
      set({ error: message });
      return { ok: false, message };
    }
    return { ok: true, message: 'מעביר ל-Google…' };
  },

  async signInWithPassword(email, password) {
    const supabase = getSupabase();
    if (!supabase) return { ok: false, message: 'החיבור לשרת אינו מוגדר.' };

    const address = email.trim().toLowerCase();
    if (!validEmail(address)) return { ok: false, message: 'כתובת אימייל לא תקינה.' };
    if (!password) return { ok: false, message: 'צריך להזין סיסמה.' };

    const { error } = await supabase.auth.signInWithPassword({ email: address, password });
    if (error) {
      const message = translateAuthError(error.message);
      set({ error: message });
      return { ok: false, message };
    }
    set({ error: null });
    return { ok: true, message: 'ברוך שובך!' };
  },

  async signUpWithPassword(email, password, name) {
    const supabase = getSupabase();
    if (!supabase) return { ok: false, message: 'החיבור לשרת אינו מוגדר.' };

    const address = email.trim().toLowerCase();
    if (!validEmail(address)) return { ok: false, message: 'כתובת אימייל לא תקינה.' };
    if (password.length < MIN_PASSWORD_LENGTH) {
      return { ok: false, message: `הסיסמה צריכה להיות באורך ${MIN_PASSWORD_LENGTH} תווים לפחות.` };
    }

    const { data, error } = await supabase.auth.signUp({
      email: address,
      password,
      // handle_new_user() copies full_name into the profile, which is the
      // name the rest of the family sees next to shared expenses.
      options: { data: { full_name: name.trim() || address.split('@')[0] }, emailRedirectTo: authRedirectUrl() },
    });

    if (error) {
      const message = translateAuthError(error.message);
      set({ error: message });
      return { ok: false, message };
    }

    // With "Confirm email" on, sign-up returns a user but no session; the
    // account only becomes usable after the link is clicked.
    if (!data.session) {
      set({ error: null });
      return {
        ok: true,
        needsConfirmation: true,
        message: 'שלחנו קישור אישור למייל. אחרי לחיצה עליו אפשר להתחבר עם הסיסמה.',
      };
    }

    set({ error: null });
    return { ok: true, message: 'החשבון נוצר.' };
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
