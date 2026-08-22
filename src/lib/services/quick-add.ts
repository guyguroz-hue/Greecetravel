import {
  CURRENCIES,
  CURRENCY_META,
  EXPENSE_CATEGORY_META,
  type CurrencyCode,
  type ExpenseCategory,
} from '@/lib/types';
import { todayISO } from '@/lib/utils/date';

/**
 * Natural-language quick add for expenses.
 *
 *   "+ €35 Dinner 25/8"  →  35 EUR · food · 2026-08-25
 *   "דלק 120 שקל אתמול"  →  120 ILS · fuel · yesterday
 *
 * Everything is optional: an amount alone is enough to create a row.
 */

export interface QuickAddResult {
  amount?: number;
  currency: CurrencyCode;
  category: ExpenseCategory;
  description: string;
  date: string;
  /** Which parts we actually recognised, for the confirmation preview. */
  matched: { amount: boolean; currency: boolean; category: boolean; date: boolean };
}

const SYMBOL_TO_CURRENCY: Record<string, CurrencyCode> = {
  '€': 'EUR',
  $: 'USD',
  '£': 'GBP',
  '₪': 'ILS',
  '¥': 'JPY',
  '฿': 'THB',
  '₺': 'TRY',
};

/** Words that reliably imply a budget category, in Hebrew and English. */
const CATEGORY_KEYWORDS: [ExpenseCategory, string[]][] = [
  ['food', ['dinner', 'lunch', 'breakfast', 'food', 'meal', 'restaurant', 'ארוחה', 'ארוחת', 'צהריים', 'ערב', 'בוקר', 'אוכל', 'מסעדה', 'טברנה']],
  ['coffee', ['coffee', 'cafe', 'קפה', 'בית קפה', 'מאפה']],
  ['fuel', ['fuel', 'gas', 'petrol', 'diesel', 'דלק', 'תדלוק', 'בנזין']],
  ['hotels', ['hotel', 'hostel', 'airbnb', 'מלון', 'לינה', 'צימר', 'אכסניה']],
  ['flights', ['flight', 'airline', 'טיסה', 'טיסות', 'כרטיס טיסה']],
  ['car', ['car', 'rental', 'parking', 'toll', 'רכב', 'השכרה', 'חניה', 'אגרה', 'כביש אגרה']],
  ['attractions', ['ticket', 'museum', 'entry', 'tour', 'כרטיס', 'מוזיאון', 'כניסה', 'סיור', 'אטרקציה', 'מנזר']],
  ['shopping', ['shopping', 'souvenir', 'gift', 'קניות', 'מזכרת', 'מתנה', 'חנות']],
  ['ferries', ['ferry', 'boat', 'cruise', 'מעבורת', 'סירה', 'שיט', 'הפלגה']],
];

const MONTHS_HE: Record<string, number> = {
  ינואר: 1, פברואר: 2, מרץ: 3, אפריל: 4, מאי: 5, יוני: 6,
  יולי: 7, אוגוסט: 8, ספטמבר: 9, אוקטובר: 10, נובמבר: 11, דצמבר: 12,
};

