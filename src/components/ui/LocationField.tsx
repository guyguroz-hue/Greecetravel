'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, LocateFixed, MapPin, Search, X } from 'lucide-react';
import { searchPlaces, type PlaceResult } from '@/lib/services/places-search';
import { useSettingsStore } from '@/lib/store/ui-store';
import type { GeoPoint } from '@/lib/types';
import { cn } from '@/lib/utils/cn';

/**
 * An address that carries its coordinates.
 *
 * Typing an address used to store a string and nothing else, so anything added
 * by hand never reached the map — the map plots only what has a location, and
 * the only way to get one was to copy two numbers out of Google Maps into a
 * pair of decimal fields. Here the address IS the search: pick a suggestion and
 * the coordinates come with it.
 *
 * Results are biased towards `near` (the trip's own area) so "the white tower"
 * finds the one in Thessaloniki rather than the one across the world.
 */
export function LocationField({
  label = 'כתובת או מקום',
  value,
  location,
  near,
  countryCode,
  onChange,
  placeholder = 'לחפש מקום או כתובת…',
}: {
  label?: string;
  value: string;
  location?: GeoPoint;
  near?: GeoPoint;
  /** ISO-3166 alpha-2 of the trip, so a new trip still searches the right country. */
  countryCode?: string;
  onChange: (next: { address: string; location?: GeoPoint }) => void;
  placeholder?: string;
}) {
  const onlineSearch = useSettingsStore((s) => s.onlineSearch);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // Only a query the person is actively typing should search. Re-opening a
  // saved activity must not fire a lookup for text that already has a pin.
  const [query, setQuery] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query === null) return;
    const q = query.trim();
    let cancelled = false;
    // Everything settles inside the timer, so the effect never sets state on
    // its way through — a short query just clears the list a tick later.
    const timer = setTimeout(async () => {
      if (q.length < 3 || !onlineSearch) {
        if (!cancelled) {
          setResults([]);
          setOpen(false);
        }
        return;
      }
      setBusy(true);
      try {
        const { results: found, onlineFailed } = await searchPlaces(q, { near, countryCode, online: true });
        if (cancelled) return;
        setResults(found.slice(0, 6));
        setFailed(onlineFailed);
        setOpen(true);
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, near, countryCode, onlineSearch]);

  // A tap outside is a dismissal, not a selection.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const pick = (r: PlaceResult) => {
    onChange({ address: r.address ?? r.name, location: r.location });
    setQuery(null);
    setResults([]);
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-1.5" ref={boxRef}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="location-field" className="text-[13px] font-medium text-muted">
          {label}
        </label>
        {location ? (
          <span className="flex items-center gap-1 text-[11.5px] text-success">
            <Check className="size-3.5" />
            מסומן על המפה
          </span>
        ) : value ? (
          <span className="text-[11.5px] text-faint">לא יופיע במפה</span>
        ) : null}
      </div>

      <div className="relative">
        <span className="absolute inset-y-0 start-3 grid place-items-center text-faint pointer-events-none">
          {location ? <LocateFixed className="size-4 text-success" /> : <Search className="size-4" />}
        </span>
        <input
          id="location-field"
          type="text"
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            // Editing the text invalidates the pin it came with.
            onChange({ address: next, location: undefined });
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          className={cn(
            'w-full h-11 ps-9 rounded-xl bg-inset border border-line text-[15px]',
            'placeholder:text-faint transition outline-none',
            'focus:border-brand focus:ring-2 focus:ring-brand/20',
            value ? 'pe-10' : 'pe-3'
          )}
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange({ address: '', location: undefined });
              setQuery(null);
              setResults([]);
              setOpen(false);
            }}
            aria-label="ניקוי המיקום"
            className="absolute inset-y-0 end-2 my-auto size-7 grid place-items-center rounded-lg text-faint hover:text-ink hover:bg-subtle transition"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="rounded-xl border border-line bg-surface overflow-hidden divide-y divide-[var(--border)] shadow-card">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => pick(r)}
                className="w-full min-h-11 px-3 py-2.5 flex items-start gap-2.5 text-start hover:bg-subtle transition"
              >
                <MapPin className="size-4 mt-0.5 shrink-0 text-accent" />
                <span className="min-w-0">
                  <span className="block text-[14px] truncate">{r.name}</span>
                  {r.address && (
                    <span className="block text-[11.5px] text-muted line-clamp-1">{r.address}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {busy && <p className="text-[11.5px] text-faint">מחפש…</p>}

      {!onlineSearch && (
        <p className="text-[11.5px] text-faint leading-relaxed">
          חיפוש המקומות כבוי בהגדרות, ולכן אי אפשר להשלים מיקום אוטומטית.
        </p>
      )}
      {failed && onlineSearch && (
        <p className="text-[11.5px] text-warning leading-relaxed">
          החיפוש לא זמין כרגע. הכתובת תישמר כטקסט, ואפשר להשלים את המיקום מאוחר יותר.
        </p>
      )}
    </div>
  );
}
