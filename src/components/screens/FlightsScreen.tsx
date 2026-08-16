'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, Luggage, Plane, PlaneLanding, PlaneTakeoff, Plus, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useActiveTrip } from '@/lib/store/hooks';
import { useTripStore } from '@/lib/store/trip-store';
import { toast } from '@/lib/store/ui-store';
import { CURRENCY_META, type CurrencyCode, type Flight, type Trip } from '@/lib/types';
import { formatWeekdayDate, relativeDayLabel, todayISO } from '@/lib/utils/date';
import { safeExternalUrl } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { Card, SectionTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select, TextArea, TextInput } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { ConfirmDialog, EmptyState } from '@/components/ui/Feedback';
import { Badge } from '@/components/ui/Bits';
import { Money } from '@/components/common/Money';
import { StatusChip } from '@/components/common/PaidToggle';

const DIRECTION_LABEL: Record<Flight['direction'], string> = {
  outbound: 'טיסת הלוך',
  return: 'טיסת חזור',
  internal: 'טיסה פנימית',
};

export function FlightsScreen() {
  const active = useActiveTrip();
  const addFlight = useTripStore((s) => s.addFlight);
  const updateFlight = useTripStore((s) => s.updateFlight);
  const deleteFlight = useTripStore((s) => s.deleteFlight);
  const undo = useTripStore((s) => s.undo);

  const [editing, setEditing] = useState<Flight | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Flight | null>(null);
  const today = todayISO();

  if (!active) return null;
  const { trip, flights } = active;

  const groups: [Flight['direction'], Flight[]][] = [
    ['outbound', flights.filter((f) => f.direction === 'outbound')],
    ['internal', flights.filter((f) => f.direction === 'internal')],
    ['return', flights.filter((f) => f.direction === 'return')],
  ];

  return (
    <AppShell
      title="טיסות"
      subtitle={`${flights.length} טיסות`}
      backHref="/more"
      actions={
        <Button
          size="sm"
          aria-label="הוספת טיסה"
          onClick={() => {
            setEditing(null);
            setSheetOpen(true);
          }}
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">טיסה</span>
        </Button>
      }
    >
      {flights.length === 0 ? (
        <EmptyState
          icon={<Plane className="size-6" />}
          title="עוד לא נוספו טיסות"
          description="אפשר להוסיף את טיסת ההלוך והחזור, כולל מספרי הזמנה וכבודה."
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setSheetOpen(true);
              }}
            >
              <Plus className="size-4" />
              הוספת טיסה
            </Button>
          }
        />
      ) : (
        <div className="space-y-5">
          {groups.map(([direction, list]) =>
            list.length === 0 ? null : (
              <section key={direction}>
                <SectionTitle>{DIRECTION_LABEL[direction]}</SectionTitle>
                <div className="space-y-3">
                  {list.map((flight) => (
                    <FlightCard
                      key={flight.id}
                      flight={flight}
                      trip={trip}
                      today={today}
                      onEdit={() => {
                        setEditing(flight);
                        setSheetOpen(true);
                      }}
                      onDelete={() => setPendingDelete(flight)}
                      onTogglePaid={() => updateFlight(flight.id, { paid: !flight.paid })}
                    />
                  ))}
                </div>
              </section>
            )
          )}
        </div>
      )}

      <FlightSheet
        key={`${editing?.id ?? 'new'}:${sheetOpen}`}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        flight={editing}
        trip={trip}
        onSave={(payload) => {
          if (editing) {
            updateFlight(editing.id, payload);
            toast.success('הטיסה עודכנה');
          } else {
            addFlight({ ...payload, tripId: trip.id });
            toast.success('הטיסה נוספה');
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
        title="למחוק את הטיסה?"
        message={`${pendingDelete?.airline ?? ''} ${pendingDelete?.flightNumber ?? ''}`}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) deleteFlight(pendingDelete.id);
          setPendingDelete(null);
          setEditing(null);
          toast.show('הטיסה נמחקה', {
            action: {
              label: 'בטל',
              onClick: () => {
                undo();
                toast.success('הטיסה שוחזרה');
              },
            },
          });
        }}
      />
    </AppShell>
  );
}

