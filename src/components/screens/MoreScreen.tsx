'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ChevronLeft, Luggage, Share2, Users } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { SECONDARY_GROUPS } from '@/components/layout/nav-items';
import { useActiveTrip } from '@/lib/store/hooks';
import { useAuthStore } from '@/lib/store/auth-store';
import { computeBookings } from '@/lib/selectors/alerts';
import { countryFlag } from '@/lib/utils/format';
import { formatDateRange } from '@/lib/utils/date';
import { SectionTitle } from '@/components/ui/Card';

export function MoreScreen() {
  const active = useActiveTrip();
  const authStatus = useAuthStore((s) => s.status);

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
      '/checklists': checklistItems > 0 ? `${checklistDone}/${checklistItems}` : '',
      '/settings': unbooked > 0 ? `${unbooked} ללא הזמנה` : '',
    };
  }, [active]);

  if (!active) return null;
  const { trip, travelers } = active;

  return (
    <AppShell title="עוד" subtitle={trip.name}>
      {/* The trip itself, and the way back to the others. */}
      <Link
        href="/"
        className="flex items-center gap-3.5 rounded-2xl border border-line bg-surface px-4 py-3.5 mb-5 hover:bg-subtle transition"
      >
        <span className="size-11 shrink-0 grid place-items-center rounded-2xl bg-accent-soft text-[19px]">
          {countryFlag(trip.countryCode) || <Luggage className="size-5 text-accent" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] truncate">{trip.name}</p>
          <p className="text-[12.5px] text-muted ltr-nums mt-0.5">
            {formatDateRange(trip.startDate, trip.endDate)} · {travelers.length} מטיילים
          </p>
        </div>
        <span className="text-[12.5px] text-muted shrink-0">החלפה</span>
        <ChevronLeft className="size-4 text-faint shrink-0" />
      </Link>

      {/* Promoted out of the list: this is the thing people come here looking
          for and previously could not find at all. */}
      <Link
        href="/share"
        className="flex items-center gap-3.5 rounded-2xl border border-accent/25 bg-accent-soft px-4 py-4 mb-6 transition hover:brightness-[0.98]"
      >
        <span className="size-11 shrink-0 grid place-items-center rounded-2xl bg-accent text-white">
          <Share2 className="size-5 stroke-[1.5]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] text-accent">שיתוף הטיול עם אנשים</p>
          <p className="text-[12.5px] text-accent/80 mt-0.5 leading-snug">
            {authStatus === 'signed-in'
              ? 'קישור או הזמנה במייל — כולם על אותו טיול, בזמן אמת'
              : 'כולם רואים את אותו מסלול ותקציב, בזמן אמת'}
          </p>
        </div>
        <ChevronLeft className="size-4 text-accent/60 shrink-0" />
      </Link>

      {SECONDARY_GROUPS.map((group) => {
        // Sharing has its own card above; listing it again in "הטיול" would
        // read as two different destinations.
        const items = group.items.filter((i) => i.href !== '/share');
        if (items.length === 0) return null;
        return (
        <section key={group.title} className="mb-5">
          <SectionTitle>{group.title}</SectionTitle>
          <div className="rounded-2xl border border-line overflow-hidden divide-y divide-[var(--border)]">
            {items.map((item) => {
              const Icon = item.icon;
              const badge = counts[item.href];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3.5 bg-surface px-4 py-3.5 hover:bg-subtle transition"
                >
                  <Icon className="size-[18px] shrink-0 stroke-[1.5] text-muted" />
                  <span className="flex-1 text-[14.5px]">{item.label}</span>
                  {badge ? (
                    <span className="text-[12.5px] font-light text-faint ltr-nums shrink-0">
                      {badge}
                    </span>
                  ) : null}
                  <ChevronLeft className="size-4 text-faint shrink-0" />
                </Link>
              );
            })}
          </div>
        </section>
        );
      })}

      <p className="flex items-center justify-center gap-1.5 text-[11.5px] text-faint text-center mt-6">
        <Users className="size-3.5" />
        {authStatus === 'signed-in'
          ? 'הטיול מסונכרן בחשבון שלך'
          : 'הנתונים נשמרים במכשיר הזה בלבד'}
      </p>
    </AppShell>
  );
}
