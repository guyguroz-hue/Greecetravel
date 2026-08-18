'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarPlus,
  ExternalLink,
  Heart,
  MapPin,
  Search as SearchIcon,
  Star,
  WifiOff,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useActiveTrip } from '@/lib/store/hooks';
import { useTripStore } from '@/lib/store/trip-store';
import { useSettingsStore, toast } from '@/lib/store/ui-store';
import { searchPlaces, type PlaceResult } from '@/lib/services/places-search';
import { centerOf } from '@/lib/services/geo';
import { CATEGORY_META, PLACE_LISTS, PLACE_LIST_META, type PlaceList } from '@/lib/types';
import { formatDayMonth } from '@/lib/utils/date';
import { googleMapsLink } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, Spinner } from '@/components/ui/Feedback';
import { Badge } from '@/components/ui/Bits';

/**
 * "יקב ליד מטסובו" → results from OpenStreetMap, biased towards the trip's
 * location. Each result can go straight onto a day or into the wishlist.
 */
export function SearchScreen() {
  const active = useActiveTrip();
  const addPlace = useTripStore((s) => s.addPlace);
  const addActivity = useTripStore((s) => s.addActivity);
  const undo = useTripStore((s) => s.undo);
  const onlineSearch = useSettingsStore((s) => s.onlineSearch);

  const [query, setQuery] = useState('');
  /** Results are stored together with the query that produced them, so the
   *  loading and "no results" states are derived rather than synchronised. */
  const [answered, setAnswered] = useState<{
    query: string;
    items: PlaceResult[];
    onlineFailed: boolean;
  }>({ query: '', items: [], onlineFailed: false });
  const [picking, setPicking] = useState<PlaceResult | null>(null);
  const [list, setList] = useState<PlaceList>('must');

  const trimmed = query.trim();
  const isCurrent = answered.query === trimmed;
  const results = isCurrent ? answered.items : [];
  const searched = isCurrent && trimmed.length >= 2;
  const loading = trimmed.length >= 2 && !isCurrent;
  const onlineFailed = isCurrent && answered.onlineFailed;

  const near = useMemo(() => {
    if (!active) return undefined;
    const points = active.activities.filter((a) => a.location).map((a) => a.location!);
    return centerOf(points) ?? undefined;
  }, [active]);

  // Debounced so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const res = await searchPlaces(q, { near, online: onlineSearch });
      if (cancelled) return;
      setAnswered({ query: q, items: res.results, onlineFailed: res.onlineFailed });
    }, 380);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, near, onlineSearch]);

  if (!active) return null;
  const { trip, days } = active;

  const saveToWishlist = (result: PlaceResult) => {
    addPlace({
      tripId: trip.id,
      name: result.name,
      list,
      category: result.category,
      address: result.address,
      location: result.location,
      rating: result.rating,
      url: result.website,
    });
    toast.success(`"${result.name}" נוסף ל${PLACE_LIST_META[list].label}`, {
      action: { label: 'בטל', onClick: () => undo() },
    });
  };

  const addToDay = (result: PlaceResult, dayId: string) => {
    const day = days.find((d) => d.id === dayId);
    addActivity({
      tripId: trip.id,
      dayId,
      title: result.name,
      category: result.category,
      durationMin: 90,
      address: result.address,
      location: result.location,
      url: result.website,
      currency: trip.currencies[trip.currencies.length - 1] ?? trip.baseCurrency,
    });
    setPicking(null);
    toast.success(`"${result.name}" נוסף ליום ${day?.index ?? ''}`, {
      action: { label: 'בטל', onClick: () => undo() },
    });
  };

  return (
    <AppShell title="חיפוש והוספה" subtitle="מצאי מקום והוסיפי אותו לטיול" backHref="/more">
      <div className="relative mb-3">
        <SearchIcon className="absolute inset-y-0 start-3.5 my-auto size-4.5 text-faint pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          placeholder="למשל: יקב ליד מטסובו, חוף בסיתוניה, מנזר במטאורה"
          aria-label="חיפוש מקום"
          className="w-full h-12 ps-11 pe-3 rounded-2xl bg-surface border border-line text-[15px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
        />
        {loading && (
          <span className="absolute inset-y-0 end-3.5 my-auto flex items-center">
            <Spinner className="size-4" />
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-[12.5px] text-muted shrink-0">שמירה אל</span>
        <Select
          value={list}
          onChange={(e) => setList(e.target.value as PlaceList)}
          className="h-9 flex-1"
        >
          {PLACE_LISTS.map((l) => (
            <option key={l} value={l}>
              {PLACE_LIST_META[l].emoji} {PLACE_LIST_META[l].label}
            </option>
          ))}
        </Select>
      </div>

      {!onlineSearch && (
        <p className="text-[12px] text-muted bg-inset rounded-xl px-3 py-2.5 mb-4 leading-relaxed">
          חיפוש המקומות כבוי בהגדרות, ולכן אין מה לחפש. אפשר להדליק אותו תחת הגדרות →
          ״חיפוש מקומות מקוון״, או להוסיף מקום ידנית.
        </p>
      )}
      {onlineFailed && (
        <p className="flex items-center gap-2 text-[12px] text-warning bg-warning-soft rounded-xl px-3 py-2.5 mb-4">
          <WifiOff className="size-3.5 shrink-0" />
          החיפוש לא זמין כרגע. אפשר לנסות שוב, או להוסיף את המקום ידנית.
        </p>
      )}

      {trimmed.length < 2 ? (
        <EmptyState
          icon={<SearchIcon className="size-6" />}
          title="מה מחפשים?"
          description="אפשר לחפש לפי שם מקום, סוג (יקב, חוף, מנזר) או אזור בטיול."
        />
      ) : searched && results.length === 0 && !loading ? (
        <EmptyState
          icon="🤷"
          title={`לא נמצאו תוצאות עבור "${trimmed}"`}
          description="אפשר לנסות מונח אחר, או להוסיף את המקום ידנית ממסך המקומות."
        />
      ) : (
        <div className="space-y-2.5">
          {results.map((result) => {
            const meta = CATEGORY_META[result.category];
            const already = active.places.some(
              (p) => p.name.toLowerCase() === result.name.toLowerCase()
            );
            return (
              <Card key={result.id} className="p-3.5">
                <div className="flex items-start gap-2.5">
                  <span
                    className="size-10 shrink-0 grid place-items-center rounded-xl text-lg"
                    style={{ background: `color-mix(in oklab, ${meta.color} 14%, transparent)` }}
                    aria-hidden
                  >
                    {meta.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-[14.5px] leading-snug">{result.name}</h3>
                    {result.address && (
                      <p className="text-[12px] text-muted mt-0.5 line-clamp-2">{result.address}</p>
                    )}
                    <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
                      <Badge>{meta.label}</Badge>
                      {result.rating !== undefined && (
                        <span className="inline-flex items-center gap-0.5 text-[11.5px] text-accent">
                          <Star className="size-3 fill-current" />
                          <span className="ltr-nums">{result.rating}</span>
                        </span>
                      )}
                      <span className="text-[11px] text-faint">{result.source}</span>
                      {already && <Badge tone="success">כבר ברשימה</Badge>}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mt-3">
                  <Button size="sm" onClick={() => setPicking(result)}>
                    <CalendarPlus className="size-3.5" />
                    הוספה ליום
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => saveToWishlist(result)}>
                    <Heart className="size-3.5" />
                    לרשימת המקומות
                  </Button>
                  {result.location && (
                    <a
                      href={googleMapsLink({ ...result.location, query: result.name })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[12px] text-muted px-2 py-1.5 rounded-lg hover:bg-subtle transition"
                    >
                      <MapPin className="size-3.5" />
                      מפה
                    </a>
                  )}
                  {result.website && (
                    <a
                      href={result.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[12px] text-muted px-2 py-1.5 rounded-lg hover:bg-subtle transition"
                    >
                      <ExternalLink className="size-3.5" />
                      אתר
                    </a>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet
        open={picking !== null}
        onClose={() => setPicking(null)}
        title={`לאיזה יום להוסיף את "${picking?.name ?? ''}"?`}
        size="sm"
      >
        <div className="space-y-1.5 pb-4">
          {days.map((day) => (
            <button
              key={day.id}
              type="button"
              onClick={() => picking && addToDay(picking, day.id)}
              className="w-full flex items-center justify-between gap-3 px-3.5 h-12 rounded-xl border border-line hover:bg-subtle transition text-start"
            >
              <span className="min-w-0">
                <span className="block text-[14px] font-medium truncate">
                  יום {day.index} — {day.title}
                </span>
                <span className="block text-[11.5px] text-muted ltr-nums">
                  {formatDayMonth(day.date)}
                </span>
              </span>
              <CalendarPlus className={cn('size-4 text-brand shrink-0')} />
            </button>
          ))}
        </div>
      </Sheet>
    </AppShell>
  );
}