function FlightCard({
  flight,
  trip,
  today,
  onEdit,
  onDelete,
  onTogglePaid,
}: {
  flight: Flight;
  trip: Trip;
  today: string;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePaid: () => void;
}) {
  const url = safeExternalUrl(flight.bookingUrl);
  const upcoming = flight.date >= today;

  return (
    <Card className="overflow-hidden">
      <button type="button" onClick={onEdit} className="w-full text-start p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="size-9 shrink-0 grid place-items-center rounded-xl bg-brand-soft text-brand">
              {flight.direction === 'return' ? (
                <PlaneLanding className="size-[18px]" />
              ) : (
                <PlaneTakeoff className="size-[18px]" />
              )}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-[14.5px] truncate">
                {flight.airline || 'חברת תעופה'}{' '}
                <span className="ltr-nums text-muted font-normal">{flight.flightNumber}</span>
              </p>
              <p className="text-[12px] text-muted">
                {flight.date ? formatWeekdayDate(flight.date) : 'ללא תאריך'}
                {upcoming && ` · ${relativeDayLabel(flight.date, today)}`}
              </p>
            </div>
          </div>
          {flight.price !== undefined && (
            <Money
              amount={flight.price}
              currency={flight.currency}
              trip={trip}
              className="text-[15px] font-semibold shrink-0"
            />
          )}
        </div>

        {/* route strip */}
        <div className="flex items-center gap-3 bg-inset rounded-xl px-3.5 py-3" dir="ltr">
          <Endpoint
            code={flight.from.code}
            name={flight.from.name}
            time={flight.departureTime}
            terminal={flight.from.terminal}
            align="start"
          />
          <div className="flex-1 flex items-center gap-1.5 min-w-0">
            <span className="h-px flex-1 bg-line-strong" aria-hidden />
            <Plane className="size-3.5 text-faint rotate-90 shrink-0" aria-hidden />
            <span className="h-px flex-1 bg-line-strong" aria-hidden />
          </div>
          <Endpoint
            code={flight.to.code}
            name={flight.to.name}
            time={flight.arrivalTime}
            terminal={flight.to.terminal}
            align="end"
            nextDay={flight.arrivesNextDay}
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          <StatusChip active={!!flight.booked} activeLabel="מוזמן" inactiveLabel="ללא הזמנה" />
          {flight.bookingRef && (
            <Badge tone="brand">
              <span className="ltr-nums">{flight.bookingRef}</span>
            </Badge>
          )}
          {flight.seats && (
            <Badge>
              <span className="ltr-nums">מושבים {flight.seats}</span>
            </Badge>
          )}
          {flight.baggage && (
            <Badge>
              <Luggage className="size-3" />
              {flight.baggage}
            </Badge>
          )}
        </div>

        {flight.notes && <p className="text-[12.5px] text-muted mt-2.5">{flight.notes}</p>}
      </button>

      <div className="flex items-center gap-1 px-3 pb-3">
        <StatusChip
          active={!!flight.paid}
          activeLabel="שולם"
          inactiveLabel="לא שולם"
          tone="brand"
          onClick={onTogglePaid}
        />
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
          onClick={onDelete}
          aria-label="מחיקת טיסה"
          className="ms-auto p-1.5 rounded-lg text-faint hover:text-danger hover:bg-danger-soft transition"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </Card>
  );
}

