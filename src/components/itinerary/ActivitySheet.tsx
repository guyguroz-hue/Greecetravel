'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, MapPin, Trash2 } from 'lucide-react';
import {
  ACTIVITY_CATEGORIES,
  CATEGORY_META,
  CURRENCY_META,
  type Activity,
  type ActivityCategory,
  type CurrencyCode,
  type Day,
  type Trip,
} from '@/lib/types';
import { formatDayMonth } from '@/lib/utils/date';
import { cn } from '@/lib/utils/cn';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextArea, TextInput } from '@/components/ui/Field';
import { LocationField } from '@/components/ui/LocationField';

export interface ActivityDraft {
  title: string;
  category: ActivityCategory;
  dayId: string;
  startTime: string;
  durationMin: string;
  address: string;
  lat: string;
  lng: string;
  price: string;
  currency: CurrencyCode;
  notes: string;
  url: string;
  bookingRef: string;
  booked: boolean;
}

function toDraft(activity: Activity | null, fallbackDayId: string, trip: Trip): ActivityDraft {
  return {
    title: activity?.title ?? '',
    category: activity?.category ?? 'attraction',
    dayId: activity?.dayId ?? fallbackDayId,
    startTime: activity?.startTime ?? '',
    durationMin: activity?.durationMin ? String(activity.durationMin) : '',
    address: activity?.address ?? '',
    lat: activity?.location ? String(activity.location.lat) : '',
    lng: activity?.location ? String(activity.location.lng) : '',
    price: activity?.price !== undefined ? String(activity.price) : '',
    currency: activity?.currency ?? trip.currencies[trip.currencies.length - 1] ?? trip.baseCurrency,
    notes: activity?.notes ?? '',
    url: activity?.url ?? '',
    bookingRef: activity?.bookingRef ?? '',
    booked: !!activity?.booked,
  };
}

/**
 * Add/edit for an activity. Only the first four fields are visible by default
 * — the rest sit behind "עוד פרטים", so adding something takes seconds.
 */
