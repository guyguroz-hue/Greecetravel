import type { ActivityCategory, GeoPoint } from '@/lib/types';

/**
 * Place search behind a provider interface.
 *
 * Search runs against OpenStreetMap, through two free services that need no
 * API key: Photon (Komoot), which is built for type-ahead and copes with
 * partial words and business names, and Nominatim, which is stronger on
 * formal addresses. Both are queried and their answers merged, because
 * neither alone finds enough — OSM is thin on businesses either way, which is
 * why the location field also accepts a pin pasted from Google Maps. There used to be a bundled catalogue of northern-Greece
 * places as an offline fallback; it ignored the trip's location, so planning
 * anywhere else returned Greek results, and it went out with the demo trip.
 *
 * Dropping in Google Places later means implementing `SearchProvider` once.
 */

export interface PlaceResult {
  id: string;
  name: string;
  address?: string;
  location?: GeoPoint;
  category: ActivityCategory;
  rating?: number;
  website?: string;
  image?: string;
  /** Which provider produced the row, shown as a subtle source chip. */
  source: string;
  /** ISO-3166 alpha-2, when the provider reports it. */
  countryCode?: string;
}

export interface SearchProvider {
  readonly id: string;
  readonly label: string;
  search(query: string, near?: GeoPoint, countryCode?: string): Promise<PlaceResult[]>;
}

/* ------------------------------------------------------------------ *
 * Photon (Komoot) — built for type-ahead
 * ------------------------------------------------------------------ */

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, unknown>;
}

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

/** "Ermou 12, Thessaloniki, Greece" out of Photon's separate address parts. */
function photonAddress(p: Record<string, unknown>): string | undefined {
  const street = [str(p.street), str(p.housenumber)].filter(Boolean).join(' ');
  return [street, str(p.city) ?? str(p.district), str(p.state), str(p.country)]
    .filter(Boolean)
    .join(', ') || undefined;
}

export const photonProvider: SearchProvider = {
  id: 'photon',
  label: 'Photon',
  async search(query, near, countryCode) {
    const params = new URLSearchParams({ q: query, limit: '8', lang: 'en' });
    if (near) {
      params.set('lat', String(near.lat));
      params.set('lon', String(near.lng));
    }
    const res = await fetch(`https://photon.komoot.io/api?${params}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`photon ${res.status}`);

    const body = (await res.json()) as { features?: PhotonFeature[] };
    const rows = Array.isArray(body?.features) ? body.features : [];

    const mapped = rows.flatMap((f, i): PlaceResult[] => {
      const coords = f.geometry?.coordinates;
      const p = f.properties ?? {};
      // Defensive: this shape is documented but never verified from here, so a
      // feature that does not match is dropped rather than trusted.
      if (!Array.isArray(coords) || coords.length < 2) return [];
      const [lng, lat] = coords;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
      const name = str(p.name);
      if (!name) return [];
      return [
        {
          id: `ph_${str(p.osm_id) ?? i}_${lat}_${lng}`,
          name,
          address: photonAddress(p),
          location: { lat: Number(lat), lng: Number(lng) },
          category:
            OSM_CATEGORY[str(p.osm_value) ?? ''] ?? OSM_CATEGORY[str(p.osm_key) ?? ''] ?? 'other',
          source: 'OpenStreetMap',
          countryCode: str(p.countrycode)?.toUpperCase(),
        },
      ];
    });

    // Keep the country's own results when there are any, but never let the
    // filter turn a hit into nothing.
    if (!countryCode) return mapped;
    const local = mapped.filter((r) => !r.countryCode || r.countryCode === countryCode.toUpperCase());
    return local.length > 0 ? local : mapped;
  },
};

/* ------------------------------------------------------------------ *
 * Nominatim (OpenStreetMap)
 * ------------------------------------------------------------------ */

const OSM_CATEGORY: Record<string, ActivityCategory> = {
  hotel: 'hotel',
  guest_house: 'hotel',
  hostel: 'hotel',
  restaurant: 'food',
  fast_food: 'food',
  tavern: 'food',
  cafe: 'coffee',
  winery: 'winery',
  beach: 'beach',
  museum: 'attraction',
  attraction: 'attraction',
  monastery: 'attraction',
  viewpoint: 'nature',
  peak: 'nature',
  waterfall: 'nature',
  nature_reserve: 'nature',
  supermarket: 'shopping',
  mall: 'shopping',
};

export const nominatimProvider: SearchProvider = {
  id: 'nominatim',
  label: 'OpenStreetMap',
  async search(query, near, countryCode) {
    const params = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '8',
    });
    // A new trip has no coordinates to bias towards, but it does know its
    // country — enough to keep "the white tower" in Greece.
    if (countryCode) params.set('countrycodes', countryCode.toLowerCase());
    if (near) {
      const d = 1.5;
      params.set(
        'viewbox',
        `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`
      );
    }
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`nominatim ${res.status}`);
    const rows = (await res.json()) as {
      place_id: number;
      lat: string;
      lon: string;
      display_name: string;
      name?: string;
      type?: string;
      category?: string;
    }[];
    return rows.map((r) => ({
      id: `osm_${r.place_id}`,
      name: r.name || r.display_name.split(',')[0],
      address: r.display_name,
      location: { lat: Number(r.lat), lng: Number(r.lon) },
      category: OSM_CATEGORY[r.type ?? ''] ?? OSM_CATEGORY[r.category ?? ''] ?? 'other',
      source: 'OpenStreetMap',
    }));
  },
};

/**
 * Two places at the same spot with the same name are one place seen twice.
 * Coordinates are rounded to about ten metres before comparing.
 */
function dedupe(rows: PlaceResult[]): PlaceResult[] {
  const seen = new Set<string>();
  const out: PlaceResult[] = [];
  for (const r of rows) {
    const key = `${r.name.toLowerCase()}@${r.location?.lat.toFixed(4)},${r.location?.lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/**
 * Asks both providers and merges what comes back. One failing does not fail
 * the search — a network problem returns no results with `onlineFailed` set,
 * and the screen says so rather than throwing.
 *
 * A search restricted to the trip's country that finds nothing is retried
 * without the restriction: a dead end is worse than a far-away answer someone
 * can look at and reject.
 */
export async function searchPlaces(
  query: string,
  opts: { near?: GeoPoint; online?: boolean; countryCode?: string } = {}
): Promise<{ results: PlaceResult[]; onlineFailed: boolean }> {
  if (!opts.online) return { results: [], onlineFailed: false };

  const ask = async (countryCode?: string) => {
    const settled = await Promise.allSettled([
      photonProvider.search(query, opts.near, countryCode),
      nominatimProvider.search(query, opts.near, countryCode),
    ]);
    const rows = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
    return { rows: dedupe(rows), allFailed: settled.every((r) => r.status === 'rejected') };
  };

  const first = await ask(opts.countryCode);
  if (first.allFailed) return { results: [], onlineFailed: true };
  if (first.rows.length > 0 || !opts.countryCode) {
    return { results: first.rows, onlineFailed: false };
  }

  const wider = await ask(undefined);
  return { results: wider.rows, onlineFailed: wider.allFailed };
}
