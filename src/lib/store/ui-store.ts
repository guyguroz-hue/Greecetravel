'use client';

import { create } from 'zustand';
import { newId } from '@/lib/utils/id';

/* ------------------------------------------------------------------ *
 * Toasts (with undo)
 * ------------------------------------------------------------------ */

export interface Toast {
  id: string;
  message: string;
  tone: 'default' | 'success' | 'danger';
  /** Renders an action button; used for "בטל" after a delete. */
  action?: { label: string; onClick: () => void };
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  push: (
    message: string,
    opts?: { tone?: Toast['tone']; action?: Toast['action']; duration?: number }
  ) => string;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  push(message, opts = {}) {
    const id = newId('tst');
    const toast: Toast = {
      id,
      message,
      tone: opts.tone ?? 'default',
      action: opts.action,
      duration: opts.duration ?? (opts.action ? 6500 : 3200),
    };
    set((s) => ({ toasts: [...s.toasts.slice(-2), toast] }));
    if (typeof window !== 'undefined') {
      setTimeout(() => get().dismiss(id), toast.duration);
    }
    return id;
  },
  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

/** Ergonomic wrapper so components don't reach into the store shape. */
export const toast = {
  show: (message: string, opts?: Parameters<ToastState['push']>[1]) =>
    useToastStore.getState().push(message, opts),
  success: (message: string, opts?: Parameters<ToastState['push']>[1]) =>
    useToastStore.getState().push(message, { ...opts, tone: 'success' }),
  error: (message: string, opts?: Parameters<ToastState['push']>[1]) =>
    useToastStore.getState().push(message, { ...opts, tone: 'danger' }),
};

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

export type ThemePreference = 'system' | 'light' | 'dark';

interface SettingsState {
  theme: ThemePreference;
  /** Use the online road-routing provider instead of the offline estimate. */
  liveRouting: boolean;
  /** Fetch exchange rates from the live API on demand. */
  liveRates: boolean;
  /** Include OpenStreetMap results in place search. */
  onlineSearch: boolean;
  /** Show converted amounts under every foreign-currency figure. */
  showConversions: boolean;
  hydrated: boolean;
  setTheme: (t: ThemePreference) => void;
  setLiveRouting: (v: boolean) => void;
  setLiveRates: (v: boolean) => void;
  setOnlineSearch: (v: boolean) => void;
  setShowConversions: (v: boolean) => void;
  hydrateSettings: () => void;
}

const SETTINGS_KEY = 'mtp:settings:v1';

function persistSettings(state: SettingsState) {
  if (typeof window === 'undefined') return;
  const { theme, liveRouting, liveRates, onlineSearch, showConversions } = state;
  window.localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({ theme, liveRouting, liveRates, onlineSearch, showConversions })
  );
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  theme: 'system',
  liveRouting: false,
  liveRates: false,
  onlineSearch: false,
  showConversions: true,
  hydrated: false,

  setTheme(theme) {
    set({ theme });
    applyTheme(theme);
    persistSettings(get());
  },
  setLiveRouting(liveRouting) {
    set({ liveRouting });
    persistSettings(get());
  },
  setLiveRates(liveRates) {
    set({ liveRates });
    persistSettings(get());
  },
  setOnlineSearch(onlineSearch) {
    set({ onlineSearch });
    persistSettings(get());
  },
  setShowConversions(showConversions) {
    set({ showConversions });
    persistSettings(get());
  },

  hydrateSettings() {
    if (typeof window === 'undefined' || get().hydrated) return;
    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SettingsState>;
        set({ ...parsed, hydrated: true });
        applyTheme(parsed.theme ?? 'system');
        return;
      }
    } catch {
      /* fall through to defaults */
    }
    set({ hydrated: true });
    applyTheme('system');
  },
}));

export function applyTheme(theme: ThemePreference) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}
