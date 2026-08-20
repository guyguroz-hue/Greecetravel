import type { ActivityCategory, GeoPoint } from '@/lib/types';

/**
 * Place search behind a provider interface.
 *
 * Search runs against OpenStreetMap's Nominatim, which needs no API key and
 * covers everywhere. There used to be a bundled catalogue of northern-Greece
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
}

export interface SearchProvider {
  readonly id: string;
  readonly label: string;
  search(query: string, near?: GeoPoint, countryCode?: string): Promise<PlaceResult[]>;
}

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
 * A network failure returns no results with `onlineFailed` set, rather than
 * throwing — the screen says so and stays usable for adding a place by hand.
 */
export async function searchPlaces(
  query: string,
  opts: { near?: GeoPoint; online?: boolean; countryCode?: string } = {}
): Promise<{ results: PlaceResult[]; onlineFailed: boolean }> {
  if (!opts.online) return { results: [], onlineFailed: false };
  try {
    return {
      results: await nominatimProvider.search(query, opts.near, opts.countryCode),
      onlineFailed: false,
    };
  } catch {
    return { results: [], onlineFailed: true };
  }
}
