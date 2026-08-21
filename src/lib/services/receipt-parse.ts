import { CURRENCIES, type CurrencyCode, type ExpenseCategory } from '@/lib/types';

/**
 * Reads an expense out of the raw text an OCR pass produced.
 *
 * This is deliberately a pure function over a string: the recognition engine
 * can be swapped (Tesseract today, a cloud model later) without touching any
 * of the reasoning here, and every rule below is unit-testable against real
 * receipt text without a camera, a worker or a network.
 *
 * The rules are shaped by what OCR on a crumpled receipt actually gives you.
 * Digits survive well — they are the same glyphs in every language, and they
 * are what an expense mostly IS. Words survive badly, so no rule here depends
 * on a word being read perfectly; keyword matching is loose and always has a
 * numeric fallback behind it.
 *
 * Nothing is ever saved from this directly. The parse fills a form the person
 * confirms, so the cost of a wrong guess is one correction, and the cost of a
 * missing guess is one keystroke.
 */

/**
 * Above this it is a phone number, a VAT id or a card number, not a bill.
 *
 * The ceiling has to clear a hotel night in yen or baht, where five and six
 * figure totals are ordinary, while still sitting below the seven-digit tax
 * and telephone numbers printed at the top of most receipts.
 */
const MAX_AMOUNT = 1_000_000;

/**
 * Words that sit next to the number you actually want.
 *
 * Latin scripts are matched without diacritics and Greek without accents, so
 * `ΣΎΝΟΛΟ` and `ΣΥΝΟΛΟ` are the same string by the time they get here.
 */
const TOTAL_WORDS = [
  // English
  'total', 'grand total', 'amount due', 'balance due', 'total due', 'to pay',
  // Greek
  'συνολο', 'συνολικο', 'πληρωτεο', 'τελικο ποσο',
  // Hebrew
  'סה"כ', 'סהכ', 'סה״כ', 'סך הכל', 'לתשלום', 'סך',
  // Italian / Spanish / Portuguese
  'totale', 'importe', 'total a pagar', 'importo',
  // French
  'montant', 'net a payer', 'a payer',
  // German
  'gesamt', 'summe', 'betrag', 'zu zahlen',
  // Dutch / Nordic / Turkish / Polish / Czech
  'totaal', 'sum', 'toplam', 'razem', 'celkem', 'yhteensa',
];

/**
 * Words that mean "this number is NOT the total", checked before the list
 * above. `subtotal` and `total vat` both contain `total`, and taking either
 * of them silently books the wrong amount — the failure mode most worth
 * designing against, because it looks like success.
 */
const NOT_TOTAL_WORDS = [
  'subtotal', 'sub total', 'sub-total', 'μερικο συνολο',
  // Tax lines
  'vat', 'tax', 'φπα', 'mwst', 'iva', 'tva', 'btw', 'מע"מ', 'מעמ', 'מע״מ',
  // Tender and change
  'change', 'cash', 'ρεστα', 'μετρητα', 'עודף', 'מזומן', 'tendered', 'received',
  'card', 'visa', 'mastercard', 'καρτα', 'karta', 'אשראי',
  // Service, tips and discounts
  'tip', 'gratuity', 'service', 'discount', 'coupon', 'הנחה', 'טיפ', 'שירות',
];

/** Symbols and codes the app can actually store. */
const CURRENCY_BY_SYMBOL: Record<string, CurrencyCode> = {
  '€': 'EUR',
  $: 'USD',
  '£': 'GBP',
  '₪': 'ILS',
  '¥': 'JPY',
  '₺': 'TRY',
  '฿': 'THB',
};

/** A hint at the category, so the common case needs no tap at all. */
const CATEGORY_WORDS: [ExpenseCategory, string[]][] = [
  ['coffee', ['cafe', 'caffe', 'coffee', 'espresso', 'cappuccino', 'καφε', 'קפה']],
  [
    'food',
    ['restaurant', 'ristorante', 'taverna', 'ταβερνα', 'εστιατοριο', 'pizzeria', 'trattoria',
      'grill', 'kitchen', 'food', 'burger', 'sushi', 'מסעדה', 'souvlaki', 'gyros'],
  ],
  ['fuel', ['fuel', 'petrol', 'gas station', 'diesel', 'unleaded', 'βενζιν', 'shell', 'bp ', 'דלק']],
  ['shopping', ['market', 'supermarket', 'store', 'shop', 'σουπερ', 'mini market', 'boutique']],
  ['attractions', ['museum', 'ticket', 'μουσειο', 'entrance', 'εισιτηριο', 'כרטיס']],
];

