import {
  type Activity,
  type CarRental,
  type Checklist,
  type ChecklistItem,
  type CurrencyCode,
  type Day,
  type Expense,
  type Flight,
  type FlightEndpoint,
  type GeoPoint,
  type Hotel,
  type Place,
  type Traveler,
  type Trip,
  type TripDocument,
} from '@/lib/types';

/**
 * Domain objects are camelCase and drop absent fields; Postgres rows are
 * snake_case and use nulls. Every conversion lives here so the repository
 * stays about syncing rather than about field names.
 */

export type Row = Record<string, unknown>;

const num = (v: unknown): number | undefined =>
  v === null || v === undefined ? undefined : Number(v);
const str = (v: unknown): string | undefined =>
  v === null || v === undefined || v === '' ? undefined : String(v);
const bool = (v: unknown): boolean => v === true;

/** Latitude/longitude live as two columns but as one object in the app. */
function point(lat: unknown, lng: unknown): GeoPoint | undefined {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return undefined;
  return { lat: Number(lat), lng: Number(lng) };
}

/** Postgres `date` columns come back as 'YYYY-MM-DD'; keep only that much. */
const date = (v: unknown): string => String(v ?? '').slice(0, 10);

export interface Mapper<T> {
  table: string;
  toRow: (entity: T) => Row;
  fromRow: (row: Row) => T;
}

/* ------------------------------------------------------------------ */

export const tripMapper: Mapper<Trip> = {
  table: 'trips',
  toRow: (t) => ({
    id: t.id,
    name: t.name,
    destination: t.destination,
    country_code: t.countryCode,
    cover_image: t.coverImage ?? null,
    start_date: t.startDate,
    end_date: t.endDate,
    base_currency: t.baseCurrency,
    total_budget: t.totalBudget,
    currencies: t.currencies,
    rates: t.rates,
    rates_updated_at: t.ratesUpdatedAt ?? null,
    rates_source: t.ratesSource ?? null,
    route: t.route ?? null,
    notes: t.notes ?? null,
  }),
  fromRow: (r) => ({
    id: String(r.id),
    name: String(r.name ?? ''),
    destination: String(r.destination ?? ''),
    countryCode: String(r.country_code ?? ''),
    coverImage: str(r.cover_image),
    startDate: date(r.start_date),
    endDate: date(r.end_date),
    baseCurrency: (r.base_currency as CurrencyCode) ?? 'ILS',
    totalBudget: Number(r.total_budget ?? 0),
    currencies: (r.currencies as CurrencyCode[]) ?? ['ILS'],
    rates: (r.rates as Trip['rates']) ?? {},
    ratesUpdatedAt: str(r.rates_updated_at),
    ratesSource: (str(r.rates_source) as Trip['ratesSource']) ?? undefined,
    route: (r.route as string[]) ?? undefined,
    notes: str(r.notes),
    createdAt: String(r.created_at ?? new Date().toISOString()),
    updatedAt: String(r.updated_at ?? new Date().toISOString()),
  }),
};

export const travelerMapper: Mapper<Traveler> = {
  table: 'travelers',
  toRow: (t) => ({
    id: t.id,
    trip_id: t.tripId,
    name: t.name,
    color: t.color,
    email: t.email ?? null,
    is_owner: !!t.isOwner,
  }),
  fromRow: (r) => ({
    id: String(r.id),
    tripId: String(r.trip_id),
    name: String(r.name ?? ''),
    color: String(r.color ?? '#1d67f0'),
    email: str(r.email),
    isOwner: bool(r.is_owner),
  }),
};

export const dayMapper: Mapper<Day> = {
  table: 'days',
  toRow: (d) => ({
    id: d.id,
    trip_id: d.tripId,
    date: d.date,
    index: d.index,
    title: d.title,
    base_location: d.baseLocation ?? null,
    hotel_id: d.hotelId ?? null,
    notes: d.notes ?? null,
    planned_budget: d.plannedBudget ?? null,
  }),
  fromRow: (r) => ({
    id: String(r.id),
    tripId: String(r.trip_id),
    date: date(r.date),
    index: Number(r.index ?? 1),
    title: String(r.title ?? ''),
    baseLocation: str(r.base_location),
    hotelId: str(r.hotel_id),
    notes: str(r.notes),
    plannedBudget: num(r.planned_budget),
  }),
};

