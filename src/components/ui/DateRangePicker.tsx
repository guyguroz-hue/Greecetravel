'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * One calendar for both ends of a trip.
 *
 * Two `<input type="date">` fields side by side asked people to hold "which
 * box am I in" in their head, and on a narrow phone the native pickers were
 * wider than half the screen, so the two boxes overlapped. Here the first tap
 * sets the start, the second sets the end, and a tap before the current start
 * begins a new range rather than erroring.
 */

const WEEKDAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
const MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Parsed as local parts, never `new Date(string)` — that reads as UTC. */
function parts(value: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) };
}

export function DateRangePicker({
  start,
  end,
  onChange,
  today,
}: {
  start: string;
  end: string;
  /** `end` is empty while a new range is being picked. */
  onChange: (range: { start: string; end: string }) => void;
  today: string;
}) {
  const anchor = parts(start) ?? parts(today)!;
  const [view, setView] = useState({ y: anchor.y, m: anchor.m });

  const grid = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    // getDay() is 0 for Sunday, which is also the first column here.
    const lead = first.getDay();
    const cells: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= daysInMonth; d += 1) cells.push(iso(view.y, view.m, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [view]);

  const step = (delta: number) => {
    const m = view.m + delta;
    setView({ y: view.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 });
  };

  const pick = (day: string) => {
    // A complete range, or a tap before the start, begins a new one.
    if (!start || (start && end) || day < start) {
      onChange({ start: day, end: '' });
      return;
    }
    onChange({ start, end: day });
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="חודש קודם"
          className="size-9 grid place-items-center rounded-xl text-muted hover:bg-subtle hover:text-ink transition"
        >
          <ChevronRight className="size-[18px]" />
        </button>
        <div className="text-[14px] font-light">
          {MONTHS[view.m]} {view.y}
        </div>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="חודש הבא"
          className="size-9 grid place-items-center rounded-xl text-muted hover:bg-subtle hover:text-ink transition"
        >
          <ChevronLeft className="size-[18px]" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-[11px] text-faint pb-1.5">
            {w}
          </div>
        ))}

        {grid.map((day, i) => {
          if (!day) return <div key={`pad-${i}`} />;
          const isStart = day === start;
          const isEnd = day === end;
          const inRange = !!end && day > start && day < end;
          const selected = isStart || isEnd;
          const single = isStart && !end;
          return (
            <div
              key={day}
              className={cn(
                'relative flex justify-center',
                // The connecting band sits behind the day, and is clipped at
                // whichever end the range stops.
                inRange && 'bg-accent-soft',
                isStart && !!end && 'bg-accent-soft rounded-e-full',
                isEnd && 'bg-accent-soft rounded-s-full'
              )}
            >
              <button
                type="button"
                onClick={() => pick(day)}
                aria-pressed={selected}
                aria-label={`${parts(day)!.d} ב${MONTHS[parts(day)!.m]}`}
                className={cn(
                  'size-10 grid place-items-center rounded-full text-[13.5px] transition ltr-nums',
                  selected && 'bg-accent text-white font-medium',
                  !selected && inRange && 'text-accent',
                  !selected && !inRange && 'hover:bg-subtle',
                  !selected && !inRange && day === today && 'ring-1 ring-inset ring-accent/40',
                  single && 'ring-2 ring-accent/30'
                )}
              >
                {parts(day)!.d}
              </button>
            </div>
          );
        })}
      </div>

      {start && !end && (
        <p className="text-[12px] text-muted text-center pt-2.5">
          עכשיו בוחרים את יום הסיום
        </p>
      )}
    </div>
  );
}
