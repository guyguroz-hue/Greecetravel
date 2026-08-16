'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/** Compact two-state chip used for booked / paid flags on list rows. */
export function StatusChip({
  active,
  activeLabel,
  inactiveLabel,
  tone = 'success',
  onClick,
  className,
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
  tone?: 'success' | 'brand';
  onClick?: () => void;
  className?: string;
}) {
  const activeTone =
    tone === 'success' ? 'bg-success-soft text-success' : 'bg-brand-soft text-brand';
  const content = (
    <>
      {active && <Check className="size-3" />}
      {active ? activeLabel : inactiveLabel}
    </>
  );
  const classes = cn(
    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11.5px] font-medium whitespace-nowrap transition',
    active ? activeTone : 'bg-warning-soft text-warning',
    onClick && 'hover:brightness-95 cursor-pointer',
    className
  );

  if (!onClick) return <span className={classes}>{content}</span>;
  return (
    <button type="button" onClick={onClick} className={classes} aria-pressed={active}>
      {content}
    </button>
  );
}
