/**
 * Domain model for My Trip Planner.
 *
 * Everything is keyed by string ids and related by foreign keys, so the exact
 * same shapes map 1:1 onto SQL tables (see docs/DATA_MODEL.md) when the
 * localStorage adapter is swapped for Supabase/Postgres.
 */

export type ID = string;
export type ISODate = string; // 'YYYY-MM-DD'
export type ISODateTime = string; // full ISO 8601
export type HHMM = string; // '08:30'

/* ------------------------------------------------------------------ *
 * Currency
 * ------------------------------------------------------------------ */

export const CURRENCIES = ['ILS', 'EUR', 'USD', 'GBP', 'CHF', 'JPY', 'THB', 'TRY'] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

export interface CurrencyMeta {
  code: CurrencyCode;
  symbol: string;
  label: string;
}

export const CURRENCY_META: Record<CurrencyCode, CurrencyMeta> = {
  ILS: { code: 'ILS', symbol: '₪', label: 'שקל' },
  EUR: { code: 'EUR', symbol: '€', label: 'אירו' },
  USD: { code: 'USD', symbol: '$', label: 'דולר' },
  GBP: { code: 'GBP', symbol: '£', label: 'ליש״ט' },
  CHF: { code: 'CHF', symbol: 'CHF', label: 'פרנק' },
  JPY: { code: 'JPY', symbol: '¥', label: 'ין' },
  THB: { code: 'THB', symbol: '฿', label: 'באט' },
  TRY: { code: 'TRY', symbol: '₺', label: 'לירה טורקית' },
};

/** Rate table: how many units of the trip's base currency 1 unit is worth. */
export type RateTable = Partial<Record<CurrencyCode, number>>;

export interface Money {
  amount: number;
  currency: CurrencyCode;
}

/* ------------------------------------------------------------------ *
 * Shared vocabulary
 * ------------------------------------------------------------------ */

export const ACTIVITY_CATEGORIES = [
  'hotel',
  'food',
  'drive',
  'nature',
  'attraction',
  'shopping',
  'beach',
  'winery',
  'activity',
  'coffee',
  'flight',
  'other',
] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export interface CategoryMeta {
  key: ActivityCategory;
  emoji: string;
  label: string;
  /** Hex used for map markers and timeline accents. */
  color: string;
}

export const CATEGORY_META: Record<ActivityCategory, CategoryMeta> = {
  hotel: { key: 'hotel', emoji: '🏨', label: 'מלון', color: '#7c5cf0' },
  food: { key: 'food', emoji: '🍴', label: 'אוכל', color: '#e0552b' },
  drive: { key: 'drive', emoji: '🚗', label: 'נסיעה', color: '#64748b' },
  nature: { key: 'nature', emoji: '🏞️', label: 'טבע', color: '#11916b' },
  attraction: { key: 'attraction', emoji: '🏛️', label: 'אטרקציה', color: '#1d67f0' },
  shopping: { key: 'shopping', emoji: '🛍️', label: 'קניות', color: '#d63f8c' },
  beach: { key: 'beach', emoji: '🏖️', label: 'חוף', color: '#0aa2c0' },
  winery: { key: 'winery', emoji: '🍷', label: 'יקב', color: '#a1263f' },
  activity: { key: 'activity', emoji: '🚣', label: 'פעילות', color: '#0b8f3c' },
  coffee: { key: 'coffee', emoji: '☕', label: 'קפה', color: '#8a5a2b' },
  flight: { key: 'flight', emoji: '✈️', label: 'טיסה', color: '#2563eb' },
  other: { key: 'other', emoji: '📍', label: 'אחר', color: '#667085' },
};