export const activityMapper: Mapper<Activity> = {
  table: 'activities',
  toRow: (a) => ({
    id: a.id,
    trip_id: a.tripId,
    day_id: a.dayId,
    title: a.title,
    category: a.category,
    start_time: a.startTime ?? null,
    duration_min: a.durationMin ?? null,
    address: a.address ?? null,
    lat: a.location?.lat ?? null,
    lng: a.location?.lng ?? null,
    price: a.price ?? null,
    currency: a.currency ?? null,
    notes: a.notes ?? null,
    url: a.url ?? null,
    image: a.image ?? null,
    booking_ref: a.bookingRef ?? null,
    booked: !!a.booked,
    done: !!a.done,
    order: a.order,
    place_id: a.placeId ?? null,
  }),
  fromRow: (r) => ({
    id: String(r.id),
    tripId: String(r.trip_id),
    dayId: String(r.day_id),
    title: String(r.title ?? ''),
    category: (r.category as Activity['category']) ?? 'other',
    startTime: str(r.start_time),
    durationMin: num(r.duration_min),
    address: str(r.address),
    location: point(r.lat, r.lng),
    price: num(r.price),
    currency: (str(r.currency) as CurrencyCode) ?? undefined,
    notes: str(r.notes),
    url: str(r.url),
    image: str(r.image),
    bookingRef: str(r.booking_ref),
    booked: bool(r.booked),
    done: bool(r.done),
    order: Number(r.order ?? 0),
    placeId: str(r.place_id),
  }),
};

export const hotelMapper: Mapper<Hotel> = {
  table: 'hotels',
  toRow: (h) => ({
    id: h.id,
    trip_id: h.tripId,
    name: h.name,
    city: h.city,
    address: h.address ?? null,
    lat: h.location?.lat ?? null,
    lng: h.location?.lng ?? null,
    check_in: h.checkIn,
    check_out: h.checkOut,
    check_in_time: h.checkInTime ?? null,
    check_out_time: h.checkOutTime ?? null,
    price_per_night: h.pricePerNight ?? null,
    total_price: h.totalPrice ?? null,
    currency: h.currency,
    rooms: h.rooms ?? null,
    guests: h.guests ?? null,
    booking_url: h.bookingUrl ?? null,
    booking_ref: h.bookingRef ?? null,
    cancellation_policy: h.cancellationPolicy ?? null,
    notes: h.notes ?? null,
    images: h.images ?? null,
    booked: !!h.booked,
    paid: !!h.paid,
  }),
  fromRow: (r) => ({
    id: String(r.id),
    tripId: String(r.trip_id),
    name: String(r.name ?? ''),
    city: String(r.city ?? ''),
    address: str(r.address),
    location: point(r.lat, r.lng),
    checkIn: date(r.check_in),
    checkOut: date(r.check_out),
    checkInTime: str(r.check_in_time),
    checkOutTime: str(r.check_out_time),
    pricePerNight: num(r.price_per_night),
    totalPrice: num(r.total_price),
    currency: (r.currency as CurrencyCode) ?? 'ILS',
    rooms: num(r.rooms),
    guests: num(r.guests),
    bookingUrl: str(r.booking_url),
    bookingRef: str(r.booking_ref),
    cancellationPolicy: str(r.cancellation_policy),
    notes: str(r.notes),
    images: (r.images as string[]) ?? undefined,
    booked: bool(r.booked),
    paid: bool(r.paid),
  }),
};

const endpoint = (v: unknown): FlightEndpoint => {
  const e = (v ?? {}) as Partial<FlightEndpoint>;
  return {
    code: e.code ?? '',
    name: e.name ?? '',
    city: e.city,
    terminal: e.terminal,
    location: e.location,
  };
};

