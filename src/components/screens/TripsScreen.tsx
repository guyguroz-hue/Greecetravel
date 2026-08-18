'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { CalendarDays, Luggage, MapPin, Plus, Trash2, Users, Wallet } from 'lucide-react';
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
import { countryFlag, formatMoney, pluralDays, pluralTravelers } from '@/lib/utils/format';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog, EmptyState, LoadingScreen } from '@/components/ui/Feedback';
import { Badge, ProgressBar } from '@/components/ui/Bits';
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
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <span className="size-9 rounded-xl bg-brand text-brand-contrast grid place-items-center shrink-0">
            <Luggage className="size-5" />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-[17px] leading-tight">הטיולים שלי</h1>
            <p className="text-[12px] text-muted">
              {trips.length > 0 ? `${trips.length} טיולים` : 'עדיין אין טיולים'}
            </p>
          </div>
          <Button size="sm" onClick={() => router.push('/new')}>
            <Plus className="size-4" />
            טיול חדש
          </Button>
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

  const statusBadge = ended ? (
    <Badge tone="neutral">הסתיים</Badge>
  ) : started ? (
    <Badge tone="success">
      יום {dayNumber} מתוך {totalDays}
    </Badge>
  ) : (
    <Badge tone="brand">{relativeDayLabel(trip.startDate, today)}</Badge>
  );

  return (
    <div className="group bg-surface border border-line rounded-2xl shadow-card overflow-hidden hover:shadow-raised transition">
      <button type="button" onClick={onOpen} className="w-full text-start block">
        <CoverImage variant={trip.coverImage} rounded={false} className="h-32">
          <div className="h-32 flex flex-col justify-end p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg" aria-hidden>
                {countryFlag(trip.countryCode)}
              </span>
              <span className="text-white/85 text-[12px] font-medium truncate">
                {trip.destination}
              </span>
            </div>
            <h2 className="text-white font-semibold text-[17px] leading-tight truncate">
              {trip.name}
            </h2>
          </div>
        </CoverImage>

        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[13px] text-muted ltr-nums">
              <CalendarDays className="size-3.5 shrink-0" />
              {formatDateRange(trip.startDate, trip.endDate)}
            </span>
            {statusBadge}
          </div>

          <div className="flex items-center gap-3 text-[12.5px] text-muted">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {pluralDays(totalDays)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" />
              {pluralTravelers(travelers)}
            </span>
            <span className="inline-flex items-center gap-1 ltr-nums">
              <Wallet className="size-3.5" />
              {formatMoney(trip.totalBudget, trip.baseCurrency)}
            </span>
          </div>

          {trip.totalBudget > 0 && (
            <div className="space-y-1.5">
              <ProgressBar
                max={trip.totalBudget}
                value={budget.planned}
                segments={[
                  { value: budget.paid, color: 'var(--brand)' },
                  {
                    value: Math.max(0, Math.min(budget.upcoming, trip.totalBudget - budget.paid)),
                    color: 'color-mix(in oklab, var(--brand) 35%, transparent)',
                  },
                ]}
              />
              <div className="flex justify-between text-[11.5px] text-faint ltr-nums">
                <span>שולם {formatMoney(budget.paid, trip.baseCurrency)}</span>
                <span>מתוכנן {formatMoney(budget.planned, trip.baseCurrency)}</span>
              </div>
            </div>
          )}
        </div>
      </button>

      <div className="px-4 pb-3 flex justify-end">
        <button
          type="button"
          onClick={onDelete}
          aria-label={`מחיקת ${trip.name}`}
          className="text-faint hover:text-danger transition p-1.5 rounded-lg hover:bg-danger-soft"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}
