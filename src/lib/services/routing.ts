import type { GeoPoint } from '@/lib/types';
import { haversineKm } from './geo';

export interface RouteLeg {
  distanceKm: number;
  durationMin: number;
  /** Where the numbers came from, so the UI can label estimates honestly. */
  source: 'estimate' | 'osrm';
}

export interface RoutingProvider {
  readonly id: string;
  readonly label: string;
  route(from: GeoPoint, to: GeoPoint): Promise<RouteLeg>;
}

/**
 * Offline estimator. Straight-line distance is inflated by a winding factor
 * and divided by a speed that drops on short hops (town driving, parking) and
 * on mountain roads — which is most of what this trip is made of.
 */
export const estimateProvider: RoutingProvider = {
  id: 'estimate',
  label: 'הערכה מקומית',
  async route(from, to) {
    const straight = haversineKm(from, to);
    const windingFactor = straight < 5 ? 1.6 : straight < 40 ? 1.45 : 1.3;
    const distanceKm = straight * windingFactor;
    const avgSpeed =
      distanceKm < 3 ? 22 : distanceKm < 15 ? 40 : distanceKm < 60 ? 58 : distanceKm < 200 ? 76 : 88;
    const durationMin = (distanceKm / avgSpeed) * 60 + (distanceKm > 1 ? 4 : 1);
    return {
      distanceKm: Math.round(distanceKm * 10) / 10,
      durationMin: Math.round(durationMin),
      source: 'estimate',
    };
  },
};

/**
 * Real road routing via a public OSRM instance. Off by default so the app
 * never depends on an outbound call; enable it in Settings.
 */
export function createOsrmProvider(baseUrl = 'https://router.project-osrm.org'): RoutingProvider {
  return {
    id: 'osrm',
    label: 'ניתוב דרכים (OSRM)',
    async route(from, to) {
      const url =
        `${baseUrl}/route/v1/driving/` +
        `${from.lng},${from.lat};${to.lng},${to.lat}?overview=false&alternatives=false`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`OSRM ${res.status}`);
      const json = (await res.json()) as {
        code: string;
        routes?: { distance: number; duration: number }[];
      };
      const leg = json.routes?.[0];
      if (json.code !== 'Ok' || !leg) throw new Error('OSRM: no route');
      return {
        distanceKm: Math.round((leg.distance / 1000) * 10) / 10,
        durationMin: Math.round(leg.duration / 60),
        source: 'osrm',
      };
    },
  };
}

/** In-memory memo so a screen full of legs doesn't recompute on every render. */
const cache = new Map<string, RouteLeg>();

function key(from: GeoPoint, to: GeoPoint, providerId: string) {
  return `${providerId}:${from.lat.toFixed(4)},${from.lng.toFixed(4)}>${to.lat.toFixed(
    4
  )},${to.lng.toFixed(4)}`;
}

let activeProvider: RoutingProvider = estimateProvider;

export function setRoutingProvider(provider: RoutingProvider) {
  activeProvider = provider;
}

export function getRoutingProvider(): RoutingProvider {
  return activeProvider;
}

/** Falls back to the offline estimate whenever the remote provider fails. */
export async function routeBetween(from: GeoPoint, to: GeoPoint): Promise<RouteLeg> {
  const provider = activeProvider;
  const k = key(from, to, provider.id);
  const hit = cache.get(k);
  if (hit) return hit;
  let leg: RouteLeg;
  try {
    leg = await provider.route(from, to);
  } catch {
    leg = await estimateProvider.route(from, to);
  }
  cache.set(k, leg);
  return leg;
}

/**
 * Synchronous estimate for render paths that can't await. Always the offline
 * model, so the timeline can paint immediately and refine later.
 */
export function estimateLeg(from: GeoPoint, to: GeoPoint): RouteLeg {
  const k = key(from, to, 'estimate');
  const hit = cache.get(k);
  if (hit) return hit;
  const straight = haversineKm(from, to);
  const windingFactor = straight < 5 ? 1.6 : straight < 40 ? 1.45 : 1.3;
  const distanceKm = straight * windingFactor;
  const avgSpeed =
    distanceKm < 3 ? 22 : distanceKm < 15 ? 40 : distanceKm < 60 ? 58 : distanceKm < 200 ? 76 : 88;
  const durationMin = Math.round((distanceKm / avgSpeed) * 60 + (distanceKm > 1 ? 4 : 1));
  const leg: RouteLeg = {
    distanceKm: Math.round(distanceKm * 10) / 10,
    durationMin,
    source: 'estimate',
  };
  cache.set(k, leg);
  return leg;
}
