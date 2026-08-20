import type { GeoPoint } from '@/lib/types';

/**
 * Coordinates out of whatever someone pasted.
 *
 * Most places people actually plan around — a restaurant, a small hotel, a
 * café — are on Google Maps and often missing from OpenStreetMap, which is
 * where this app's search looks. Rather than pretend the search covers them,
 * the location field accepts a pin copied straight out of Google Maps.
 *
 * Handles the forms that carry coordinates in the text itself, so no network
 * call and no API key is involved:
 *
 *   40.6263, 22.9484
 *   https://www.google.com/maps/place/White+Tower/@40.6263,22.9484,17z/...
 *   https://www.google.com/maps?q=40.6263,22.9484
 *   https://www.google.com/maps/.../data=...!3d40.6263!4d22.9484
 *   https://waze.com/ul?ll=40.6263,22.9484
 *
 * A shortened link (maps.app.goo.gl, goo.gl/maps) carries no coordinates —
 * they only appear after following the redirect, which a browser cannot do
 * across origins. `isShortMapLink` exists so the UI can say that plainly
 * instead of failing silently.
 */

const LAT = /^-?\d{1,2}(\.\d+)?$/;
const LNG = /^-?\d{1,3}(\.\d+)?$/;

function valid(lat: number, lng: number): GeoPoint | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  // 0,0 is in the Atlantic and is almost always a parse artefact.
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

export function isShortMapLink(text: string): boolean {
  return /(maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(text);
}

export function parseMapLocation(input: string): GeoPoint | null {
  const text = input.trim();
  if (!text) return null;

  // A bare pair, which is what Google Maps copies when you long-press a spot.
  const pair = text.match(/^\(?\s*(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*\)?$/);
  if (pair && LAT.test(pair[1]) && LNG.test(pair[2])) {
    return valid(Number(pair[1]), Number(pair[2]));
  }

  if (!/https?:\/\//i.test(text)) return null;

  // `!3d<lat>!4d<lng>` is the place's own pin; `@lat,lng` is only where the
  // camera happens to sit, so it is the weaker of the two and comes second.
  const data = text.match(/!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/);
  if (data) return valid(Number(data[1]), Number(data[2]));

  try {
    const url = new URL(text);
    for (const key of ['q', 'query', 'll', 'daddr', 'center', 'sll']) {
      const raw = url.searchParams.get(key);
      const m = raw?.match(/^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
      if (m) return valid(Number(m[1]), Number(m[2]));
    }
  } catch {
    // Not a parseable URL; the patterns below still work on the raw text.
  }

  const at = text.match(/@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/);
  if (at) return valid(Number(at[1]), Number(at[2]));

  return null;
}

/** A readable label for a pin that arrived as numbers. */
export function formatCoords(point: GeoPoint): string {
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}

/**
 * The place name inside a Google Maps URL, when it has one — nicer to store
 * than a coordinate pair.
 */
export function parseMapLabel(input: string): string | undefined {
  const m = input.match(/\/maps\/place\/([^/@?]+)/);
  if (!m) return undefined;
  try {
    const name = decodeURIComponent(m[1].replace(/\+/g, ' ')).trim();
    return name && !/^-?\d/.test(name) ? name : undefined;
  } catch {
    return undefined;
  }
}
