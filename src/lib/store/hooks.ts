'use client';

import { useMemo } from 'react';
import { useTripStore } from './trip-store';
import {
  type Activity,
  type CarRental,
  type Checklist,
  type Day,
  type Expense,
  type Flight,
  type Hotel,
  type Place,
  type ShareMember,
  type Traveler,
  type Trip,
  type TripDocument,
} from '@/lib/types';

export interface ActiveTrip {
  trip: Trip;
  travelers: Traveler[];
  days: Day[];
  activities: Activity[];
  hotels: Hotel[];
  flights: Flight[];
  cars: CarRental[];
  places: Place[];
  expenses: Expense[];
  documents: TripDocument[];
  checklists: Checklist[];
  shares: ShareMember[];
}

/**
 * Everything belonging to the currently open trip, already filtered and
 * sorted. Returns null while the store is still hydrating or when no trip is
 * selected, so screens can render their loading/empty states.
 */
export function useActiveTrip(): ActiveTrip | null {
  const data = useTripStore((s) => s.data);
  const activeTripId = useTripStore((s) => s.activeTripId);

  return useMemo(() => {
    if (!activeTripId) return null;
    const trip = data.trips.find((t) => t.id === activeTripId);
    if (!trip) return null;

    const days = data.days
      .filter((d) => d.tripId === trip.id)
      .sort((a, b) => a.date.localeCompare(b.date));
    const dayIds = new Set(days.map((d) => d.id));

    return {
      trip,
      travelers: data.travelers.filter((t) => t.tripId === trip.id),
      days,
      activities: data.activities.filter((a) => a.tripId === trip.id && dayIds.has(a.dayId)),
      hotels: data.hotels
        .filter((h) => h.tripId === trip.id)
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn)),
      flights: data.flights
        .filter((f) => f.tripId === trip.id)
        .sort((a, b) => a.date.localeCompare(b.date)),
      cars: data.cars.filter((c) => c.tripId === trip.id),
      places: data.places.filter((p) => p.tripId === trip.id),
      expenses: data.expenses
        .filter((e) => e.tripId === trip.id)
        .sort((a, b) => b.date.localeCompare(a.date)),
      documents: data.documents
        .filter((d) => d.tripId === trip.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      checklists: data.checklists.filter((c) => c.tripId === trip.id),
      shares: data.shares.filter((s) => s.tripId === trip.id),
    };
  }, [data, activeTripId]);
}

export function useTripStatus() {
  return useTripStore((s) => s.status);
}

export function useAllTrips() {
  return useTripStore((s) => s.data.trips);
}