export const flightMapper: Mapper<Flight> = {
  table: 'flights',
  toRow: (f) => ({
    id: f.id,
    trip_id: f.tripId,
    direction: f.direction,
    airline: f.airline,
    flight_number: f.flightNumber,
    date: f.date,
    departure_time: f.departureTime ?? null,
    arrival_time: f.arrivalTime ?? null,
    arrives_next_day: !!f.arrivesNextDay,
    from_endpoint: f.from,
    to_endpoint: f.to,
    baggage: f.baggage ?? null,
    seats: f.seats ?? null,
    price: f.price ?? null,
    currency: f.currency,
    price_is_per_person: !!f.priceIsPerPerson,
    booking_ref: f.bookingRef ?? null,
    booking_url: f.bookingUrl ?? null,
    notes: f.notes ?? null,
    booked: !!f.booked,
    paid: !!f.paid,
  }),
  fromRow: (r) => ({
    id: String(r.id),
    tripId: String(r.trip_id),
    direction: (r.direction as Flight['direction']) ?? 'outbound',
    airline: String(r.airline ?? ''),
    flightNumber: String(r.flight_number ?? ''),
    date: date(r.date),
    departureTime: str(r.departure_time),
    arrivalTime: str(r.arrival_time),
    arrivesNextDay: bool(r.arrives_next_day),
    from: endpoint(r.from_endpoint),
    to: endpoint(r.to_endpoint),
    baggage: str(r.baggage),
    seats: str(r.seats),
    price: num(r.price),
    currency: (r.currency as CurrencyCode) ?? 'ILS',
    priceIsPerPerson: bool(r.price_is_per_person),
    bookingRef: str(r.booking_ref),
    bookingUrl: str(r.booking_url),
    notes: str(r.notes),
    booked: bool(r.booked),
    paid: bool(r.paid),
  }),
};

export const carMapper: Mapper<CarRental> = {
  table: 'car_rentals',
  toRow: (c) => ({
    id: c.id,
    trip_id: c.tripId,
    company: c.company,
    car_type: c.carType ?? null,
    pickup_date: c.pickupDate,
    pickup_time: c.pickupTime ?? null,
    pickup_location: c.pickupLocation,
    pickup_lat: c.pickupPoint?.lat ?? null,
    pickup_lng: c.pickupPoint?.lng ?? null,
    dropoff_date: c.dropoffDate,
    dropoff_time: c.dropoffTime ?? null,
    dropoff_location: c.dropoffLocation,
    dropoff_lat: c.dropoffPoint?.lat ?? null,
    dropoff_lng: c.dropoffPoint?.lng ?? null,
    price: c.price ?? null,
    currency: c.currency,
    insurance: c.insurance ?? null,
    deductible: c.deductible ?? null,
    booking_ref: c.bookingRef ?? null,
    booking_url: c.bookingUrl ?? null,
    notes: c.notes ?? null,
    booked: !!c.booked,
    paid: !!c.paid,
    fuel_consumption: c.fuelConsumption ?? null,
    fuel_price_per_liter: c.fuelPricePerLiter ?? null,
  }),
  fromRow: (r) => ({
    id: String(r.id),
    tripId: String(r.trip_id),
    company: String(r.company ?? ''),
    carType: str(r.car_type),
    pickupDate: date(r.pickup_date),
    pickupTime: str(r.pickup_time),
    pickupLocation: String(r.pickup_location ?? ''),
    pickupPoint: point(r.pickup_lat, r.pickup_lng),
    dropoffDate: date(r.dropoff_date),
    dropoffTime: str(r.dropoff_time),
    dropoffLocation: String(r.dropoff_location ?? ''),
    dropoffPoint: point(r.dropoff_lat, r.dropoff_lng),
    price: num(r.price),
    currency: (r.currency as CurrencyCode) ?? 'ILS',
    insurance: str(r.insurance),
    deductible: num(r.deductible),
    bookingRef: str(r.booking_ref),
    bookingUrl: str(r.booking_url),
    notes: str(r.notes),
    booked: bool(r.booked),
    paid: bool(r.paid),
    fuelConsumption: num(r.fuel_consumption),
    fuelPricePerLiter: num(r.fuel_price_per_liter),
  }),
};

