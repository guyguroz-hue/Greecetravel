import { CURRENCY_META, type CurrencyCode } from '@/lib/types';

/** `₪1,720` — no decimals, which is what trip budgets actually want. */
export function formatMoney(
  amount: number,
  currency: CurrencyCode,
  opts: { decimals?: number; signed?: boolean } = {}
): string {
  const { decimals = 0, signed = false } = opts;
  const symbol = CURRENCY_META[currency]?.symbol ?? currency;
  const abs = Math.abs(amount);
  const body = abs.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const sign = amount < 0 ? '-' : signed && amount > 0 ? '+' : '';
  // Multi-character codes (CHF) read better after the number.
  return symbol.length > 1 ? `${sign}${body} ${symbol}` : `${sign}${symbol}${body}`;
}

/** `≈ ₪1,720` for the converted secondary line. */
export function formatApprox(amount: number, currency: CurrencyCode): string {
  return `≈ ${formatMoney(amount, currency)}`;
}

export function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** `42 ק״מ` / `1,240 ק״מ` */
export function formatKm(km: number): string {
  return `${formatNumber(km, km < 10 ? 1 : 0)} ק״מ`;
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Turns a country code into its flag emoji, for the trip cards. */
export function countryFlag(code?: string): string {
  if (!code || code.length !== 2) return '🌍';
  const base = 0x1f1e6;
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split('')
      .map((c) => base + c.charCodeAt(0) - 65)
  );
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return parts[0][0] + parts[1][0];
}

/** Cheap deterministic colour so travellers keep the same avatar tint. */
export const AVATAR_COLORS = [
  '#1d67f0',
  '#11916b',
  '#db8629',
  '#a1263f',
  '#7c5cf0',
  '#0aa2c0',
  '#d63f8c',
  '#64748b',
];

export function colorForIndex(i: number): string {
  return AVATAR_COLORS[i % AVATAR_COLORS.length];
}

export function pluralDays(n: number): string {
  if (n === 1) return 'יום אחד';
  if (n === 2) return 'יומיים';
  return `${n} ימים`;
}

export function pluralNights(n: number): string {
  if (n === 1) return 'לילה אחד';
  if (n === 2) return 'שני לילות';
  return `${n} לילות`;
}

export function pluralTravelers(n: number): string {
  if (n === 1) return 'מטייל אחד';
  return `${n} מטיילים`;
}

/** Builds a Google Maps link that works on both mobile apps and the web. */
export function googleMapsLink(opts: {
  lat?: number;
  lng?: number;
  query?: string;
}): string {
  const { lat, lng, query } = opts;
  if (typeof lat === 'number' && typeof lng === 'number') {
    const q = query ? `${encodeURIComponent(query)}` : `${lat},${lng}`;
    return `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=&center=${lat},${lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query ?? '')}`;
}

/** Turn-by-turn navigation link, used by the Today screen's Navigate button. */
export function navigationLink(opts: { lat?: number; lng?: number; address?: string }): string {
  const { lat, lng, address } = opts;
  const dest =
    typeof lat === 'number' && typeof lng === 'number'
      ? `${lat},${lng}`
      : encodeURIComponent(address ?? '');
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
}

export function safeExternalUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return undefined; // block javascript:, data:, …
  return `https://${trimmed}`;
}