export interface ReceiptFields {
  amount?: number;
  currency?: CurrencyCode;
  /** ISO date, only when it parsed to a real day. */
  date?: string;
  merchant?: string;
  category?: ExpenseCategory;
  /**
   * How the amount was found. `total-line` means a labelled total was read;
   * `largest` means the label was missed and the biggest plausible number on
   * the receipt was taken instead — worth saying out loud in the UI.
   */
  amountSource?: 'total-line' | 'largest';
  /** The cleaned lines, so the person can check the reading against the photo. */
  lines: string[];
}

/** Accents off, case down, whitespace collapsed — for keyword matching only. */
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A money token as a number.
 *
 * Both `1.234,56` and `1,234.56` mean the same thing, and a receipt gives no
 * clue which convention it follows. Whichever separator comes LAST is the
 * decimal one, which resolves every mixed case correctly. With only one kind
 * present, three digits behind it is a thousands group and one or two is a
 * decimal — `12,50` is twelve fifty, `1,250` is a thousand two hundred fifty.
 */
export function parseAmountToken(raw: string): number | null {
  const t = raw.trim();
  if (!/\d/.test(t)) return null;

  const lastDot = t.lastIndexOf('.');
  const lastComma = t.lastIndexOf(',');
  let normalized: string;

  if (lastDot >= 0 && lastComma >= 0) {
    const decimalAt = Math.max(lastDot, lastComma);
    normalized = `${t.slice(0, decimalAt).replace(/[.,]/g, '')}.${t.slice(decimalAt + 1)}`;
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ',';
    const parts = t.split(sep);
    const tail = parts[parts.length - 1];
    if (parts.length > 2) {
      // `1.234.567` — repeated, so every one of them groups thousands.
      if (tail.length !== 3) return null;
      normalized = parts.join('');
    } else if (tail.length === 3 && parts[0].length > 0) {
      normalized = parts.join('');
    } else if (tail.length >= 1 && tail.length <= 2) {
      normalized = `${parts[0]}.${tail}`;
    } else {
      return null;
    }
  } else {
    normalized = t;
  }

  if (!/^\d*\.?\d+$/.test(normalized)) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0 || n > MAX_AMOUNT) return null;
  return Math.round(n * 100) / 100;
}

/**
 * Every money-shaped token on a line.
 *
 * Spaces are only allowed to group thousands in exact threes, which is what
 * keeps `2310 123456` (a Greek phone number) from being read as two billion.
 */
function moneyTokens(line: string): { value: number; hadDecimal: boolean; index: number }[] {
  const out: { value: number; hadDecimal: boolean; index: number }[] = [];
  const re = /\d{1,3}(?: \d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d+)*/g;
  for (const m of line.matchAll(re)) {
    const token = m[0].replace(/ /g, '');
    const value = parseAmountToken(token);
    if (value === null) continue;
    out.push({ value, hadDecimal: /[.,]\d{1,2}$/.test(token), index: m.index ?? 0 });
  }
  return out;
}

function hasWord(folded: string, words: string[]): boolean {
  return words.some((w) => folded.includes(w));
}

/**
 * Does the text name a total anywhere? Used to judge a whole OCR pass before
 * anything is extracted: a receipt read in the right language nearly always
 * contains its own word for "total", and one read in the wrong language
 * nearly never does.
 */
export function hasTotalKeyword(text: string): boolean {
  const f = fold(text);
  return TOTAL_WORDS.some((w) => f.includes(w));
}

/** How many money-shaped numbers the text holds, as a signal of a real read. */
export function countMoneyTokens(text: string): number {
  let n = 0;
  for (const line of text.split(/\r?\n/)) n += moneyTokens(line).length;
  return n;
}

/** The currency, from a symbol or a code anywhere in the text. */
function findCurrency(text: string): CurrencyCode | undefined {
  for (const [symbol, code] of Object.entries(CURRENCY_BY_SYMBOL)) {
    if (text.includes(symbol)) return code;
  }
  const upper = text.toUpperCase();
  for (const code of CURRENCIES) {
    if (new RegExp(`\\b${code}\\b`).test(upper)) return code;
  }
  return undefined;
}

function isoIfReal(year: number, month: number, day: number): string | undefined {
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return undefined;
  }
  // A receipt is never for next year; a bad read that lands in the future is
  // worse than no date at all, because the expense hides on a day nobody opens.
  const limit = new Date();
  limit.setUTCDate(limit.getUTCDate() + 1);
  if (d > limit) return undefined;
  if (year < 2000) return undefined;
  return d.toISOString().slice(0, 10);
}

/**
 * The date on the receipt.
 *
 * `03/04/2026` is ambiguous and always will be. Where one number is above 12
 * it resolves itself; otherwise day-first wins, which is the convention
 * everywhere this app is used except the United States.
 */