export const placeMapper: Mapper<Place> = {
  table: 'places',
  toRow: (p) => ({
    id: p.id,
    trip_id: p.tripId,
    name: p.name,
    list: p.list,
    category: p.category,
    address: p.address ?? null,
    lat: p.location?.lat ?? null,
    lng: p.location?.lng ?? null,
    image: p.image ?? null,
    rating: p.rating ?? null,
    notes: p.notes ?? null,
    price: p.price ?? null,
    currency: p.currency ?? null,
    url: p.url ?? null,
    day_id: p.dayId ?? null,
    created_at: p.createdAt,
  }),
  fromRow: (r) => ({
    id: String(r.id),
    tripId: String(r.trip_id),
    name: String(r.name ?? ''),
    list: (r.list as Place['list']) ?? 'must',
    category: (r.category as Place['category']) ?? 'attraction',
    address: str(r.address),
    location: point(r.lat, r.lng),
    image: str(r.image),
    rating: num(r.rating),
    notes: str(r.notes),
    price: num(r.price),
    currency: (str(r.currency) as CurrencyCode) ?? undefined,
    url: str(r.url),
    dayId: str(r.day_id),
    createdAt: String(r.created_at ?? new Date().toISOString()),
  }),
};

export const expenseMapper: Mapper<Expense> = {
  table: 'expenses',
  toRow: (e) => ({
    id: e.id,
    trip_id: e.tripId,
    date: e.date,
    category: e.category,
    description: e.description,
    amount: e.amount,
    currency: e.currency,
    paid: !!e.paid,
    paid_by_id: e.paidById ?? null,
    split_between: e.splitBetween,
    notes: e.notes ?? null,
    linked_type: e.linkedType ?? null,
    linked_id: e.linkedId ?? null,
    created_at: e.createdAt,
  }),
  fromRow: (r) => ({
    id: String(r.id),
    tripId: String(r.trip_id),
    date: date(r.date),
    category: (r.category as Expense['category']) ?? 'other',
    description: String(r.description ?? ''),
    amount: Number(r.amount ?? 0),
    currency: (r.currency as CurrencyCode) ?? 'ILS',
    paid: bool(r.paid),
    paidById: str(r.paid_by_id),
    splitBetween: (r.split_between as string[]) ?? [],
    notes: str(r.notes),
    linkedType: (str(r.linked_type) as Expense['linkedType']) ?? undefined,
    linkedId: str(r.linked_id),
    createdAt: String(r.created_at ?? new Date().toISOString()),
  }),
};

export const documentMapper: Mapper<TripDocument> = {
  table: 'documents',
  toRow: (d) => ({
    id: d.id,
    trip_id: d.tripId,
    name: d.name,
    category: d.category,
    date: d.date ?? null,
    url: d.url ?? null,
    // `fileKey` addresses an IndexedDB blob locally and a storage object in
    // the cloud; only the latter is meaningful to other people.
    storage_path: d.fileKey ?? null,
    mime_type: d.mimeType ?? null,
    size: d.size ?? null,
    notes: d.notes ?? null,
    linked_type: d.linkedType ?? null,
    linked_id: d.linkedId ?? null,
    created_at: d.createdAt,
  }),
  fromRow: (r) => ({
    id: String(r.id),
    tripId: String(r.trip_id),
    name: String(r.name ?? ''),
    category: (r.category as TripDocument['category']) ?? 'other',
    date: str(r.date) ? date(r.date) : undefined,
    url: str(r.url),
    fileKey: str(r.storage_path),
    mimeType: str(r.mime_type),
    size: num(r.size),
    notes: str(r.notes),
    linkedType: (str(r.linked_type) as TripDocument['linkedType']) ?? undefined,
    linkedId: str(r.linked_id),
    createdAt: String(r.created_at ?? new Date().toISOString()),
  }),
};

export const checklistMapper: Mapper<Checklist> = {
  table: 'checklists',
  toRow: (c) => ({
    id: c.id,
    trip_id: c.tripId,
    title: c.title,
    group: c.group,
    items: c.items,
    created_at: c.createdAt,
  }),
  fromRow: (r) => ({
    id: String(r.id),
    tripId: String(r.trip_id),
    title: String(r.title ?? ''),
    group: (r.group as Checklist['group']) ?? 'custom',
    items: (r.items as ChecklistItem[]) ?? [],
    createdAt: String(r.created_at ?? new Date().toISOString()),
  }),
};
