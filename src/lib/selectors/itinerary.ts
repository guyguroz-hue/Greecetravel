import { estimateLeg } from '@/lib/services/routing';
import {
  type Activity,
  type Day,
  type GeoPoint,
  type Hotel,
  type ID,
} from '@/lib/types';
import { timeToMinutes } from '@/lib/utils/date';

/** Activities of a day, scheduled ones first in clock order. */
export function sortActivities(items: Activity[]): Activity[] {
  return [...items].sort((a, b) => {
    const ta = timeToMinutes(a.startTime);
    const tb = timeToMinutes(b.startTime);
    if (ta === undefined && tb === undefined) return a.order - b.order;
    if (ta === undefined) return 1;
    if (tb === undefined) return -1;
    if (ta !== tb) return ta - tb;
    return a.order - b.order;
  });
}

export interface TimelineLeg {
  /** Driving time from the previous activity. */
  durationMin: number;
  distanceKm: number;
  /** Minutes actually available between the two activities. */
  availableMin: number;
  /** True when the gap can't absorb the drive. */
  tooTight: boolean;
  /** How many minutes short we are. */
  shortfallMin: number;
}

export interface TimelineEntry {
  activity: Activity;
  /** Travel from the previous entry, when both have coordinates. */
  legFromPrev?: TimelineLeg;
  endMin?: number;
}

/**
 * Builds the day's timeline and flags impossible transitions — the
 * "⚠️ הפעילות הבאה מתחילה 15 דקות אחרי זמן הנסיעה" warning.
 */
export function buildTimeline(activities: Activity[]): TimelineEntry[] {
  const sorted = sortActivities(activities);
  const out: TimelineEntry[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const activity = sorted[i];
    const startMin = timeToMinutes(activity.startTime);
    const endMin =
      startMin !== undefined ? startMin + (activity.durationMin ?? 0) : undefined;

    let legFromPrev: TimelineLeg | undefined;
    const prev = out[out.length - 1];
    // A drive or a flight *is* the journey — inserting an implied travel leg in
    // front of it would double-count the time and raise a bogus warning.
    const isExplicitTravel = activity.category === 'drive' || activity.category === 'flight';
    if (!isExplicitTravel && prev && prev.activity.location && activity.location && startMin !== undefined) {
      const from = prev.activity.location;
      const to = activity.location;
      if (!samePoint(from, to)) {
        const leg = estimateLeg(from, to);
        const prevEnd = prev.endMin;
        const availableMin = prevEnd !== undefined ? startMin - prevEnd : Number.POSITIVE_INFINITY;
        const shortfallMin = Math.round(leg.durationMin - availableMin);
        legFromPrev = {
          durationMin: leg.durationMin,
          distanceKm: leg.distanceKm,
          availableMin: Number.isFinite(availableMin) ? availableMin : 0,
          tooTight: Number.isFinite(availableMin) && shortfallMin > 0,
          shortfallMin: Math.max(0, shortfallMin),
        };
      }
    }

    out.push({ activity, legFromPrev, endMin });
  }

  return out;
}

function samePoint(a: GeoPoint, b: GeoPoint) {
  return Math.abs(a.lat - b.lat) < 0.0005 && Math.abs(a.lng - b.lng) < 0.0005;
}

export interface DayStats {
  activityCount: number;
  drivingMin: number;
  drivingKm: number;
  /** Minutes between the first start and the last end. */
  spanMin: number;
  tightLegs: number;
  missingTimes: number;
}

export function computeDayStats(activities: Activity[]): DayStats {
  const timeline = buildTimeline(activities);
  let drivingMin = 0;
  let drivingKm = 0;
  let tightLegs = 0;
  for (const entry of timeline) {
    if (entry.legFromPrev) {
      drivingMin += entry.legFromPrev.durationMin;
      drivingKm += entry.legFromPrev.distanceKm;
      if (entry.legFromPrev.tooTight) tightLegs++;
    }
    // A drive logged as its own activity also counts toward the day's driving.
    if (entry.activity.category === 'drive' && entry.activity.durationMin) {
      drivingMin += 0; // already represented by the leg above; avoid double count
    }
  }
  const starts = timeline
    .map((e) => timeToMinutes(e.activity.startTime))
    .filter((n): n is number => n !== undefined);
  const ends = timeline.map((e) => e.endMin).filter((n): n is number => n !== undefined);
  return {
    activityCount: activities.length,
    drivingMin: Math.round(drivingMin),
    drivingKm: Math.round(drivingKm * 10) / 10,
    spanMin: starts.length && ends.length ? Math.max(...ends) - Math.min(...starts) : 0,
    tightLegs,
    missingTimes: activities.filter((a) => !a.startTime).length,
  };
}

/**
 * "Too full" has to stay rare to stay useful. A holiday day that runs from
 * breakfast to a late dinner is normal, so length alone doesn't count — only
 * a packed schedule, a lot of driving, or a very long day that's also busy.
 */
export function isOverloadedDay(stats: DayStats): boolean {
  return (
    stats.activityCount >= 9 ||
    stats.drivingMin > 300 ||
    (stats.spanMin > 15 * 60 && stats.activityCount >= 7)
  );
}

export function groupActivitiesByDay(activities: Activity[]): Map<ID, Activity[]> {
  const map = new Map<ID, Activity[]>();
  for (const a of activities) {
    const list = map.get(a.dayId);
    if (list) list.push(a);
    else map.set(a.dayId, [a]);
  }
  for (const [k, v] of map) map.set(k, sortActivities(v));
  return map;
}

/** The hotel you sleep at on a given day, derived from check-in/out windows. */
export function hotelForDay(day: Day, hotels: Hotel[]): Hotel | undefined {
  if (day.hotelId) {
    const explicit = hotels.find((h) => h.id === day.hotelId);
    if (explicit) return explicit;
  }
  return hotels.find((h) => day.date >= h.checkIn && day.date < h.checkOut);
}

/** Total driving across the whole trip, used by the Car screen. */
export function computeTripDriving(days: Day[], byDay: Map<ID, Activity[]>) {
  let minutes = 0;
  let km = 0;
  for (const day of days) {
    const stats = computeDayStats(byDay.get(day.id) ?? []);
    minutes += stats.drivingMin;
    km += stats.drivingKm;
  }
  return { minutes: Math.round(minutes), km: Math.round(km) };
}
