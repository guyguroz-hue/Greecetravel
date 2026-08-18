'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { initials } from '@/lib/utils/format';

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'accent';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-subtle text-muted',
    brand: 'bg-brand-soft text-brand',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
    accent: 'bg-accent-soft text-accent',
  }[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11.5px] font-medium whitespace-nowrap',
        tones,
        className
      )}
    >
      {children}
    </span>
  );
}

export function Avatar({
  name,
  color,
  size = 'md',
  className,
}: {
  name: string;
  color?: string;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}) {
  const sizes = {
    xs: 'size-5 text-[9px]',
    sm: 'size-7 text-[11px]',
    md: 'size-9 text-[13px]',
  }[size];
  return (
    <span
      title={name}
      className={cn(
        'inline-grid place-items-center rounded-full font-semibold text-white shrink-0 ring-2 ring-surface',
        sizes,
        className
      )}
      style={{ background: color ?? 'var(--brand)' }}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarGroup({
  people,
  max = 4,
  size = 'sm',
}: {
  people: { name: string; color?: string }[];
  max?: number;
  size?: 'xs' | 'sm' | 'md';
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className="flex items-center -space-x-2 [direction:ltr]">
      {shown.map((p, i) => (
        <Avatar key={`${p.name}-${i}`} name={p.name} color={p.color} size={size} />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            'inline-grid place-items-center rounded-full bg-subtle text-muted font-semibold ring-2 ring-surface',
            size === 'md' ? 'size-9 text-[13px]' : size === 'sm' ? 'size-7 text-[11px]' : 'size-5 text-[9px]'
          )}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}

export function ProgressBar({
  value,
  max = 1,
  tone = 'brand',
  className,
  segments,
}: {
  value: number;
  max?: number;
  tone?: 'brand' | 'success' | 'warning' | 'danger';
  className?: string;
  /** Optional stacked segments, e.g. paid vs. planned. */
  segments?: { value: number; color: string }[];
}) {
  const colors = {
    brand: 'var(--brand)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    danger: 'var(--danger)',
  };
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  return (
    <div
      className={cn('h-1.5 w-full rounded-full bg-subtle overflow-hidden flex [direction:ltr]', className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {segments ? (
        segments.map((s, i) => (
          <div
            key={i}
            className="h-full transition-all duration-500"
            style={{
              width: `${max > 0 ? Math.min(100, (s.value / max) * 100) : 0}%`,
              background: s.color,
            }}
          />
        ))
      ) : (
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: colors[tone] }}
        />
      )}
    </div>
  );
}

/** The blocky day-progress meter on the dashboard. */
export function BlockProgress({
  current,
  total,
  blocks = 10,
}: {
  current: number;
  total: number;
  blocks?: number;
}) {
  const filled = total > 0 ? Math.round((current / total) * blocks) : 0;
  return (
    <div className="flex gap-1 [direction:ltr]" aria-hidden>
      {Array.from({ length: blocks }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'h-2 flex-1 rounded-full transition-colors',
            i < filled ? 'bg-brand' : 'bg-subtle'
          )}
        />
      ))}
    </div>
  );
}

export function CategoryChip({
  emoji,
  label,
  color,
  className,
}: {
  emoji: string;
  label?: string;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-lg text-[11.5px] font-medium px-1.5 py-0.5',
        className
      )}
      style={
        color
          ? { background: `color-mix(in oklab, ${color} 14%, transparent)`, color }
          : undefined
      }
    >
      <span aria-hidden>{emoji}</span>
      {label}
    </span>
  );
}

/** Round icon tile used across list rows. */
export function IconTile({
  children,
  color,
  className,
}: {
  children: ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={cn('size-10 shrink-0 grid place-items-center rounded-xl text-lg', className)}
      style={
        color
          ? { background: `color-mix(in oklab, ${color} 14%, transparent)`, color }
          : { background: 'var(--bg-subtle)' }
      }
    >
      {children}
    </span>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px bg-line', className)} />;
}

/** Small labelled row used inside detail sheets. */
export function DetailRow({
  label,
  value,
  ltr,
}: {
  label: string;
  value: ReactNode;
  ltr?: boolean;
}) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-line last:border-0">
      <span className="text-[13px] text-muted shrink-0">{label}</span>
      <span className={cn('text-[14px] font-medium text-end min-w-0', ltr && 'ltr-nums')}>
        {value}
      </span>
    </div>
  );
}