export const EXPENSE_CATEGORIES = [
  'flights',
  'hotels',
  'car',
  'fuel',
  'food',
  'attractions',
  'shopping',
  'ferries',
  'coffee',
  'other',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_META: Record<
  ExpenseCategory,
  { key: ExpenseCategory; emoji: string; label: string; color: string }
> = {
  flights: { key: 'flights', emoji: '✈️', label: 'טיסות', color: '#2563eb' },
  hotels: { key: 'hotels', emoji: '🏨', label: 'מלונות', color: '#7c5cf0' },
  car: { key: 'car', emoji: '🚗', label: 'רכב', color: '#0aa2c0' },
  fuel: { key: 'fuel', emoji: '⛽', label: 'דלק', color: '#64748b' },
  food: { key: 'food', emoji: '🍴', label: 'אוכל', color: '#e0552b' },
  attractions: { key: 'attractions', emoji: '🎟️', label: 'אטרקציות', color: '#11916b' },
  shopping: { key: 'shopping', emoji: '🛍️', label: 'קניות', color: '#d63f8c' },
  ferries: { key: 'ferries', emoji: '🛳️', label: 'מעבורות', color: '#1a3c8c' },
  coffee: { key: 'coffee', emoji: '☕', label: 'קפה', color: '#8a5a2b' },
  other: { key: 'other', emoji: '💳', label: 'אחר', color: '#98a2b3' },
};

/** Maps an itinerary category onto the budget category it spends from. */
export const ACTIVITY_TO_EXPENSE_CATEGORY: Record<ActivityCategory, ExpenseCategory> = {
  hotel: 'hotels',
  food: 'food',
  drive: 'fuel',
  nature: 'attractions',
  attraction: 'attractions',
  shopping: 'shopping',
  beach: 'attractions',
  winery: 'attractions',
  activity: 'attractions',
  coffee: 'coffee',
  flight: 'flights',
  other: 'other',
};

export interface GeoPoint {
  lat: number;
  lng: number;
}

/* ------------------------------------------------------------------ *
 * Core entities
 * ------------------------------------------------------------------ */

export interface Traveler {
  id: ID;
  tripId: ID;
  name: string;
  /** Hex colour used for avatars and the settle-up chart. */
  color: string;
  email?: string;
  /** Owner of the trip; cannot be removed. */
  isOwner?: boolean;
}

export type SharePermission = 'view' | 'edit';

export interface ShareMember {
  id: ID;
  tripId: ID;
  name: string;
  email: string;
  permission: SharePermission;
  invitedAt: ISODateTime;
  status: 'pending' | 'active';
}

export interface Trip {
  id: ID;
  name: string;
  destination: string;
  /** ISO-3166 alpha-2, used for the flag chip. */
  countryCode: string;
  coverImage?: string;
  startDate: ISODate;
  endDate: ISODate;
  baseCurrency: CurrencyCode;
  totalBudget: number;
  /** Currencies actively used on this trip, always includes baseCurrency. */
  currencies: CurrencyCode[];
  /** Value of 1 unit of each currency, expressed in baseCurrency. */
  rates: RateTable;
  ratesUpdatedAt?: ISODateTime;
  ratesSource?: 'manual' | 'api';
  notes?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  /** Ordered list of the trip's main stops, used by the map route line. */
  route?: string[];
}

export interface Day {
  id: ID;
  tripId: ID;
  date: ISODate;
  /** 1-based day number within the trip. */
  index: number;
  title: string;
  /** Main city/region for the day. */
  baseLocation?: string;
  /** Where you sleep that night. */
  hotelId?: ID;
  notes?: string;
  plannedBudget?: number;
}

export interface Activity {
  id: ID;
  tripId: ID;
  dayId: ID;
  title: string;
  category: ActivityCategory;
  /** Null means "unscheduled" — shown in the day's inbox. */
  startTime?: HHMM;
  durationMin?: number;
  address?: string;
  location?: GeoPoint;
  price?: number;
  currency?: CurrencyCode;
  notes?: string;
  url?: string;
  image?: string;
  bookingRef?: string;
  booked?: boolean;
  /** Manual ordering within the day, used for unscheduled items and ties. */
  order: number;
  /** Set when the activity was dragged in from the Places board. */
  placeId?: ID;
  /** Minutes of driving from the previous activity, cached from the routing service. */
  travelFromPrevMin?: number;
  travelFromPrevKm?: number;
  done?: boolean;
}

export interface Hotel {
  id: ID;
  tripId: ID;
  name: string;
  city: string;
  address?: string;
  location?: GeoPoint;
  checkIn: ISODate;
  checkOut: ISODate;
  pricePerNight?: number;
  totalPrice?: number;
  currency: CurrencyCode;
  rooms?: number;
  guests?: number;
  bookingUrl?: string;
  bookingRef?: string;
  cancellationPolicy?: string;
  notes?: string;
  images?: string[];
  booked?: boolean;
  paid?: boolean;
  checkInTime?: HHMM;
  checkOutTime?: HHMM;
}

export type FlightDirection = 'outbound' | 'return' | 'internal';

export interface FlightEndpoint {
  code: string;
  name: string;
  city?: string;
  terminal?: string;
  location?: GeoPoint;
}

export interface Flight {
  id: ID;
  tripId: ID;
  direction: FlightDirection;
  airline: string;
  flightNumber: string;
  date: ISODate;
  departureTime?: HHMM;
  arrivalTime?: HHMM;
  /** Set when the flight lands on a later calendar day than it departs. */
  arrivesNextDay?: boolean;
  from: FlightEndpoint;
  to: FlightEndpoint;
  baggage?: string;
  price?: number;
  currency: CurrencyCode;
  /** Whether `price` covers all travellers or just one seat. */
  priceIsPerPerson?: boolean;
  bookingRef?: string;
  bookingUrl?: string;
  seats?: string;
  notes?: string;
  booked?: boolean;
  paid?: boolean;
}

export interface CarRental {
  id: ID;
  tripId: ID;
  company: string;
  carType?: string;
  pickupDate: ISODate;
  pickupTime?: HHMM;
  pickupLocation: string;
  pickupPoint?: GeoPoint;
  dropoffDate: ISODate;
  dropoffTime?: HHMM;
  dropoffLocation: string;
  dropoffPoint?: GeoPoint;
  price?: number;
  currency: CurrencyCode;
  insurance?: string;
  deductible?: number;
  bookingRef?: string;
  bookingUrl?: string;
  notes?: string;
  booked?: boolean;
  paid?: boolean;
  /** Litres per 100km, used for the fuel estimate. */
  fuelConsumption?: number;
  fuelPricePerLiter?: number;
}

export const PLACE_LISTS = [
  'must',
  'if-time',
  'restaurants',
  'coffee',
  'nature',
  'beaches',
  'wineries',
] as const;
export type PlaceList = (typeof PLACE_LISTS)[number];

export const PLACE_LIST_META: Record<PlaceList, { key: PlaceList; emoji: string; label: string }> = {
  must: { key: 'must', emoji: '❤️', label: 'חובה לבקר' },
  'if-time': { key: 'if-time', emoji: '⭐', label: 'אם יש זמן' },
  restaurants: { key: 'restaurants', emoji: '🍴', label: 'מסעדות' },
  coffee: { key: 'coffee', emoji: '☕', label: 'קפה' },
  nature: { key: 'nature', emoji: '🏞️', label: 'טבע' },
  beaches: { key: 'beaches', emoji: '🏖️', label: 'חופים' },
  wineries: { key: 'wineries', emoji: '🍷', label: 'יקבים' },
};

export interface Place {
  id: ID;
  tripId: ID;
  name: string;
  list: PlaceList;
  category: ActivityCategory;
  address?: string;
  location?: GeoPoint;
  image?: string;
  /** Personal rating, 0–5. */
  rating?: number;
  notes?: string;
  price?: number;
  currency?: CurrencyCode;
  url?: string;
  /** Set once the place has been scheduled into a day. */
  dayId?: ID;
  createdAt: ISODateTime;
}

export interface Expense {
  id: ID;
  tripId: ID;
  date: ISODate;
  category: ExpenseCategory;
  description: string;
  amount: number;
  currency: CurrencyCode;
  paid: boolean;
  /** Traveler id who fronted the money. */
  paidById?: ID;
  /** Traveler ids the cost is split between. Empty = everyone. */
  splitBetween: ID[];
  notes?: string;
  /** Back-reference to whatever this expense pays for. */
  linkedType?: 'hotel' | 'flight' | 'car' | 'activity';
  linkedId?: ID;
  createdAt: ISODateTime;
}

export const DOCUMENT_CATEGORIES = [
  'flight',
  'hotel',
  'car',
  'insurance',
  'tickets',
  'restaurant',
  'other',
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_CATEGORY_META: Record<
  DocumentCategory,
  { key: DocumentCategory; emoji: string; label: string }
> = {
  flight: { key: 'flight', emoji: '✈️', label: 'כרטיסי טיסה' },
  hotel: { key: 'hotel', emoji: '🏨', label: 'אישורי מלון' },
  car: { key: 'car', emoji: '🚗', label: 'השכרת רכב' },
  insurance: { key: 'insurance', emoji: '🛡️', label: 'ביטוח' },
  tickets: { key: 'tickets', emoji: '🎟️', label: 'כרטיסים' },
  restaurant: { key: 'restaurant', emoji: '🍴', label: 'מסעדות' },
  other: { key: 'other', emoji: '📄', label: 'אחר' },
};

export interface TripDocument {
  id: ID;
  tripId: ID;
  name: string;
  category: DocumentCategory;
  date?: ISODate;
  /** External link, when the document lives elsewhere. */
  url?: string;
  /** Key into the blob store (IndexedDB) for uploaded files. */
  fileKey?: string;
  mimeType?: string;
  size?: number;
  notes?: string;
  /** Attaches the document to a specific booking or day. */
  linkedType?: 'hotel' | 'flight' | 'car' | 'activity' | 'day';
  linkedId?: ID;
  createdAt: ISODateTime;
}

export interface ChecklistItem {
  id: ID;
  text: string;
  done: boolean;
  assigneeId?: ID;
}

export const CHECKLIST_GROUPS = [
  'before-flight',
  'hotel-change',
  'day-out',
  'documents',
  'luggage',
  'car',
  'insurance',
  'custom',
] as const;
export type ChecklistGroup = (typeof CHECKLIST_GROUPS)[number];

export const CHECKLIST_GROUP_META: Record<
  ChecklistGroup,
  { key: ChecklistGroup; emoji: string; label: string }
> = {
  'before-flight': { key: 'before-flight', emoji: '✈️', label: 'לפני הטיסה' },
  'hotel-change': { key: 'hotel-change', emoji: '🏨', label: 'לפני מעבר מלון' },
  'day-out': { key: 'day-out', emoji: '🎒', label: 'לפני יציאה ליום טיול' },
  documents: { key: 'documents', emoji: '📄', label: 'מסמכים' },
  luggage: { key: 'luggage', emoji: '🧳', label: 'מזוודות' },
  car: { key: 'car', emoji: '🚗', label: 'רכב' },
  insurance: { key: 'insurance', emoji: '🛡️', label: 'ביטוח' },
  custom: { key: 'custom', emoji: '📝', label: 'רשימה אישית' },
};

export interface Checklist {
  id: ID;
  tripId: ID;
  title: string;
  group: ChecklistGroup;
  items: ChecklistItem[];
  createdAt: ISODateTime;
}

/**
 * A booking is a *view* over the things that can be reserved, not a table of
 * its own — that keeps "is it booked?" in exactly one place per entity.
 */
export interface Booking {
  id: ID;
  type: 'hotel' | 'flight' | 'car' | 'activity';
  title: string;
  subtitle: string;
  date: ISODate;
  booked: boolean;
  paid: boolean;
  reference?: string;
  url?: string;
  amount?: number;
  currency?: CurrencyCode;
}

/* ------------------------------------------------------------------ *
 * Aggregate persisted document
 * ------------------------------------------------------------------ */

export interface TripData {
  trips: Trip[];
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

export const EMPTY_DATA: TripData = {
  trips: [],
  travelers: [],
  days: [],
  activities: [],
  hotels: [],
  flights: [],
  cars: [],
  places: [],
  expenses: [],
  documents: [],
  checklists: [],
  shares: [],
};

/* ------------------------------------------------------------------ *
 * Alerts
 * ------------------------------------------------------------------ */

export type AlertSeverity = 'info' | 'warning' | 'danger';

export interface TripAlert {
  id: string;
  severity: AlertSeverity;
  icon: string;
  title: string;
  detail?: string;
  /** Where tapping the alert takes you. */
  href?: string;
}
