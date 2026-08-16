import type { HHMM, ISODate } from '@/lib/types';

const HE_MONTHS = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

const HE_MONTHS_SHORT = [
  'ינו',
  'פבר',
  'מרץ',
  'אפר',
  'מאי',
  'יונ',
  'יול',
  'אוג',
  'ספט',
  'אוק',
  'נוב',
  'דצמ',
];

const HE_WEEKDAYS = [
  'יום ראשון',
  'יום שני',
  'יום שלישי',
  'יום רביעי',
  'יום חמישי',
  'יום שישי',
  'שבת',
];

const HE_WEEKDAYS_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

/**
 * All dates in the app are calendar dates with no timezone. Parsing them as
 * UTC and reading them back with UTC getters keeps a day from sliding by one
 * for users east or west of GMT.
 */
export function parseDate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

export function toISODate(date: Date): ISODate {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Today in the *browser's* local calendar, as an ISO date. */
export function todayISO(): ISODate {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = parseDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

/** Whole days from `a` to `b`; negative when `b` is earlier. */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000);
}

/** Inclusive day count, i.e. 22.8 → 4.9 is 14 days. */
export function daysBetweenInclusive(start: ISODate, end: ISODate): number {
  return diffDays(start, end) + 1;
}

export function eachDate(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  const total = Math.max(0, diffDays(start, end));
  for (let i = 0; i <= total; i++) out.push(addDays(start, i));
  return out;
}

export function isBetween(iso: ISODate, start: ISODate, end: ISODate): boolean {
  return iso >= start && iso <= end;
}

/* --------------------------- formatting --------------------------- */

/** `25.8` — the compact form used on cards and chips. */
export function formatDayMonth(iso: ISODate): string {
  const d = parseDate(iso);
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}`;
}

/** `25.8.2026` */
export function formatShortDate(iso: ISODate): string {
  const d = parseDate(iso);
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.${d.getUTCFullYear()}`;
}

/** `25 באוגוסט 2026` */
export function formatLongDate(iso: ISODate): string {
  const d = parseDate(iso);
  return `${d.getUTCDate()} ב${HE_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** `יום שלישי, 25 באוגוסט` */
export function formatWeekdayDate(iso: ISODate): string {
  const d = parseDate(iso);
  return `${HE_WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ב${HE_MONTHS[d.getUTCMonth()]}`;
}

export function weekdayShort(iso: ISODate): string {
  return HE_WEEKDAYS_SHORT[parseDate(iso).getUTCDay()];
}

export function monthShort(iso: ISODate): string {
  return HE_MONTHS_SHORT[parseDate(iso).getUTCMonth()];
}

/** `22.8.2026 – 4.9.2026` (LTR-safe: caller should wrap in .ltr-nums) */
export function formatDateRange(start: ISODate, end: ISODate): string {
  return `${formatShortDate(start)} – ${formatShortDate(end)}`;
}

/** `22–24.8` for hotel timelines. */
export function formatCompactRange(start: ISODate, end: ISODate): string {
  const a = parseDate(start);
  const b = parseDate(end);
  if (a.getUTCMonth() === b.getUTCMonth()) {
    return `${a.getUTCDate()}–${b.getUTCDate()}.${b.getUTCMonth() + 1}`;
  }
  return `${a.getUTCDate()}.${a.getUTCMonth() + 1}–${b.getUTCDate()}.${b.getUTCMonth() + 1}`;
}

/* ----------------------------- times ------------------------------ */

export function timeToMinutes(time?: HHMM): number | undefined {
  if (!time) return undefined;
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h)) return undefined;
  return h * 60 + (m || 0);
}

export function minutesToTime(mins: number): HHMM {
  const wrapped = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = Math.round(wrapped % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** `42 דק׳` / `2 שע׳` / `1 שע׳ 15 דק׳` */
export function formatDuration(mins: number): string {
  const rounded = Math.max(0, Math.round(mins));
  if (rounded < 60) return `${rounded} דק׳`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  const hours = h === 1 ? 'שעה' : `${h} שע׳`;
  return m === 0 ? hours : `${hours} ${m} דק׳`;
}

export function nowHHMM(): HHMM {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** `בעוד 3 ימים` / `היום` / `אתמול` */
export function relativeDayLabel(iso: ISODate, from: ISODate = todayISO()): string {
  const delta = diffDays(from, iso);
  if (delta === 0) return 'היום';
  if (delta === 1) return 'מחר';
  if (delta === 2) return 'מחרתיים';
  if (delta === -1) return 'אתמול';
  if (delta > 0) return `בעוד ${delta} ימים`;
  return `לפני ${Math.abs(delta)} ימים`;
}