export function ActivitySheet({
  open,
  onClose,
  activity,
  days,
  trip,
  near,
  defaultDayId,
  onSave,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  activity: Activity | null;
  days: Day[];
  trip: Trip;
  /** An existing point on this trip, used to bias the location search. */
  near?: { lat: number; lng: number };
  defaultDayId: string;
  onSave: (draft: ActivityDraft) => void;
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState<ActivityDraft>(() => toDraft(activity, defaultDayId, trip));
  const [expanded, setExpanded] = useState(false);
  const [touched, setTouched] = useState(false);

  const patch = (p: Partial<ActivityDraft>) => setDraft((d) => ({ ...d, ...p }));

  const errors = useMemo(() => {
    const e: Partial<Record<keyof ActivityDraft, string>> = {};
    if (!draft.title.trim()) e.title = 'צריך שם לפעילות';
    if (draft.startTime && !/^\d{2}:\d{2}$/.test(draft.startTime)) e.startTime = 'שעה לא תקינה';
    if (draft.price && !Number.isFinite(Number(draft.price))) e.price = 'מחיר לא תקין';
    if (draft.durationMin && Number(draft.durationMin) < 0) e.durationMin = 'משך לא תקין';
    const hasLat = draft.lat.trim() !== '';
    const hasLng = draft.lng.trim() !== '';
    if (hasLat !== hasLng) e.lat = 'צריך גם קו רוחב וגם קו אורך';
    else if (hasLat && (!Number.isFinite(Number(draft.lat)) || Math.abs(Number(draft.lat)) > 90))
      e.lat = 'קו רוחב לא תקין';
    else if (hasLng && (!Number.isFinite(Number(draft.lng)) || Math.abs(Number(draft.lng)) > 180))
      e.lat = 'קו אורך לא תקין';
    return e;
  }, [draft]);

  const valid = Object.keys(errors).length === 0;

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    onSave(draft);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={activity ? 'עריכת פעילות' : 'פעילות חדשה'}
      description={activity ? undefined : 'רק שם ויום הם חובה — כל השאר אופציונלי'}
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
          label="שם"
          required
          autoFocus
          placeholder="למשל: יקב Katogi Averoff"
          value={draft.title}
          error={touched ? errors.title : undefined}
          onChange={(e) => patch({ title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />

        <Field label="קטגוריה">
          <div className="flex flex-wrap gap-1.5">
            {ACTIVITY_CATEGORIES.map((key) => {
              const meta = CATEGORY_META[key];
              const active = draft.category === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => patch({ category: key })}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex items-center gap-1 px-2.5 h-8 rounded-lg text-[12.5px] font-medium border transition',
                    active
                      ? 'border-transparent text-white'
                      : 'border-line text-muted hover:bg-subtle'
                  )}
                  style={active ? { background: meta.color } : undefined}
                >
                  <span aria-hidden>{meta.emoji}</span>
                  {meta.label}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Select label="יום" value={draft.dayId} onChange={(e) => patch({ dayId: e.target.value })}>
            {days.map((d) => (
              <option key={d.id} value={d.id}>
                יום {d.index} · {formatDayMonth(d.date)} — {d.title}
              </option>
            ))}
          </Select>
          <TextInput
            label="שעה"
            type="time"
            value={draft.startTime}
            error={touched ? errors.startTime : undefined}
            onChange={(e) => patch({ startTime: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextInput
            label="מחיר"
            type="number"
            inputMode="decimal"
            min={0}
            placeholder="0"
            prefix={CURRENCY_META[draft.currency].symbol}
            value={draft.price}
            error={touched ? errors.price : undefined}
            onChange={(e) => patch({ price: e.target.value })}
          />
          <Select
            label="מטבע"
            value={draft.currency}
            onChange={(e) => patch({ currency: e.target.value as CurrencyCode })}
          >
            {trip.currencies.map((c) => (
              <option key={c} value={c}>
                {CURRENCY_META[c].symbol} {c}
              </option>
            ))}
          </Select>
        </div>

        <LocationField
          value={draft.address}
          location={
            draft.lat && draft.lng
              ? { lat: Number(draft.lat), lng: Number(draft.lng) }
              : undefined
          }
          near={near}
          countryCode={trip.countryCode}
          onChange={({ address, location }: { address: string; location?: { lat: number; lng: number } }) =>
            patch({
              address,
              lat: location ? String(location.lat) : '',
              lng: location ? String(location.lng) : '',
            })
          }
        />

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between h-10 px-1 text-[14px] font-medium text-brand"
        >
          עוד פרטים
          <ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} />
        </button>

        {expanded && (
          <div className="space-y-4 animate-[slide-up_0.18s_ease-out]">
            <TextInput
              label="משך בדקות"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="90"
              value={draft.durationMin}
              error={touched ? errors.durationMin : undefined}
              onChange={(e) => patch({ durationMin: e.target.value })}
            />

            <Field
              label="קואורדינטות"
              hint="נמלאות לבד כשבוחרים מקום בשדה הכתובת. כאן רק אם רוצים לדייק ידנית."
              error={touched ? errors.lat : undefined}
            >
              <div className="grid grid-cols-2 gap-3">
                <TextInput
                  placeholder="קו רוחב · 39.7742"
                  inputMode="decimal"
                  value={draft.lat}
                  onChange={(e) => patch({ lat: e.target.value })}
                  prefix={<MapPin className="size-3.5" />}
                />
                <TextInput
                  placeholder="קו אורך · 21.1858"
                  inputMode="decimal"
                  value={draft.lng}
                  onChange={(e) => patch({ lng: e.target.value })}
                />
              </div>
            </Field>

            <TextInput
              label="קישור"
              type="url"
              dir="ltr"
              placeholder="https://"
              value={draft.url}
              onChange={(e) => patch({ url: e.target.value })}
            />
            <TextInput
              label="מספר הזמנה"
              dir="ltr"
              placeholder="NP-7741"
              value={draft.bookingRef}
              onChange={(e) => patch({ bookingRef: e.target.value })}
            />
            <label className="flex items-center gap-2.5 py-1 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.booked}
                onChange={(e) => patch({ booked: e.target.checked })}
                className="size-4.5 rounded accent-[var(--brand)]"
              />
              <span className="text-[14px]">הפעילות כבר מוזמנת</span>
            </label>
            <TextArea
              label="הערות"
              placeholder="להביא נעלי מים, להזמין מקום מראש…"
              value={draft.notes}
              onChange={(e) => patch({ notes: e.target.value })}
            />
          </div>
        )}
      </div>
    </Sheet>
  );
}

/** Turns a validated draft back into the shape the store expects. */
export function draftToActivityPatch(draft: ActivityDraft) {
  const lat = Number(draft.lat);
  const lng = Number(draft.lng);
  const hasLocation =
    draft.lat.trim() !== '' && draft.lng.trim() !== '' && Number.isFinite(lat) && Number.isFinite(lng);
  return {
    title: draft.title.trim(),
    category: draft.category,
    dayId: draft.dayId,
    startTime: draft.startTime || undefined,
    durationMin: draft.durationMin ? Number(draft.durationMin) : undefined,
    address: draft.address.trim() || undefined,
    location: hasLocation ? { lat, lng } : undefined,
    price: draft.price !== '' ? Number(draft.price) : undefined,
    currency: draft.currency,
    notes: draft.notes.trim() || undefined,
    url: draft.url.trim() || undefined,
    bookingRef: draft.bookingRef.trim() || undefined,
    booked: draft.booked,
  };
}
