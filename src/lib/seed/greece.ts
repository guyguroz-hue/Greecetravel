import {
  type Activity,
  type ActivityCategory,
  type CarRental,
  type Checklist,
  type Day,
  type Expense,
  type ExpenseCategory,
  type Flight,
  type GeoPoint,
  type Hotel,
  type Place,
  type PlaceList,
  type Traveler,
  type Trip,
  type TripData,
  type TripDocument,
} from '@/lib/types';
import { addDays } from '@/lib/utils/date';
import { FALLBACK_ILS_RATES, defaultRates } from '@/lib/services/currency';

/**
 * A complete, realistic demo trip so every screen has something to show the
 * first time the app opens. Coordinates are real; prices and booking
 * references are illustrative.
 */

const TRIP_ID = 'trip_greece_2026';
const START = '2026-08-22';
const DAYS_COUNT = 14;

const P = (lat: number, lng: number): GeoPoint => ({ lat, lng });

const LOC = {
  skg: P(40.5197, 22.9709),
  modernist: P(40.6295, 22.9459),
  ladadika: P(40.6363, 22.937),
  whiteTower: P(40.6263, 22.9484),
  aristotelous: P(40.6324, 22.941),
  mourga: P(40.6357, 22.9377),
  anoPoli: P(40.642, 22.95),
  rotunda: P(40.6333, 22.9531),
  modiano: P(40.6371, 22.9401),
  tsimiski: P(40.634, 22.942),
  nikis: P(40.627, 22.945),
  thessaloniki: P(40.6401, 22.9444),

  grandForest: P(39.7639, 21.1836),
  katogi: P(39.7742, 21.1858),
  averoff: P(39.7706, 21.1811),
  dairy: P(39.7736, 21.1774),
  metsovo: P(39.7708, 21.1806),

  aristi: P(39.9358, 20.7358),
  kokkoris: P(39.8639, 20.825),
  oxya: P(39.9086, 20.7717),
  monodendri: P(39.8836, 20.7539),
  agiaParaskevi: P(39.8858, 20.7583),
  papingoPools: P(39.9931, 20.7136),
  megaloPapingo: P(39.9903, 20.7167),
  voidomatis: P(39.9639, 20.7),
  kipi: P(39.85, 20.8167),
  zagori: P(39.9333, 20.7333),

  dellas: P(39.7156, 21.6178),
  greatMeteoron: P(39.7228, 21.6289),
  varlaam: P(39.7247, 21.6317),
  roussanou: P(39.7189, 21.635),
  agiosStefanos: P(39.705, 21.635),
  kalambaka: P(39.705, 21.6297),
  psaropetra: P(39.7161, 21.6408),
  kastraki: P(39.7139, 21.6153),

  ekies: P(40.1856, 23.7811),
  vourvourou: P(40.19, 23.785),
  karydi: P(40.1633, 23.8236),
  kavourotrypes: P(40.1058, 23.9269),
  neosMarmaras: P(40.0958, 23.7794),
  diaporos: P(40.2, 23.81),
  portoKoufo: P(39.9631, 23.925),
  kapros: P(40.0917, 23.9333),
  ormosPanagias: P(40.2153, 23.7639),
} as const;

/* ------------------------------------------------------------------ *
 * Travellers
 * ------------------------------------------------------------------ */

const TRAVELER_SEED: [string, string, boolean][] = [
  ['גיא', '#1d67f0', true],
  ['גלי', '#a1263f', false],
  ['נועם', '#11916b', false],
  ['שיר', '#db8629', false],
  ['איתי', '#7c5cf0', false],
];

const travelers: Traveler[] = TRAVELER_SEED.map(([name, color, isOwner], i) => ({
  id: `trv_${i + 1}`,
  tripId: TRIP_ID,
  name,
  color,
  isOwner,
}));

const [GUY, GALI, NOAM, SHIR, ITAY] = travelers.map((t) => t.id);
const ALL = travelers.map((t) => t.id);

/* ------------------------------------------------------------------ *
 * Hotels
 * ------------------------------------------------------------------ */

