import type { Activity } from '@/lib/types';
import { minutesToTime, timeToMinutes } from '@/lib/utils/date';

/**
 * Works out the time an activity should take when it's dropped between two
 * neighbours, so dragging a card actually reschedules it instead of only
 * reordering an invisible index.
 */
export function timeForDrop(
  moved: Activity,
  prev: Activity | undefined,
  next: Activity | undefined
): string | undefined {
  const duration = moved.durationMin ?? 60;
  const prevStart = timeToMinutes(prev?.startTime);
  const prevEnd =
    prevStart !== undefined ? prevStart + (prev?.durationMin ?? 60) : undefined;
  const nextStart = timeToMinutes(next?.startTime);

  const GAP = 15;

  if (prevEnd !== undefined && nextStart !== undefined) {
    // Enough room to sit right after the previous item, gap included.
    if (prevEnd + GAP + duration <= nextStart) return minutesToTime(prevEnd + GAP);
    // Otherwise split the difference so the order still reads correctly; the
    // timeline will flag the squeeze with its own warning.
    return minutesToTime(Math.round((prevEnd + nextStart) / 2));
  }

  if (prevEnd !== undefined) return minutesToTime(Math.min(prevEnd + GAP, 23 * 60 + 45));
  if (nextStart !== undefined) return minutesToTime(Math.max(0, nextStart - duration - GAP));

  // Neither neighbour is scheduled — keep it unscheduled rather than inventing
  // a time the user never asked for.
  return moved.startTime;
}
