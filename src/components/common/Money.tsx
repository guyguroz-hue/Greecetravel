'use client';

import { convert } from '@/lib/services/currency';
import { useSettingsStore } from '@/lib/store/ui-store';
import type { CurrencyCode, Trip } from '@/lib/types';
import { cn } from '@/lib/utils/cn';
import { formatApprox, formatMoney } from '@/lib/utils/format';

/**
 * Shows an amount in the currency it was entered in, with the trip's base
 * currency underneath — "€420 / ≈ ₪1,720".
 */
export function Money({
  amount,
  currency,
  trip,
  className,
  subClassName,
  inline = false,
  hideConversion = false,
}: {
  amount?: number;
  currency?: CurrencyCode;
  trip: Trip;
  className?: string;
  subClassName?: string;
  /** Puts the converted value on the same line instead of below. */
  inline?: boolean;
  hideConversion?: boolean;
}) {
  const showConversions = useSettingsStore((s) => s.showConversions);
  if (amount === undefined || amount === null) return null;

  const cur = currency ?? trip.baseCurrency;
  const primary = formatMoney(amount, cur);
  const needsConversion = cur !== trip.baseCurrency && showConversions && !hideConversion;
  const converted = needsConversion
    ? formatApprox(convert(amount, cur, trip.baseCurrency, trip.rates), trip.baseCurrency)
    : null;

  if (inline) {
    return (
      <span className={cn('ltr-nums', className)}>
        {primary}
        {converted && <span className={cn('text-faint ms-1.5', subClassName)}>{converted}</span>}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex flex-col items-end ltr-nums', className)}>
      <span>{primary}</span>
      {converted && (
        <span className={cn('text-[11.5px] text-faint font-normal', subClassName)}>{converted}</span>
      )}
    </span>
  );
}

/** Value already expressed in the trip's base currency. */
export function BaseMoney({
  amount,
  trip,
  className,
  signed,
}: {
  amount: number;
  trip: Trip;
  className?: string;
  signed?: boolean;
}) {
  return (
    <span className={cn('ltr-nums', className)}>
      {formatMoney(amount, trip.baseCurrency, { signed })}
    </span>
  );
}
