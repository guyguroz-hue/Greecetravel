import type { CurrencyCode, RateTable } from '@/lib/types';

/**
 * Fallback rates, expressed as "1 unit of X = N ILS". They ship with the app
 * so budgets always add up offline; Settings can refresh them from a live API
 * or override any single pair by hand.
 */
export const FALLBACK_ILS_RATES: Record<CurrencyCode, number> = {
  ILS: 1,
  EUR: 4.1,
  USD: 3.72,
  GBP: 4.78,
  CHF: 4.35,
  JPY: 0.025,
  THB: 0.106,
  TRY: 0.092,
};

/** Derives a rate table in any base currency from the ILS reference table. */
export function defaultRates(base: CurrencyCode, currencies: CurrencyCode[]): RateTable {
  const baseInIls = FALLBACK_ILS_RATES[base] ?? 1;
  const table: RateTable = {};
  for (const c of currencies) {
    table[c] = c === base ? 1 : round4((FALLBACK_ILS_RATES[c] ?? 1) / baseInIls);
  }
  table[base] = 1;
  return table;
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}

/** Converts using the trip's rate table; unknown pairs pass through 1:1. */
export function convert(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: RateTable
): number {
  if (from === to) return amount;
  const fromRate = rates[from];
  const toRate = rates[to];
  if (!fromRate || !toRate) return amount;
  return (amount * fromRate) / toRate;
}

export interface RatesResult {
  rates: RateTable;
  source: 'api' | 'manual';
  fetchedAt: string;
}

export interface RatesProvider {
  readonly id: string;
  fetchRates(base: CurrencyCode, symbols: CurrencyCode[]): Promise<RatesResult>;
}

/**
 * frankfurter.dev — ECB reference rates, no key required. Returns rates as
 * "1 base = N foreign", which we invert into our "1 foreign = N base" table.
 */
export const frankfurterProvider: RatesProvider = {
  id: 'frankfurter',
  async fetchRates(base, symbols) {
    const wanted = symbols.filter((s) => s !== base);
    if (wanted.length === 0) {
      return { rates: { [base]: 1 }, source: 'api', fetchedAt: new Date().toISOString() };
    }
    const url = `https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${wanted.join(',')}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`rates ${res.status}`);
    const json = (await res.json()) as { rates?: Record<string, number> };
    if (!json.rates) throw new Error('rates: malformed response');
    const table: RateTable = { [base]: 1 };
    for (const c of wanted) {
      const perBase = json.rates[c];
      if (perBase) table[c] = round4(1 / perBase);
    }
    return { rates: table, source: 'api', fetchedAt: new Date().toISOString() };
  },
};

let provider: RatesProvider = frankfurterProvider;

export function setRatesProvider(next: RatesProvider) {
  provider = next;
}

/**
 * Refreshes rates, keeping any currency the API doesn't cover at its existing
 * (possibly hand-entered) value.
 */
export async function refreshRates(
  base: CurrencyCode,
  symbols: CurrencyCode[],
  existing: RateTable
): Promise<RatesResult> {
  const result = await provider.fetchRates(base, symbols);
  return { ...result, rates: { ...existing, ...result.rates, [base]: 1 } };
}