const hotels: Hotel[] = [
  {
    id: 'htl_1',
    tripId: TRIP_ID,
    name: 'The Modernist Thessaloniki',
    city: 'סלוניקי',
    address: 'Ermou 41, Thessaloniki 546 23',
    location: LOC.modernist,
    checkIn: '2026-08-22',
    checkOut: '2026-08-24',
    checkInTime: '14:00',
    checkOutTime: '11:00',
    pricePerNight: 190,
    totalPrice: 380,
    currency: 'EUR',
    rooms: 3,
    guests: 5,
    bookingUrl: 'https://www.booking.com/',
    bookingRef: 'BK-4471902',
    cancellationPolicy: 'ביטול חינם עד 20.8.2026',
    notes: 'חניה בתשלום במלון. ארוחת בוקר כלולה.',
    booked: true,
    paid: true,
  },
  {
    id: 'htl_2',
    tripId: TRIP_ID,
    name: 'Grand Forest Metsovo',
    city: 'מטסובו',
    address: 'Metsovo 442 00, Ioannina',
    location: LOC.grandForest,
    checkIn: '2026-08-24',
    checkOut: '2026-08-25',
    checkInTime: '15:00',
    checkOutTime: '12:00',
    pricePerNight: 210,
    totalPrice: 210,
    currency: 'EUR',
    rooms: 3,
    guests: 5,
    bookingUrl: 'https://www.booking.com/',
    bookingRef: 'BK-4471955',
    cancellationPolicy: 'ביטול חינם עד 17.8.2026',
    notes: 'ספא ובריכה מחוממת. נוף להרי הפינדוס.',
    booked: true,
    paid: true,
  },
  {
    id: 'htl_3',
    tripId: TRIP_ID,
    name: 'Aristi Mountain Resort',
    city: 'זגוריה',
    address: 'Aristi 440 16, Zagori',
    location: LOC.aristi,
    checkIn: '2026-08-25',
    checkOut: '2026-08-28',
    checkInTime: '15:00',
    checkOutTime: '11:00',
    pricePerNight: 230,
    totalPrice: 690,
    currency: 'EUR',
    rooms: 3,
    guests: 5,
    bookingUrl: 'https://aristi.eu/',
    bookingRef: 'AR-20268',
    cancellationPolicy: 'ביטול חינם עד 11.8.2026 — עבר',
    notes: 'הבסיס לוויקוס ולפאפינגו. מסעדה מצוינת במלון.',
    booked: true,
    paid: true,
  },
  {
    id: 'htl_4',
    tripId: TRIP_ID,
    name: 'Dellas Boutique Hotel',
    city: 'קסטרקי / מטאורה',
    address: 'Kastraki 422 00, Kalambaka',
    location: LOC.dellas,
    checkIn: '2026-08-28',
    checkOut: '2026-08-30',
    checkInTime: '14:00',
    checkOutTime: '11:00',
    pricePerNight: 155,
    totalPrice: 310,
    currency: 'EUR',
    rooms: 3,
    guests: 5,
    bookingUrl: 'https://www.booking.com/',
    bookingRef: 'BK-4482103',
    cancellationPolicy: 'ביטול חינם עד 24.8.2026',
    notes: 'נוף ישיר לסלעי מטאורה מהמרפסת.',
    booked: true,
    paid: false,
  },
  {
    id: 'htl_5',
    tripId: TRIP_ID,
    name: 'Ekies All Senses Resort',
    city: 'ורוורו, חלקידיקי',
    address: 'Vourvourou 630 78, Sithonia',
    location: LOC.ekies,
    checkIn: '2026-08-30',
    checkOut: '2026-09-04',
    checkInTime: '15:00',
    checkOutTime: '12:00',
    pricePerNight: 280,
    totalPrice: 1400,
    currency: 'EUR',
    rooms: 3,
    guests: 5,
    bookingUrl: 'https://ekies.gr/',
    bookingRef: 'EK-88214',
    cancellationPolicy: 'ביטול בתשלום — 30% אחרי 20.8',
    notes: 'חוף פרטי, השכרת קייקים, ארוחת בוקר כלולה.',
    booked: true,
    paid: false,
  },
];

/* ------------------------------------------------------------------ *
 * Flights
 * ------------------------------------------------------------------ */

const flights: Flight[] = [
  {
    id: 'flt_1',
    tripId: TRIP_ID,
    direction: 'outbound',
    airline: 'Aegean Airlines',
    flightNumber: 'A3 928',
    date: '2026-08-22',
    departureTime: '06:20',
    arrivalTime: '08:40',
    from: { code: 'TLV', name: 'נמל התעופה בן גוריון', city: 'תל אביב', terminal: '3' },
    to: {
      code: 'SKG',
      name: 'Thessaloniki Makedonia',
      city: 'סלוניקי',
      terminal: 'Main',
      location: LOC.skg,
    },
    baggage: 'מזוודה 23 ק״ג + טרולי 8 ק״ג לנוסע',
    price: 825,
    currency: 'EUR',
    priceIsPerPerson: false,
    bookingRef: 'A3-QX7T2M',
    bookingUrl: 'https://www.aegeanair.com/',
    seats: '12A–12E',
    notes: 'צ׳ק־אין אונליין נפתח 48 שעות לפני.',
    booked: true,
    paid: true,
  },
  {
    id: 'flt_2',
    tripId: TRIP_ID,
    direction: 'return',
    airline: 'Aegean Airlines',
    flightNumber: 'A3 927',
    date: '2026-09-04',
    departureTime: '21:20',
    arrivalTime: '23:35',
    from: {
      code: 'SKG',
      name: 'Thessaloniki Makedonia',
      city: 'סלוניקי',
      terminal: 'Main',
      location: LOC.skg,
    },
    to: { code: 'TLV', name: 'נמל התעופה בן גוריון', city: 'תל אביב', terminal: '3' },
    baggage: 'מזוודה 23 ק״ג + טרולי 8 ק״ג לנוסע',
    price: 825,
    currency: 'EUR',
    priceIsPerPerson: false,
    bookingRef: 'A3-QX7T2M',
    bookingUrl: 'https://www.aegeanair.com/',
    seats: '14A–14E',
    notes: 'להיות בשדה ב-18:30. החזרת רכב לפני כן.',
    booked: true,
    paid: true,
  },
];

/* ------------------------------------------------------------------ *
 * Car
 * ------------------------------------------------------------------ */

