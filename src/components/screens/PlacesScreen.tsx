'use client';

import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { CalendarPlus, ExternalLink, GripVertical, Heart, MapPin, Plus, Star, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useActiveTrip } from '@/lib/store/hooks';
import { useTripStore } from '@/lib/store/trip-store';
import { toast } from '@/lib/store/ui-store';
import {
  ACTIVITY_CATEGORIES,
  CATEGORY_META,
  CURRENCY_META,
  PLACE_LISTS,
  PLACE_LIST_META,
  type ActivityCategory,
  type CurrencyCode,
  type Place,
  type PlaceList,
  type Trip,
} from '@/lib/types';
import { formatDayMonth } from '@/lib/utils/date';
import { googleMapsLink, safeExternalUrl } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextArea, TextInput } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { ConfirmDialog, EmptyState } from '@/components/ui/Feedback';
import { Badge } from '@/components/ui/Bits';
import { Money } from '@/components/common/Money';

export function PlacesScreen() {
  const active = useActiveTrip();
  const addPlace = useTripStore((s) => s.addPlace);
  const updatePlace = useTripStore((s) => s.updatePlace);
  const deletePlace = useTripStore((s) => s.deletePlace);
  const placeToActivity = useTripStore((s) => s.placeToActivity);
  const undo = useTripStore((s) => s.undo);

  const [listFilter, setListFilter] = useState<PlaceList | 'all'>('all');
  const [editing, setEditing] = useState<Place | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Place | null>(null);
  const [scheduling, setScheduling] = useState<Place | null>(null);
  const [dragging, setDragging] = useState<Place | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const grouped = useMemo(() => {
    if (!active) return [];
    return PLACE_LISTS.map((list) => ({
      list,
      meta: PLACE_LIST_META[list],
      items: active.places.filter((p) => p.list === list),
    })).filter((g) => (listFilter === 'all' ? g.items.length > 0 : g.list === listFilter));
  }, [active, listFilter]);

  const handleDragEnd = (event: DragEndEvent) => {
    setDragging(null);
    const { active: dragged, over } = event;
    if (!over || !active) return;
    const placeId = String(dragged.id).replace('place:', '');
    const dayId = String(over.id).replace('day-drop:', '');
    const day = active.days.find((d) => d.id === dayId);
    const place = active.places.find((p) => p.id === placeId);
    if (!day || !place) return;
    placeToActivity(place.id, day.id);
    toast.success(`"${place.name}" נוסף ליום ${day.index}`, {
      action: { label: 'בטל', onClick: () => undo() },
    });
  };

  if (!active) return null;
  const { trip, places, days } = active;
  const unscheduled = places.filter((p) => !p.dayId).length;

  return (
    <AppShell
      title="מקומות"
      subtitle={`${places.length} מקומות · ${unscheduled} עדיין לא במסלול`}
      backHref="/more"
      actions={
        <Button
          size="sm"
          aria-label="הוספת מקום"
          onClick={() => {
            setEditing(null);
            setSheetOpen(true);
          }}
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">מקום</span>
        </Button>
      }
    >
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 mb-4">
        <FilterChip
          active={listFilter === 'all'}
          onClick={() => setListFilter('all')}
          label={`הכל (${places.length})`}
        />
        {PLACE_LISTS.map((list) => {
          const count = places.filter((p) => p.list === list).length;
          if (count === 0) return null;
          const meta = PLACE_LIST_META[list];
          return (
            <FilterChip
              key={list}
              active={listFilter === list}
              onClick={() => setListFilter(list)}
              label={`${meta.emoji} ${meta.label} (${count})`}
            />
          );
        })}
      </div>

      {places.length === 0 ? (
        <EmptyState
          icon={<Heart className="size-6" />}
          title="רשימת המקומות ריקה"
          description="כאן שומרים מקומות שרוצים לבקר בהם — ואז גוררים אותם ליום במסלול."
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setSheetOpen(true);
              }}
            >
              <Plus className="size-4" />
              הוספת מקום
            </Button>
          }
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e) =>
            setDragging(places.find((p) => `place:${p.id}` === String(e.active.id)) ?? null)
          }
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDragging(null)}
        >
          <div className="lg:grid lg:grid-cols-[1fr_15rem] lg:gap-5 lg:items-start">
            <div className="space-y-5">
              {grouped.map((group) => (
                <section key={group.list}>
                  <h2 className="text-[13px] font-semibold text-muted mb-2.5 px-0.5">
                    {group.meta.emoji} {group.meta.label}
                    <span className="text-faint font-normal"> · {group.items.length}</span>
                  </h2>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {group.items.map((place) => (
                      <PlaceCard
                        key={place.id}
                        place={place}
                        trip={trip}
                        dayLabel={
                          place.dayId
                            ? days.find((d) => d.id === place.dayId)?.index
                            : undefined
                        }
                        onEdit={() => {
                          setEditing(place);
                          setSheetOpen(true);
                        }}
                        onSchedule={() => setScheduling(place)}
                        onDelete={() => setPendingDelete(place)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {/* drop targets — a compact day rail on desktop */}
            <aside className="hidden lg:block sticky top-20">
              <p className="text-[12.5px] font-semibold text-muted mb-2">גררי מקום ליום</p>
              <div className="space-y-1.5 max-h-[70vh] overflow-y-auto pe-1">
                {days.map((day) => (
                  <DayDropZone key={day.id} dayId={day.id} index={day.index} title={day.title} date={day.date} />
                ))}
              </div>
            </aside>
          </div>

          <DragOverlay>
            {dragging && (
              <div className="w-64 rotate-2 rounded-2xl border border-brand bg-surface shadow-float p-3">
                <p className="font-medium text-[14px] truncate">
                  {CATEGORY_META[dragging.category].emoji} {dragging.name}
                </p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      <PlaceSheet
        key={`${editing?.id ?? 'new'}:${sheetOpen}`}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        place={editing}
        trip={trip}
        onSave={(payload) => {
          if (editing) {
            updatePlace(editing.id, payload);
            toast.success('המקום עודכן');
          } else {
            addPlace({ ...payload, tripId: trip.id });
            toast.success('המקום נוסף');
          }
        }}
        onDelete={
          editing
            ? () => {
                setPendingDelete(editing);
                setSheetOpen(false);
              }
            : undefined
        }
      />

      {/* mobile-friendly "add to day" picker */}
      <Sheet
        open={scheduling !== null}
        onClose={() => setScheduling(null)}
        title={`לאיזה יום להוסיף את "${scheduling?.name ?? ''}"?`}
        size="sm"
      >
        <div className="space-y-1.5 pb-4">
          {days.map((day) => (
            <button
              key={day.id}
              type="button"
              onClick={() => {
                if (!scheduling) return;
                placeToActivity(scheduling.id, day.id);
                toast.success(`נוסף ליום ${day.index}`, {
                  action: { label: 'בטל', onClick: () => undo() },
                });
                setScheduling(null);
              }}
              className="w-full flex items-center justify-between gap-3 px-3.5 h-12 rounded-xl border border-line hover:bg-subtle transition text-start"
            >
              <span className="min-w-0">
                <span className="block text-[14px] font-medium truncate">
                  יום {day.index} — {day.title}
                </span>
                <span className="block text-[11.5px] text-muted ltr-nums">
                  {formatDayMonth(day.date)}
                </span>
              </span>
              <CalendarPlus className="size-4 text-brand shrink-0" />
            </button>
          ))}
        </div>
      </Sheet>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`למחוק את "${pendingDelete?.name}"?`}
        message="המקום יוסר מהרשימה ומהמפה."
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const name = pendingDelete?.name ?? '';
          if (pendingDelete) deletePlace(pendingDelete.id);
          setPendingDelete(null);
          setEditing(null);
          toast.show(`"${name}" נמחק`, {
            action: {
              label: 'בטל',
              onClick: () => {
                undo();
                toast.success('המקום שוחזר');
              },
            },
          });
        }}
      />
    </AppShell>
  );
}

function DayDropZone({
  dayId,
  index,
  title,
  date,
}: {
  dayId: string;
  index: number;
  title: string;
  date: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-drop:${dayId}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-xl border px-3 py-2 transition',
        isOver ? 'border-brand bg-brand-soft' : 'border-line bg-surface'
      )}
    >
      <p className="text-[12.5px] font-medium truncate">
        יום {index} — {title}
      </p>
      <p className="text-[11px] text-faint ltr-nums">{formatDayMonth(date)}</p>
    </div>
  );
}

function PlaceCard({
  place,
  trip,
  dayLabel,
  onEdit,
  onSchedule,
  onDelete,
}: {
  place: Place;
  trip: Trip;
  dayLabel?: number;
  onEdit: () => void;
  onSchedule: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `place:${place.id}`,
  });
  const meta = CATEGORY_META[place.category];
  const url = safeExternalUrl(place.url);

  return (
    <Card
      ref={setNodeRef}
      className={cn('overflow-hidden transition', isDragging && 'opacity-40')}
    >
      <div className="flex items-start gap-2.5 p-3.5">
        <span
          className="size-10 shrink-0 grid place-items-center rounded-xl text-lg"
          style={{ background: `color-mix(in oklab, ${meta.color} 14%, transparent)` }}
          aria-hidden
        >
          {meta.emoji}
        </span>

        <button type="button" onClick={onEdit} className="flex-1 min-w-0 text-start">
          <h3 className="font-medium text-[14.5px] leading-snug truncate">{place.name}</h3>
          {place.address && (
            <p className="text-[12px] text-muted truncate mt-0.5">{place.address}</p>
          )}
          <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
            {place.rating ? (
              <span className="inline-flex items-center gap-0.5 text-[11.5px] text-accent">
                <Star className="size-3 fill-current" />
                <span className="ltr-nums">{place.rating}</span>
              </span>
            ) : null}
            {dayLabel !== undefined ? (
              <Badge tone="brand">יום {dayLabel}</Badge>
            ) : (
              <Badge>לא במסלול</Badge>
            )}
            {place.price !== undefined && (
              <Money
                amount={place.price}
                currency={place.currency}
                trip={trip}
                inline
                className="text-[11.5px] text-muted"
              />
            )}
          </div>
          {place.notes && (
            <p className="text-[12px] text-muted mt-1.5 line-clamp-2 leading-relaxed">
              {place.notes}
            </p>
          )}
        </button>

        <span
          {...attributes}
          {...listeners}
          role="button"
          tabIndex={0}
          aria-label={`גרירת ${place.name}`}
          className="hidden lg:grid size-7 shrink-0 place-items-center rounded-lg text-faint hover:text-ink hover:bg-subtle cursor-grab active:cursor-grabbing touch-none transition"
        >
          <GripVertical className="size-4" />
        </span>
      </div>

      <div className="flex items-center gap-1 px-2.5 pb-2.5">
        <button
          type="button"
          onClick={onSchedule}
          className="inline-flex items-center gap-1 text-[12px] text-brand px-2 py-1 rounded-lg hover:bg-brand-soft transition"
        >
          <CalendarPlus className="size-3.5" />
          הוספה ליום
        </button>
        {place.location && (
          <a
            href={googleMapsLink({ ...place.location, query: place.name })}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[12px] text-muted px-2 py-1 rounded-lg hover:bg-subtle transition"
          >
            <MapPin className="size-3.5" />
            מפה
          </a>
        )}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="קישור"
            className="inline-flex items-center gap-1 text-[12px] text-muted px-2 py-1 rounded-lg hover:bg-subtle transition"
          >
            <ExternalLink className="size-3.5" />
          </a>
        )}
        <button
          type="button"
          onClick={onDelete}
          aria-label={`מחיקת ${place.name}`}
          className="ms-auto p-1.5 rounded-lg text-faint hover:text-danger hover:bg-danger-soft transition"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </Card>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'shrink-0 px-3 h-8 rounded-lg text-[12.5px] font-medium border transition whitespace-nowrap',
        active
          ? 'bg-brand text-brand-contrast border-transparent'
          : 'bg-surface border-line text-muted hover:bg-subtle'
      )}
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */

type PlacePayload = Omit<Place, 'id' | 'tripId' | 'createdAt'>;

function PlaceSheet({
  open,
  onClose,
  place,
  trip,
  onSave,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  place: Place | null;
  trip: Trip;
  onSave: (payload: PlacePayload) => void;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState(() => toForm(place, trip));
  const [touched, setTouched] = useState(false);


  const patch = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));
  const valid = form.name.trim().length > 0;

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    const hasLocation =
      form.lat !== '' && form.lng !== '' && Number.isFinite(lat) && Number.isFinite(lng);
    onSave({
      name: form.name.trim(),
      list: form.list,
      category: form.category,
      address: form.address.trim() || undefined,
      location: hasLocation ? { lat, lng } : undefined,
      rating: form.rating !== '' ? Number(form.rating) : undefined,
      notes: form.notes.trim() || undefined,
      price: form.price !== '' ? Number(form.price) : undefined,
      currency: form.currency,
      url: form.url.trim() || undefined,
      dayId: place?.dayId,
    });
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={place ? 'עריכת מקום' : 'מקום חדש'}
      footer={
        <div className="flex gap-2">
          {onDelete && (
            <Button
              variant="ghost"
              onClick={onDelete}
              aria-label="מחיקה"
              className="text-danger hover:bg-danger-soft shrink-0"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} className="flex-1">
            ביטול
          </Button>
          <Button onClick={submit} className="flex-1" disabled={touched && !valid}>
            שמירה
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pb-4">
        <TextInput
          label="שם המקום"
          required
          autoFocus
          value={form.name}
          error={touched && !valid ? 'צריך שם' : undefined}
          onChange={(e) => patch({ name: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />

        <Field label="רשימה">
          <div className="flex flex-wrap gap-1.5">
            {PLACE_LISTS.map((list) => {
              const meta = PLACE_LIST_META[list];
              const on = form.list === list;
              return (
                <button
                  key={list}
                  type="button"
                  onClick={() => patch({ list })}
                  aria-pressed={on}
                  className={cn(
                    'inline-flex items-center gap-1 px-2.5 h-8 rounded-lg text-[12.5px] font-medium border transition',
                    on
                      ? 'bg-brand text-brand-contrast border-transparent'
                      : 'border-line text-muted hover:bg-subtle'
                  )}
                >
                  <span aria-hidden>{meta.emoji}</span>
                  {meta.label}
                </button>
              );
            })}
          </div>
        </Field>

        <Select
          label="קטגוריה"
          value={form.category}
          onChange={(e) => patch({ category: e.target.value as ActivityCategory })}
        >
          {ACTIVITY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
            </option>
          ))}
        </Select>

        <TextInput
          label="כתובת"
          value={form.address}
          onChange={(e) => patch({ address: e.target.value })}
        />

        <div className="grid grid-cols-2 gap-3">
          <TextInput
            label="קו רוחב"
            inputMode="decimal"
            value={form.lat}
            onChange={(e) => patch({ lat: e.target.value })}
          />
          <TextInput
            label="קו אורך"
            inputMode="decimal"
            value={form.lng}
            onChange={(e) => patch({ lng: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <TextInput
            label="דירוג אישי"
            type="number"
            inputMode="numeric"
            min={0}
            max={5}
            value={form.rating}
            onChange={(e) => patch({ rating: e.target.value })}
          />
          <TextInput
            label="מחיר"
            type="number"
            inputMode="decimal"
            min={0}
            prefix={CURRENCY_META[form.currency].symbol}
            value={form.price}
            onChange={(e) => patch({ price: e.target.value })}
          />
          <Select
            label="מטבע"
            value={form.currency}
            onChange={(e) => patch({ currency: e.target.value as CurrencyCode })}
          >
            {trip.currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>

        <TextInput
          label="קישור"
          type="url"
          dir="ltr"
          placeholder="https://"
          value={form.url}
          onChange={(e) => patch({ url: e.target.value })}
        />
        <TextArea
          label="הערה"
          value={form.notes}
          onChange={(e) => patch({ notes: e.target.value })}
        />
      </div>
    </Sheet>
  );
}

function toForm(place: Place | null, trip: Trip) {
  return {
    name: place?.name ?? '',
    list: place?.list ?? ('must' as PlaceList),
    category: place?.category ?? ('attraction' as ActivityCategory),
    address: place?.address ?? '',
    lat: place?.location ? String(place.location.lat) : '',
    lng: place?.location ? String(place.location.lng) : '',
    rating: place?.rating !== undefined ? String(place.rating) : '',
    price: place?.price !== undefined ? String(place.price) : '',
    currency: place?.currency ?? trip.currencies[trip.currencies.length - 1] ?? trip.baseCurrency,
    url: place?.url ?? '',
    notes: place?.notes ?? '',
  };
}