export function parseReceiptDate(text: string): string | undefined {
  const ymd = text.match(/\b(\d{4})[-./](\d{1,2})[-./](\d{1,2})\b/);
  if (ymd) {
    const iso = isoIfReal(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]));
    if (iso) return iso;
  }

  for (const m of text.matchAll(/\b(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})\b/g)) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += 2000;

    const dayFirst = a > 12 ? true : b > 12 ? false : true;
    const iso = dayFirst ? isoIfReal(year, b, a) : isoIfReal(year, a, b);
    if (iso) return iso;
  }
  return undefined;
}

/**
 * The business name: the first line near the top that reads like a name
 * rather than an address, a phone number or a tax id.
 */
function findMerchant(lines: string[]): string | undefined {
  const junk = /(tel|phone|fax|vat|a\.?f\.?m|τηλ|αφμ|ח\.?פ|עוסק|receipt|invoice|www\.|@|https?:)/i;
  for (const line of lines.slice(0, 6)) {
    const clean = line.replace(/\s+/g, ' ').trim();
    if (clean.length < 3 || clean.length > 40) continue;
    if (junk.test(clean)) continue;
    const letters = clean.replace(/[^\p{L}]/gu, '').length;
    // Mostly letters, and enough of them to be a name rather than a code.
    if (letters < 3 || letters < clean.length / 2) continue;
    return clean;
  }
  return undefined;
}

function findCategory(lines: string[]): ExpenseCategory | undefined {
  const head = fold(lines.slice(0, 8).join(' '));
  for (const [category, words] of CATEGORY_WORDS) {
    if (hasWord(head, words)) return category;
  }
  return undefined;
}

/**
 * Confidence below which the fallback is switched off entirely.
 *
 * The labelled-total rule needs a word to have survived, so it carries its own
 * evidence. The fallback does not: it takes the biggest number it can see,
 * which on a badly read page means the biggest misreading. Two photos of one
 * receipt then produce two different totals, each stated as fact — the exact
 * failure this threshold exists to prevent. Below it, no amount is offered at
 * all and the person types four characters.
 *
 * `guessAllowed` closes the same door from the other side: the caller sets it
 * false when the reading as a whole did not convince, regardless of what the
 * engine's own confidence claims.
 */
const FALLBACK_MIN_CONFIDENCE = 55;

/**
 * The total.
 *
 * First choice is a line that names itself as the total and is not disclaimed
 * by the exclusion list; the last such line wins, because receipts print the
 * final figure lowest.
 *
 * Failing that, the largest number that looks like money — but only when the
 * page was read well enough for "largest" to mean anything, and only from the
 * bottom of the receipt, where the total is. Taking the largest number from
 * anywhere reads the most expensive line item on a long bill just as happily
 * as the sum.
 */
function findAmount(
  lines: string[],
  confidence: number,
  guessAllowed: boolean
): { amount: number; source: 'total-line' | 'largest' } | undefined {
  let labelled: number | undefined;

  for (const line of lines) {
    const f = fold(line);
    if (!hasWord(f, TOTAL_WORDS)) continue;
    if (hasWord(f, NOT_TOTAL_WORDS)) continue;
    const tokens = moneyTokens(line);
    if (tokens.length === 0) continue;
    // Rightmost number on the line: `TOTAL 3 items 42,50` ends with the money.
    labelled = tokens[tokens.length - 1].value;
  }
  if (labelled !== undefined) return { amount: labelled, source: 'total-line' };

  if (!guessAllowed || confidence < FALLBACK_MIN_CONFIDENCE) return undefined;

  // The sum is at the foot of the bill. Anything above the last third is a
  // line item, and on a receipt with one expensive item it beats the total.
  const from = Math.floor(lines.length * 0.55);
  let best: number | undefined;
  for (const line of lines.slice(from)) {
    if (hasWord(fold(line), NOT_TOTAL_WORDS)) continue;
    const hasCurrency = /[€$£₪¥₺฿]/.test(line);
    for (const t of moneyTokens(line)) {
      // A bare integer is a quantity, a year or a table number far more often
      // than it is a price, unless a currency sign is standing next to it.
      if (!t.hadDecimal && !hasCurrency) continue;
      if (best === undefined || t.value > best) best = t.value;
    }
  }
  return best === undefined ? undefined : { amount: best, source: 'largest' };
}

export function parseReceipt(
  text: string,
  opts: { confidence?: number; guessAllowed?: boolean } = {}
): ReceiptFields {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  // Absent options mean a caller that is not the OCR path — a unit test, or
  // text pasted by hand — where the text is known-good and the fallback is
  // welcome.
  const found = findAmount(lines, opts.confidence ?? 100, opts.guessAllowed ?? true);
  return {
    amount: found?.amount,
    amountSource: found?.source,
    currency: findCurrency(text),
    date: parseReceiptDate(text),
    merchant: findMerchant(lines),
    category: findCategory(lines),
    lines,
  };
}