export function parseQuickAdd(
  input: string,
  opts: { defaultCurrency: CurrencyCode; tripYear?: number; today?: string }
): QuickAddResult {
  const today = opts.today ?? todayISO();
  const year = opts.tripYear ?? Number(today.slice(0, 4));
  let rest = ` ${input.trim()} `;

  const matched = { amount: false, currency: false, category: false, date: false };

  /* ---------------- date ---------------- */
  let date = today;

  const dmy = rest.match(/(?<![\d.])(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?![\d.])/);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]);
    let y = dmy[3] ? Number(dmy[3]) : year;
    if (y < 100) y += 2000;
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      matched.date = true;
      rest = rest.replace(dmy[0], ' ');
    }
  }

  if (!matched.date) {
    const heDate = rest.match(/(\d{1,2})\s+ב?(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)/);
    if (heDate) {
      const d = Number(heDate[1]);
      const m = MONTHS_HE[heDate[2]];
      date = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      matched.date = true;
      rest = rest.replace(heDate[0], ' ');
    }
  }

  if (!matched.date) {
    // No `\b` on the Hebrew: it is an ASCII-only boundary and never fires
    // beside a Hebrew letter, so these three matched nothing and every
    // "מחר" silently became today.
    if (/אתמול|\byesterday\b/.test(rest)) {
      date = shiftDate(today, -1);
      matched.date = true;
      rest = rest.replace(/אתמול|yesterday/g, ' ');
    } else if (/מחר|\btomorrow\b/.test(rest)) {
      date = shiftDate(today, 1);
      matched.date = true;
      rest = rest.replace(/מחר|tomorrow/g, ' ');
    } else if (/היום|\btoday\b/.test(rest)) {
      matched.date = true;
      rest = rest.replace(/היום|today/g, ' ');
    }
  }

  /* ---------------- currency ---------------- */
  let currency = opts.defaultCurrency;

  for (const [symbol, code] of Object.entries(SYMBOL_TO_CURRENCY)) {
    if (rest.includes(symbol)) {
      currency = code;
      matched.currency = true;
      rest = rest.split(symbol).join(' ');
      break;
    }
  }
  if (!matched.currency) {
    const codeMatch = rest.match(new RegExp(`\\b(${CURRENCIES.join('|')})\\b`, 'i'));
    if (codeMatch) {
      currency = codeMatch[1].toUpperCase() as CurrencyCode;
      matched.currency = true;
      rest = rest.replace(codeMatch[0], ' ');
    }
  }
  if (!matched.currency) {
    const words: [RegExp, CurrencyCode][] = [
      // `\b` is an ASCII-only word boundary, so it never fires beside a
      // Hebrew letter — these patterns matched nothing until the boundaries
      // came off.
      [/שקל(ים)?|ש"ח|ש״ח/, 'ILS'],
      [/אירו|\byuro\b|\beuros?\b/, 'EUR'],
      [/דולר(ים)?|\bdollars?\b/, 'USD'],
    ];
    for (const [re, code] of words) {
      if (re.test(rest)) {
        currency = code;
        matched.currency = true;
        rest = rest.replace(re, ' ');
        break;
      }
    }
  }

  /* ---------------- amount ---------------- */
  let amount: number | undefined;
  const amountMatch = rest.match(/(?<![\w.])(\d+(?:[.,]\d{1,2})?)(?![\w.])/);
  if (amountMatch) {
    amount = Number(amountMatch[1].replace(',', '.'));
    if (Number.isFinite(amount)) {
      matched.amount = true;
      rest = rest.replace(amountMatch[0], ' ');
    } else {
      amount = undefined;
    }
  }

  /* ---------------- category ---------------- */
  const lower = rest.toLowerCase();
  let category: ExpenseCategory = 'other';
  for (const [cat, words] of CATEGORY_KEYWORDS) {
    if (words.some((w) => lower.includes(w))) {
      category = cat;
      matched.category = true;
      break;
    }
  }

  /* ---------------- description ---------------- */
  const description =
    rest
      .replace(/[+\-–—]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || EXPENSE_CATEGORY_META[category].label;

  return { amount, currency, category, description, date, matched };
}

function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(
    dt.getUTCDate()
  ).padStart(2, '0')}`;
}

/** Human-readable echo of what the parser understood. */
export function describeQuickAdd(result: QuickAddResult): string {
  const parts: string[] = [];
  if (result.amount !== undefined) {
    parts.push(`${CURRENCY_META[result.currency].symbol}${result.amount}`);
  }
  parts.push(
    `${EXPENSE_CATEGORY_META[result.category].emoji} ${EXPENSE_CATEGORY_META[result.category].label}`
  );
  return parts.join(' · ');
}
