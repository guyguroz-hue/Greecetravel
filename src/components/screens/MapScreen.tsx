'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { Layers, MapPin, Route } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useActiveTrip } from '@/lib/store/hooks';
import {
  ACTIVITY_CATEGORIES,
  CATEGORY_META,
  type ActivityCategory,
  type GeoPoint,
} from '@/lib/types';
import { formatMoney, googleMapsLink } from '@/lib/utils/format';
import { convert } from '@/lib/services/currency';
import { cn } from '@/lib/utils/cn';
import { Segmented } from '@/components/ui/Field';
import { EmptyState, Spinner } from '@/components/ui/Feedback';
import type { MapPoint } from '@/components/map/TripMap';

// Leaflet touches `window` at import time, so it can only load in the browser.
const TripMap = dynamic(() => import('@/components/map/TripMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full grid place-items-center bg-subtle">
      <Spinner className="size-6" />
    </div>
  ),
});

type Scope = 'trip' | 'day' | 'places';

export function MapScreen() {
  const active = useActiveTrip();
  const [scope, setScope] = useState<Scope>('trip');
  const [dayId, setDayId] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<ActivityCategory>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const selectedDay = useMemo(() => {
    if (!active) return null;
    return active.days.find((d) => d.id === dayId) ?? active.days[0] ?? null;
  }, [active, dayId]);

  const { points, routeLine, categoriesPresent } = useMemo(() => {
    if (!active) return { points: [], routeLine: [], categoriesPresent: [] as ActivityCategory[] };
    const { trip, days, activities, hotels, places } = active;
    const dayIndexById = new Map(days.map((d) => [d.id, d.index]));

    const activityPoints: MapPoint[] = activities
      .filter((a) => a.location)
      .filter((a) => scope !== 'day' || a.dayId === selectedDay?.id)
      .map((a) => ({
        id: `act:${a.id}`,
        name: a.title,
        category: a.category,
        location: a.location!,
        dayIndex: dayIndexById.get(a.dayId),
        time: a.startTime,
        address: a.address,
        notes: a.notes,
        priceLabel:
          a.price !== undefined
            ? formatMoney(
                convert(a.price, a.currency ?? trip.baseCurrency, trip.baseCurrency, trip.rates),
                trip.baseCurrency
              )
            : undefined,
        mapsUrl: googleMapsLink({ ...a.location!, query: a.title }),
      }));

    const hotelPoints: MapPoint[] = hotels
      .filter((h) => h.location)
      .map((h) => ({
        id: `htl:${h.id}`,
        name: h.name,
        category: 'hotel' as ActivityCategory,
        location: h.location!,
        address: h.address ?? h.city,
        notes: h.notes,
        priceLabel:
          h.totalPrice !== undefined
            ? formatMoney(
                convert(h.totalPrice, h.currency, trip.baseCurrency, trip.rates),
                trip.baseCurrency
              )
            : undefined,
        mapsUrl: googleMapsLink({ ...h.location!, query: h.name }),
      }));

    const placePoints: MapPoint[] = places
      .filter((p) => p.location)
      .map((p) => ({
        id: `plc:${p.id}`,
        name: p.name,
        category: p.category,
        location: p.location!,
        address: p.address,
        notes: p.notes,
        dayIndex: p.dayId ? dayIndexById.get(p.dayId) : undefined,
        mapsUrl: googleMapsLink({ ...p.location!, query: p.name }),
        muted: true,
      }));

    let all: MapPoint[];
    if (scope === 'places') all = placePoints;
    else if (scope === 'day') all = activityPoints;
    else all = [...activityPoints, ...hotelPoints];

    const present = Array.from(new Set(all.map((p) => p.category)));
    const visible = all.filter((p) => !hidden.has(p.category));

    // Route line follows the sleeping locations in date order for the whole
    // trip, or the day's own activity order when a single day is selected.
    let line: GeoPoint[] = [];
    if (scope === 'day') {
      line = activityPoints.map((p) => p.location);
    } else if (scope === 'trip') {
      const seen = new Set<string>();
      line = hotels
        .filter((h) => h.location)
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
        .filter((h) => {
          const key = `${h.location!.lat.toFixed(3)},${h.location!.lng.toFixed(3)}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((h) => h.location!);
    }

    return { points: visible, routeLine: line, categoriesPresent: present };
  }, [active, scope, selectedDay, hidden]);

  if (!active) return null;

  const toggleCategory = (c: ActivityCategory) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  return (
    <AppShell
      title="מפה"
      subtitle={`${points.length} נקודות`}
      bleed
      actions={
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          aria-label="סינון שכבות"
          aria-pressed={showFilters}
          className={cn(
            'size-9 grid place-items-center rounded-xl transition',
            showFilters ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-subtle hover:text-ink'
          )}
        >
          <Layers className="size-[18px]" />
        </button>
      }
    >
      <div className="px-4 sm:px-6 pt-3 pb-2 space-y-2.5">
        <Segmented
          value={scope}
          onChange={(v) => setScope(v)}
          options={[
            { value: 'trip', label: 'כל הטיול' },
            { value: 'day', label: 'יום בודד' },
            { value: 'places', label: 'רשימת מקומות' },
          ]}
        />

        {scope === 'day' && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {active.days.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDayId(d.id)}
                className={cn(
                  'shrink-0 px-3 h-8 rounded-lg text-[12.5px] font-medium border transition whitespace-nowrap',
                  selectedDay?.id === d.id
                    ? 'bg-brand text-brand-contrast border-transparent'
                    : 'bg-surface border-line text-muted hover:bg-subtle'
                )}
              >
                יום {d.index}
              </button>
            ))}
          </div>
        )}

        {showFilters && categoriesPresent.length > 0 && (
          <div className="flex flex-wrap gap-1.5 animate-[slide-up_0.16s_ease-out]">
            {ACTIVITY_CATEGORIES.filter((c) => categoriesPresent.includes(c)).map((c) => {
              const meta = CATEGORY_META[c];
              const on = !hidden.has(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCategory(c)}
                  aria-pressed={on}
                  className={cn(
                    'inline-flex items-center gap-1 px-2.5 h-8 rounded-lg text-[12px] font-medium border transition',
                    on ? 'border-transparent text-white' : 'border-line text-faint bg-surface'
                  )}
                  style={on ? { background: meta.color } : undefined}
                >
                  <span aria-hidden>{meta.emoji}</span>
                  {meta.label}
                </button>
              );
            })}
          </div>
        )}

        {scope === 'trip' && active.trip.route && active.trip.route.length > 1 && (
          <p className="flex items-center gap-1.5 text-[12px] text-muted">
            <Route className="size-3.5 shrink-0" />
            <span className="truncate">{active.trip.route.join(' → ')}</span>
          </p>
        )}
      </div>

      <div className="h-[calc(100dvh-15.5rem)] min-h-[22rem] lg:h-[calc(100dvh-13rem)] mx-4 sm:mx-6 mb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:mb-8 rounded-2xl overflow-hidden border border-line shadow-card">
        {points.length === 0 ? (
          <div className="h-full grid place-items-center bg-subtle p-6">
            <EmptyState
              icon={<MapPin className="size-6" />}
              title="אין נקודות להצגה"
              description={
                scope === 'places'
                  ? 'רשימת המקומות ריקה, או שלמקומות שבה אין עדיין מיקום.'
                  : 'לפעילויות בטווח הנבחר אין עדיין קואורדינטות. אפשר להוסיף מיקום דרך מסך החיפוש או בעריכת הפעילות.'
              }
              className="bg-transparent border-0"
            />
          </div>
        ) : (
          <TripMap points={points} route={routeLine} className="h-full w-full" />
        )}
      </div>
    </AppShell>
  );
}
