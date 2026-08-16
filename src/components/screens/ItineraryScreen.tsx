'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertTriangle,
  BedDouble,
  CalendarDays,
  Car,
  Clock,
  LayoutGrid,
  Plus,
  Rows3,
  StickyNote,
  Wallet,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useActiveTrip } from '@/lib/store/hooks';
import { useTripStore } from '@/lib/store/trip-store';
import { toast } from '@/lib/store/ui-store';
import {
  buildTimeline,
  computeDayStats,
  groupActivitiesByDay,
  hotelForDay,
  isOverloadedDay,
  sortActivities,
} from '@/lib/selectors/itinerary';
import type { Activity, Day, TripDocument } from '@/lib/types';
import {
  formatDayMonth,
  formatDuration,
  formatWeekdayDate,
  todayISO,
  weekdayShort,
} from '@/lib/utils/date';
import { formatKm, formatMoney } from '@/lib/utils/format';
import { convert } from '@/lib/services/currency';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';
import { Segmented, TextArea } from '@/components/ui/Field';
import { ConfirmDialog, EmptyState } from '@/components/ui/Feedback';
import { Badge } from '@/components/ui/Bits';
import { Sheet } from '@/components/ui/Sheet';
import { ActivityCard, TravelLeg } from '@/components/itinerary/ActivityCard';
import {
  ActivitySheet,
  draftToActivityPatch,
  type ActivityDraft,
} from '@/components/itinerary/ActivitySheet';
import { timeForDrop } from '@/components/itinerary/drop-time';
import { DayDocuments, documentsForDay } from '@/components/itinerary/DayDocuments';

type ViewMode = 'day' | 'board';

