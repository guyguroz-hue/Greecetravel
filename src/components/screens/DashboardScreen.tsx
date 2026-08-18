'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import {
  BedDouble,
  CalendarDays,
  CarFront,
  ChevronLeft,
  MapPin,
  Plane,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { CoverImage } from '@/components/layout/CoverImage';
import { useActiveTrip } from '@/lib/store/hooks';
import { computeBudget } from '@/lib/selectors/budget';
import { computeAlerts, computeBookings } from '@/lib/selectors/alerts';
import { buildTimeline, groupActivitiesByDay, hotelForDay } from '@/lib/selectors/itinerary';
import {
  daysBetweenInclusive,
  diffDays,
  eachDate,
  formatDateRange,
  formatDayMonth,
  formatWeekdayDate,
  relativeDayLabel,
  todayISO,
} from '@/lib/utils/date';
import {
  countryFlag,
  formatMoney,
  formatPercent,
  pluralDays,
  pluralNights,
  pluralTravelers,
} from '@/lib/utils/format';
import { CATEGORY_META } from '@/lib/types';
import { cn } from '@/lib/utils/cn';
import { Card, SectionTitle, Stat } from '@/components/ui/Card';
import { AvatarGroup, Badge, BlockProgress, ProgressBar } from '@/components/ui/Bits';
import { EmptyState } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';

