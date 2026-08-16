import {
  type Activity,
  type Booking,
  type CarRental,
  type Day,
  type Expense,
  type Flight,
  type Hotel,
  type ID,
  type Trip,
  type TripAlert,
} from '@/lib/types';
import { computeDayStats, groupActivitiesByDay, isOverloadedDay } from './itinerary';
import { diffDays, eachDate, formatCompactRange, formatDayMonth, todayISO } from '@/lib/utils/date';

/** Unified booking view over hotels, flights, cars and bookable activities. */
export function computeBookings(
  hotels: Hotel[],
  flights: Flight[],
  cars: CarRental[],
  activities: Activity[]
): Booking[] {
  const out: Booking[] = [
    ...flights.map<Booking>((f) => ({
      id: f.id,
      type: 'flight',
      title: `${f.airline} ${f.flightNumber}`,
      subtitle: `${f.from.code} → ${f.to.code}`,
      date: f.date,
      booked: !!f.booked,
      paid: !!f.paid,
      reference: f.bookingRef,
      url: f.bookingUrl,
      amount: f.price,
      currency: f.currency,
    })),
    ...hotels.map<Booking>((h) => ({
      id: h.id,
      type: 'hotel',
      title: h.name,
      subtitle: `${h.city} · ${formatCompactRange(h.checkIn, h.checkOut)}`,
      date: h.checkIn,
      booked: !!h.booked,
      paid: !!h.paid,
      reference: h.bookingRef,
      url: h.bookingUrl,
      amount: h.totalPrice,
      currency: h.currency,
    })),
    ...cars.map<Booking>((c) => ({
      id: c.id,
      type: 'car',
      title: `${c.company}${c.carType ? ` · ${c.carType}` : ''}`,
      subtitle: c.pickupLocation,
      date: c.pickupDate,
      booked: !!c.booked,
      paid: !!c.paid,
      reference: c.bookingRef,
      url: c.bookingUrl,
      amount: c.price,
      currency: c.currency,
    })),
    ...activities
      .filter((a) => a.bookingRef || a.booked)
      .map<Booking>((a) => ({
        id: a.id,
        type: 'activity',
        title: a.title,
        subtitle: 'פעילות מוזמנת',
        date: '',
        booked: !!a.booked,
        paid: false,
        reference: a.bookingRef,
        url: a.url,
        amount: a.price,
        currency: a.currency,
      })),
  ];
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export interface AlertInput {
  trip: Trip;
  days: Day[];
  activities: Activity[];
  hotels: Hotel[];
  flights: Flight[];
  cars: CarRental[];
  expenses: Expense[];
  today?: string;
}

/**
 * Every alert the dashboard can raise. Ordered by urgency so the top of the
 * list is always the thing that actually needs doing.
 */
export function computeAlerts(input: AlertInput): TripAlert[] {
  const { trip, days, activities, hotels, flights, cars, expenses } = input;
  const today = input.today ?? todayISO();
  const alerts: TripAlert[] = [];

  /* --- nights with no hotel --- */
  const nights = eachDate(trip.startDate, trip.endDate).slice(0, -1);
  const uncovered = nights.filter(
    (date) => !hotels.some((h) => date >= h.checkIn && date < h.checkOut)
  );
  if (uncovered.length > 0) {
    alerts.push({
      id: 'nights-uncovered',
      severity: 'danger',
      icon: '🏨',
      title: `${uncovered.length === 1 ? 'לילה אחד' : `${uncovered.length} לילות`} ללא מלון`,
      detail: uncovered.slice(0, 4).map(formatDayMonth).join(', '),
      href: '/hotels',
    });
  }

  /* --- unbooked accommodation --- */
  const unbookedHotels = hotels.filter((h) => !h.booked);
  if (unbookedHotels.length > 0) {
    alerts.push({
      id: 'hotels-unbooked',
      severity: 'warning',
      icon: '🏨',
      title: `${unbookedHotels.length} מלונות ללא הזמנה`,
      detail: unbookedHotels.map((h) => h.name).join(', '),
      href: '/hotels',
    });
  }

  /* --- upcoming check-in --- */
  for (const h of hotels) {
    const delta = diffDays(today, h.checkIn);
    if (delta === 1) {
      alerts.push({
        id: `checkin-${h.id}`,
        severity: 'info',
        icon: '🔑',
        title: `Check-in מחר — ${h.name}`,
        detail: h.city,
        href: '/hotels',
      });
    }
  }

  /* --- approaching flight --- */
  for (const f of flights) {
    const delta = diffDays(today, f.date);
    if (delta >= 0 && delta <= 3) {
      alerts.push({
        id: `flight-${f.id}`,
        severity: delta === 0 ? 'danger' : 'info',
        icon: '✈️',
        title:
          delta === 0
            ? `טיסה היום — ${f.airline} ${f.flightNumber}`
            : `טיסה בעוד ${delta === 1 ? 'יום' : `${delta} ימים`} — ${f.flightNumber}`,
        detail: `${f.from.code} → ${f.to.code}${f.departureTime ? ` · ${f.departureTime}` : ''}`,
        href: '/flights',
      });
    }
  }

  /* --- car pickup --- */
  for (const c of cars) {
    const delta = diffDays(today, c.pickupDate);
    if (delta >= 0 && delta <= 2) {
      alerts.push({
        id: `car-${c.id}`,
        severity: 'info',
        icon: '🚗',
        title: delta === 0 ? 'איסוף רכב היום' : `איסוף רכב בעוד ${delta === 1 ? 'יום' : 'יומיים'}`,
        detail: `${c.company} · ${c.pickupLocation}`,
        href: '/car',
      });
    }
  }

  /* --- itinerary quality --- */
  const byDay = groupActivitiesByDay(activities);
  const noTime = activities.filter((a) => !a.startTime);
  if (noTime.length > 0) {
    alerts.push({
      id: 'activities-no-time',
      severity: 'warning',
      icon: '⏱️',
      title: `${noTime.length} פעילויות ללא שעה`,
      detail: noTime
        .slice(0, 3)
        .map((a) => a.title)
        .join(', '),
      href: '/itinerary',
    });
  }

  const overloaded: Day[] = [];
  const tightDays: { day: Day; count: number }[] = [];
  const emptyDays: Day[] = [];
  for (const day of days) {
    const items = byDay.get(day.id) ?? [];
    if (items.length === 0) {
      emptyDays.push(day);
      continue;
    }
    const stats = computeDayStats(items);
    if (isOverloadedDay(stats)) overloaded.push(day);
    if (stats.tightLegs > 0) tightDays.push({ day, count: stats.tightLegs });
  }

  if (emptyDays.length > 0) {
    alerts.push({
      id: 'days-empty',
      severity: 'info',
      icon: '📅',
      title: `${emptyDays.length} ימים ללא תכנון`,
      detail: emptyDays.map((d) => `יום ${d.index}`).join(', '),
      href: '/itinerary',
    });
  }
  if (overloaded.length > 0) {
    alerts.push({
      id: 'days-overloaded',
      severity: 'warning',
      icon: '😵',
      title: `${overloaded.length} ימים עמוסים מדי`,
      detail: overloaded.map((d) => `יום ${d.index} — ${d.title}`).join(' · '),
      href: '/itinerary',
    });
  }
  if (tightDays.length > 0) {
    const total = tightDays.reduce((n, t) => n + t.count, 0);
    alerts.push({
      id: 'legs-tight',
      severity: 'warning',
      icon: '⚠️',
      title: `${total} מעברים עם זמן נסיעה לא ריאלי`,
      detail: tightDays.map((t) => `יום ${t.day.index}`).join(', '),
      href: '/itinerary',
    });
  }

  const longDrives = days.filter((d) => computeDayStats(byDay.get(d.id) ?? []).drivingMin > 240);
  if (longDrives.length > 0) {
    alerts.push({
      id: 'long-drives',
      severity: 'info',
      icon: '🛣️',
      title: `${longDrives.length} ימים עם מעל 4 שעות נסיעה`,
      detail: longDrives.map((d) => `יום ${d.index}`).join(', '),
      href: '/itinerary',
    });
  }

  /* --- money --- */
  const unpaid = expenses.filter((e) => !e.paid);
  if (unpaid.length > 0) {
    alerts.push({
      id: 'expenses-unpaid',
      severity: 'info',
      icon: '💳',
      title: `${unpaid.length} הוצאות שטרם שולמו`,
      href: '/budget',
    });
  }

  return alerts;
}

/** How many bookable things still lack a reservation. */
export function countUnbooked(bookings: Booking[]): number {
  return bookings.filter((b) => !b.booked).length;
}

export function bookingsForEntity(bookings: Booking[], type: Booking['type'], id: ID) {
  return bookings.find((b) => b.type === type && b.id === id);
}
