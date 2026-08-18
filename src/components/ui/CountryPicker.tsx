'use client';

import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { COUNTRIES, searchCountries, type Country } from '@/lib/data/countries';
import { countryFlag } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

/**
 * Picking the destination country, so everything that follows from it — the
 * flag, the currency spent there, the cover — is filled in rather than typed.
 * It used to be a free-text field plus a separate "two-letter country code"
 * box, which asked the person to know something the app already knows.
 */
export function CountryPicker({
  value,
  onSelect,
  error,
}: {
  value: string;
  onSelect: (country: Country) => void;
  error?: string;
}) {
  const [query, setQuery] = useState('');
  const selected = COUNTRIES.find((c) => c.code === value);

  // With the search cleared, the chosen country leads the list. Otherwise the
  // list springs back to the alphabetical top and the only sign anything was
  // selected is a placeholder halfway up the screen.
  const results = useMemo(() => {
    const found = searchCountries(query);
    if (query.trim() || !selected) return found;
    return [selected, ...found.filter((c) => c.code !== selected.code)];
  }, [query, selected]);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="country-search" className="text-[13px] font-medium text-muted">
        לאן נוסעים
        <span className="text-danger ms-0.5">*</span>
      </label>

      <div className="relative">
        <span className="absolute inset-y-0 start-3 grid place-items-center text-faint pointer-events-none">
          <Search className="size-4" />
        </span>
        <input
          id="country-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={selected ? `${selected.name} — לחיפוש אחר` : 'חיפוש מדינה'}
          aria-invalid={error ? true : undefined}
          className={cn(
            'w-full h-11 ps-9 pe-3 rounded-xl bg-inset border border-line text-[15px]',
            'placeholder:text-faint transition outline-none',
            'focus:border-brand focus:ring-2 focus:ring-brand/20',
            error && 'border-danger'
          )}
        />
      </div>

      <div className="max-h-56 overflow-y-auto rounded-xl border border-line divide-y divide-[var(--border)]">
        {results.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px] text-muted">
            לא נמצאה מדינה בשם הזה. אפשר לחפש גם באנגלית.
          </p>
        ) : (
          results.map((country) => {
            const active = country.code === value;
            return (
              <button
                key={country.code}
                type="button"
                onClick={() => {
                  onSelect(country);
                  setQuery('');
                }}
                aria-pressed={active}
                className={cn(
                  'w-full min-h-11 px-3 py-2.5 flex items-center gap-3 text-start transition',
                  active ? 'bg-accent-soft' : 'hover:bg-subtle'
                )}
              >
                <span className="text-base leading-none" aria-hidden>
                  {countryFlag(country.code)}
                </span>
                <span className="flex-1 min-w-0 truncate text-[14.5px]">{country.name}</span>
                <span className="text-[11.5px] text-faint ltr-nums">{country.currency}</span>
                {active && <Check className="size-4 text-accent shrink-0" />}
              </button>
            );
          })
        )}
      </div>

      {error && <p className="text-[12px] text-danger">{error}</p>}
    </div>
  );
}
