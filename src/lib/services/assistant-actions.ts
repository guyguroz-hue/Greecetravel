import {
  CURRENCIES,
  type ActivityCategory,
  type CurrencyCode,
  type ExpenseCategory,
} from '@/lib/types';
import { parseQuickAdd } from './quick-add';

/**
 * Turning pasted text into things the assistant can actually create.
 *
 * The assistant could only ever answer questions, which makes it a search box
 * with opinions: the person still had to open the right screen and retype
 * what they already had in front of them. This is the other half — text in,
 * a list of bookings, expenses and activities out, put where they belong.
 *
 * Two rules shape everything here.
 *
 * Nothing is ever written from a parse. `planFromText` returns a *proposal*,
 * every line of it labelled with what it would create, and lines it could not
 * understand are returned too, with the reason. The caller shows the list and
 * the person confirms it. A parser that writes directly is a parser that
 * silently corrupts a trip the first time it misreads a date.
 *
 * And a line that is ambiguous is never guessed at twice. Each recogniser
 * below looks for evidence that is hard to produce by accident — a flight
 * number, a date range, a clock time — and the tests pin down which one wins
 * when a line carries more than one, because that ordering is the whole
 * behaviour of the feature.
 */

export type PlanOp =
  | {
      kind: 'expense';
      date: string;
      amount: number;
      currency: CurrencyCode;
      category: ExpenseCategory;
      description: string;
      paid: boolean;
    }
  | {
      kind: 'hotel';
      name: string;
      city: string;
      checkIn: string;
      checkOut: string;
      totalPrice?: number;
      currency: CurrencyCode;
      paid: boolean;
    }
  | {
      kind: 'flight';
      airline: string;
      flightNumber: string;
      date: string;
      departureTime?: string;
      fromCode: string;
      toCode: string;
      price?: number;
      currency: CurrencyCode;
    }
  | {
      kind: 'activity';
      date: string;
      title: string;
      startTime?: string;
      category: ActivityCategory;
    };

export interface PlanLine {
  /** The line exactly as it was pasted, so a rejection can be pointed at. */
  source: string;
  op?: PlanOp;
  /** Why nothing could be made of it. Present when `op` is not. */
  problem?: string;
}

export interface PlanContext {
  defaultCurrency: CurrencyCode;
  /** The trip's own dates, used to resolve a bare day/month and to reject strays. */
  startDate?: string;
  endDate?: string;
  today?: string;
}

/* ------------------------------------------------------------------ *
 * Shared scraps
 * ------------------------------------------------------------------ */

const TIME = /\b([01]?\d|2[0-3]):([0-5]\d)\b/;
/** Two letters or a letter/digit mix, then 2–4 digits: `U8 216`, `LY385`. */
const FLIGHT_NO = /\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{2,4})\b/;
/** `TLV → SKG`, `TLV-SKG`, `TLV to SKG`. */
const ROUTE = /\b([A-Z]{3})\s*(?:→|->|–|-|to|אל)\s*([A-Z]{3})\b/;
/** `22-26/8`, `22/8-26/8`, `29.8-2.9`. */
const RANGE =
  /\b(\d{1,2})(?:[./](\d{1,2}))?\s*[-–]\s*(\d{1,2})[./](\d{1,2})\b/;

const CURRENCY_SYMBOL: Record<string, CurrencyCode> = {
  '€': 'EUR',
  $: 'USD',
  '£': 'GBP',
  '₪': 'ILS',
  '¥': 'JPY',
  '฿': 'THB',
  '₺': 'TRY',
};

function iso(year: number, month: number, day: number): string | undefined {
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return undefined;
  return d.toISOString().slice(0, 10);
}

/**
 * The year a bare `29/8` means.
 *
 * A trip that runs across New Year makes this genuinely ambiguous, so the
 * month decides: a date whose month is at or after the start month belongs to
 * the starting year, and one before it belongs to the next.
 */
function yearFor(month: number, ctx: PlanContext): number {
  const start = ctx.startDate ?? ctx.today;
  if (!start) return new Date().getUTCFullYear();
  const startYear = Number(start.slice(0, 4));
  const startMonth = Number(start.slice(5, 7));
  const endYear = Number((ctx.endDate ?? start).slice(0, 4));
  if (endYear === startYear) return startYear;
  return month >= startMonth ? startYear : endYear;
}

/**
 * A single date anywhere in the text, as ISO. Consumes what it matched.
 *
 * Every candidate is tried, not just the first. `19.00 ארוחה 25/8` leads with
 * something date-shaped that is not a date — month zero — and stopping at the
 * first match would throw away the real date sitting further along the line.
 */