const cars: CarRental[] = [
  {
    id: 'car_1',
    tripId: TRIP_ID,
    company: 'Hertz',
    carType: 'Peugeot 5008 אוטומט, 7 מקומות',
    pickupDate: '2026-08-22',
    pickupTime: '10:00',
    pickupLocation: 'נמל התעופה סלוניקי (SKG)',
    pickupPoint: LOC.skg,
    dropoffDate: '2026-09-04',
    dropoffTime: '18:00',
    dropoffLocation: 'נמל התעופה סלוניקי (SKG)',
    dropoffPoint: LOC.skg,
    price: 680,
    currency: 'EUR',
    insurance: 'ביטוח מקיף כולל צד ג׳',
    deductible: 300,
    bookingRef: 'HZ-5520841',
    bookingUrl: 'https://www.hertz.com/',
    notes: 'נהג נוסף רשום. רישיון בינלאומי נדרש.',
    booked: true,
    paid: true,
    fuelConsumption: 7.2,
    fuelPricePerLiter: 1.85,
  },
];

/* ------------------------------------------------------------------ *
 * Days
 * ------------------------------------------------------------------ */

const DAY_SEED: [string, string, string | undefined][] = [
  ['סלוניקי — נחיתה', 'סלוניקי', 'htl_1'],
  ['סלוניקי', 'סלוניקי', 'htl_1'],
  ['סלוניקי → מטסובו', 'מטסובו', 'htl_2'],
  ['מטסובו → זגוריה', 'זגוריה', 'htl_3'],
  ['זגוריה — ערוץ ויקוס', 'זגוריה', 'htl_3'],
  ['זגוריה — נהר ווידומטיס', 'זגוריה', 'htl_3'],
  ['זגוריה → מטאורה', 'מטאורה', 'htl_4'],
  ['מטאורה — המנזרים', 'מטאורה', 'htl_4'],
  ['מטאורה → חלקידיקי', 'חלקידיקי', 'htl_5'],
  ['חלקידיקי — חופים', 'חלקידיקי', 'htl_5'],
  ['חלקידיקי — איי דיאפורוס', 'חלקידיקי', 'htl_5'],
  ['חלקידיקי — פורטו קופו', 'חלקידיקי', 'htl_5'],
  ['חלקידיקי — הר אתוס', 'חלקידיקי', 'htl_5'],
  ['חלקידיקי → סלוניקי → הביתה', 'סלוניקי', undefined],
];


/* ------------------------------------------------------------------ *
 * Activities
 *
 * Compact tuple form keeps 90+ rows readable:
 *   [dayIndex, time, durationMin, category, title, location?, extras?]
 * ------------------------------------------------------------------ */

type ActExtras = Partial<
  Pick<
    Activity,
    'address' | 'price' | 'currency' | 'notes' | 'url' | 'bookingRef' | 'booked' | 'image'
  >
>;
type ActRow = [
  number,
  string,
  number,
  ActivityCategory,
  string,
  GeoPoint | undefined,
  ActExtras?,
];