export function DashboardScreen() {
  const active = useActiveTrip();
  const today = todayISO();

  const derived = useMemo(() => {
    if (!active) return null;
    const { trip, days, activities, hotels, flights, cars, expenses, travelers, places } = active;

    const byDay = groupActivitiesByDay(activities);
    const budget = computeBudget(trip, expenses, travelers.length);
    const bookings = computeBookings(hotels, flights, cars, activities);
    const alerts = computeAlerts({
      trip,
      days,
      activities,
      hotels,
      flights,
      cars,
      expenses,
      today,
    });

    const totalDays = daysBetweenInclusive(trip.startDate, trip.endDate);
    const started = today >= trip.startDate;
    const ended = today > trip.endDate;
    const dayNumber = started ? Math.min(totalDays, diffDays(trip.startDate, today) + 1) : 0;

    const nights = eachDate(trip.startDate, trip.endDate).slice(0, -1);
    const bookedNights = nights.filter((d) =>
      hotels.some((h) => h.booked && d >= h.checkIn && d < h.checkOut)
    ).length;

    const plannedDays = days.filter((d) => (byDay.get(d.id) ?? []).length > 0).length;

    // The day to feature: today when we're mid-trip, otherwise day one.
    const focusDay = ended ? days[days.length - 1] : (days.find((d) => d.date === today) ?? days[0]);
    const focusActivities = focusDay ? (byDay.get(focusDay.id) ?? []) : [];

    const upcoming = days
      .filter((d) => d.date > today)
      .slice(0, 3)
      .map((d) => ({ day: d, count: (byDay.get(d.id) ?? []).length }));

    return {
      budget,
      bookings,
      alerts,
      totalDays,
      started,
      ended,
      dayNumber,
      nights: nights.length,
      bookedNights,
      plannedDays,
      focusDay,
      focusActivities,
      focusHotel: focusDay ? hotelForDay(focusDay, hotels) : undefined,
      upcoming,
      unbookedCount: bookings.filter((b) => !b.booked).length,
      unpaidCount: expenses.filter((e) => !e.paid).length,
      placesUnscheduled: places.filter((p) => !p.dayId).length,
    };
  }, [active, today]);

  if (!active || !derived) return null;
  const { trip, travelers, hotels, flights, cars, activities } = active;
  const withLocation = activities.filter((a) => a.location).length;

  return (
    <AppShell
      title={trip.name}
      subtitle={formatDateRange(trip.startDate, trip.endDate)}
      actions={
        <Link
          href="/assistant"
          aria-label="עוזר AI"
          className="size-9 grid place-items-center rounded-xl text-muted hover:bg-subtle hover:text-brand transition"
        >
          <Sparkles className="size-[18px]" />
        </Link>
      }
    >
      {/* ---------------- hero ---------------- */}
      <CoverImage variant={trip.coverImage} className="mb-4">
        <div className="p-4 pt-16 sm:pt-20">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xl" aria-hidden>
              {countryFlag(trip.countryCode)}
            </span>
            <span className="text-white/85 text-[13px] font-medium">{trip.destination}</span>
          </div>
          <h2 className="text-white font-semibold text-[21px] leading-tight">{trip.name}</h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-white/85 text-[12.5px]">
            <span className="ltr-nums">{formatDateRange(trip.startDate, trip.endDate)}</span>
            <span aria-hidden>·</span>
            <span>{pluralDays(derived.totalDays)}</span>
            <span aria-hidden>·</span>
            <span>{pluralTravelers(travelers.length)}</span>
            <span aria-hidden>·</span>
            <span>{trip.baseCurrency}</span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <AvatarGroup people={travelers} max={5} />
            {derived.started && !derived.ended ? (
              <Badge tone="success">
                יום {derived.dayNumber} מתוך {derived.totalDays}
              </Badge>
            ) : derived.ended ? (
              <Badge tone="neutral">הטיול הסתיים</Badge>
            ) : (
              <Badge tone="brand">{relativeDayLabel(trip.startDate, today)}</Badge>
            )}
          </div>
        </div>
      </CoverImage>

      {/* ---------------- alerts ---------------- */}
      {derived.alerts.length > 0 && (
        <section className="mb-5">
          <SectionTitle>התראות</SectionTitle>
          <div className="space-y-2">
            {derived.alerts.slice(0, 4).map((alert) => (
              <Link
                key={alert.id}
                href={alert.href ?? '#'}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-2xl border transition hover:shadow-card',
                  alert.severity === 'danger' && 'bg-danger-soft border-transparent',
                  alert.severity === 'warning' && 'bg-warning-soft border-transparent',
                  alert.severity === 'info' && 'bg-surface border-line'
                )}
              >
                <span className="text-base leading-none mt-0.5 shrink-0" aria-hidden>
                  {alert.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block text-[13.5px] font-medium',
                      alert.severity === 'danger' && 'text-danger',
                      alert.severity === 'warning' && 'text-warning'
                    )}
                  >
                    {alert.title}
                  </span>
                  {alert.detail && (
                    <span className="block text-[12px] text-muted mt-0.5 truncate">
                      {alert.detail}
                    </span>
                  )}
                </span>
                <ChevronLeft className="size-4 text-faint shrink-0 mt-0.5" />
              </Link>
            ))}
            {derived.alerts.length > 4 && (
              <p className="text-[12px] text-faint text-center pt-1">
                ועוד {derived.alerts.length - 4} התראות
              </p>
            )}
          </div>
        </section>
      )}

      {/* ---------------- progress ---------------- */}
      <section className="mb-5 grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-[13px] font-semibold text-muted">התקדמות הטיול</h3>
            <span className="text-[12px] text-faint ltr-nums">
              {derived.started
                ? `${derived.dayNumber} / ${derived.totalDays}`
                : `0 / ${derived.totalDays}`}
            </span>
          </div>
          <BlockProgress current={derived.dayNumber} total={derived.totalDays} />
          <p className="text-[12.5px] text-muted mt-2.5">
            {derived.ended
              ? 'הטיול הסתיים — אפשר לסגור את המאזן בתקציב.'
              : derived.started
                ? `יום ${derived.dayNumber} מתוך ${derived.totalDays}`
                : `יוצאים ${relativeDayLabel(trip.startDate, today)}`}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-[13px] font-semibold text-muted">התקדמות תקציב</h3>
            <span className="text-[12px] text-faint ltr-nums">
              {trip.totalBudget > 0 ? formatPercent(derived.budget.paid / trip.totalBudget) : '—'}
            </span>
          </div>
          <ProgressBar
            max={Math.max(trip.totalBudget, derived.budget.planned, 1)}
            value={derived.budget.planned}
            segments={[
              { value: derived.budget.paid, color: 'var(--brand)' },
              {
                value: Math.max(0, derived.budget.upcoming),
                color: 'color-mix(in oklab, var(--brand) 32%, transparent)',
              },
            ]}
          />
          <p className="text-[12.5px] text-muted mt-2.5 ltr-nums">
            {formatMoney(derived.budget.paid, trip.baseCurrency)} /{' '}
            {formatMoney(trip.totalBudget, trip.baseCurrency)}
          </p>
        </Card>
      </section>

      {/* ---------------- info cards ---------------- */}
      <section className="mb-5">
        <SectionTitle>סקירה</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-px bg-line rounded-2xl overflow-hidden border border-line shadow-card">
          <Link href="/flights">
            <Stat
              icon={<Plane className="size-3.5" />}
              label="טיסות"
              value={flights.length}
              hint={
                flights.length > 0
                  ? flights.map((f) => f.flightNumber || '—').join(' · ')
                  : 'עוד לא נוספו'
              }
            />
          </Link>
          <Link href="/hotels">
            <Stat
              icon={<BedDouble className="size-3.5" />}
              label="מלונות"
              value={hotels.length}
              hint={`${derived.bookedNights} / ${derived.nights} לילות מוזמנים`}
              tone={derived.bookedNights < derived.nights ? 'warning' : 'default'}
            />
          </Link>
          <Link href="/car">
            <Stat
              icon={<CarFront className="size-3.5" />}
              label="רכב"
              value={cars.length > 0 ? (cars[0].company || 'רכב') : '—'}
              hint={cars.length > 0 ? cars[0].carType : 'לא הוזמן רכב'}
            />
          </Link>
          <Link href="/map">
            <Stat
              icon={<MapPin className="size-3.5" />}
              label="מקומות במסלול"
              value={withLocation}
              hint={`מתוך ${activities.length} פעילויות`}
            />
          </Link>
          <Link href="/budget">
            <Stat
              icon={<Wallet className="size-3.5" />}
              label="נותר בתקציב"
              value={formatMoney(derived.budget.remaining, trip.baseCurrency)}
              hint={`מתוכנן ${formatMoney(derived.budget.planned, trip.baseCurrency)}`}
              tone={derived.budget.remaining < 0 ? 'danger' : 'success'}
            />
          </Link>
          <Link href="/itinerary">
            <Stat
              icon={<CalendarDays className="size-3.5" />}
              label="ימים מתוכננים"
              value={`${derived.plannedDays} / ${derived.totalDays}`}
              hint={`${activities.length} פעילויות`}
            />
          </Link>
        </div>
      </section>

      {/* ---------------- open items ---------------- */}
      <section className="mb-5">
        <SectionTitle>מה עוד פתוח</SectionTitle>
        <Card className="divide-y divide-[var(--border)]">
          <OpenItem
            href="/hotels"
            label="לילות ללא הזמנה"
            value={derived.nights - derived.bookedNights}
          />
          <OpenItem href="/budget" label="הזמנות שטרם שולמו" value={derived.unpaidCount} />
          <OpenItem href="/more" label="פריטים ללא הזמנה" value={derived.unbookedCount} />
          <OpenItem
            href="/places"
            label="מקומות שעדיין לא במסלול"
            value={derived.placesUnscheduled}
          />
        </Card>
      </section>

      {/* ---------------- what's happening ---------------- */}
      <section className="mb-5">
        <SectionTitle
          action={
            <Link href="/today" className="text-[12.5px] font-medium text-brand">
              מסך היום
            </Link>
          }
        >
          {derived.started && !derived.ended ? 'מה קורה היום?' : 'היום הראשון'}
        </SectionTitle>

        {derived.focusDay ? (
          <Card className="overflow-hidden">
            <div className="px-4 py-3 bg-inset border-b border-line">
              <p className="font-semibold text-[14px]">
                יום {derived.focusDay.index} — {derived.focusDay.title}
              </p>
              <p className="text-[12px] text-muted mt-0.5">
                {formatWeekdayDate(derived.focusDay.date)}
                {derived.focusHotel && ` · 🏨 ${derived.focusHotel.name}`}
              </p>
            </div>
            {derived.focusActivities.length === 0 ? (
              <div className="px-4 py-6 text-center text-[13px] text-muted">
                אין פעילויות ליום הזה עדיין.
              </div>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {buildTimeline(derived.focusActivities)
                  .slice(0, 7)
                  .map(({ activity }) => {
                    const meta = CATEGORY_META[activity.category];
                    return (
                      <li key={activity.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="w-11 shrink-0 text-[13px] font-semibold ltr-nums text-center">
                          {activity.startTime ?? '—'}
                        </span>
                        <span className="text-base shrink-0" aria-hidden>
                          {meta.emoji}
                        </span>
                        <span className="flex-1 min-w-0 text-[14px] truncate">
                          {activity.title}
                        </span>
                      </li>
                    );
                  })}
              </ul>
            )}
            {derived.focusActivities.length > 7 && (
              <div className="px-4 py-2 text-center border-t border-line">
                <Link href="/itinerary" className="text-[12.5px] text-brand font-medium">
                  עוד {derived.focusActivities.length - 7} פעילויות
                </Link>
              </div>
            )}
          </Card>
        ) : (
          <EmptyState
            icon="📅"
            title="עוד לא נבנה מסלול"
            description="אפשר להתחיל מהוספת פעילות ליום הראשון."
            action={
              <Link href="/itinerary">
                <Button>פתיחת המסלול</Button>
              </Link>
            }
          />
        )}
      </section>

      {/* ---------------- coming up ---------------- */}
      {derived.upcoming.length > 0 && (
        <section>
          <SectionTitle>הלו״ז הקרוב</SectionTitle>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {derived.upcoming.map(({ day, count }) => (
              <Link key={day.id} href="/itinerary">
                <Card className="p-3.5 hover:shadow-raised transition h-full">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] text-muted ltr-nums">
                      {formatDayMonth(day.date)}
                    </span>
                    <span className="text-[11.5px] text-faint">יום {day.index}</span>
                  </div>
                  <p className="font-medium text-[14px] mt-1 truncate">{day.title}</p>
                  <p className="text-[12px] text-muted mt-0.5">{count} פעילויות</p>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mt-6 flex items-center justify-center gap-2 text-[12.5px] text-faint">
        <Users className="size-3.5" />
        <Link href="/settings" className="hover:text-brand transition">
          {pluralTravelers(travelers.length)} · {pluralNights(derived.nights)} · ניהול הטיול
        </Link>
      </div>
    </AppShell>
  );
}

function OpenItem({ href, label, value }: { href: string; label: string; value: number }) {
  return (
    <Link href={href} className="flex items-center justify-between gap-3 px-4 py-3 group">
      <span className="text-[14px]">{label}</span>
      <span className="flex items-center gap-2">
        <span
          className={cn(
            'text-[14px] font-semibold ltr-nums',
            value > 0 ? 'text-warning' : 'text-success'
          )}
        >
          {value}
        </span>
        <ChevronLeft className="size-4 text-faint group-hover:text-brand transition" />
      </span>
    </Link>
  );
}
