'use client';

import { useMemo, useState } from 'react';
import { BedDouble, ExternalLink, MapPin, Plus, Trash2, Users } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useActiveTrip } from '@/lib/store/hooks';
import { useTripStore } from '@/lib/store/trip-store';
import { toast } from '@/lib/store/ui-store';
import {
  CURRENCY_META,
  type CurrencyCode,
  type Hotel,
  type Trip,
} from '@/lib/types';
import {
  diffDays,
  eachDate,
  formatCompactRange,
  formatShortDate,
  todayISO,
} from '@/lib/utils/date';
import {
  formatMoney,
  googleMapsLink,
  pluralNights,
  safeExternalUrl,
} from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { Card, SectionTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select, TextArea, TextInput } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { ConfirmDialog, EmptyState } from '@/components/ui/Feedback';
import { Badge, DetailRow } from '@/components/ui/Bits';
import { Money } from '@/components/common/Money';
import { StatusChip } from '@/components/common/PaidToggle';

export function HotelsScreen() {
  const active = useActiveTrip();
  const addHotel = useTripStore((s) => s.addHotel);
  const updateHotel = useTripStore((s) => s.updateHotel);
  const deleteHotel = useTripStore((s) => s.deleteHotel);
  const undo = useTripStore((s) => s.undo);

  const [editing, setEditing] = useState<Hotel | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Hotel | null>(null);
  const today = todayISO();

  const coverage = useMemo(() => {
    if (!active) return { nights: 0, covered: 0, gaps: [] as string[] };
    const nights = eachDate(active.trip.startDate, active.trip.endDate).slice(0, -1);
    const gaps = nights.filter(
      (d) => !active.hotels.some((h) => d >= h.checkIn && d < h.checkOut)
    );
    return { nights: nights.length, covered: nights.length - gaps.length, gaps };
  }, [active]);

  if (!active) return null;
  const { trip, hotels } = active;

  return (
    <AppShell
      title="מלונות"
      subtitle={`${coverage.covered} מתוך ${coverage.nights} לילות מכוסים`}
      backHref="/more"
      actions={
        <Button
          size="sm"
          aria-label="הוספת מלון"
          onClick={() => {
            setEditing(null);
            setSheetOpen(true);
          }}
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">מלון</span>
        </Button>
      }
    >
      {coverage.gaps.length > 0 && (
        <div className="mb-4 rounded-2xl bg-warning-soft text-warning px-4 py-3">
          <p className="text-[13.5px] font-medium">
            ⚠️ {pluralNights(coverage.gaps.length)} ללא מלון
          </p>
          <p className="text-[12px] mt-0.5 opacity-90 ltr-nums">
            {coverage.gaps.slice(0, 6).map((d) => formatShortDate(d)).join(' · ')}
            {coverage.gaps.length > 6 && ' …'}
          </p>
        </div>
      )}

      {hotels.length === 0 ? (
        <EmptyState
          icon={<BedDouble className="size-6" />}
          title="עוד לא נוספו מלונות"
          description="כדאי להוסיף כל לינה בטיול, כדי שהמסלול והתקציב יידעו איפה אתם ישנים."
          action={
            <Button
              onClick={() => {
                setEditing(null);
                setSheetOpen(true);
              }}
            >
              <Plus className="size-4" />
              הוספת מלון
            </Button>
          }
        />
      ) : (
        <>
          <SectionTitle>ציר הלינות</SectionTitle>
          <ol className="relative space-y-3 ps-6">
            <span
              className="absolute top-2 bottom-2 start-[0.4375rem] w-px bg-line"
              aria-hidden
            />
            {hotels.map((hotel) => {
              const nights = Math.max(1, diffDays(hotel.checkIn, hotel.checkOut));
              const current = today >= hotel.checkIn && today < hotel.checkOut;
              const url = safeExternalUrl(hotel.bookingUrl);
              return (
                <li key={hotel.id} className="relative">
                  <span
                    className={cn(
                      'absolute -start-6 top-4 size-3.5 rounded-full border-2 border-[var(--bg)]',
                      current ? 'bg-success' : hotel.booked ? 'bg-brand' : 'bg-warning'
                    )}
                    aria-hidden
                  />
                  <Card className="overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(hotel);
                        setSheetOpen(true);
                      }}
                      className="w-full text-start p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[12px] font-semibold text-brand ltr-nums">
                              {formatCompactRange(hotel.checkIn, hotel.checkOut)}
                            </span>
                            <span className="text-[11.5px] text-muted">
                              {pluralNights(nights)}
                            </span>
                            {current && <Badge tone="success">כאן עכשיו</Badge>}
                          </div>
                          <h3 className="font-semibold text-[15px] mt-1 truncate">
                            🏨 {hotel.name || 'מלון ללא שם'}
                          </h3>
                          <p className="text-[12.5px] text-muted mt-0.5 truncate">
                            {hotel.city}
                            {hotel.address ? ` · ${hotel.address}` : ''}
                          </p>
                        </div>
                        {hotel.totalPrice !== undefined && (
                          <Money
                            amount={hotel.totalPrice}
                            currency={hotel.currency}
                            trip={trip}
                            className="text-[15px] font-semibold shrink-0"
                          />
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-3">
                        <StatusChip
                          active={!!hotel.booked}
                          activeLabel="מוזמן"
                          inactiveLabel="ללא הזמנה"
                        />
                        <StatusChip
                          active={!!hotel.paid}
                          activeLabel="שולם"
                          inactiveLabel="לא שולם"
                          tone="brand"
                        />
                        {hotel.rooms ? (
                          <Badge>
                            <Users className="size-3" />
                            {hotel.rooms} חדרים
                            {hotel.guests ? ` · ${hotel.guests} אורחים` : ''}
                          </Badge>
                        ) : null}
                        {hotel.pricePerNight !== undefined && (
                          <Badge>
                            <span className="ltr-nums">
                              {formatMoney(hotel.pricePerNight, hotel.currency)} / לילה
                            </span>
                          </Badge>
                        )}
                      </div>
                    </button>

                    <div className="flex items-center gap-1 px-3 pb-3">
                      {hotel.location && (
                        <a
                          href={googleMapsLink({ ...hotel.location, query: hotel.name })}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[12px] text-brand px-2 py-1 rounded-lg hover:bg-brand-soft transition"
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
                          className="inline-flex items-center gap-1 text-[12px] text-brand px-2 py-1 rounded-lg hover:bg-brand-soft transition"
                        >
                          <ExternalLink className="size-3.5" />
                          ההזמנה
                        </a>
                      )}
                      {hotel.bookingRef && (
                        <span className="text-[11.5px] text-faint ltr-nums px-2">
                          {hotel.bookingRef}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setPendingDelete(hotel)}
                        aria-label={`מחיקת ${hotel.name}`}
                        className="ms-auto p-1.5 rounded-lg text-faint hover:text-danger hover:bg-danger-soft transition"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ol>
        </>
      )}

      {/* Keyed so each open starts from the entity's saved values, with no
          state-syncing effect. */}
      <HotelSheet
        key={`${editing?.id ?? 'new'}:${sheetOpen}`}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        hotel={editing}
        trip={trip}
        onSave={(payload) => {
          if (editing) {
            updateHotel(editing.id, payload);
            toast.success('המלון עודכן');
          } else {
            addHotel({ ...payload, tripId: trip.id });
            toast.success('המלון נוסף');
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
        title={`למחוק את "${pendingDelete?.name || 'המלון'}"?`}
        message="הלינה תוסר מהציר ומהמפה. הוצאות מקושרות יישארו, ללא הקישור."
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const name = pendingDelete?.name ?? '';
          if (pendingDelete) deleteHotel(pendingDelete.id);
          setPendingDelete(null);
          setEditing(null);
          toast.show(`"${name}" נמחק`, {
            action: {
              label: 'בטל',
              onClick: () => {
                undo();
                toast.success('המלון שוחזר');
              },
            },
          });
        }}
      />
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */

type HotelPayload = Omit<Hotel, 'id' | 'tripId'>;

function HotelSheet({
  open,
  onClose,
  hotel,
  trip,
  onSave,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  hotel: Hotel | null;
  trip: Trip;
  onSave: (payload: HotelPayload) => void;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState(() => toForm(hotel, trip));
  const [touched, setTouched] = useState(false);


  const patch = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));

  const nights = useMemo(() => {
    if (!form.checkIn || !form.checkOut) return 0;
    return Math.max(0, diffDays(form.checkIn, form.checkOut));
  }, [form.checkIn, form.checkOut]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'צריך שם למלון';
    if (!form.checkIn) e.checkIn = 'צריך תאריך כניסה';
    if (!form.checkOut) e.checkOut = 'צריך תאריך יציאה';
    else if (form.checkOut <= form.checkIn) e.checkOut = 'היציאה חייבת להיות אחרי הכניסה';
    return e;
  }, [form]);

  const valid = Object.keys(errors).length === 0;

  // Filling one price side fills the other, which is what people expect.
  const syncFromPerNight = (v: string) => {
    const n = Number(v);
    patch({
      pricePerNight: v,
      totalPrice: Number.isFinite(n) && nights > 0 ? String(n * nights) : form.totalPrice,
    });
  };
  const syncFromTotal = (v: string) => {
    const n = Number(v);
    patch({
      totalPrice: v,
      pricePerNight:
        Number.isFinite(n) && nights > 0
          ? String(Math.round((n / nights) * 100) / 100)
          : form.pricePerNight,
    });
  };

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    const hasLocation = form.lat !== '' && form.lng !== '' && Number.isFinite(lat) && Number.isFinite(lng);
    onSave({
      name: form.name.trim(),
      city: form.city.trim(),
      address: form.address.trim() || undefined,
      location: hasLocation ? { lat, lng } : undefined,
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      checkInTime: form.checkInTime || undefined,
      checkOutTime: form.checkOutTime || undefined,
      pricePerNight: form.pricePerNight !== '' ? Number(form.pricePerNight) : undefined,
      totalPrice: form.totalPrice !== '' ? Number(form.totalPrice) : undefined,
      currency: form.currency,
      rooms: form.rooms !== '' ? Number(form.rooms) : undefined,
      guests: form.guests !== '' ? Number(form.guests) : undefined,
      bookingUrl: form.bookingUrl.trim() || undefined,
      bookingRef: form.bookingRef.trim() || undefined,
      cancellationPolicy: form.cancellationPolicy.trim() || undefined,
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
      title={hotel ? 'עריכת מלון' : 'מלון חדש'}
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
          label="שם המלון"
          required
          autoFocus
          value={form.name}
          error={touched ? errors.name : undefined}
          onChange={(e) => patch({ name: e.target.value })}
        />
        <TextInput label="עיר" value={form.city} onChange={(e) => patch({ city: e.target.value })} />
        <TextInput
          label="כתובת"
          value={form.address}
          onChange={(e) => patch({ address: e.target.value })}
        />

        <div className="grid grid-cols-2 gap-3">
          <TextInput
            label="Check-in"
            required
            type="date"
            value={form.checkIn}
            error={touched ? errors.checkIn : undefined}
            onChange={(e) => patch({ checkIn: e.target.value })}
          />
          <TextInput
            label="Check-out"
            required
            type="date"
            min={form.checkIn}
            value={form.checkOut}
            error={touched ? errors.checkOut : undefined}
            onChange={(e) => patch({ checkOut: e.target.value })}
          />
        </div>

        {nights > 0 && (
          <p className="text-[12.5px] text-brand bg-brand-soft rounded-xl px-3 py-2">
            {pluralNights(nights)}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <TextInput
            label="שעת כניסה"
            type="time"
            value={form.checkInTime}
            onChange={(e) => patch({ checkInTime: e.target.value })}
          />
          <TextInput
            label="שעת יציאה"
            type="time"
            value={form.checkOutTime}
            onChange={(e) => patch({ checkOutTime: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <TextInput
            label="מחיר ללילה"
            type="number"
            inputMode="decimal"
            min={0}
            prefix={CURRENCY_META[form.currency].symbol}
            value={form.pricePerNight}
            onChange={(e) => syncFromPerNight(e.target.value)}
          />
          <TextInput
            label="מחיר כולל"
            type="number"
            inputMode="decimal"
            min={0}
            prefix={CURRENCY_META[form.currency].symbol}
            value={form.totalPrice}
            onChange={(e) => syncFromTotal(e.target.value)}
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

        <div className="grid grid-cols-2 gap-3">
          <TextInput
            label="מספר חדרים"
            type="number"
            inputMode="numeric"
            min={0}
            value={form.rooms}
            onChange={(e) => patch({ rooms: e.target.value })}
          />
          <TextInput
            label="מספר אנשים"
            type="number"
            inputMode="numeric"
            min={0}
            value={form.guests}
            onChange={(e) => patch({ guests: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TextInput
            label="קו רוחב"
            inputMode="decimal"
            placeholder="40.6295"
            value={form.lat}
            onChange={(e) => patch({ lat: e.target.value })}
          />
          <TextInput
            label="קו אורך"
            inputMode="decimal"
            placeholder="22.9459"
            value={form.lng}
            onChange={(e) => patch({ lng: e.target.value })}
          />
        </div>

        <TextInput
          label="קישור להזמנה"
          type="url"
          dir="ltr"
          placeholder="https://"
          value={form.bookingUrl}
          onChange={(e) => patch({ bookingUrl: e.target.value })}
        />
        <TextInput
          label="מספר הזמנה"
          dir="ltr"
          value={form.bookingRef}
          onChange={(e) => patch({ bookingRef: e.target.value })}
        />
        <TextInput
          label="מדיניות ביטול"
          value={form.cancellationPolicy}
          onChange={(e) => patch({ cancellationPolicy: e.target.value })}
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

        {hotel && (
          <div className="pt-2">
            <DetailRow label="מזהה הזמנה" value={hotel.bookingRef} ltr />
          </div>
        )}
      </div>
    </Sheet>
  );
}

function toForm(hotel: Hotel | null, trip: Trip) {
  return {
    name: hotel?.name ?? '',
    city: hotel?.city ?? trip.destination,
    address: hotel?.address ?? '',
    lat: hotel?.location ? String(hotel.location.lat) : '',
    lng: hotel?.location ? String(hotel.location.lng) : '',
    checkIn: hotel?.checkIn ?? trip.startDate,
    checkOut: hotel?.checkOut ?? trip.endDate,
    checkInTime: hotel?.checkInTime ?? '',
    checkOutTime: hotel?.checkOutTime ?? '',
    pricePerNight: hotel?.pricePerNight !== undefined ? String(hotel.pricePerNight) : '',
    totalPrice: hotel?.totalPrice !== undefined ? String(hotel.totalPrice) : '',
    currency: hotel?.currency ?? trip.currencies[trip.currencies.length - 1] ?? trip.baseCurrency,
    rooms: hotel?.rooms !== undefined ? String(hotel.rooms) : '',
    guests: hotel?.guests !== undefined ? String(hotel.guests) : '',
    bookingUrl: hotel?.bookingUrl ?? '',
    bookingRef: hotel?.bookingRef ?? '',
    cancellationPolicy: hotel?.cancellationPolicy ?? '',
    notes: hotel?.notes ?? '',
    booked: !!hotel?.booked,
    paid: !!hotel?.paid,
  };
}