const ACTIVITY_ROWS: ActRow[] = [
  // ---- Day 1 — arrival, Thessaloniki
  [1, '06:20', 140, 'flight', 'טיסה TLV → SKG (A3 928)', LOC.skg, { booked: true, bookingRef: 'A3-QX7T2M' }],
  [1, '10:00', 45, 'drive', 'איסוף הרכב — Hertz בשדה התעופה', LOC.skg, { booked: true, notes: 'רישיון בינלאומי + כרטיס אשראי של הנהג הראשי' }],
  [1, '11:30', 45, 'hotel', 'Check-in — The Modernist', LOC.modernist, { address: 'Ermou 41', booked: true }],
  [1, '13:00', 90, 'food', 'צהריים ברובע לאדאדיקה', LOC.ladadika, { price: 95, currency: 'EUR', notes: 'המון טברנות קטנות, אין צורך בהזמנה' }],
  [1, '16:00', 60, 'attraction', 'המגדל הלבן', LOC.whiteTower, { price: 30, currency: 'EUR', url: 'https://lpth.gr/' }],
  [1, '18:00', 90, 'attraction', 'כיכר אריסטוטלוס והטיילת', LOC.aristotelous, undefined],
  [1, '20:30', 120, 'food', 'ארוחת ערב ב-Mourga', LOC.mourga, { price: 140, currency: 'EUR', notes: 'חובה להזמין מקום מראש', url: 'https://www.mourga.gr/' }],

  // ---- Day 2 — Thessaloniki
  [2, '08:30', 60, 'coffee', 'ארוחת בוקר במלון', LOC.modernist, undefined],
  [2, '10:00', 120, 'attraction', 'העיר העתיקה — Ano Poli וחומות העיר', LOC.anoPoli, { notes: 'נעליים נוחות, יש הרבה מדרגות' }],
  [2, '12:15', 60, 'attraction', 'הרוטונדה', LOC.rotunda, { price: 20, currency: 'EUR' }],
  [2, '13:30', 90, 'food', 'שוק מודיאנו — צהריים', LOC.modiano, { price: 80, currency: 'EUR' }],
  [2, '16:00', 120, 'shopping', 'רחוב צימיסקי — קניות', LOC.tsimiski, { price: 150, currency: 'EUR' }],
  [2, '19:00', 60, 'beach', 'שקיעה בטיילת ניקיס', LOC.nikis, undefined],
  [2, '21:00', 120, 'food', 'ארוחת ערב — מזה בעיר העתיקה', LOC.anoPoli, { price: 130, currency: 'EUR' }],

  // ---- Day 3 — to Metsovo
  [3, '08:00', 60, 'coffee', 'ארוחת בוקר', LOC.modernist, undefined],
  [3, '09:00', 30, 'hotel', 'Check-out', LOC.modernist, undefined],
  [3, '09:30', 180, 'drive', 'נסיעה לסלוניקי → מטסובו', LOC.metsovo, { notes: 'כביש אגנטיה, כ-3 שעות. יש אגרה.' }],
  [3, '12:45', 45, 'hotel', 'Check-in — Grand Forest Metsovo', LOC.grandForest, { booked: true }],
  [3, '14:00', 90, 'food', 'צהריים מטסוביטי מסורתי', LOC.metsovo, { price: 90, currency: 'EUR' }],
  [3, '16:00', 90, 'winery', 'יקב Katogi Averoff — סיור וטעימות', LOC.katogi, { price: 60, currency: 'EUR', url: 'https://www.katogi-strofilia.gr/', notes: 'להזמין סיור מראש' }],
  [3, '18:00', 75, 'attraction', 'מוזיאון Averoff לאמנות יוונית', LOC.averoff, { price: 25, currency: 'EUR' }],
  [3, '20:30', 120, 'food', 'ארוחת ערב במלון', LOC.grandForest, { price: 160, currency: 'EUR' }],

  // ---- Day 4 — Metsovo → Zagori
  [4, '08:00', 60, 'coffee', 'ארוחת בוקר', LOC.grandForest, undefined],
  [4, '09:15', 30, 'hotel', 'Check-out', LOC.grandForest, undefined],
  [4, '10:30', 60, 'winery', 'טעימות יין במטסובו', LOC.katogi, { price: 40, currency: 'EUR' }],
  [4, '11:45', 45, 'attraction', 'מחלבת Metsovone — גבינות מקומיות', LOC.dairy, { price: 35, currency: 'EUR', notes: 'לקנות גבינה לדרך' }],
  [4, '13:00', 75, 'drive', 'נסיעה לזגוריה', LOC.kipi, undefined],
  [4, '14:30', 90, 'food', 'צהריים בכפר קיפי', LOC.kipi, { price: 85, currency: 'EUR' }],
  [4, '16:30', 45, 'hotel', 'Check-in — Aristi Mountain Resort', LOC.aristi, { booked: true }],
  [4, '17:45', 75, 'nature', 'גשרי האבן של קוקוריס', LOC.kokkoris, { notes: 'תצפית יפה במיוחד לפני השקיעה' }],
  [4, '20:30', 120, 'food', 'ארוחת ערב במלון', LOC.aristi, { price: 170, currency: 'EUR' }],

  // ---- Day 5 — Vikos
  [5, '07:30', 60, 'coffee', 'ארוחת בוקר', LOC.aristi, undefined],
  [5, '09:00', 120, 'nature', 'תצפית אוקסיה על ערוץ ויקוס', LOC.oxya, { notes: 'הערוץ העמוק בעולם ביחס לרוחבו' }],
  [5, '11:30', 90, 'nature', 'כפר מונודנדרי ומנזר אגיה פרסקבי', LOC.agiaParaskevi, undefined],
  [5, '13:30', 90, 'food', 'צהריים במונודנדרי', LOC.monodendri, { price: 80, currency: 'EUR' }],
  [5, '16:00', 150, 'nature', 'בריכות הסלע של פאפינגו', LOC.papingoPools, { notes: 'המים קרים! להביא נעלי מים' }],
  [5, '20:00', 120, 'food', 'ארוחת ערב באריסטי', LOC.aristi, { price: 150, currency: 'EUR' }],

  // ---- Day 6 — rafting
  [6, '08:00', 45, 'coffee', 'ארוחת בוקר', LOC.aristi, undefined],
  [6, '09:30', 210, 'activity', 'ראפטינג בנהר ווידומטיס', LOC.voidomatis, { price: 250, currency: 'EUR', booked: true, bookingRef: 'NP-7741', notes: 'להביא בגד ים, מגבת והחלפה', url: 'https://www.no-limits.com.gr/' }],
  [6, '13:30', 90, 'food', 'צהריים אחרי הראפטינג', LOC.voidomatis, { price: 75, currency: 'EUR' }],
  [6, '16:00', 120, 'nature', 'כפר מגאלו פאפינגו', LOC.megaloPapingo, undefined],
  [6, '18:30', 60, 'coffee', 'קפה בכיכר הכפר', LOC.megaloPapingo, { price: 25, currency: 'EUR' }],
  [6, '20:30', 120, 'food', 'ארוחת ערב', LOC.aristi, { price: 150, currency: 'EUR' }],

  // ---- Day 7 — to Meteora
  [7, '08:30', 60, 'coffee', 'ארוחת בוקר', LOC.aristi, undefined],
  [7, '09:45', 30, 'hotel', 'Check-out', LOC.aristi, undefined],
  [7, '10:15', 150, 'drive', 'נסיעה למטאורה', LOC.kalambaka, { notes: 'דרך יפה במיוחד, כ-2:30 שעות' }],
  [7, '13:00', 45, 'hotel', 'Check-in — Dellas Boutique', LOC.dellas, { booked: true }],
  [7, '14:00', 90, 'food', 'צהריים בקלמבקה', LOC.kalambaka, { price: 85, currency: 'EUR' }],
  [7, '16:30', 120, 'attraction', 'מנזר Great Meteoron', LOC.greatMeteoron, { price: 25, currency: 'EUR', notes: 'לבוש צנוע — חצאית/מכנס ארוך' }],
  [7, '19:00', 75, 'nature', 'שקיעה מנקודת התצפית פסרופטרה', LOC.psaropetra, undefined],
  [7, '20:45', 120, 'food', 'ארוחת ערב', LOC.kalambaka, { price: 120, currency: 'EUR' }],

  // ---- Day 8 — monasteries
  [8, '07:30', 45, 'coffee', 'ארוחת בוקר', LOC.dellas, undefined],
  [8, '08:45', 90, 'attraction', 'מנזר Varlaam', LOC.varlaam, { price: 25, currency: 'EUR' }],
  [8, '10:45', 75, 'attraction', 'מנזר Roussanou', LOC.roussanou, { price: 25, currency: 'EUR' }],
  [8, '12:30', 75, 'attraction', 'מנזר Agios Stefanos', LOC.agiosStefanos, { price: 25, currency: 'EUR' }],
  [8, '14:15', 90, 'food', 'צהריים', LOC.kalambaka, { price: 80, currency: 'EUR' }],
  [8, '17:00', 120, 'nature', 'טיול רגלי בין הסלעים בקסטרקי', LOC.kastraki, undefined],
  [8, '20:30', 120, 'food', 'ארוחת ערב', LOC.kastraki, { price: 110, currency: 'EUR' }],

  // ---- Day 9 — to Halkidiki
  [9, '08:00', 60, 'coffee', 'ארוחת בוקר', LOC.dellas, undefined],
  [9, '09:15', 30, 'hotel', 'Check-out', LOC.dellas, undefined],
  [9, '09:45', 215, 'drive', 'נסיעה לחלקידיקי (סיתוניה)', LOC.vourvourou, { notes: 'עצירת קפה באמצע הדרך' }],
  [9, '14:00', 45, 'hotel', 'Check-in — Ekies All Senses', LOC.ekies, { booked: true }],
  [9, '15:30', 150, 'beach', 'חוף המלון', LOC.ekies, undefined],
  [9, '18:30', 60, 'beach', 'שחייה במפרץ ורוורו', LOC.vourvourou, undefined],
  [9, '20:30', 120, 'food', 'ארוחת ערב במלון', LOC.ekies, { price: 175, currency: 'EUR' }],

  // ---- Day 10 — beaches
  [10, '09:00', 60, 'coffee', 'ארוחת בוקר', LOC.ekies, undefined],
  [10, '10:30', 180, 'beach', 'חוף קארידי', LOC.karydi, { notes: 'מים רדודים ותכולים, מצוין למשפחות' }],
  [10, '13:45', 90, 'food', 'צהריים בטברנה על החוף', LOC.karydi, { price: 95, currency: 'EUR' }],
  // Deliberately planned back-to-back: the itinerary screen flags this as a
  // transition the drive can't fit into.
  [10, '15:30', 180, 'beach', 'חוף קבורוטריפס (Orange Beach)', LOC.kavourotrypes, { notes: 'החניה קטנה — להגיע מוקדם' }],
  [10, '20:00', 120, 'food', 'ארוחת ערב בנאוס מרמרס', LOC.neosMarmaras, { price: 130, currency: 'EUR' }],

  // ---- Day 11 — boat
  [11, '09:00', 60, 'coffee', 'ארוחת בוקר', LOC.ekies, undefined],
  [11, '10:15', 300, 'activity', 'שיט לאיי דיאפורוס', LOC.diaporos, { price: 300, currency: 'EUR', booked: true, bookingRef: 'DP-2291', notes: 'סירה פרטית ליום שלם, כולל עצירות שנורקלינג' }],
  [11, '16:00', 120, 'beach', 'חוף ליד המלון', LOC.vourvourou, undefined],
  [11, '19:00', 60, 'coffee', 'קפה בוורוורו', LOC.vourvourou, { price: 30, currency: 'EUR' }],
  [11, '21:00', 120, 'food', 'ארוחת ערב', LOC.vourvourou, { price: 125, currency: 'EUR' }],

  // ---- Day 12 — Porto Koufo
  [12, '09:30', 60, 'coffee', 'ארוחת בוקר', LOC.ekies, undefined],
  [12, '11:00', 75, 'drive', 'נסיעה לפורטו קופו', LOC.portoKoufo, undefined],
  [12, '12:30', 90, 'beach', 'פורטו קופו — הנמל הטבעי', LOC.portoKoufo, undefined],
  [12, '14:15', 105, 'food', 'דגים טריים בנמל', LOC.portoKoufo, { price: 160, currency: 'EUR', notes: 'מומלץ Taverna Porto' }],
  [12, '17:00', 90, 'nature', 'תצפית קאפרוס', LOC.kapros, undefined],
  [12, '20:30', 120, 'food', 'ארוחת ערב במלון', LOC.ekies, { price: 140, currency: 'EUR' }],

  // ---- Day 13 — Athos
  [13, '08:30', 45, 'coffee', 'ארוחת בוקר', LOC.ekies, undefined],
  [13, '10:00', 300, 'activity', 'שיט להר אתוס מאורמוס פנאיאס', LOC.ormosPanagias, { price: 225, currency: 'EUR', booked: true, bookingRef: 'AT-6650', notes: 'הפלגה לאורך המנזרים, כולל ארוחה על הסירה' }],
  [13, '16:00', 120, 'beach', 'מנוחה בחוף המלון', LOC.ekies, undefined],
  [13, '18:30', 90, 'shopping', 'קניות מזכרות בנאוס מרמרס', LOC.neosMarmaras, { price: 200, currency: 'EUR' }],
  [13, '20:45', 150, 'food', 'ארוחת ערב פרידה', LOC.neosMarmaras, { price: 190, currency: 'EUR' }],

  // ---- Day 14 — home
  [14, '09:00', 60, 'coffee', 'ארוחת בוקר אחרונה', LOC.ekies, undefined],
  [14, '10:30', 30, 'hotel', 'Check-out', LOC.ekies, undefined],
  [14, '11:15', 105, 'drive', 'נסיעה לסלוניקי', LOC.thessaloniki, undefined],
  [14, '13:15', 90, 'food', 'צהריים בסלוניקי', LOC.ladadika, { price: 100, currency: 'EUR' }],
  [14, '15:00', 120, 'shopping', 'קניות אחרונות', LOC.tsimiski, { price: 120, currency: 'EUR' }],
  [14, '17:30', 45, 'drive', 'החזרת הרכב בשדה התעופה', LOC.skg, { notes: 'למלא דלק לפני ההחזרה' }],
  [14, '21:20', 135, 'flight', 'טיסה SKG → TLV (A3 927)', LOC.skg, { booked: true, bookingRef: 'A3-QX7T2M' }],
];

