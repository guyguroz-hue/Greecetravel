import type { ActivityCategory, GeoPoint } from '@/lib/types';

/**
 * Place search behind a provider interface.
 *
 * Without a Google Places key the app ships two providers:
 *  - a curated offline catalogue for the demo destination, always available;
 *  - OpenStreetMap's Nominatim, used when "חיפוש מקוון" is enabled in Settings.
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
  search(query: string, near?: GeoPoint): Promise<PlaceResult[]>;
}

/* ------------------------------------------------------------------ *
 * Offline catalogue
 * ------------------------------------------------------------------ */

interface CatalogEntry {
  name: string;
  aliases: string[];
  address: string;
  location: GeoPoint;
  category: ActivityCategory;
  rating: number;
  website?: string;
}

const CATALOG: CatalogEntry[] = [
  { name: 'Katogi Averoff Winery', aliases: ['יקב', 'מטסובו', 'winery', 'katogi', 'יין'], address: 'Metsovo 442 00', location: { lat: 39.7742, lng: 21.1858 }, category: 'winery', rating: 4.6, website: 'https://www.katogi-strofilia.gr/' },
  { name: 'Domaine Porto Carras', aliases: ['יקב', 'wine', 'חלקידיקי', 'sithonia'], address: 'Neos Marmaras 630 81', location: { lat: 40.0653, lng: 23.7889 }, category: 'winery', rating: 4.4 },
  { name: 'Ktima Gerovassiliou', aliases: ['יקב', 'wine', 'סלוניקי', 'epanomi'], address: 'Epanomi 575 00', location: { lat: 40.4222, lng: 22.9167 }, category: 'winery', rating: 4.7 },
  { name: 'Averoff Museum', aliases: ['מוזיאון', 'מטסובו', 'museum', 'אמנות'], address: 'Metsovo 442 00', location: { lat: 39.7706, lng: 21.1811 }, category: 'attraction', rating: 4.6 },
  { name: 'Metsovone Cheese Dairy', aliases: ['גבינה', 'מחלבה', 'מטסובו', 'cheese'], address: 'Metsovo 442 00', location: { lat: 39.7736, lng: 21.1774 }, category: 'shopping', rating: 4.4 },
  { name: 'Vikos Gorge — Oxya Viewpoint', aliases: ['ויקוס', 'ערוץ', 'תצפית', 'zagori', 'זגוריה'], address: 'Monodendri 440 07', location: { lat: 39.9086, lng: 20.7717 }, category: 'nature', rating: 4.9 },
  { name: 'Papingo Rock Pools', aliases: ['פאפינגו', 'בריכות', 'זגוריה', 'papingo'], address: 'Papingo 440 16', location: { lat: 39.9931, lng: 20.7136 }, category: 'nature', rating: 4.7 },
  { name: 'Kokkoris Bridge', aliases: ['גשר', 'אבן', 'זגוריה', 'bridge'], address: 'Kipi 440 07', location: { lat: 39.8639, lng: 20.825 }, category: 'nature', rating: 4.6 },
  { name: 'Great Meteoron Monastery', aliases: ['מטאורה', 'מנזר', 'meteora', 'monastery'], address: 'Kalambaka 422 00', location: { lat: 39.7228, lng: 21.6289 }, category: 'attraction', rating: 4.8 },
  { name: 'Holy Monastery of Varlaam', aliases: ['מטאורה', 'מנזר', 'meteora', 'varlaam'], address: 'Kalambaka 422 00', location: { lat: 39.7247, lng: 21.6317 }, category: 'attraction', rating: 4.8 },
  { name: 'Agia Triada Monastery', aliases: ['מטאורה', 'מנזר', 'meteora', 'trinity'], address: 'Kalambaka 422 00', location: { lat: 39.7186, lng: 21.6414 }, category: 'attraction', rating: 4.8 },
  { name: 'Kavourotrypes Beach', aliases: ['חוף', 'beach', 'orange', 'חלקידיקי', 'sithonia'], address: 'Sithonia 630 72', location: { lat: 40.1058, lng: 23.9269 }, category: 'beach', rating: 4.7 },
  { name: 'Karydi Beach', aliases: ['חוף', 'beach', 'vourvourou', 'ורוורו'], address: 'Vourvourou 630 78', location: { lat: 40.1633, lng: 23.8236 }, category: 'beach', rating: 4.6 },
  { name: 'Kalogria Beach', aliases: ['חוף', 'beach', 'sithonia'], address: 'Sithonia 630 81', location: { lat: 40.0578, lng: 23.7192 }, category: 'beach', rating: 4.5 },
  { name: 'Porto Koufo', aliases: ['נמל', 'חוף', 'harbour', 'sithonia'], address: 'Porto Koufo 630 72', location: { lat: 39.9631, lng: 23.925 }, category: 'beach', rating: 4.6 },
  { name: 'White Tower of Thessaloniki', aliases: ['מגדל לבן', 'סלוניקי', 'thessaloniki'], address: 'Nikis Ave, Thessaloniki', location: { lat: 40.6263, lng: 22.9484 }, category: 'attraction', rating: 4.6 },
  { name: 'Rotunda of Galerius', aliases: ['רוטונדה', 'סלוניקי', 'thessaloniki'], address: 'Thessaloniki 546 35', location: { lat: 40.6333, lng: 22.9531 }, category: 'attraction', rating: 4.5 },
  { name: 'Modiano Market', aliases: ['שוק', 'market', 'סלוניקי', 'אוכל'], address: 'Ermou 22, Thessaloniki', location: { lat: 40.6371, lng: 22.9401 }, category: 'food', rating: 4.4 },
  { name: 'Mourga', aliases: ['מסעדה', 'דגים', 'restaurant', 'סלוניקי'], address: 'Christopoulou 12, Thessaloniki', location: { lat: 40.6357, lng: 22.9377 }, category: 'food', rating: 4.7, website: 'https://www.mourga.gr/' },
  { name: 'Bougatsa Bantis', aliases: ['בוגצה', 'קפה', 'bakery', 'סלוניקי'], address: 'Panagias Faneromenis 33', location: { lat: 40.6424, lng: 22.9346 }, category: 'coffee', rating: 4.7 },
  { name: 'Edessa Waterfalls', aliases: ['מפלים', 'waterfall', 'אדסה', 'edessa'], address: 'Edessa 582 00', location: { lat: 40.8022, lng: 22.0439 }, category: 'nature', rating: 4.5 },
  { name: 'Lake Plastira', aliases: ['אגם', 'lake', 'plastira'], address: 'Karditsa 431 50', location: { lat: 39.2506, lng: 21.7681 }, category: 'nature', rating: 4.6 },
  { name: 'Mount Olympus — Prionia', aliases: ['אולימפוס', 'olympus', 'הר', 'טרק'], address: 'Litochoro 602 00', location: { lat: 40.0864, lng: 22.4056 }, category: 'nature', rating: 4.8 },
  { name: 'Ormos Panagias Harbour', aliases: ['נמל', 'שיט', 'אתוס', 'athos', 'cruise'], address: 'Ormos Panagias 630 78', location: { lat: 40.2153, lng: 23.7639 }, category: 'activity', rating: 4.5 },
];

