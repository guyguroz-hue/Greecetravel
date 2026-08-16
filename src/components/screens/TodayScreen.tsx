'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  BedDouble,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Navigation,
  Wallet,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useActiveTrip } from '@/lib/store/hooks';
import { useTripStore } from '@/lib/store/trip-store';
import { buildTimeline, computeDayStats, hotelForDay } from '@/lib/selectors/itinerary';
import { CATEGORY_META, type Activity } from '@/lib/types';
import {
  diffDays,
  formatDuration,
  formatWeekdayDate,
  nowHHMM,
  relativeDayLabel,
  timeToMinutes,
  todayISO,
} from '@/lib/utils/date';
import { formatKm, navigationLink } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Bits';
import { EmptyState } from '@/components/ui/Feedback';
import { Money } from '@/components/common/Money';
import { TravelLeg } from '@/components/itinerary/ActivityCard';

/**
 * The screen you actually open while standing in a car park in Zagori: big
 * touch targets, one column, current activity highlighted, Navigate one tap
 * away.
 */
export function TodayScreen() {
  const active = useActiveTrip();
  const updateActivity = useTripStore((s) => s.updateActivity);
  const today = todayISO();
  const [dayId, setDayId] = useState<string | null>(null);
  const [now, setNow] = useState(nowHHMM());

  // Keeps the "now" marker honest without a heavy timer.
  useEffect(() => {
    const t = setInterval(() => setNow(nowHHMM()), 60_000);
    return () => clearInterval(t);
  }, []);

  const days = useMemo(() => active?.days ?? [], [active]);
  const todayIndex = days.findIndex((d) => d.date === today);

  const currentIndex = useMemo(() => {
    if (dayId) {
      const i = days.findIndex((d) => d.id === dayId);
      if (i >= 0) return i;
    }
    if (todayIndex >= 0) return todayIndex;
    // Before the trip → day one; after it → the last day.
    return active && today > active.trip.endDate ? days.length - 1 : 0;
  }, [dayId, days, todayIndex, active, today]);

  const day = days[currentIndex];

  const { timeline, stats, hotel, dayCost, currentActivityId } = useMemo(() => {
    if (!active || !day) {
      return {
        timeline: [],
        stats: null,
        hotel: undefined,
        dayCost: 0,
        currentActivityId: null as string | null,
      };
    }
    const items = active.activities.filter((a) => a.dayId === day.id);
    const tl = buildTimeline(items);
    const cost = items.reduce((sum, a) => sum + (a.price ?? 0), 0);

    // "Now" is the last activity whose start time has already passed today.
    let currentId: string | null = null;
    if (day.date === today) {
      const nowMin = timeToMinutes(now) ?? 0;
      for (const entry of tl) {
        const start = timeToMinutes(entry.activity.startTime);
        if (start !== undefined && start <= nowMin) currentId = entry.activity.id;
      }
    }

    return {
      timeline: tl,
      stats: computeDayStats(items),
      hotel: hotelForDay(day, active.hotels),
      dayCost: cost,
      currentActivityId: currentId,
    };
  }, [active, day, today, now]);

  if (!active) return null;
  const { trip } = active;

  const beforeTrip = today < trip.startDate;
  const afterTrip = today > trip.endDate;

  return (
    <AppShell
      title="היום"
      subtitle={day ? `יום ${day.index} מתוך ${days.length}` : undefined}
      backHref="/more"
    >
      {(beforeTrip || afterTrip) && (
        <div
          className={cn(
            'rounded-2xl px-4 py-3.5 mb-4',
            beforeTrip ? 'bg-brand-soft text-brand' : 'bg-subtle text-muted'
          )}
        >
          <p className="text-[14px] font-semibold">
            {beforeTrip
              ? `הטיול מתחיל ${relativeDayLabel(trip.startDate, today)}`
              : 'הטיול הסתיים'}
          </p>
          <p className="text-[12.5px] mt-0.5 opacity-90">
            {beforeTrip
              ? `עוד ${diffDays(today, trip.startDate)} ימים ל${formatWeekdayDate(trip.startDate)}. בינתיים אפשר לעבור על היום הראשון.`
              : 'אפשר לעבור על הימים ולסגור הוצאות שנשארו פתוחות.'}
          </p>
        </div>
      )}

      {/* day switcher */}
      {day && (
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => setDayId(days[currentIndex - 1]?.id ?? null)}
            aria-label="יום קודם"
            className="size-10 shrink-0 grid place-items-center rounded-xl border border-line text-muted hover:bg-subtle disabled:opacity-35 transition"
          >
            <ChevronRight className="size-5" />
          </button>

          <div className="flex-1 min-w-0 text-center">
            <p className="font-semibold text-[15.5px] truncate">
              יום {day.index} — {day.title}
            </p>
            <p className="text-[12.5px] text-muted">
              {formatWeekdayDate(day.date)}
              {day.date === today && ' · היום'}
            </p>
          </div>

          <button
            type="button"
            disabled={currentIndex >= days.length - 1}
            onClick={() => setDayId(days[currentIndex + 1]?.id ?? null)}
            aria-label="יום הבא"
            className="size-10 shrink-0 grid place-items-center rounded-xl border border-line text-muted hover:bg-subtle disabled:opacity-35 transition"
          >
            <ChevronLeft className="size-5" />
          </button>
        </div>
      )}

      {todayIndex >= 0 && day?.date !== today && (
        <button
          type="button"
          onClick={() => setDayId(days[todayIndex].id)}
          className="w-full mb-4 h-10 rounded-xl bg-brand-soft text-brand text-[13.5px] font-medium"
        >
          חזרה להיום
        </button>
      )}

      {/* day summary */}
      {day && stats && (
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          <SummaryTile
            icon={<Clock className="size-3.5" />}
            label="פעילויות"
            value={String(stats.activityCount)}
          />
          <SummaryTile
            icon={<Navigation className="size-3.5" />}
            label="נסיעה"
            value={stats.drivingMin > 0 ? formatDuration(stats.drivingMin) : '—'}
            hint={stats.drivingKm > 0 ? formatKm(stats.drivingKm) : undefined}
          />
          <SummaryTile
            icon={<Wallet className="size-3.5" />}
            label="עלות היום"
            value={
              dayCost > 0 ? (
                <Money
                  amount={dayCost}
                  currency={trip.currencies[trip.currencies.length - 1]}
                  trip={trip}
                  hideConversion
                  inline
                />
              ) : (
                '—'
              )
            }
          />
        </div>
      )}

      {hotel && (
        <Card className="p-3.5 mb-4 flex items-center gap-3">
          <span className="size-10 shrink-0 grid place-items-center rounded-xl bg-brand-soft text-brand">
            <BedDouble className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] text-muted">הלינה הלילה</p>
            <p className="font-medium text-[14px] truncate">{hotel.name}</p>
            <p className="text-[12px] text-muted truncate">{hotel.city}</p>
          </div>
          {hotel.location && (
            <a
              href={navigationLink({ ...hotel.location, address: hotel.address })}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-brand text-brand-contrast text-[12.5px] font-semibold"
            >
              <Navigation className="size-3.5" />
              ניווט
            </a>
          )}
        </Card>
      )}

      {/* timeline */}
      {timeline.length === 0 ? (
        <EmptyState
          icon="🌤️"
          title="אין פעילויות ליום הזה"
          description="יום פנוי לגמרי. אפשר להוסיף משהו מהמסלול, או פשוט ליהנות."
          action={
            <Link href="/itinerary">
              <Button variant="secondary">פתיחת המסלול</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-1.5">
          {timeline.map((entry) => (
            <div key={entry.activity.id}>
              {entry.legFromPrev && <TravelLeg leg={entry.legFromPrev} />}
              <TodayRow
                activity={entry.activity}
                trip={trip}
                isCurrent={entry.activity.id === currentActivityId}
                onToggleDone={() =>
                  updateActivity(entry.activity.id, { done: !entry.activity.done })
                }
              />
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="bg-surface border border-line rounded-2xl p-3 text-center shadow-card">
      <div className="flex items-center justify-center gap-1 text-muted text-[11.5px]">
        {icon}
        {label}
      </div>
      <div className="text-[15px] font-semibold mt-1 ltr-nums">{value}</div>
      {hint && <div className="text-[10.5px] text-faint ltr-nums">{hint}</div>}
    </div>
  );
}

function TodayRow({
  activity,
  trip,
  isCurrent,
  onToggleDone,
}: {
  activity: Activity;
  trip: Parameters<typeof Money>[0]['trip'];
  isCurrent: boolean;
  onToggleDone: () => void;
}) {
  const meta = CATEGORY_META[activity.category];
  return (
    <div
      className={cn(
        'flex items-stretch gap-3 rounded-2xl border p-3 transition',
        isCurrent ? 'border-brand bg-brand-soft/40 shadow-card' : 'border-line bg-surface',
        activity.done && 'opacity-60'
      )}
    >
      <div className="w-12 shrink-0 text-center pt-0.5">
        <div
          className={cn(
            'text-[15px] font-semibold ltr-nums leading-tight',
            isCurrent && 'text-brand'
          )}
        >
          {activity.startTime ?? '—'}
        </div>
        {isCurrent && <div className="text-[10px] text-brand font-medium mt-0.5">עכשיו</div>}
      </div>

      <div className="w-1 shrink-0 rounded-full" style={{ background: meta.color }} aria-hidden />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3
            className={cn(
              'font-medium text-[15px] leading-snug',
              activity.done && 'line-through'
            )}
          >
            <span className="me-1" aria-hidden>
              {meta.emoji}
            </span>
            {activity.title}
          </h3>
          {activity.price !== undefined && (
            <Money
              amount={activity.price}
              currency={activity.currency}
              trip={trip}
              className="text-[13px] font-semibold shrink-0"
            />
          )}
        </div>

        {activity.address && (
          <p className="text-[12px] text-muted mt-0.5 truncate">{activity.address}</p>
        )}
        {activity.notes && (
          <p className="text-[12.5px] text-muted mt-1.5 bg-inset rounded-lg px-2.5 py-1.5 leading-relaxed">
            {activity.notes}
          </p>
        )}
        {activity.bookingRef && (
          <Badge tone="success" className="mt-1.5">
            <span className="ltr-nums">{activity.bookingRef}</span>
          </Badge>
        )}

        <div className="flex items-center gap-2 mt-2.5">
          {activity.location && (
            <a
              href={navigationLink({ ...activity.location, address: activity.address })}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-brand text-brand-contrast text-[12.5px] font-semibold"
            >
              <Navigation className="size-3.5" />
              ניווט
            </a>
          )}
          <button
            type="button"
            onClick={onToggleDone}
            aria-pressed={!!activity.done}
            className={cn(
              'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl text-[12.5px] font-medium border transition',
              activity.done
                ? 'bg-success-soft text-success border-transparent'
                : 'border-line text-muted hover:bg-subtle'
            )}
          >
            <Check className="size-3.5" />
            {activity.done ? 'בוצע' : 'סמן כבוצע'}
          </button>
        </div>
      </div>
    </div>
  );
}
