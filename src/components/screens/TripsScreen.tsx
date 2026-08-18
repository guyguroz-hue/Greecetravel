'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTripStore } from '@/lib/store/trip-store';
import { useTripStatus } from '@/lib/store/hooks';
import { toast } from '@/lib/store/ui-store';
import { computeBudget } from '@/lib/selectors/budget';
import type { Trip } from '@/lib/types';
import {
  daysBetweenInclusive,
  diffDays,
  formatDateRange,
  relativeDayLabel,
  todayISO,
} from '@/lib/utils/date';
import { countryFlag, formatMoney } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog, EmptyState, LoadingScreen } from '@/components/ui/Feedback';
import { ProgressBar } from '@/components/ui/Bits';
import { CoverImage } from '@/components/layout/CoverImage';
import { TripsAccountBar } from './TripsAccountBar';

export function TripsScreen() {
  const status = useTripStatus();
  const data = useTripStore((s) => s.data);
  const setActiveTrip = useTripStore((s) => s.setActiveTrip);
  const deleteTrip = useTripStore((s) => s.deleteTrip);
  const undo = useTripStore((s) => s.undo);
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = useState<Trip | null>(null);
  const today = todayISO();

  const trips = useMemo(() => {
    return [...data.trips].sort((a, b) => {
      // Upcoming and in-progress trips first, then the most recent past ones.
      const aOver = a.endDate < today;
      const bOver = b.endDate < today;
      if (aOver !== bOver) return aOver ? 1 : -1;
      return aOver
        ? b.endDate.localeCompare(a.endDate)
        : a.startDate.localeCompare(b.startDate);
    });
  }, [data.trips, today]);

  const open = (id: string) => {
    setActiveTrip(id);
    router.push('/dashboard');
  };

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="min-h-dvh grid place-items-center">
        <LoadingScreen label="טוען טיולים…" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 bg-bg/85 backdrop-blur-lg border-b border-line">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-[4.5rem] flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-[11.5px] tracking-[0.2em] text-muted">הטיולים שלי</h1>
            <p className="text-[15px] font-light mt-1">
              {trips.length > 0
                ? `${trips.length === 1 ? 'טיול אחד' : `${trips.length} טיולים`} מתוכנן`
                : 'עדיין אין טיולים'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/new')}
            aria-label="טיול חדש"
            className="size-11 rounded-full border border-line grid place-items-center text-ink hover:bg-subtle transition"
          >
            <Plus className="size-[19px] stroke-[1.5]" />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-5 pb-16">
        <TripsAccountBar />

        {trips.length === 0 ? (
          <EmptyState
            icon="🧳"
            title="בואו נתחיל לתכנן"
            description="כאן ייווצר הטיול הראשון — מסלול, מלונות, טיסות ותקציב, הכל במקום אחד."
            action={
              <Button onClick={() => router.push('/new')}>
                <Plus className="size-4" />
                יצירת טיול חדש
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {trips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                today={today}
                travelers={data.travelers.filter((t) => t.tripId === trip.id).length}
                expenses={data.expenses.filter((e) => e.tripId === trip.id)}
                onOpen={() => open(trip.id)}
                onDelete={() => setPendingDelete(trip)}
              />
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <Link href="/settings" className="text-[13px] text-muted hover:text-brand transition">
            הגדרות, גיבוי ושחזור נתונים
          </Link>
        </div>
      </main>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`למחוק את "${pendingDelete?.name}"?`}
        message="כל המסלול, המלונות, הטיסות, המסמכים וההוצאות של הטיול יימחקו. אפשר יהיה לבטל מיד לאחר מכן."
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const name = pendingDelete?.name ?? '';
          if (pendingDelete) deleteTrip(pendingDelete.id);
          setPendingDelete(null);
          toast.show(`"${name}" נמחק`, {
            action: {
              label: 'בטל',
              onClick: () => {
                undo();
                toast.success('הטיול שוחזר');
              },
            },
          });
        }}
      />
    </div>
  );
}

/** One number in the card's figures row. */
function Figure({
  value,
  label,
  className,
  small,
}: {
  value: string;
  label: string;
  className?: string;
  small?: boolean;
}) {
  return (
    <div className={cn('px-3 py-4 text-center', className)}>
      <div
        className={cn(
          'font-extralight leading-none ltr-nums',
          small ? 'text-[19px]' : 'text-[26px]'
        )}
      >
        {value}
      </div>
      <div className="mt-2 text-[11px] tracking-[0.06em] text-muted">{label}</div>
    </div>
  );
}

function TripCard({
  trip,
  today,
  travelers,
  expenses,
  onOpen,
  onDelete,
}: {
  trip: Trip;
  today: string;
  travelers: number;
  expenses: Parameters<typeof computeBudget>[1];
  onOpen: () => void;
  onDelete: () => void;
}) {
  const totalDays = daysBetweenInclusive(trip.startDate, trip.endDate);
  const budget = computeBudget(trip, expenses, travelers);
  const started = today >= trip.startDate;
  const ended = today > trip.endDate;
  const dayNumber = started && !ended ? diffDays(trip.startDate, today) + 1 : 0;

  // On the cover rather than beside the dates: it is the one fact worth
  // reading before the trip's name, and glass keeps it from competing with it.
  const statusLabel = ended
    ? 'הסתיים'
    : started
      ? `יום ${dayNumber} מתוך ${totalDays}`
      : relativeDayLabel(trip.startDate, today);

  return (
    <div className="group relative bg-surface border border-line rounded-2xl shadow-card overflow-hidden hover:shadow-raised transition">
      <button type="button" onClick={onOpen} className="w-full text-start block">
        <CoverImage variant={trip.coverImage} rounded={false} className="h-64">
          <div className="h-64 flex flex-col justify-end p-5">
            <span className="absolute top-4 end-4 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-[11.5px] text-white backdrop-blur-md">
              {statusLabel}
            </span>

            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-base leading-none" aria-hidden>
                {countryFlag(trip.countryCode)}
              </span>
              <span className="truncate text-[11.5px] tracking-[0.16em] text-sand-200">
                {trip.destination}
              </span>
            </div>
            <h2 className="truncate text-[34px] font-extralight leading-[1.05] tracking-[-0.03em] text-white">
              {trip.name}
            </h2>
            <p className="mt-2 text-[13px] font-light text-white/75 ltr-nums">
              {formatDateRange(trip.startDate, trip.endDate)}
            </p>
          </div>
        </CoverImage>

        {/* Figures separated by hairlines instead of boxed into four tiles —
            the numbers carry the weight, the labels stay quiet. */}
        <div className="grid grid-cols-3">
          <Figure value={String(totalDays)} label="ימים" />
          <Figure
            value={String(travelers)}
            label="מטיילים"
            className="border-x border-line"
          />
          <Figure
            value={formatMoney(trip.totalBudget, trip.baseCurrency)}
            label="תקציב"
            small
          />
        </div>

        {trip.totalBudget > 0 && (
          <div className="border-t border-line px-5 py-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12.5px] tracking-[0.04em] text-muted">שולם עד כה</span>
              <span className="text-[13.5px] font-light ltr-nums">
                {formatMoney(budget.paid, trip.baseCurrency)}
                <span className="text-muted">
                  {' '}
                  מתוך {formatMoney(budget.planned, trip.baseCurrency)}
                </span>
              </span>
            </div>
            <ProgressBar
              className="mt-2.5"
              max={trip.totalBudget}
              value={budget.planned}
              segments={[
                { value: budget.paid, color: 'linear-gradient(90deg,#db8629,#e3a33f)' },
                {
                  value: Math.max(0, Math.min(budget.upcoming, trip.totalBudget - budget.paid)),
                  color: 'color-mix(in oklab, var(--accent) 28%, transparent)',
                },
              ]}
            />
          </div>
        )}
      </button>

      <button
        type="button"
        onClick={onDelete}
        aria-label={`מחיקת ${trip.name}`}
        className="absolute top-4 start-4 size-9 rounded-full border border-white/20 bg-white/10 text-white/80 backdrop-blur-md grid place-items-center opacity-0 transition hover:bg-danger/80 hover:text-white focus-visible:opacity-100 group-hover:opacity-100 max-lg:opacity-100"
      >
        <Trash2 className="size-4 stroke-[1.6]" />
      </button>
    </div>
  );
}