function Endpoint({
  code,
  name,
  time,
  terminal,
  align,
  nextDay,
}: {
  code: string;
  name: string;
  time?: string;
  terminal?: string;
  align: 'start' | 'end';
  nextDay?: boolean;
}) {
  return (
    <div className={cn('min-w-0 shrink-0', align === 'end' ? 'text-right' : 'text-left')}>
      <p className="text-[17px] font-semibold ltr-nums leading-none">{code || '—'}</p>
      <p className="text-[13px] font-medium ltr-nums mt-1">
        {time || '--:--'}
        {nextDay && <sup className="text-[9px] text-brand ms-0.5">+1</sup>}
      </p>
      <p className="text-[10.5px] text-faint mt-0.5 truncate max-w-24">{name}</p>
      {terminal && <p className="text-[10px] text-faint">Terminal {terminal}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */

type FlightPayload = Omit<Flight, 'id' | 'tripId'>;

function FlightSheet({
  open,
  onClose,
  flight,
  trip,
  onSave,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  flight: Flight | null;
  trip: Trip;
  onSave: (payload: FlightPayload) => void;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState(() => toForm(flight, trip));
  const [touched, setTouched] = useState(false);


  const patch = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!form.airline.trim() && !form.flightNumber.trim()) {
      e.airline = 'צריך חברת תעופה או מספר טיסה';
    }
    if (!form.date) e.date = 'צריך תאריך';
    if (form.price && !Number.isFinite(Number(form.price))) e.price = 'מחיר לא תקין';
    return e;
  }, [form]);

  const valid = Object.keys(errors).length === 0;

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    onSave({
      direction: form.direction,
      airline: form.airline.trim(),
      flightNumber: form.flightNumber.trim().toUpperCase(),
      date: form.date,
      departureTime: form.departureTime || undefined,
      arrivalTime: form.arrivalTime || undefined,
      arrivesNextDay: form.arrivesNextDay,
      from: {
        code: form.fromCode.trim().toUpperCase(),
        name: form.fromName.trim(),
        terminal: form.fromTerminal.trim() || undefined,
      },
      to: {
        code: form.toCode.trim().toUpperCase(),
        name: form.toName.trim(),
        terminal: form.toTerminal.trim() || undefined,
      },
      baggage: form.baggage.trim() || undefined,
      price: form.price !== '' ? Number(form.price) : undefined,
      currency: form.currency,
      bookingRef: form.bookingRef.trim() || undefined,
      bookingUrl: form.bookingUrl.trim() || undefined,
      seats: form.seats.trim() || undefined,
      notes: form.notes.trim() || undefined,
      booked: form.booked,
      paid: form.paid,
    });
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={flight ? 'עריכת טיסה' : 'טיסה חדשה'}
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
        <Select
          label="סוג"
          value={form.direction}
          onChange={(e) => patch({ direction: e.target.value as Flight['direction'] })}
        >
          <option value="outbound">טיסת הלוך</option>
          <option value="return">טיסת חזור</option>
          <option value="internal">טיסה פנימית</option>
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <TextInput
            label="חברת תעופה"
            required
            autoFocus
            placeholder="Aegean Airlines"
            value={form.airline}
            error={touched ? errors.airline : undefined}
            onChange={(e) => patch({ airline: e.target.value })}
          />
          <TextInput
            label="מספר טיסה"
            dir="ltr"
            placeholder="A3 928"
            value={form.flightNumber}
            onChange={(e) => patch({ flightNumber: e.target.value })}
          />
        </div>

        <TextInput
          label="תאריך"
          required
          type="date"
          value={form.date}
          error={touched ? errors.date : undefined}
          onChange={(e) => patch({ date: e.target.value })}
        />

        <div className="rounded-2xl border border-line p-3.5 space-y-3">
          <p className="text-[12.5px] font-semibold text-muted">יציאה</p>
          <div className="grid grid-cols-3 gap-3">
            <TextInput
              label="קוד"
              dir="ltr"
              maxLength={4}
              placeholder="TLV"
              className="uppercase"
              value={form.fromCode}
              onChange={(e) => patch({ fromCode: e.target.value.toUpperCase() })}
            />
            <TextInput
              label="שדה תעופה"
              containerClassName="col-span-2"
              placeholder="נמל התעופה בן גוריון"
              value={form.fromName}
              onChange={(e) => patch({ fromName: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextInput
              label="שעה"
              type="time"
              value={form.departureTime}
              onChange={(e) => patch({ departureTime: e.target.value })}
            />
            <TextInput
              label="טרמינל"
              dir="ltr"
              value={form.fromTerminal}
              onChange={(e) => patch({ fromTerminal: e.target.value })}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-line p-3.5 space-y-3">
          <p className="text-[12.5px] font-semibold text-muted">נחיתה</p>
          <div className="grid grid-cols-3 gap-3">
            <TextInput
              label="קוד"
              dir="ltr"
              maxLength={4}
              placeholder="SKG"
              className="uppercase"
              value={form.toCode}
              onChange={(e) => patch({ toCode: e.target.value.toUpperCase() })}
            />
            <TextInput
              label="שדה תעופה"
              containerClassName="col-span-2"
              placeholder="Thessaloniki Makedonia"
              value={form.toName}
              onChange={(e) => patch({ toName: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextInput
              label="שעה"
              type="time"
              value={form.arrivalTime}
              onChange={(e) => patch({ arrivalTime: e.target.value })}
            />
            <TextInput
              label="טרמינל"
              dir="ltr"
              value={form.toTerminal}
              onChange={(e) => patch({ toTerminal: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.arrivesNextDay}
              onChange={(e) => patch({ arrivesNextDay: e.target.checked })}
              className="size-4.5 rounded accent-[var(--brand)]"
            />
            <span className="text-[13.5px]">נוחתים למחרת</span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextInput
            label="מחיר (סה״כ)"
            type="number"
            inputMode="decimal"
            min={0}
            prefix={CURRENCY_META[form.currency].symbol}
            value={form.price}
            error={touched ? errors.price : undefined}
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
          label="כבודה"
          placeholder="מזוודה 23 ק״ג + טרולי 8 ק״ג"
          value={form.baggage}
          onChange={(e) => patch({ baggage: e.target.value })}
        />
        <TextInput
          label="מושבים"
          dir="ltr"
          placeholder="12A–12E"
          value={form.seats}
          onChange={(e) => patch({ seats: e.target.value })}
        />
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

function toForm(flight: Flight | null, trip: Trip) {
  return {
    direction: flight?.direction ?? ('outbound' as Flight['direction']),
    airline: flight?.airline ?? '',
    flightNumber: flight?.flightNumber ?? '',
    date: flight?.date ?? trip.startDate,
    departureTime: flight?.departureTime ?? '',
    arrivalTime: flight?.arrivalTime ?? '',
    arrivesNextDay: !!flight?.arrivesNextDay,
    fromCode: flight?.from.code ?? '',
    fromName: flight?.from.name ?? '',
    fromTerminal: flight?.from.terminal ?? '',
    toCode: flight?.to.code ?? '',
    toName: flight?.to.name ?? '',
    toTerminal: flight?.to.terminal ?? '',
    baggage: flight?.baggage ?? '',
    price: flight?.price !== undefined ? String(flight.price) : '',
    currency: flight?.currency ?? trip.currencies[trip.currencies.length - 1] ?? trip.baseCurrency,
    bookingRef: flight?.bookingRef ?? '',
    bookingUrl: flight?.bookingUrl ?? '',
    seats: flight?.seats ?? '',
    notes: flight?.notes ?? '',
    booked: !!flight?.booked,
    paid: !!flight?.paid,
  };
}