export function ItineraryScreen() {
  const active = useActiveTrip();
  const addActivity = useTripStore((s) => s.addActivity);
  const updateActivity = useTripStore((s) => s.updateActivity);
  const deleteActivity = useTripStore((s) => s.deleteActivity);
  const moveActivity = useTripStore((s) => s.moveActivity);
  const reorderActivities = useTripStore((s) => s.reorderActivities);
  const updateDay = useTripStore((s) => s.updateDay);
  const undo = useTripStore((s) => s.undo);

  const [view, setView] = useState<ViewMode>('day');
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Activity | null>(null);
  const [notesFor, setNotesFor] = useState<Day | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dayRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const today = todayISO();
  const byDay = useMemo(
    () => groupActivitiesByDay(active?.activities ?? []),
    [active?.activities]
  );

  const days = useMemo(() => active?.days ?? [], [active]);
  const currentDay = useMemo(() => {
    if (days.length === 0) return null;
    if (selectedDayId) return days.find((d) => d.id === selectedDayId) ?? days[0];
    return days.find((d) => d.date === today) ?? days[0];
  }, [days, selectedDayId, today]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activeDragActivity = useMemo(
    () => active?.activities.find((a) => a.id === draggingId) ?? null,
    [active?.activities, draggingId]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDraggingId(null);
      document.body.classList.remove('dragging-active');
      const { active: dragged, over } = event;
      if (!over || !active) return;

      const moved = active.activities.find((a) => a.id === dragged.id);
      if (!moved) return;

      // Dropping on a day container (its empty area) vs. on another card.
      const overId = String(over.id);
      const overDay = days.find((d) => `day-zone-${d.id}` === overId);
      const overActivity = active.activities.find((a) => a.id === overId);
      const targetDayId = overDay?.id ?? overActivity?.dayId;
      if (!targetDayId) return;

      const targetList = sortActivities(
        (byDay.get(targetDayId) ?? []).filter((a) => a.id !== moved.id)
      );

      let insertIndex = targetList.length;
      if (overActivity) {
        const idx = targetList.findIndex((a) => a.id === overActivity.id);
        if (idx >= 0) {
          // Dropping onto a card places the item before it when moving up the
          // list, after it when moving down within the same day.
          const sameDay = moved.dayId === targetDayId;
          const fromIdx = sortActivities(byDay.get(targetDayId) ?? []).findIndex(
            (a) => a.id === moved.id
          );
          insertIndex = sameDay && fromIdx < idx ? idx + 1 : idx;
          if (insertIndex > targetList.length) insertIndex = targetList.length;
        }
      }

      const prev = targetList[insertIndex - 1];
      const next = targetList[insertIndex];
      const newTime = timeForDrop(moved, prev, next);

      const changedDay = moved.dayId !== targetDayId;
      const changedTime = newTime !== moved.startTime;
      if (!changedDay && !changedTime) return;

      moveActivity(moved.id, targetDayId, newTime ?? '');

      const reordered = [...targetList];
      reordered.splice(insertIndex, 0, { ...moved, dayId: targetDayId, startTime: newTime });
      reorderActivities(
        targetDayId,
        reordered.map((a) => a.id)
      );

      const targetDay = days.find((d) => d.id === targetDayId);
      if (changedDay && targetDay) {
        toast.show(`"${moved.title}" הועבר ליום ${targetDay.index}`, {
          action: { label: 'בטל', onClick: () => undo() },
        });
      }
    },
    [active, byDay, days, moveActivity, reorderActivities, undo]
  );

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingId(String(event.active.id));
    document.body.classList.add('dragging-active');
  };

  const openNew = (dayId: string) => {
    setEditing(null);
    setSelectedDayId(dayId);
    setSheetOpen(true);
  };

  const saveDraft = (draft: ActivityDraft) => {
    if (!active) return;
    const patch = draftToActivityPatch(draft);
    if (editing) {
      updateActivity(editing.id, patch);
      toast.success('הפעילות עודכנה');
    } else {
      addActivity({ ...patch, tripId: active.trip.id });
      toast.success('הפעילות נוספה');
    }
  };

  if (!active) return null;

  return (
    <AppShell
      title="מסלול"
      subtitle={`${days.length} ימים · ${active.activities.length} פעילויות`}
      actions={
        <Button
          size="sm"
          aria-label="הוספת פעילות"
          onClick={() => currentDay && openNew(currentDay.id)}
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">פעילות</span>
        </Button>
      }
    >
      <Segmented
        value={view}
        onChange={setView}
        className="mb-4"
        options={[
          {
            value: 'day',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <Rows3 className="size-3.5" />
                יום אחד
              </span>
            ),
          },
          {
            value: 'board',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <LayoutGrid className="size-3.5" />
                לוח כל הימים
              </span>
            ),
          },
        ]}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setDraggingId(null);
          document.body.classList.remove('dragging-active');
        }}
      >
        {view === 'day' && currentDay ? (
          <>
            <DayStrip
              days={days}
              byDay={byDay}
              currentId={currentDay.id}
              today={today}
              onSelect={setSelectedDayId}
              refs={dayRefs}
            />
            <DayPanel
              day={currentDay}
              activities={byDay.get(currentDay.id) ?? []}
              trip={active.trip}
              hotel={hotelForDay(currentDay, active.hotels)}
              documents={documentsForDay(
                currentDay,
                active.documents,
                hotelForDay(currentDay, active.hotels),
                active.flights,
                active.activities
              )}
              onAdd={() => openNew(currentDay.id)}
              onEdit={(a) => {
                setEditing(a);
                setSheetOpen(true);
              }}
              onNotes={() => setNotesFor(currentDay)}
            />
          </>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 no-scrollbar">
            {days.map((day) => (
              <BoardColumn
                key={day.id}
                day={day}
                activities={byDay.get(day.id) ?? []}
                trip={active.trip}
                today={today}
                onAdd={() => openNew(day.id)}
                onEdit={(a) => {
                  setEditing(a);
                  setSheetOpen(true);
                }}
              />
            ))}
          </div>
        )}

        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2,0,0,1)' }}>
          {activeDragActivity && (
            <div className="w-[min(22rem,85vw)] rotate-1">
              <ActivityCard activity={activeDragActivity} trip={active.trip} isDragging compact />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Keyed so each open starts from the entity's saved values, with no
          state-syncing effect. */}
      <ActivitySheet
        key={`${editing?.id ?? 'new'}:${sheetOpen}:${currentDay?.id ?? ''}`}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        activity={editing}
        days={days}
        trip={active.trip}
        defaultDayId={currentDay?.id ?? days[0]?.id ?? ''}
        onSave={saveDraft}
        onDelete={
          editing
            ? () => {
                setPendingDelete(editing);
                setSheetOpen(false);
              }
            : undefined
        }
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`למחוק את "${pendingDelete?.title}"?`}
        message="הפעילות תוסר מהמסלול ומהמפה."
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const title = pendingDelete?.title ?? '';
          if (pendingDelete) deleteActivity(pendingDelete.id);
          setPendingDelete(null);
          setEditing(null);
          toast.show(`"${title}" נמחקה`, {
            action: {
              label: 'בטל',
              onClick: () => {
                undo();
                toast.success('הפעילות שוחזרה');
              },
            },
          });
        }}
      />

      <DayNotesSheet
        key={notesFor?.id ?? 'none'}
        day={notesFor}
        onClose={() => setNotesFor(null)}
        onSave={(patch) => {
          if (notesFor) updateDay(notesFor.id, patch);
          setNotesFor(null);
          toast.success('היום עודכן');
        }}
      />
    </AppShell>
  );
}

/* ------------------------------------------------------------------ *
 * Day strip
 * ------------------------------------------------------------------ */