const activities: Activity[] = ACTIVITY_ROWS.map((row, i) => {
  const [dayIndex, startTime, durationMin, category, title, location, extras] = row;
  return {
    id: `act_${String(i + 1).padStart(3, '0')}`,
    tripId: TRIP_ID,
    dayId: `day_${dayIndex}`,
    title,
    category,
    startTime,
    durationMin,
    location,
    order: i,
    currency: 'EUR',
    ...extras,
  };
});

/* ------------------------------------------------------------------ *
 * Days
 *
 * The daily budget is derived from what the day's activities actually cost,
 * rounded up to the nearest ₪50 with a small buffer for the things nobody
 * plans (coffee, parking, an extra scoop of ice cream).
 * ------------------------------------------------------------------ */

const EUR_TO_ILS = FALLBACK_ILS_RATES.EUR;

function plannedBudgetForDay(dayIndex: number): number {
  const spend = ACTIVITY_ROWS.filter(([d]) => d === dayIndex).reduce(
    (sum, [, , , , , , extras]) => sum + (extras?.price ?? 0),
    0
  );
  const withBuffer = spend * EUR_TO_ILS * 1.15 + 120;
  return Math.round(withBuffer / 50) * 50;
}

const days: Day[] = DAY_SEED.map(([title, baseLocation, hotelId], i) => ({
  id: `day_${i + 1}`,
  tripId: TRIP_ID,
  date: addDays(START, i),
  index: i + 1,
  title,
  baseLocation,
  hotelId,
  plannedBudget: plannedBudgetForDay(i + 1),
}));