function takeDate(text: string, ctx: PlanContext): { date?: string; rest: string } {
  for (const m of text.matchAll(/\b(\d{1,2})[./](\d{1,2})[./](\d{2,4})\b/g)) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    const d = iso(y, Number(m[2]), Number(m[1]));
    if (d) return { date: d, rest: text.replace(m[0], ' ') };
  }

  for (const m of text.matchAll(/\b(\d{1,2})[./](\d{1,2})\b/g)) {
    const month = Number(m[2]);
    const d = iso(yearFor(month, ctx), month, Number(m[1]));
    if (d) return { date: d, rest: text.replace(m[0], ' ') };
  }

  return { rest: text };
}

interface Bits {
  date?: string;
  time?: string;
  currency: CurrencyCode;
  /** True when a currency symbol or word was actually written. */
  marked: boolean;
  amount?: number;
  /** The line with date, time, currency and amount removed. */
  rest: string;
}

/**
 * Pull the structured pieces out of a line, in an order that matters.
 *
 * The date and the clock time come out FIRST, before anything looks for an
 * amount. Both are made of digits, and a search for money that runs before
 * they are removed finds them: `ביקור במנזר 26/8` becomes an expense of 26,
 * and `19:00 ארוחת ערב ₪240` becomes an expense of 19. Both did, until this
 * function existed — and neither looks like an error afterwards, which is what
 * makes it the worst kind.
 */
function extract(line: string, ctx: PlanContext): Bits {
  const { date, rest: noDate } = takeDate(line, ctx);

  const t = noDate.match(TIME);
  const time = t ? `${t[1].padStart(2, '0')}:${t[2]}` : undefined;
  const noTime = t ? noDate.replace(t[0], ' ') : noDate;

  const { currency, rest: noCurrency } = takeCurrency(noTime, ctx.defaultCurrency);
  const { amount, rest } = takeAmount(noCurrency);

  return { date, time, currency, marked: noCurrency !== noTime, amount, rest };
}

