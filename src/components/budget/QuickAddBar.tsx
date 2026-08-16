'use client';

import { useMemo, useState } from 'react';
import { CornerDownLeft, Zap } from 'lucide-react';
import { parseQuickAdd } from '@/lib/services/quick-add';
import { CURRENCY_META, EXPENSE_CATEGORY_META, type Traveler, type Trip } from '@/lib/types';
import { formatDayMonth } from '@/lib/utils/date';
import { useTripStore } from '@/lib/store/trip-store';
import { toast } from '@/lib/store/ui-store';
import { cn } from '@/lib/utils/cn';

/**
 * "+ €35 Dinner 25/8" → a full expense row, with a live preview of what the
 * parser understood so nothing is saved blind.
 */
export function QuickAddBar({ trip, travelers }: { trip: Trip; travelers: Traveler[] }) {
  const addExpense = useTripStore((s) => s.addExpense);
  const undo = useTripStore((s) => s.undo);
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);

  const parsed = useMemo(
    () =>
      parseQuickAdd(value, {
        defaultCurrency: trip.currencies[trip.currencies.length - 1] ?? trip.baseCurrency,
        tripYear: Number(trip.startDate.slice(0, 4)),
      }),
    [value, trip]
  );

  const ready = value.trim().length > 0 && parsed.amount !== undefined;

  const submit = () => {
    if (!ready) return;
    addExpense({
      tripId: trip.id,
      date: parsed.date,
      category: parsed.category,
      description: parsed.description,
      amount: parsed.amount!,
      currency: parsed.currency,
      paid: false,
      paidById: travelers[0]?.id,
      splitBetween: travelers.map((t) => t.id),
    });
    setValue('');
    toast.success(`נוספה: ${parsed.description}`, {
      action: { label: 'בטל', onClick: () => undo() },
    });
  };

  return (
    <div
      className={cn(
        'rounded-2xl border bg-surface transition',
        focused ? 'border-brand ring-2 ring-brand/15' : 'border-line'
      )}
    >
      <div className="flex items-center gap-2 px-3 h-12">
        <Zap className="size-4 text-accent shrink-0" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') setValue('');
          }}
          placeholder="הוספה מהירה — למשל: €35 ארוחת ערב 25/8"
          aria-label="הוספה מהירה של הוצאה"
          className="flex-1 min-w-0 bg-transparent outline-none text-[14px] placeholder:text-faint"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!ready}
          aria-label="הוספה"
          className={cn(
            'shrink-0 size-8 grid place-items-center rounded-lg transition',
            ready ? 'bg-brand text-brand-contrast' : 'bg-subtle text-faint'
          )}
        >
          <CornerDownLeft className="size-4" />
        </button>
      </div>

      {value.trim().length > 0 && (
        <div className="px-3 pb-2.5 flex flex-wrap items-center gap-1.5 animate-[fade-in_0.15s_ease-out]">
          <Token
            on={parsed.matched.amount}
            text={
              parsed.amount !== undefined
                ? `${CURRENCY_META[parsed.currency].symbol}${parsed.amount}`
                : 'חסר סכום'
            }
          />
          <Token
            on={parsed.matched.category}
            text={`${EXPENSE_CATEGORY_META[parsed.category].emoji} ${
              EXPENSE_CATEGORY_META[parsed.category].label
            }`}
          />
          <Token on={parsed.matched.date} text={formatDayMonth(parsed.date)} />
          <span className="text-[11.5px] text-faint truncate">{parsed.description}</span>
        </div>
      )}
    </div>
  );
}

function Token({ on, text }: { on: boolean; text: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded-md text-[11.5px] font-medium ltr-nums',
        on ? 'bg-brand-soft text-brand' : 'bg-subtle text-faint'
      )}
    >
      {text}
    </span>
  );
}