/* ------------------------------------------------------------------ *
 * Places wishlist
 * ------------------------------------------------------------------ */

const PLACE_ROWS: [string, PlaceList, ActivityCategory, GeoPoint, number, string, string?][] = [
  ['מנזר Agia Triada', 'must', 'attraction', P(39.7186, 21.6414), 5, 'המנזר מסרט הג׳יימס בונד. נוף מטורף.'],
  ['ערוץ ויקוס — מסלול מלא', 'if-time', 'nature', P(39.9333, 20.7833), 5, 'מסלול של 6 שעות מהכפר מונודנדרי לפאפינגו'],
  ['Taverna To Elliniko', 'restaurants', 'food', P(40.6355, 22.9422), 4, 'מטבח יווני ביתי במרכז סלוניקי'],
  ['Bougatsa Bantis', 'coffee', 'coffee', P(40.6424, 22.9346), 5, 'הבוגצה הכי טובה בסלוניקי — פתוח מ-6 בבוקר'],
  ['אגם פלסטירה', 'if-time', 'nature', P(39.2506, 21.7681), 4, 'אם נשאר זמן בדרך ממטאורה'],
  ['חוף Kalogria', 'beaches', 'beach', P(40.0578, 23.7192), 4, 'חוף רחב עם חול לבן בסיתוניה'],
  ['יקב Domaine Porto Carras', 'wineries', 'winery', P(40.0653, 23.7889), 4, 'הכרם הגדול ביוון, סיורים בבוקר'],
  ['Krypto Beach Bar', 'beaches', 'beach', P(40.1069, 23.9294), 3, 'ליד קבורוטריפס, מוזיקה טובה בשקיעה'],
  ['מפלי אדסה', 'if-time', 'nature', P(40.8022, 22.0439), 4, 'שעתיים מסלוניקי — אפשר ביום האחרון'],
  ['Ouzeri Agora', 'restaurants', 'food', P(40.6379, 22.9403), 4, 'מזה ואוזו ליד שוק מודיאנו'],
];

const places: Place[] = PLACE_ROWS.map(([name, list, category, location, rating, notes, url], i) => ({
  id: `plc_${i + 1}`,
  tripId: TRIP_ID,
  name,
  list,
  category,
  location,
  rating,
  notes,
  url,
  createdAt: '2026-07-01T09:00:00.000Z',
}));

/* ------------------------------------------------------------------ *
 * Expenses
 * ------------------------------------------------------------------ */