function takeCurrency(text: string, fallback: CurrencyCode): { currency: CurrencyCode; rest: string } {
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOL)) {
    if (text.includes(symbol)) return { currency: code, rest: text.split(symbol).join(' ') };
  }
  const code = text.match(new RegExp(`\\b(${CURRENCIES.join('|')})\\b`, 'i'));
  if (code) {
    return {
      currency: code[1].toUpperCase() as CurrencyCode,
      rest: text.replace(code[0], ' '),
    };
  }
  // No `\b` around the Hebrew: JavaScript defines a word boundary over ASCII
  // word characters only, so `\bשקלים\b` can never match — the letters either
  // side of it are not word characters to begin with.
  if (/שקלים?|ש"ח|ש״ח/.test(text)) {
    return { currency: 'ILS', rest: text.replace(/שקלים?|ש"ח|ש״ח/g, ' ') };
  }
  return { currency: fallback, rest: text };
}

/**
 * A money amount, allowing the thousands separators a person actually types.
 *
 * The quick-add bar reads `15,000` as fifteen, which is the kind of detail
 * that turns a helpful paste into a wrong budget. Here a comma or dot
 * followed by exactly three digits is a thousands group.
 */
export function takeAmount(text: string): { amount?: number; rest: string } {
  const m = text.match(/(?<![\w.,])(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?![\w])/);
  if (!m) return { rest: text };

  const raw = m[1];
  let normalized = raw;
  const groups = raw.match(/[.,]\d{3}\b/g);
  if (groups && groups.length > 0) {
    // `1.234,56` / `1,234.56` — strip the groups, keep a trailing decimal.
    const decimal = raw.match(/[.,](\d{1,2})$/);
    normalized = raw.replace(/[.,]\d{3}/g, (g) => g.slice(1));
    // The separator goes too, not just the digits after it — leaving it
    // behind yields `1234,.56`, which is NaN and silently drops the amount.
    if (decimal) {
      normalized = normalized.slice(0, -(decimal[1].length + 1)) + '.' + decimal[1];
    }
  } else {
    normalized = raw.replace(',', '.');
  }

  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return { rest: text };
  return { amount: value, rest: text.replace(raw, ' ') };
}

function clean(s: string): string {
  return s
    .replace(/[·|]/g, ' ')
    .replace(/\s*[-–—]\s*$/, '')
    .replace(/^\s*[-–—+]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const ACTIVITY_WORDS: [ActivityCategory, string[]][] = [
  ['food', ['ארוחה', 'ארוחת', 'מסעדה', 'טברנה', 'dinner', 'lunch', 'restaurant']],
  ['coffee', ['קפה', 'coffee', 'cafe']],
  ['beach', ['חוף', 'beach', 'ים']],
  ['hotel', ['צ׳ק אין', "צ'ק אין", 'check in', 'checkin', 'מלון']],
  ['drive', ['נסיעה', 'נהיגה', 'drive', 'כביש']],
  ['nature', ['טיול', 'הליכה', 'מסלול', 'hike', 'trail', 'מפל', 'הר']],
  ['winery', ['יקב', 'winery', 'יין']],
  ['shopping', ['קניות', 'שוק', 'market', 'shopping']],
  ['flight', ['טיסה', 'flight']],
  ['attraction', ['מוזיאון', 'מנזר', 'ביקור', 'סיור', 'museum', 'tour', 'כניסה']],
];

/**
 * Whole-word keyword matching, for a language that glues its prepositions on.
 *
 * A plain `includes` is unusable here. `ים` is a real word meaning sea, and it
 * is also the standard masculine plural ending, so a substring test files
 * `סיור במנזרים` under "beach" — and `הר` does the same inside `מהר` and
 * `אחרי`. JavaScript's `\b` is no help, being defined over ASCII only.
 *
 * So the text is split into words and each is compared whole, allowing the
 * single-letter prefixes Hebrew attaches directly to a noun — the ב of בחוף,
 * the ל of לים. `בחוף` matches `חוף`; `במנזרים` does not match `ים`, because
 * stripping one letter leaves `מנזרים`, not `ים`.
 */
const HEBREW_PREFIXES = 'בלהומשכ';

function hasKeyword(text: string, keyword: string): boolean {
  if (/[a-z]/i.test(keyword)) return new RegExp(`\\b${keyword}\\b`, 'i').test(text);

  for (const word of text.split(/[^\p{L}\p{N}']+/u)) {
    if (!word) continue;
    if (word === keyword) return true;
    if (
      word.length === keyword.length + 1 &&
      HEBREW_PREFIXES.includes(word[0]) &&
      word.slice(1) === keyword
    ) {
      return true;
    }
  }
  return false;
}

function activityCategory(text: string): ActivityCategory {
  const lower = text.toLowerCase();
  for (const [cat, words] of ACTIVITY_WORDS) {
    if (words.some((w) => hasKeyword(lower, w))) return cat;
  }
  return 'activity';
}

/* ------------------------------------------------------------------ *
 * Recognisers, in the order they are tried
 * ------------------------------------------------------------------ */

function asFlight(line: string, ctx: PlanContext): PlanOp | undefined {
  const upper = line.toUpperCase();
  const route = upper.match(ROUTE);
  const number = upper.match(FLIGHT_NO);
  // A flight needs its number. A route alone is a drive, and a number alone
  // on a line about money is a quantity.
  if (!number) return undefined;
  if (!route && !/טיסה|\bflight\b/i.test(line)) return undefined;

  const { date, rest: noDate } = takeDate(line, ctx);
  if (!date) return undefined;

  const time = line.match(TIME);
  const { currency, rest: noCur } = takeCurrency(noDate, ctx.defaultCurrency);
  const { amount } = takeAmount(noCur.replace(TIME, ' '));

  // Whatever sits before the flight number, minus the noise, is the airline.
  const beforeNumber = line.slice(0, upper.indexOf(number[0]));
  const airline = clean(beforeNumber.replace(/טיסה|flight|הלוך|חזור/gi, ''));

  return {
    kind: 'flight',
    airline: airline || 'טיסה',
    flightNumber: `${number[1]}${number[2]}`,
    date,
    departureTime: time ? `${time[1].padStart(2, '0')}:${time[2]}` : undefined,
    fromCode: route?.[1] ?? '',
    toCode: route?.[2] ?? '',
    price: amount,
    currency,
  };
}

function asHotel(line: string, ctx: PlanContext): PlanOp | undefined {
  const range = line.match(RANGE);
  if (!range) return undefined;

  // `22-26/8` shares one month; `29.8-2.9` names two.
  const endMonth = Number(range[4]);
  const startMonth = range[2] ? Number(range[2]) : endMonth;
  const checkIn = iso(yearFor(startMonth, ctx), startMonth, Number(range[1]));
  const checkOut = iso(yearFor(endMonth, ctx), endMonth, Number(range[3]));
  if (!checkIn || !checkOut || checkOut <= checkIn) return undefined;

  const withoutRange = line.replace(range[0], ' ');
  const { currency, rest: noCur } = takeCurrency(withoutRange, ctx.defaultCurrency);
  const { amount, rest: noAmount } = takeAmount(noCur);

  const paid = !/לא שולם/.test(line);
  const body = clean(noAmount.replace(/מלון|hotel|לא שולם|שולם/gi, ''));
  if (!body) return undefined;

  // "Nyx סלוניקי" — the last word is the town far more often than not, and
  // it is the only part of an address a pasted line reliably carries.
  const words = body.split(' ');
  const city = words.length > 1 ? words[words.length - 1] : '';
  const name = words.length > 1 ? words.slice(0, -1).join(' ') : body;

  return {
    kind: 'hotel',
    name,
    city,
    checkIn,
    checkOut,
    totalPrice: amount,
    currency,
    paid,
  };
}

/**
 * A day's plan: something happening on a date, with no price on it.
 *
 * A clock time is welcome but not required. Half of what goes into an
 * itinerary has no time — a free morning, a monastery, a market — and
 * demanding one meant those lines fell through to the expense reader, which
 * read the day of the month as an amount and quietly invented a cost.
 */
function asActivity(bits: Bits): PlanOp | undefined {
  if (!bits.date) return undefined;
  // A price on the line makes it a record of spending, not a plan.
  if (bits.amount !== undefined || bits.marked) return undefined;

  const title = clean(bits.rest);
  if (!title) return undefined;

  return {
    kind: 'activity',
    date: bits.date,
    title,
    startTime: bits.time,
    category: activityCategory(title),
  };
}

function asExpense(line: string, bits: Bits, ctx: PlanContext): PlanOp | undefined {
  if (bits.amount === undefined) return undefined;

  // The quick-add bar already knows how to read a category, and the relative
  // dates a bare regex misses — "אתמול", "מחר", Hebrew month names. It runs on
  // what is left after the amount and the date are gone, so its own weaker
  // amount reading cannot fire.
  const viaQuickAdd = parseQuickAdd(bits.rest, {
    defaultCurrency: bits.currency,
    tripYear: Number((ctx.startDate ?? ctx.today ?? '').slice(0, 4)) || undefined,
    today: ctx.today,
  });

  const paid = !/לא שולם/.test(line);
  const description = clean(viaQuickAdd.description.replace(/לא שולם|שולם/g, ''));

  return {
    kind: 'expense',
    date: bits.date ?? viaQuickAdd.date,
    amount: bits.amount,
    currency: bits.currency,
    category: viaQuickAdd.category,
    description: description || 'הוצאה',
    paid,
  };
}

/**
 * A proposal built from pasted text, one line at a time.
 *
 * Order matters and is the feature's actual behaviour: a flight number beats
 * a date range beats a clock time beats an amount. So `₪6600 כרטיסי טיסה 22/8`
 * is an expense — it has money and no flight number — while
 * `TUS U8 216 TLV→SKG 22/8 08:30` is a flight, even though a price could be
 * read out of the numbers in it.
 */
export function planFromText(text: string, ctx: PlanContext): PlanLine[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((source): PlanLine => {
      // Flights and hotels are decided on their own evidence — a flight
      // number, a date range — before the line is taken apart, because a
      // range is two dates and the general extraction would eat the first.
      const special = asFlight(source, ctx) ?? asHotel(source, ctx);
      if (special) return { source, op: special };

      const bits = extract(source, ctx);
      const op = asExpense(source, bits, ctx) ?? asActivity(bits);

      if (!op) {
        return {
          source,
          problem: bits.date
            ? 'לא הצלחתי להבין מה להוסיף — צריך גם תיאור'
            : 'צריך תאריך בשורה, למשל 26/8',
        };
      }
      return { source, op };
    });
}

/** One-line human summary of what an operation would create. */
export function describeOp(op: PlanOp): string {
  switch (op.kind) {
    case 'expense':
      return `${op.description} · ${op.amount} ${op.currency} · ${op.date}${op.paid ? ' · שולם' : ' · לא שולם'}`;
    case 'hotel':
      return `${op.name}${op.city ? ` · ${op.city}` : ''} · ${op.checkIn} → ${op.checkOut}${
        op.totalPrice ? ` · ${op.totalPrice} ${op.currency}` : ''
      }`;
    case 'flight':
      return `${op.airline} ${op.flightNumber}${
        op.fromCode ? ` · ${op.fromCode}→${op.toCode}` : ''
      } · ${op.date}${op.departureTime ? ` · ${op.departureTime}` : ''}`;
    case 'activity':
      return `${op.title} · ${op.date}${op.startTime ? ` · ${op.startTime}` : ''}`;
  }
}

export const OP_LABEL: Record<PlanOp['kind'], string> = {
  expense: 'הוצאה',
  hotel: 'מלון',
  flight: 'טיסה',
  activity: 'פעילות',
};