export const catalogProvider: SearchProvider = {
  id: 'catalog',
  label: 'קטלוג מקומי',
  async search(query) {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const terms = q.split(/\s+/).filter(Boolean);
    return CATALOG.map((entry) => {
      const haystack = `${entry.name} ${entry.aliases.join(' ')} ${entry.address}`.toLowerCase();
      const score = terms.reduce((n, t) => n + (haystack.includes(t) ? 1 : 0), 0);
      return { entry, score };
    })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.entry.rating - a.entry.rating)
      .slice(0, 8)
      .map(({ entry }) => ({
        id: `cat_${entry.name.replace(/\W+/g, '_')}`,
        name: entry.name,
        address: entry.address,
        location: entry.location,
        category: entry.category,
        rating: entry.rating,
        website: entry.website,
        source: 'קטלוג',
      }));
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
  async search(query, near) {
    const params = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '8',
    });
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
 * Runs the catalogue always, and the online provider when enabled, merging
 * results without letting a network failure break the screen.
 */
export async function searchPlaces(
  query: string,
  opts: { near?: GeoPoint; online?: boolean } = {}
): Promise<{ results: PlaceResult[]; onlineFailed: boolean }> {
  const local = await catalogProvider.search(query, opts.near);
  if (!opts.online) return { results: local, onlineFailed: false };
  try {
    const remote = await nominatimProvider.search(query, opts.near);
    const seen = new Set(local.map((r) => r.name.toLowerCase()));
    const merged = [...local, ...remote.filter((r) => !seen.has(r.name.toLowerCase()))];
    return { results: merged, onlineFailed: false };
  } catch {
    return { results: local, onlineFailed: true };
  }
}