const EXPENSE_ROWS: [
  string,
  ExpenseCategory,
  string,
  number,
  'EUR' | 'ILS',
  boolean,
  string,
  Expense['linkedType']?,
  string?,
][] = [
  ['2026-05-14', 'flights', 'טיסות הלוך — Aegean A3 928', 825, 'EUR', true, GUY, 'flight', 'flt_1'],
  ['2026-05-14', 'flights', 'טיסות חזור — Aegean A3 927', 825, 'EUR', true, GUY, 'flight', 'flt_2'],
  ['2026-05-20', 'car', 'השכרת רכב — Hertz, 13 ימים', 680, 'EUR', true, GALI, 'car', 'car_1'],
  ['2026-05-28', 'hotels', 'The Modernist סלוניקי — 2 לילות', 380, 'EUR', true, GUY, 'hotel', 'htl_1'],
  ['2026-06-02', 'hotels', 'Grand Forest Metsovo — לילה', 210, 'EUR', true, NOAM, 'hotel', 'htl_2'],
  ['2026-06-02', 'hotels', 'Aristi Mountain Resort — 3 לילות', 690, 'EUR', true, GALI, 'hotel', 'htl_3'],
  ['2026-08-28', 'hotels', 'Dellas Boutique — 2 לילות', 310, 'EUR', false, GUY, 'hotel', 'htl_4'],
  ['2026-08-30', 'hotels', 'Ekies All Senses — 5 לילות', 1400, 'EUR', false, GUY, 'hotel', 'htl_5'],
  ['2026-07-10', 'other', 'ביטוח נסיעות ל-5 מטיילים', 650, 'ILS', true, SHIR],
  ['2026-07-18', 'attractions', 'מקדמה ראפטינג ווידומטיס', 150, 'EUR', true, ITAY],
  ['2026-07-22', 'ferries', 'שיט להר אתוס — 5 מקומות', 225, 'EUR', true, GUY],
  ['2026-08-01', 'ferries', 'סירה פרטית לאיי דיאפורוס', 300, 'EUR', true, NOAM],
  ['2026-08-24', 'fuel', 'דלק — הערכה לכל הטיול', 260, 'EUR', false, GUY],
  ['2026-08-23', 'food', 'אוכל סלוניקי — הערכה', 300, 'EUR', false, GUY],
  ['2026-08-26', 'food', 'אוכל מטסובו וזגוריה — הערכה', 340, 'EUR', false, GUY],
  ['2026-08-29', 'food', 'אוכל מטאורה — הערכה', 160, 'EUR', false, GUY],
  ['2026-09-02', 'food', 'אוכל חלקידיקי — הערכה', 480, 'EUR', false, GUY],
  ['2026-08-29', 'attractions', 'כניסות למנזרי מטאורה ואתרים', 75, 'EUR', false, GUY],
  ['2026-09-03', 'shopping', 'מזכרות ומתנות', 200, 'EUR', false, GUY],
];

const expenses: Expense[] = EXPENSE_ROWS.map(
  ([date, category, description, amount, currency, paid, paidById, linkedType, linkedId], i) => ({
    id: `exp_${String(i + 1).padStart(3, '0')}`,
    tripId: TRIP_ID,
    date,
    category,
    description,
    amount,
    currency,
    paid,
    paidById,
    splitBetween: ALL,
    linkedType,
    linkedId,
    createdAt: '2026-07-01T09:00:00.000Z',
  })
);

/* ------------------------------------------------------------------ *
 * Documents
 * ------------------------------------------------------------------ */

const documents: TripDocument[] = [
  {
    id: 'doc_1',
    tripId: TRIP_ID,
    name: 'כרטיסי טיסה — Aegean A3-QX7T2M',
    category: 'flight',
    date: '2026-05-14',
    url: 'https://www.aegeanair.com/my-booking/',
    linkedType: 'flight',
    linkedId: 'flt_1',
    notes: 'כולל את שתי הטיסות. צ׳ק־אין נפתח 48 שעות לפני.',
    createdAt: '2026-05-14T10:00:00.000Z',
  },
  {
    id: 'doc_2',
    tripId: TRIP_ID,
    name: 'אישור הזמנה — The Modernist',
    category: 'hotel',
    date: '2026-05-28',
    url: 'https://www.booking.com/',
    linkedType: 'hotel',
    linkedId: 'htl_1',
    createdAt: '2026-05-28T10:00:00.000Z',
  },
  {
    id: 'doc_3',
    tripId: TRIP_ID,
    name: 'אישור הזמנה — Aristi Mountain Resort',
    category: 'hotel',
    date: '2026-06-02',
    url: 'https://aristi.eu/',
    linkedType: 'hotel',
    linkedId: 'htl_3',
    createdAt: '2026-06-02T10:00:00.000Z',
  },
  {
    id: 'doc_4',
    tripId: TRIP_ID,
    name: 'שובר השכרת רכב — Hertz',
    category: 'car',
    date: '2026-05-20',
    url: 'https://www.hertz.com/',
    linkedType: 'car',
    linkedId: 'car_1',
    notes: 'להציג יחד עם רישיון בינלאומי בדלפק.',
    createdAt: '2026-05-20T10:00:00.000Z',
  },
  {
    id: 'doc_5',
    tripId: TRIP_ID,
    name: 'פוליסת ביטוח נסיעות — 5 מטיילים',
    category: 'insurance',
    date: '2026-07-10',
    notes: 'מספר פוליסה 88-224019. טלפון חירום 24/7 בעמוד האחרון.',
    createdAt: '2026-07-10T10:00:00.000Z',
  },
  {
    id: 'doc_6',
    tripId: TRIP_ID,
    name: 'אישור ראפטינג — No Limits',
    category: 'tickets',
    date: '2026-07-18',
    linkedType: 'activity',
    // Resolved by booking reference rather than by row index, so inserting an
    // activity earlier in the table can't silently repoint this document.
    linkedId: activities.find((a) => a.bookingRef === 'NP-7741')?.id,
    notes: 'להגיע 20 דקות לפני. מספר הזמנה NP-7741.',
    createdAt: '2026-07-18T10:00:00.000Z',
  },
];

