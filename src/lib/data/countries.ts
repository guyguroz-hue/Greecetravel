/**
 * Destinations, so picking a country fills in everything that follows from it
 * — the flag, the currency spent there, and a cover that suits the place —
 * instead of asking someone to type a two-letter code and choose a picture.
 *
 * Hebrew and Latin names come from ICU (Intl.DisplayNames) rather than being
 * typed by hand, so they match what the rest of the system calls each country.
 * The Latin name is carried only so search matches "greece" as well as "יוון".
 *
 * Generated; see scratchpad/gencountries.mjs in the commit that added it.
 */

import type { CurrencyCode } from '@/lib/types';
import { CURRENCIES } from '@/lib/types';

export interface Country {
  code: string;
  name: string;
  latin: string;
  /** ISO 4217 for the country, whether or not the app carries rates for it. */
  currency: string;
  cover: string;
}

export const COUNTRIES: Country[] = [
  { code: 'UZ', name: 'אוזבקיסטן', latin: 'Uzbekistan', currency: 'UZS', cover: 'desert' },
  { code: 'AT', name: 'אוסטריה', latin: 'Austria', currency: 'EUR', cover: 'mountain' },
  { code: 'AU', name: 'אוסטרליה', latin: 'Australia', currency: 'AUD', cover: 'coast' },
  { code: 'AZ', name: 'אזרבייג׳ן', latin: 'Azerbaijan', currency: 'AZN', cover: 'city' },
  { code: 'AE', name: 'איחוד האמירויות הערביות', latin: 'United Arab Emirates', currency: 'AED', cover: 'desert' },
  { code: 'IT', name: 'איטליה', latin: 'Italy', currency: 'EUR', cover: 'city' },
  { code: 'SC', name: 'איי סיישל', latin: 'Seychelles', currency: 'SCR', cover: 'tropic' },
  { code: 'ID', name: 'אינדונזיה', latin: 'Indonesia', currency: 'IDR', cover: 'tropic' },
  { code: 'IS', name: 'איסלנד', latin: 'Iceland', currency: 'ISK', cover: 'mountain' },
  { code: 'IE', name: 'אירלנד', latin: 'Ireland', currency: 'EUR', cover: 'mountain' },
  { code: 'AL', name: 'אלבניה', latin: 'Albania', currency: 'ALL', cover: 'coast' },
  { code: 'EE', name: 'אסטוניה', latin: 'Estonia', currency: 'EUR', cover: 'city' },
  { code: 'AR', name: 'ארגנטינה', latin: 'Argentina', currency: 'ARS', cover: 'mountain' },
  { code: 'AM', name: 'ארמניה', latin: 'Armenia', currency: 'AMD', cover: 'mountain' },
  { code: 'US', name: 'ארצות הברית', latin: 'United States', currency: 'USD', cover: 'city' },
  { code: 'BG', name: 'בולגריה', latin: 'Bulgaria', currency: 'BGN', cover: 'coast' },
  { code: 'BA', name: 'בוסניה והרצגובינה', latin: 'Bosnia & Herzegovina', currency: 'BAM', cover: 'mountain' },
  { code: 'BE', name: 'בלגיה', latin: 'Belgium', currency: 'EUR', cover: 'city' },
  { code: 'BR', name: 'ברזיל', latin: 'Brazil', currency: 'BRL', cover: 'tropic' },
  { code: 'GB', name: 'בריטניה', latin: 'United Kingdom', currency: 'GBP', cover: 'city' },
  { code: 'GE', name: 'גאורגיה', latin: 'Georgia', currency: 'GEL', cover: 'mountain' },
  { code: 'DE', name: 'גרמניה', latin: 'Germany', currency: 'EUR', cover: 'city' },
  { code: 'DK', name: 'דנמרק', latin: 'Denmark', currency: 'DKK', cover: 'city' },
  { code: 'ZA', name: 'דרום אפריקה', latin: 'South Africa', currency: 'ZAR', cover: 'desert' },
  { code: 'MV', name: 'האיים המלדיביים', latin: 'Maldives', currency: 'MVR', cover: 'tropic' },
  { code: 'IN', name: 'הודו', latin: 'India', currency: 'INR', cover: 'mountain' },
  { code: 'NL', name: 'הולנד', latin: 'Netherlands', currency: 'EUR', cover: 'city' },
  { code: 'HU', name: 'הונגריה', latin: 'Hungary', currency: 'HUF', cover: 'city' },
  { code: 'PH', name: 'הפיליפינים', latin: 'Philippines', currency: 'PHP', cover: 'tropic' },
  { code: 'DO', name: 'הרפובליקה הדומיניקנית', latin: 'Dominican Republic', currency: 'DOP', cover: 'tropic' },
  { code: 'VN', name: 'וייטנאם', latin: 'Vietnam', currency: 'VND', cover: 'tropic' },
  { code: 'TR', name: 'טורקיה', latin: 'Türkiye', currency: 'TRY', cover: 'city' },
  { code: 'TZ', name: 'טנזניה', latin: 'Tanzania', currency: 'TZS', cover: 'tropic' },
  { code: 'GR', name: 'יוון', latin: 'Greece', currency: 'EUR', cover: 'greece' },
  { code: 'JP', name: 'יפן', latin: 'Japan', currency: 'JPY', cover: 'city' },
  { code: 'JO', name: 'ירדן', latin: 'Jordan', currency: 'JOD', cover: 'desert' },
  { code: 'IL', name: 'ישראל', latin: 'Israel', currency: 'ILS', cover: 'desert' },
  { code: 'LV', name: 'לטביה', latin: 'Latvia', currency: 'EUR', cover: 'city' },
  { code: 'LT', name: 'ליטא', latin: 'Lithuania', currency: 'EUR', cover: 'city' },
  { code: 'MU', name: 'מאוריציוס', latin: 'Mauritius', currency: 'MUR', cover: 'tropic' },
  { code: 'ME', name: 'מונטנגרו', latin: 'Montenegro', currency: 'EUR', cover: 'coast' },
  { code: 'MY', name: 'מלזיה', latin: 'Malaysia', currency: 'MYR', cover: 'tropic' },
  { code: 'MT', name: 'מלטה', latin: 'Malta', currency: 'EUR', cover: 'coast' },
  { code: 'EG', name: 'מצרים', latin: 'Egypt', currency: 'EGP', cover: 'desert' },
  { code: 'MK', name: 'מקדוניה הצפונית', latin: 'North Macedonia', currency: 'MKD', cover: 'mountain' },
  { code: 'MX', name: 'מקסיקו', latin: 'Mexico', currency: 'MXN', cover: 'tropic' },
  { code: 'MA', name: 'מרוקו', latin: 'Morocco', currency: 'MAD', cover: 'desert' },
  { code: 'NO', name: 'נורווגיה', latin: 'Norway', currency: 'NOK', cover: 'mountain' },
  { code: 'NZ', name: 'ניו זילנד', latin: 'New Zealand', currency: 'NZD', cover: 'mountain' },
  { code: 'NP', name: 'נפאל', latin: 'Nepal', currency: 'NPR', cover: 'mountain' },
  { code: 'CN', name: 'סין', latin: 'China', currency: 'CNY', cover: 'city' },
  { code: 'SG', name: 'סינגפור', latin: 'Singapore', currency: 'SGD', cover: 'city' },
  { code: 'SI', name: 'סלובניה', latin: 'Slovenia', currency: 'EUR', cover: 'mountain' },
  { code: 'SK', name: 'סלובקיה', latin: 'Slovakia', currency: 'EUR', cover: 'mountain' },
  { code: 'ES', name: 'ספרד', latin: 'Spain', currency: 'EUR', cover: 'coast' },
  { code: 'RS', name: 'סרביה', latin: 'Serbia', currency: 'RSD', cover: 'city' },
  { code: 'LK', name: 'סרי לנקה', latin: 'Sri Lanka', currency: 'LKR', cover: 'tropic' },
  { code: 'PL', name: 'פולין', latin: 'Poland', currency: 'PLN', cover: 'city' },
  { code: 'PT', name: 'פורטוגל', latin: 'Portugal', currency: 'EUR', cover: 'coast' },
  { code: 'FI', name: 'פינלנד', latin: 'Finland', currency: 'EUR', cover: 'mountain' },
  { code: 'PA', name: 'פנמה', latin: 'Panama', currency: 'PAB', cover: 'tropic' },
  { code: 'PE', name: 'פרו', latin: 'Peru', currency: 'PEN', cover: 'mountain' },
  { code: 'CL', name: 'צ׳ילה', latin: 'Chile', currency: 'CLP', cover: 'mountain' },
  { code: 'CZ', name: 'צ׳כיה', latin: 'Czechia', currency: 'CZK', cover: 'city' },
  { code: 'FR', name: 'צרפת', latin: 'France', currency: 'EUR', cover: 'city' },
  { code: 'CU', name: 'קובה', latin: 'Cuba', currency: 'CUP', cover: 'tropic' },
  { code: 'CO', name: 'קולומביה', latin: 'Colombia', currency: 'COP', cover: 'tropic' },
  { code: 'CR', name: 'קוסטה ריקה', latin: 'Costa Rica', currency: 'CRC', cover: 'tropic' },
  { code: 'KR', name: 'קוריאה הדרומית', latin: 'South Korea', currency: 'KRW', cover: 'city' },
  { code: 'KZ', name: 'קזחסטן', latin: 'Kazakhstan', currency: 'KZT', cover: 'mountain' },
  { code: 'CA', name: 'קנדה', latin: 'Canada', currency: 'CAD', cover: 'mountain' },
  { code: 'KE', name: 'קניה', latin: 'Kenya', currency: 'KES', cover: 'desert' },
  { code: 'CY', name: 'קפריסין', latin: 'Cyprus', currency: 'EUR', cover: 'coast' },
  { code: 'HR', name: 'קרואטיה', latin: 'Croatia', currency: 'EUR', cover: 'coast' },
  { code: 'RO', name: 'רומניה', latin: 'Romania', currency: 'RON', cover: 'mountain' },
  { code: 'SE', name: 'שוודיה', latin: 'Sweden', currency: 'SEK', cover: 'mountain' },
  { code: 'CH', name: 'שווייץ', latin: 'Switzerland', currency: 'CHF', cover: 'mountain' },
  { code: 'TH', name: 'תאילנד', latin: 'Thailand', currency: 'THB', cover: 'tropic' },
  { code: 'TN', name: 'תוניסיה', latin: 'Tunisia', currency: 'TND', cover: 'desert' },
];

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function findCountry(code: string | undefined): Country | undefined {
  return code ? BY_CODE.get(code.toUpperCase()) : undefined;
}

/**
 * The app ships offline fallback rates for a fixed set of currencies. A
 * destination outside it still resolves — the trip just keeps its home
 * currency, rather than quietly converting at 1:1.
 */
export function supportedCurrency(country: Country | undefined): CurrencyCode | undefined {
  if (!country) return undefined;
  return (CURRENCIES as readonly string[]).includes(country.currency)
    ? (country.currency as CurrencyCode)
    : undefined;
}

/** Matches on Hebrew name, Latin name or code, so both keyboards work. */
export function searchCountries(query: string): Country[] {
  const q = query.trim().toLowerCase();
  if (!q) return COUNTRIES;
  return COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.latin.toLowerCase().includes(q) ||
      c.code.toLowerCase() === q
  );
}
