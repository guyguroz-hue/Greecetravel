'use client';

import { useMemo, useState } from 'react';
import {
  CarFront,
  ExternalLink,
  Fuel,
  MapPin,
  Plus,
  Route,
  ShieldCheck,
  Timer,
  Trash2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useActiveTrip } from '@/lib/store/hooks';
import { useTripStore } from '@/lib/store/trip-store';
import { toast } from '@/lib/store/ui-store';
import { computeTripDriving, groupActivitiesByDay } from '@/lib/selectors/itinerary';
import { convert } from '@/lib/services/currency';
import { CURRENCY_META, type CarRental, type CurrencyCode, type Trip } from '@/lib/types';
import { diffDays, formatDuration, formatShortDate } from '@/lib/utils/date';
import { formatKm, formatMoney, googleMapsLink, safeExternalUrl } from '@/lib/utils/format';
import { Card, SectionTitle, Stat } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select, TextArea, TextInput } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { ConfirmDialog, EmptyState } from '@/components/ui/Feedback';
import { Badge, DetailRow } from '@/components/ui/Bits';
import { Money } from '@/components/common/Money';
import { StatusChip } from '@/components/common/PaidToggle';

export function CarScreen() {
  const active = useActiveTrip();
  const addCar = useTripStore((s) => s.addCar);
  const updateCar = useTripStore((s) => s.updateCar);
  const deleteCar = useTripStore((s) => s.deleteCar);
  const undo = useTripStore((s) => s.undo);

  const [editing, setEditing] = useState<CarRental | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CarRental | null>(null);

  const driving = useMemo(() => {
    if (!active) return { minutes: 0, km: 0 };
    return computeTripDriving(active.days, groupActivitiesByDay(active.activities));
  }, [active]);

  if (!active) return null;
  const { trip, cars } = active;

  const primary = cars[0];
  const fuelEstimate =
    primary?.fuelConsumption && primary.fuelPricePerLiter
      ? (driving.km / 100) * primary.fuelConsumption * primary.fuelPricePerLiter
      : null;

  return (
    <AppShell
      title="רכב שכור"
      subtitle={cars.length > 0 ? `${cars.length} השכרות` : 'לא הוזמן רכב'}
      backHref="/more"
      actions={
        <Button
          size="sm"
          aria-label="הוספת השכרה"
          onClick={() => {
            setEditing(null);
            setSheetOpen(true);
          }}
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">השכרה</span>
        </Button>
      }
    >
      {/* driving summary from the itinerary itself */}
      <section className="mb-5">
        <SectionTitle>נסיעה משוערת לפי המסלול</SectionTitle>
        <div className="grid grid-cols-3 gap-px bg-line rounded-2xl overflow-hidden border border-line shadow-card">
          <Stat
            icon={<Timer className="size-3.5" />}
            label="זמן נהיגה"
            value={driving.minutes > 0 ? formatDuration(driving.minutes) : '—'}
            hint="סך כל הימים"
          />
          <Stat
            icon={<Route className="size-3.5" />}
            label="מרחק כולל"
            value={driving.km > 0 ? formatKm(driving.km) : '—'}
            hint="בין הפעילויות"
          />
          <Stat
            icon={<Fuel className="size-3.5" />}
            label="הערכת דלק"
            value={
              fuelEstimate !== null
                ? formatMoney(
                    convert(fuelEstimate, primary!.currency, trip.baseCurrency, trip.rates),
                    trip.baseCurrency
                  )
                : '—'
            }
            hint={
              primary?.fuelConsumption
                ? `${primary.fuelConsumption} ל׳ / 100 ק״מ`
                : 'להזנת צריכה בהשכרה'
            }
          />
        </div>
        <p className="text-[11.5px] text-faint mt-2 px-0.5">
          החישוב מבוסס על המרחקים בין הפעילויות במסלול, בהערכה מקומית ללא חיבור לשירות ניתוב.
        </p>
      </section>

      {cars.length === 0 ? (
        <EmptyState
          icon={<CarFront className="size-6" />}
          title="עוד לא נוסף רכב"
          description="הוספת ההשכרה תאפשר לחשב הערכת דלק, ולזכור איפה ומתי לאסוף ולהחזיר."
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setSheetOpen(true);
              }}
            >
              <Plus className="size-4" />
              הוספת השכרה
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {cars.map((car) => {
            const days = Math.max(1, diffDays(car.pickupDate, car.dropoffDate));
            const url = safeExternalUrl(car.bookingUrl);
            return (
              <Card key={car.id} className="overflow-hidden">
                <button type="button" onClick={() => { setEditing(car); setSheetOpen(true); }} className="w-full text-start p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="size-10 shrink-0 grid place-items-center rounded-xl bg-brand-soft text-brand">
                        <CarFront className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-[15px] truncate">
                          {car.company || 'חברת השכרה'}
                        </h3>
                        <p className="text-[12.5px] text-muted truncate">
                          {car.carType || 'סוג רכב לא צוין'}
                        </p>
                      </div>
                    </div>
                    {car.price !== undefined && (
                      <Money
                        amount={car.price}
                        currency={car.currency}
                        trip={trip}
                        className="text-[15px] font-semibold shrink-0"
                      />
                    )}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 mt-3.5">
                    <Leg
                      label="איסוף"
                      date={car.pickupDate}
                      time={car.pickupTime}
                      place={car.pickupLocation}
                    />
                    <Leg
                      label="החזרה"
                      date={car.dropoffDate}
                      time={car.dropoffTime}
                      place={car.dropoffLocation}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    <StatusChip active={!!car.booked} activeLabel="מוזמן" inactiveLabel="ללא הזמנה" />
                    <Badge>{days} ימי השכרה</Badge>
                    {car.insurance && (
                      <Badge tone="success">
                        <ShieldCheck className="size-3" />
                        {car.insurance}
                      </Badge>
                    )}
                    {car.deductible !== undefined && (
                      <Badge tone="warning">
                        <span className="ltr-nums">
                          השתתפות עצמית {formatMoney(car.deductible, car.currency)}
                        </span>
                      </Badge>
                    )}
                  </div>

                  {car.notes && <p className="text-[12.5px] text-muted mt-2.5">{car.notes}</p>}
                </button>

                <div className="flex items-center gap-1 px-3 pb-3">
                  <StatusChip
                    active={!!car.paid}
                    activeLabel="שולם"
                    inactiveLabel="לא שולם"
                    tone="brand"
                    onClick={() => updateCar(car.id, { paid: !car.paid })}
                  />
                  {car.pickupPoint && (
                    <a
                      href={googleMapsLink({ ...car.pickupPoint, query: car.pickupLocation })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[12px] text-brand px-2 py-1 rounded-lg hover:bg-brand-soft transition"
                    >
                      <MapPin className="size-3.5" />
                      נקודת איסוף
                    </a>
                  )}
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[12px] text-brand px-2 py-1 rounded-lg hover:bg-brand-soft transition"
                    >
                      <ExternalLink className="size-3.5" />
                      ההזמנה
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setPendingDelete(car)}
                    aria-label="מחיקת השכרה"
                    className="ms-auto p-1.5 rounded-lg text-faint hover:text-danger hover:bg-danger-soft transition"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                {car.bookingRef && (
                  <div className="px-4 pb-3">
                    <DetailRow label="מספר הזמנה" value={car.bookingRef} ltr />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <CarSheet
        key={`${editing?.id ?? 'new'}:${sheetOpen}`}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        car={editing}
        trip={trip}
        onSave={(payload) => {
          if (editing) {
            updateCar(editing.id, payload);
            toast.success('ההשכרה עודכנה');
          } else {
            addCar({ ...payload, tripId: trip.id });
            toast.success('ההשכרה נוספה');
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

      <ConfirmDialog
        open={pendingDelete !== null}
        title="למחוק את ההשכרה?"
        message={pendingDelete?.company}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) deleteCar(pendingDelete.id);
          setPendingDelete(null);
          setEditing(null);
          toast.show('ההשכרה נמחקה', {
            action: {
              label: 'בטל',
              onClick: () => {
                undo();
                toast.success('ההשכרה שוחזרה');
              },
            },
          });
        }}
      />
    </AppShell>
  );
}

function Leg({
  label,
  date,
  time,
  place,
}: {
  label: string;
  date: string;
  time?: string;
  place: string;
}) {
  return (
    <div className="bg-inset rounded-xl px-3 py-2.5">
      <p className="text-[11.5px] text-muted">{label}</p>
      <p className="text-[13.5px] font-semibold ltr-nums mt-0.5">
        {formatShortDate(date)}
        {time ? ` · ${time}` : ''}
      </p>
      <p className="text-[12px] text-muted truncate mt-0.5">{place || '—'}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

type CarPayload = Omit<CarRental, 'id' | 'tripId'>;

function CarSheet({
  open,
  onClose,
  car,
  trip,
  onSave,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  car: CarRental | null;
  trip: Trip;
  onSave: (payload: CarPayload) => void;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState(() => toForm(car, trip));
  const [touched, setTouched] = useState(false);


  const patch = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!form.company.trim()) e.company = 'צריך שם חברה';
    if (!form.pickupDate) e.pickupDate = 'צריך תאריך איסוף';
    if (!form.dropoffDate) e.dropoffDate = 'צריך תאריך החזרה';
    else if (form.dropoffDate < form.pickupDate) e.dropoffDate = 'ההחזרה לפני האיסוף';
    return e;
  }, [form]);

  const valid = Object.keys(errors).length === 0;

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    onSave({
      company: form.company.trim(),
      carType: form.carType.trim() || undefined,
      pickupDate: form.pickupDate,
      pickupTime: form.pickupTime || undefined,
      pickupLocation: form.pickupLocation.trim(),
      dropoffDate: form.dropoffDate,
      dropoffTime: form.dropoffTime || undefined,
      dropoffLocation: form.dropoffLocation.trim(),
      price: form.price !== '' ? Number(form.price) : undefined,
      currency: form.currency,
      insurance: form.insurance.trim() || undefined,
      deductible: form.deductible !== '' ? Number(form.deductible) : undefined,
      bookingRef: form.bookingRef.trim() || undefined,
      bookingUrl: form.bookingUrl.trim() || undefined,
      notes: form.notes.trim() || undefined,
      booked: form.booked,
      paid: form.paid,
      fuelConsumption: form.fuelConsumption !== '' ? Number(form.fuelConsumption) : undefined,
      fuelPricePerLiter:
        form.fuelPricePerLiter !== '' ? Number(form.fuelPricePerLiter) : undefined,
      pickupPoint: car?.pickupPoint,
      dropoffPoint: car?.dropoffPoint,
    });
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={car ? 'עריכת השכרה' : 'השכרת רכב חדשה'}
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
          label="חברת השכרה"
          required
          autoFocus
          placeholder="Hertz"
          value={form.company}
          error={touched ? errors.company : undefined}
          onChange={(e) => patch({ company: e.target.value })}
        />
        <TextInput
          label="סוג הרכב"
          placeholder="Peugeot 5008 אוטומט, 7 מקומות"
          value={form.carType}
          onChange={(e) => patch({ carType: e.target.value })}
        />

        <div className="rounded-2xl border border-line p-3.5 space-y-3">
          <p className="text-[12.5px] font-semibold text-muted">איסוף</p>
          <div className="grid grid-cols-2 gap-3">
            <TextInput
              label="תאריך"
              required
              type="date"
              value={form.pickupDate}
              error={touched ? errors.pickupDate : undefined}
              onChange={(e) => patch({ pickupDate: e.target.value })}
            />
            <TextInput
              label="שעה"
              type="time"
              value={form.pickupTime}
              onChange={(e) => patch({ pickupTime: e.target.value })}
            />
          </div>
          <TextInput
            label="מקום"
            placeholder="נמל התעופה סלוניקי (SKG)"
            value={form.pickupLocation}
            onChange={(e) => patch({ pickupLocation: e.target.value })}
          />
        </div>

        <div className="rounded-2xl border border-line p-3.5 space-y-3">
          <p className="text-[12.5px] font-semibold text-muted">החזרה</p>
          <div className="grid grid-cols-2 gap-3">
            <TextInput
              label="תאריך"
              required
              type="date"
              min={form.pickupDate}
              value={form.dropoffDate}
              error={touched ? errors.dropoffDate : undefined}
              onChange={(e) => patch({ dropoffDate: e.target.value })}
            />
            <TextInput
              label="שעה"
              type="time"
              value={form.dropoffTime}
              onChange={(e) => patch({ dropoffTime: e.target.value })}
            />
          </div>
          <TextInput
            label="מקום"
            value={form.dropoffLocation}
            onChange={(e) => patch({ dropoffLocation: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
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
          label="ביטוח"
          placeholder="ביטוח מקיף כולל צד ג׳"
          value={form.insurance}
          onChange={(e) => patch({ insurance: e.target.value })}
        />
        <TextInput
          label="השתתפות עצמית"
          type="number"
          inputMode="decimal"
          min={0}
          prefix={CURRENCY_META[form.currency].symbol}
          value={form.deductible}
          onChange={(e) => patch({ deductible: e.target.value })}
        />

        <div className="grid grid-cols-2 gap-3">
          <TextInput
            label="צריכת דלק"
            hint="ליטרים ל-100 ק״מ"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.1"
            placeholder="7.2"
            value={form.fuelConsumption}
            onChange={(e) => patch({ fuelConsumption: e.target.value })}
          />
          <TextInput
            label="מחיר דלק לליטר"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="1.85"
            prefix={CURRENCY_META[form.currency].symbol}
            value={form.fuelPricePerLiter}
            onChange={(e) => patch({ fuelPricePerLiter: e.target.value })}
          />
        </div>

        <TextInput
          label="מספר הזמנה"
          dir="ltr"
          value={form.bookingRef}
          onChange={(e) => patch({ bookingRef: e.target.value })}
        />
        <TextInput
          label="קישור להזמנה"
          type="url"
          dir="ltr"
          placeholder="https://"
          value={form.bookingUrl}
          onChange={(e) => patch({ bookingUrl: e.target.value })}
        />
        <TextArea
          label="הערות"
          value={form.notes}
          onChange={(e) => patch({ notes: e.target.value })}
        />

        <div className="flex gap-5 pt-1">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.booked}
              onChange={(e) => patch({ booked: e.target.checked })}
              className="size-4.5 rounded accent-[var(--brand)]"
            />
            <span className="text-[14px]">מוזמן</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.paid}
              onChange={(e) => patch({ paid: e.target.checked })}
              className="size-4.5 rounded accent-[var(--brand)]"
            />
            <span className="text-[14px]">שולם</span>
          </label>
        </div>
      </div>
    </Sheet>
  );
}

function toForm(car: CarRental | null, trip: Trip) {
  return {
    company: car?.company ?? '',
    carType: car?.carType ?? '',
    pickupDate: car?.pickupDate ?? trip.startDate,
    pickupTime: car?.pickupTime ?? '',
    pickupLocation: car?.pickupLocation ?? '',
    dropoffDate: car?.dropoffDate ?? trip.endDate,
    dropoffTime: car?.dropoffTime ?? '',
    dropoffLocation: car?.dropoffLocation ?? '',
    price: car?.price !== undefined ? String(car.price) : '',
    currency: car?.currency ?? trip.currencies[trip.currencies.length - 1] ?? trip.baseCurrency,
    insurance: car?.insurance ?? '',
    deductible: car?.deductible !== undefined ? String(car.deductible) : '',
    bookingRef: car?.bookingRef ?? '',
    bookingUrl: car?.bookingUrl ?? '',
    notes: car?.notes ?? '',
    booked: !!car?.booked,
    paid: !!car?.paid,
    fuelConsumption: car?.fuelConsumption !== undefined ? String(car.fuelConsumption) : '',
    fuelPricePerLiter:
      car?.fuelPricePerLiter !== undefined ? String(car.fuelPricePerLiter) : '',
  };
}
