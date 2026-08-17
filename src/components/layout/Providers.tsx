'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useTripStore } from '@/lib/store/trip-store';
import { useAuthStore } from '@/lib/store/auth-store';
import { useSettingsStore } from '@/lib/store/ui-store';
import { createOsrmProvider, estimateProvider, setRoutingProvider } from '@/lib/services/routing';
import { getCloudRepository, setStorageMode } from '@/lib/db';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { subscribeToReconnects, subscribeToTripChanges } from '@/lib/supabase/sync';
import { ToastViewport } from '@/components/ui/Feedback';

export function Providers({ children }: { children: ReactNode }) {
  const hydrate = useTripStore((s) => s.hydrate);
  const rehydrate = useTripStore((s) => s.rehydrate);
  const hydrateSettings = useSettingsStore((s) => s.hydrateSettings);
  const liveRouting = useSettingsStore((s) => s.liveRouting);
  const initAuth = useAuthStore((s) => s.init);

  // Remembers which account the store was last loaded for, so an auth event
  // that doesn't actually change the user (token refresh) doesn't reload.
  const loadedFor = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    hydrateSettings();
  }, [hydrateSettings]);

  useEffect(() => {
    // Local-only deployment: behave exactly as before there was a backend.
    if (!isSupabaseConfigured) {
      setStorageMode('local');
      void hydrate();
      return;
    }

    const stop = initAuth((user) => {
      const key = user?.id ?? null;
      if (loadedFor.current === key) return;
      loadedFor.current = key;

      setStorageMode(user ? 'cloud' : 'local');
      void rehydrate();
    });

    return stop;
  }, [hydrate, rehydrate, initAuth]);

  // The routing service is a module-level singleton; keep it in step with the
  // user's preference rather than threading a provider through every screen.
  useEffect(() => {
    setRoutingProvider(liveRouting ? createOsrmProvider() : estimateProvider);
  }, [liveRouting]);

  return (
    <>
      <CloudSync />
      {children}
      <ToastViewport />
    </>
  );
}

/**
 * Keeps this device in step with everyone else on the trip: realtime pushes
 * while the app is open, plus a re-read whenever the tab wakes up or the
 * network comes back.
 */
function CloudSync() {
  const authStatus = useAuthStore((s) => s.status);
  const applyRemote = useTripStore((s) => s.applyRemote);
  const inFlight = useRef(false);

  useEffect(() => {
    if (authStatus !== 'signed-in') return;

    const pull = async () => {
      const repo = getCloudRepository();
      if (!repo || inFlight.current) return;
      inFlight.current = true;
      try {
        repo.invalidate();
        const data = await repo.load();
        if (data) applyRemote(data);
      } catch (err) {
        console.error('[sync] refresh failed', err);
      } finally {
        inFlight.current = false;
      }
    };

    const sync = subscribeToTripChanges(() => void pull());
    const stopWake = subscribeToReconnects(() => void pull());

    return () => {
      sync.stop();
      stopWake();
    };
  }, [authStatus, applyRemote]);

  return null;
}
