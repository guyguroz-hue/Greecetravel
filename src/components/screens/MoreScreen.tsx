'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ChevronLeft, Luggage } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { SECONDARY_NAV } from '@/components/layout/nav-items';
import { useActiveTrip } from '@/lib/store/hooks';
import { computeBookings } from '@/lib/selectors/alerts';
import { countryFlag } from '@/lib/utils/format';
import { formatDateRange } from '@/lib/utils/date';
import { Card } from '@/components/ui/Card';

export function MoreScreen() {
  const active = useActiveTrip();

  const counts = useMemo(() => {
    if (!active) return {} as Record<string, string>;
    const bookings = computeBookings(active.hotels, active.flights, active.cars, active.activities);
    const unbooked = bookings.filter((b) => !b.booked).length;
    const checklistItems = active.checklists.reduce((n, c) => n + c.items.length, 0);
    const checklistDone = active.checklists.reduce(
      (n, c) => n + c.items.filter((i) => i.done).length,
      0
    );
    return {
      '/hotels': `${active.hotels.length}`,
      '/flights': `${active.flights.length}`,
      '/car': `${active.cars.length}`,
      '/places': `${active.places.length}`,
      '/documents': `${active.documents.length}`,
      '/checklists': checklistItems > 0 ? `${checklistDone}/${checklistItems}` : '0',
      '/today': '',
      '/search': '',
      '/assistant': '',
      '/settings': unbooked > 0 ? `${unbooked} ללא הזמנה` : '',
    };
  }, [active]);

  if (!active) return null;
  const { trip, travelers } = active;

  return (
    <AppShell title="עוד" subtitle={trip.name}>
      <Link href="/">
        <Card className="p-4 mb-4 flex items-center gap-3 hover:shadow-raised transition">
          <span className="size-11 shrink-0 grid place-items-center rounded-xl bg-brand-soft text-brand text-xl">
            {countryFlag(trip.countryCode) || <Luggage className="size-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[15px] truncate">{trip.name}</p>
            <p className="text-[12.5px] text-muted ltr-nums">
              {formatDateRange(trip.startDate, trip.endDate)} · {travelers.length} מטיילים
            </p>
          </div>
          <span className="text-[12.5px] text-brand font-medium shrink-0">החלפת טיול</span>
          <ChevronLeft className="size-4 text-faint shrink-0" />
        </Card>
      </Link>

      <Card className="divide-y divide-[var(--border)] overflow-hidden">
        {SECONDARY_NAV.map((item) => {
          const Icon = item.icon;
          const badge = counts[item.href];
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-subtle transition group"
            >
              <span className="size-9 shrink-0 grid place-items-center rounded-xl bg-subtle text-muted group-hover:bg-brand-soft group-hover:text-brand transition">
                <Icon className="size-[18px]" />
              </span>
              <span className="flex-1 text-[15px] font-medium">{item.label}</span>
              {badge ? (
                <span className="text-[12.5px] text-muted ltr-nums shrink-0">{badge}</span>
              ) : null}
              <ChevronLeft className="size-4 text-faint shrink-0" />
            </Link>
          );
        })}
      </Card>

      <p className="text-[11.5px] text-faint text-center mt-6">
        My Trip Planner · הנתונים נשמרים במכשיר שלך
      </p>
    </AppShell>
  );
}
