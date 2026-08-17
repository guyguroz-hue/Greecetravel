'use client';

import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from './client';

/**
 * Streams other people's edits into this device.
 *
 * Rather than trying to patch individual rows into the store — which would
 * mean reimplementing every mapper in reverse and reasoning about ordering —
 * a change simply triggers a refetch. The payload is small, the code is one
 * path instead of eleven, and there is no way for a partial patch to leave
 * the client disagreeing with the database.
 *
 * Refetches are coalesced, so a burst of edits from someone dragging a day
 * around costs one round trip rather than thirty.
 */

const WATCHED_TABLES = [
  'trips',
  'travelers',
  'days',
  'activities',
  'hotels',
  'flights',
  'car_rentals',
  'places',
  'expenses',
  'documents',
  'checklists',
  'trip_members',
] as const;

const COALESCE_MS = 700;

export interface TripSync {
  stop: () => void;
}

export function subscribeToTripChanges(onRemoteChange: () => void): TripSync {
  const supabase = getSupabase();
  if (!supabase) return { stop: () => {} };

  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const schedule = () => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      onRemoteChange();
    }, COALESCE_MS);
  };

  const channel: RealtimeChannel = supabase.channel('trip-changes');

  for (const table of WATCHED_TABLES) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, schedule);
  }

  void channel.subscribe();

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    },
  };
}

/**
 * Re-syncs when the tab comes back to the foreground or the network returns.
 * Realtime can miss messages while a phone is asleep, which is exactly what
 * happens between opening the app at breakfast and again at dinner.
 */
export function subscribeToReconnects(onWake: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const onVisible = () => {
    if (document.visibilityState === 'visible') onWake();
  };

  window.addEventListener('online', onWake);
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    window.removeEventListener('online', onWake);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
