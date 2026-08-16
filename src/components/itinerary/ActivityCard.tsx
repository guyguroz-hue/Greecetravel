'use client';

import { AlertTriangle, Car, ExternalLink, GripVertical, Navigation, Ticket } from 'lucide-react';
import { CATEGORY_META, type Activity, type Trip } from '@/lib/types';
import { formatDuration, minutesToTime, timeToMinutes } from '@/lib/utils/date';
import { formatKm, navigationLink, safeExternalUrl } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { Money } from '@/components/common/Money';
import type { TimelineLeg } from '@/lib/selectors/itinerary';

/** The "↓ 🚗 42 min" connector drawn between two activities. */
export function TravelLeg({ leg }: { leg: TimelineLeg }) {
  return (
    <div className="flex items-center gap-2 ps-[3.25rem] pe-1 py-1">
      <div
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium',
          leg.tooTight ? 'bg-danger-soft text-danger' : 'bg-subtle text-muted'
        )}
      >
        <Car className="size-3.5 shrink-0" />
        <span className="ltr-nums">{formatDuration(leg.durationMin)}</span>
        <span className="text-faint">·</span>
        <span className="ltr-nums">{formatKm(leg.distanceKm)}</span>
      </div>
      {leg.tooTight && (
        <span className="inline-flex items-center gap-1 text-[11.5px] text-danger min-w-0">
          <AlertTriangle className="size-3.5 shrink-0" />
          <span className="truncate">
            חסרות {formatDuration(leg.shortfallMin)} — הפעילות הבאה מתחילה מוקדם מדי
          </span>
        </span>
      )}
    </div>
  );
}

export function ActivityCard({
  activity,
  trip,
  onClick,
  dragHandleProps,
  isDragging,
  compact = false,
  showNavigate = false,
}: {
  activity: Activity;
  trip: Trip;
  onClick?: () => void;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
  compact?: boolean;
  showNavigate?: boolean;
}) {
  const meta = CATEGORY_META[activity.category];
  const startMin = timeToMinutes(activity.startTime);
  const endTime =
    startMin !== undefined && activity.durationMin
      ? minutesToTime(startMin + activity.durationMin)
      : undefined;
  const url = safeExternalUrl(activity.url);

  return (
    <div
      className={cn(
        'group relative flex gap-2.5 rounded-2xl border bg-surface transition',
        isDragging ? 'border-brand shadow-float opacity-90' : 'border-line shadow-card',
        compact ? 'p-2.5' : 'p-3'
      )}
    >
      {/* time gutter */}
      <div className="w-11 shrink-0 pt-0.5 text-center">
        {activity.startTime ? (
          <>
            <div className="text-[13.5px] font-semibold ltr-nums leading-tight">
              {activity.startTime}
            </div>
            {endTime && <div className="text-[10.5px] text-faint ltr-nums">{endTime}</div>}
          </>
        ) : (
          <div className="text-[10.5px] text-faint leading-tight pt-0.5">ללא שעה</div>
        )}
      </div>

      {/* category rail */}
      <div
        className="w-1 shrink-0 rounded-full self-stretch"
        style={{ background: meta.color }}
        aria-hidden
      />

      <button
        type="button"
        onClick={onClick}
        className="flex-1 min-w-0 text-start"
        aria-label={`עריכת ${activity.title}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3
              className={cn(
                'font-medium leading-snug',
                compact ? 'text-[14px]' : 'text-[14.5px]',
                activity.done && 'line-through text-faint'
              )}
            >
              <span className="me-1" aria-hidden>
                {meta.emoji}
              </span>
              {activity.title}
            </h3>
            {activity.address && (
              <p className="text-[12px] text-muted truncate mt-0.5">{activity.address}</p>
            )}
          </div>
          {activity.price !== undefined && (
            <Money
              amount={activity.price}
              currency={activity.currency}
              trip={trip}
              className="text-[13px] font-semibold shrink-0"
            />
          )}
        </div>

        {(activity.notes || activity.bookingRef || activity.durationMin) && !compact && (
          <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1 mt-1.5">
            {activity.durationMin ? (
              <span className="text-[11.5px] text-faint ltr-nums">
                {formatDuration(activity.durationMin)}
              </span>
            ) : null}
            {activity.bookingRef && (
              <span className="inline-flex items-center gap-1 text-[11.5px] text-success">
                <Ticket className="size-3" />
                <span className="ltr-nums">{activity.bookingRef}</span>
              </span>
            )}
            {activity.notes && (
              <span className="text-[11.5px] text-muted truncate max-w-full">{activity.notes}</span>
            )}
          </div>
        )}
      </button>

      <div className="flex flex-col items-center gap-1 shrink-0">
        {dragHandleProps && (
          <span
            {...dragHandleProps}
            role="button"
            tabIndex={0}
            aria-label={`גרירת ${activity.title}`}
            className="size-7 grid place-items-center rounded-lg text-faint hover:text-ink hover:bg-subtle cursor-grab active:cursor-grabbing touch-none transition"
          >
            <GripVertical className="size-4" />
          </span>
        )}
        {showNavigate && activity.location && (
          <a
            href={navigationLink({ ...activity.location, address: activity.address })}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`ניווט אל ${activity.title}`}
            className="size-7 grid place-items-center rounded-lg text-brand hover:bg-brand-soft transition"
          >
            <Navigation className="size-4" />
          </a>
        )}
        {url && !showNavigate && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`פתיחת קישור עבור ${activity.title}`}
            className="size-7 grid place-items-center rounded-lg text-faint hover:text-brand hover:bg-brand-soft transition"
          >
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}
