'use client';

import { useEffect, type ReactNode } from 'react';
import { useTripStore } from '@/lib/store/trip-store';
import { useSettingsStore } from '@/lib/store/ui-store';
import { createOsrmProvider, estimateProvider, setRoutingProvider } from '@/lib/services/routing';
import { ToastViewport } from '@/components/ui/Feedback';

export function Providers({ children }: { children: ReactNode }) {
  const hydrate = useTripStore((s) => s.hydrate);
  const hydrateSettings = useSettingsStore((s) => s.hydrateSettings);
  const liveRouting = useSettingsStore((s) => s.liveRouting);

  useEffect(() => {
    hydrateSettings();
    void hydrate();
  }, [hydrate, hydrateSettings]);

  // The routing service is a module-level singleton; keep it in step with the
  // user's preference rather than threading a provider through every screen.
  useEffect(() => {
    setRoutingProvider(liveRouting ? createOsrmProvider() : estimateProvider);
  }, [liveRouting]);

  return (
    <>
      {children}
      <ToastViewport />
    </>
  );
}