function DayStrip({
  days,
  byDay,
  currentId,
  today,
  onSelect,
  refs,
}: {
  days: Day[];
  byDay: Map<string, Activity[]>;
  currentId: string;
  today: string;
  onSelect: (id: string) => void;
  refs: React.RefObject<Record<string, HTMLButtonElement | null>>;
}) {
  return (
    <div className="-mx-4 px-4 sm:-mx-6 sm:px-6 mb-4">
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {days.map((day) => {
          const active = day.id === currentId;
          const isToday = day.date === today;
          const count = byDay.get(day.id)?.length ?? 0;
          return (
            <button
              key={day.id}
              ref={(el) => {
                refs.current[day.id] = el;
              }}
              type="button"
              onClick={() => onSelect(day.id)}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'shrink-0 w-[4.25rem] rounded-2xl border px-2 py-2 text-center transition',
                active
                  ? 'bg-brand text-brand-contrast border-transparent shadow-card'
                  : 'bg-surface border-line hover:bg-subtle'
              )}
            >
              <div
                className={cn(
                  'text-[10.5px] font-medium',
                  active ? 'opacity-80' : isToday ? 'text-brand' : 'text-faint'
                )}
              >
                {isToday ? 'היום' : weekdayShort(day.date)}
              </div>
              <div className="text-[15px] font-semibold ltr-nums leading-tight mt-0.5">
                {formatDayMonth(day.date)}
              </div>
              <div className={cn('text-[10px] mt-0.5', active ? 'opacity-80' : 'text-faint')}>
                יום {day.index} · {count}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Single-day panel
 * ------------------------------------------------------------------ */

function DayPanel({
  day,
  activities,
  trip,
  hotel,
  documents,
  onAdd,
  onEdit,
  onNotes,
}: {
  day: Day;
  activities: Activity[];
  trip: Parameters<typeof ActivityCard>[0]['trip'];
  hotel?: { id: string; name: string; city: string };
  documents: TripDocument[];
  onAdd: () => void;
  onEdit: (a: Activity) => void;
  onNotes: () => void;
}) {
  const timeline = useMemo(() => buildTimeline(activities), [activities]);
  const stats = useMemo(() => computeDayStats(activities), [activities]);
  const overloaded = isOverloadedDay(stats);

  // What the day's activities add up to, in the trip's own currency.
  const dayCost = useMemo(
    () =>
      activities.reduce(
        (sum, a) =>
          sum +
          (a.price
            ? convert(a.price, a.currency ?? trip.baseCurrency, trip.baseCurrency, trip.rates)
            : 0),
        0
      ),
    [activities, trip]
  );
  const { setNodeRef, isOver } = useDroppable({ id: `day-zone-${day.id}` });

  return (
    <div>
      <div className="bg-surface border border-line rounded-2xl p-4 mb-3 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-[16px]">
                יום {day.index} — {day.title}
              </h2>
              {overloaded && (
                <Badge tone="warning">
                  <AlertTriangle className="size-3" />
                  יום עמוס
                </Badge>
              )}
            </div>
            <p className="text-[12.5px] text-muted mt-0.5">{formatWeekdayDate(day.date)}</p>
          </div>
          <button
            type="button"
            onClick={onNotes}
            aria-label="הערות ליום"
            className="size-9 shrink-0 grid place-items-center rounded-xl text-muted hover:bg-subtle hover:text-ink transition"
          >
            <StickyNote className="size-[18px]" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-[12.5px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5" />
            {stats.activityCount} פעילויות
          </span>
          {stats.drivingMin > 0 && (
            <span className="inline-flex items-center gap-1.5 ltr-nums">
              <Car className="size-3.5" />
              {formatDuration(stats.drivingMin)} · {formatKm(stats.drivingKm)}
            </span>
          )}
          {stats.spanMin > 0 && (
            <span className="inline-flex items-center gap-1.5 ltr-nums">
              <Clock className="size-3.5" />
              {formatDuration(stats.spanMin)}
            </span>
          )}
          {dayCost > 0 && (
            <span className="inline-flex items-center gap-1.5 ltr-nums">
              <Wallet className="size-3.5" />
              {formatMoney(dayCost, trip.baseCurrency)}
              {day.plannedBudget
                ? ` / ${formatMoney(day.plannedBudget, trip.baseCurrency)}`
                : ''}
            </span>
          )}
          {hotel && (
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <BedDouble className="size-3.5 shrink-0" />
              <span className="truncate">{hotel.name}</span>
            </span>
          )}
        </div>

        {day.notes && (
          <p className="mt-3 text-[13px] text-muted bg-inset rounded-xl px-3 py-2 leading-relaxed">
            {day.notes}
          </p>
        )}

        <DayDocuments documents={documents} />
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'rounded-2xl transition min-h-24',
          isOver && 'ring-2 ring-brand ring-offset-4 ring-offset-[var(--bg)]'
        )}
      >
        {activities.length === 0 ? (
          <EmptyState
            icon="📅"
            title="היום עדיין ריק"
            description="אפשר להוסיף פעילות, או לגרור לכאן מקום מרשימת המקומות."
            action={
              <Button onClick={onAdd}>
                <Plus className="size-4" />
                הוספת פעילות
              </Button>
            }
          />
        ) : (
          <SortableContext
            items={activities.map((a) => a.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1.5">
              {timeline.map((entry) => (
                <div key={entry.activity.id}>
                  {entry.legFromPrev && <TravelLeg leg={entry.legFromPrev} />}
                  <SortableActivity
                    activity={entry.activity}
                    trip={trip}
                    onEdit={() => onEdit(entry.activity)}
                  />
                </div>
              ))}
            </div>
          </SortableContext>
        )}
      </div>

      {activities.length > 0 && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-3 w-full h-12 rounded-2xl border border-dashed border-line text-[14px] text-muted hover:text-brand hover:border-brand transition inline-flex items-center justify-center gap-1.5"
        >
          <Plus className="size-4" />
          הוספת פעילות ליום {day.index}
        </button>
      )}
    </div>
  );
}

function SortableActivity({
  activity,
  trip,
  onEdit,
  compact,
}: {
  activity: Activity;
  trip: Parameters<typeof ActivityCard>[0]['trip'];
  onEdit: () => void;
  compact?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: activity.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && 'opacity-40')}
    >
      <ActivityCard
        activity={activity}
        trip={trip}
        onClick={onEdit}
        compact={compact}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Board column
 * ------------------------------------------------------------------ */

function BoardColumn({
  day,
  activities,
  trip,
  today,
  onAdd,
  onEdit,
}: {
  day: Day;
  activities: Activity[];
  trip: Parameters<typeof ActivityCard>[0]['trip'];
  today: string;
  onAdd: () => void;
  onEdit: (a: Activity) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-zone-${day.id}` });
  const stats = computeDayStats(activities);
  const isToday = day.date === today;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'shrink-0 w-[17.5rem] rounded-2xl border bg-subtle/40 p-2.5 transition',
        isOver ? 'border-brand bg-brand-soft/40' : 'border-line'
      )}
    >
      <div className="px-1.5 pb-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-[13.5px] truncate">
            יום {day.index} — {day.title}
          </h3>
          {isToday && <Badge tone="brand">היום</Badge>}
        </div>
        <p className="text-[11.5px] text-muted mt-0.5 ltr-nums">
          {formatDayMonth(day.date)} · {stats.activityCount} פעילויות
          {stats.drivingMin > 0 && ` · ${formatDuration(stats.drivingMin)} נסיעה`}
        </p>
      </div>

      <SortableContext items={activities.map((a) => a.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1.5 min-h-16">
          {activities.map((a) => (
            <SortableActivity
              key={a.id}
              activity={a}
              trip={trip}
              onEdit={() => onEdit(a)}
              compact
            />
          ))}
          {activities.length === 0 && (
            <p className="text-[12px] text-faint text-center py-6">גררי לכאן פעילות</p>
          )}
        </div>
      </SortableContext>

      <button
        type="button"
        onClick={onAdd}
        className="mt-2 w-full h-9 rounded-xl border border-dashed border-line text-[12.5px] text-muted hover:text-brand hover:border-brand transition inline-flex items-center justify-center gap-1"
      >
        <Plus className="size-3.5" />
        הוספה
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Day notes
 * ------------------------------------------------------------------ */

function DayNotesSheet({
  day,
  onClose,
  onSave,
}: {
  day: Day | null;
  onClose: () => void;
  onSave: (patch: Partial<Day>) => void;
}) {
  // Keyed on the day by the parent, so these initialisers re-run per day.
  const [title, setTitle] = useState(day?.title ?? '');
  const [notes, setNotes] = useState(day?.notes ?? '');
  const [baseLocation, setBaseLocation] = useState(day?.baseLocation ?? '');

  return (
    <Sheet
      open={day !== null}
      onClose={onClose}
      title={day ? `יום ${day.index} — פרטים` : ''}
      size="sm"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={onClose}>
            ביטול
          </Button>
          <Button
            fullWidth
            onClick={() =>
              onSave({
                title: title.trim() || `יום ${day?.index}`,
                notes: notes.trim() || undefined,
                baseLocation: baseLocation.trim() || undefined,
              })
            }
          >
            שמירה
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pb-4">
        <TextArea
          label="כותרת היום"
          rows={1}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="למשל: זגוריה — ערוץ ויקוס"
        />
        <TextArea
          label="יעד מרכזי"
          rows={1}
          value={baseLocation}
          onChange={(e) => setBaseLocation(e.target.value)}
          placeholder="למשל: זגוריה"
        />
        <TextArea
          label="הערות"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="מה חשוב לזכור ליום הזה?"
        />
      </div>
    </Sheet>
  );
}