/* ------------------------------------------------------------------ *
 * Checklists
 * ------------------------------------------------------------------ */

const CHECKLIST_SEED: [string, Checklist['group'], [string, boolean][]][] = [
  [
    'לפני הטיסה',
    'before-flight',
    [
      ['צ׳ק־אין אונליין (48 שעות לפני)', false],
      ['להדפיס/לשמור כרטיסי עלייה', false],
      ['לבדוק תוקף דרכונים — 6 חודשים', true],
      ['להזמין הסעה לשדה', false],
      ['להוריד מפות אופליין של צפון יוון', false],
      ['לעדכן את הבנק על נסיעה לחו״ל', true],
    ],
  ],
  [
    'מסמכים',
    'documents',
    [
      ['דרכונים', true],
      ['רישיון נהיגה בינלאומי', true],
      ['פוליסת ביטוח נסיעות', true],
      ['אישורי מלונות מודפסים', false],
      ['שובר השכרת רכב', true],
      ['כרטיס אשראי של הנהג הראשי', true],
    ],
  ],
  [
    'מזוודות',
    'luggage',
    [
      ['נעלי הליכה', false],
      ['בגדי ים ומגבת חוף', false],
      ['ז׳קט קל להרים (קר בערב בזגוריה)', false],
      ['מטענים ומתאם תקע אירופאי', false],
      ['תרופות ועזרה ראשונה', false],
      ['קרם הגנה', false],
      ['לבוש צנוע לביקור במנזרים', false],
      ['נעלי מים לבריכות פאפינגו', false],
    ],
  ],
  [
    'לפני מעבר מלון',
    'hotel-change',
    [
      ['לבדוק מגירות וכספת', false],
      ['מטענים בשקעים', false],
      ['בגדים על המרפסת', false],
      ['להחזיר מפתח/כרטיס', false],
      ['לוודא שהחשבון נסגר', false],
    ],
  ],
  [
    'לפני יציאה ליום טיול',
    'day-out',
    [
      ['בקבוקי מים', false],
      ['סוללות טעונות', false],
      ['כובעים וקרם הגנה', false],
      ['חטיפים לדרך', false],
      ['לבדוק שעות פתיחה של האתרים', false],
    ],
  ],
  [
    'רכב',
    'car',
    [
      ['לצלם את הרכב לפני היציאה מהחניון', false],
      ['לבדוק גלגל רזרבי', false],
      ['להתקין מחזיק טלפון', false],
      ['למלא דלק לפני ההחזרה', false],
      ['לבדוק מדיניות אגרות בכביש אגנטיה', false],
    ],
  ],
  [
    'ביטוח',
    'insurance',
    [
      ['ביטוח נסיעות לכל 5 המטיילים', true],
      ['ביטוח מקיף לרכב', true],
      ['לשמור טלפון חירום בטלפון', false],
    ],
  ],
];

const checklists: Checklist[] = CHECKLIST_SEED.map(([title, group, items], i) => ({
  id: `chk_${i + 1}`,
  tripId: TRIP_ID,
  title,
  group,
  items: items.map(([text, done], j) => ({ id: `chi_${i + 1}_${j + 1}`, text, done })),
  createdAt: '2026-07-01T09:00:00.000Z',
}));

/* ------------------------------------------------------------------ *
 * Trip
 * ------------------------------------------------------------------ */

const trip: Trip = {
  id: TRIP_ID,
  name: 'צפון יוון — אוגוסט 2026',
  destination: 'צפון יוון',
  countryCode: 'GR',
  coverImage: 'greece',
  startDate: START,
  endDate: addDays(START, DAYS_COUNT - 1),
  baseCurrency: 'ILS',
  totalBudget: 35000,
  currencies: ['ILS', 'EUR'],
  rates: defaultRates('ILS', ['ILS', 'EUR']),
  ratesSource: 'manual',
  route: ['סלוניקי', 'מטסובו', 'זגוריה', 'מטאורה', 'חלקידיקי'],
  notes: 'טיול משפחתי — שילוב של עיר, הרים ומנזרים, וסיום על החוף בסיתוניה.',
  createdAt: '2026-05-01T09:00:00.000Z',
  updatedAt: '2026-08-10T09:00:00.000Z',
};

export const GREECE_DEMO: TripData = {
  trips: [trip],
  travelers,
  days,
  activities,
  hotels,
  flights,
  cars,
  places,
  expenses,
  documents,
  checklists,
  shares: [
    {
      id: 'shr_1',
      tripId: TRIP_ID,
      name: 'גלי',
      email: 'gali@example.com',
      permission: 'edit',
      invitedAt: '2026-05-02T09:00:00.000Z',
      status: 'active',
    },
    {
      id: 'shr_2',
      tripId: TRIP_ID,
      name: 'סבתא רותי',
      email: 'ruti@example.com',
      permission: 'view',
      invitedAt: '2026-07-15T09:00:00.000Z',
      status: 'pending',
    },
  ],
};

export const DEMO_TRIP_ID = TRIP_ID;
