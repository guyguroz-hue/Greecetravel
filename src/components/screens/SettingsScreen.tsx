'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import {
  ChevronLeft,
  Check,
  Download,
  Globe,
  Moon,
  Pencil,
  RefreshCw,
  Share2,
  Sun,
  Trash2,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useActiveTrip } from '@/lib/store/hooks';
import { useTripStore } from '@/lib/store/trip-store';
import { toast, useSettingsStore, type ThemePreference } from '@/lib/store/ui-store';
import { refreshRates } from '@/lib/services/currency';
import { CURRENCIES, CURRENCY_META, type CurrencyCode } from '@/lib/types';
import { formatDateRange, formatShortDate } from '@/lib/utils/date';
import { cn } from '@/lib/utils/cn';
import { Card, SectionTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Segmented, Select, TextInput, Toggle } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { ConfirmDialog } from '@/components/ui/Feedback';
import { Avatar, Badge } from '@/components/ui/Bits';
import { CloudAccountCard } from '@/components/settings/CloudAccountCard';
import { useAuthStore } from '@/lib/store/auth-store';
import { isSupabaseConfigured } from '@/lib/supabase/client';

export function SettingsScreen() {
  const active = useActiveTrip();
  const authStatus = useAuthStore((s) => s.status);
  const updateTrip = useTripStore((s) => s.updateTrip);
  const addTraveler = useTripStore((s) => s.addTraveler);
  const updateTraveler = useTripStore((s) => s.updateTraveler);
  const removeTraveler = useTripStore((s) => s.removeTraveler);
  const exportData = useTripStore((s) => s.exportData);
  const importData = useTripStore((s) => s.importData);
  const clearAll = useTripStore((s) => s.clearAll);

  const settings = useSettingsStore();

  const [tripSheet, setTripSheet] = useState(false);
  const [travelerName, setTravelerName] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  if (!active) return null;
  const { trip, travelers } = active;

  const supabaseAvailable = isSupabaseConfigured;
  // Real sharing needs both a backend and a signed-in user.
  const cloudReady = supabaseAvailable && authStatus === 'signed-in';

  const doExport = () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-trip-planner-${formatShortDate(new Date().toISOString().slice(0, 10))}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success('קובץ הגיבוי הורד');
  };

  const doImport = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const result = importData(text);
    if (result.ok) toast.success(result.message);
    else toast.error(result.message);
    if (fileInput.current) fileInput.current.value = '';
  };

  const doRefreshRates = async () => {
    setRefreshing(true);
    try {
      const result = await refreshRates(trip.baseCurrency, trip.currencies, trip.rates);
      updateTrip(trip.id, {
        rates: result.rates,
        ratesSource: result.source,
        ratesUpdatedAt: result.fetchedAt,
      });
      toast.success('שערי ההמרה עודכנו');
    } catch {
      toast.error('לא הצלחנו למשוך שערים. אפשר להזין ידנית.');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <AppShell title="הגדרות" subtitle={trip.name} backHref="/more">
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(e) => void doImport(e.target.files?.[0])}
      />

      <CloudAccountCard />

      {/* ---------------- trip ---------------- */}
      <section className="mb-5">
        <SectionTitle
          action={
            <button
              type="button"
              onClick={() => setTripSheet(true)}
              className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand"
            >
              <Pencil className="size-3.5" />
              עריכה
            </button>
          }
        >
          פרטי הטיול
        </SectionTitle>
        <Card className="p-4 space-y-2.5">
          <Line label="שם" value={trip.name} />
          <Line label="יעד" value={trip.destination} />
          <Line label="תאריכים" value={formatDateRange(trip.startDate, trip.endDate)} ltr />
          <Line
            label="תקציב"
            value={`${CURRENCY_META[trip.baseCurrency].symbol}${trip.totalBudget.toLocaleString('en-US')}`}
            ltr
          />
          <Line label="מטבע ראשי" value={`${trip.baseCurrency} · ${CURRENCY_META[trip.baseCurrency].label}`} />
        </Card>
      </section>

      {/* ---------------- travelers ---------------- */}
      <section className="mb-5">
        <SectionTitle>מטיילים</SectionTitle>
        <Card className="divide-y divide-[var(--border)]">
          {travelers.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={t.name} color={t.color} />
              <input
                value={t.name}
                onChange={(e) => updateTraveler(t.id, { name: e.target.value })}
                aria-label={`שם המטייל ${t.name}`}
                className="flex-1 min-w-0 bg-transparent text-[14.5px] font-medium outline-none focus:bg-inset rounded-lg px-2 h-9 transition"
              />
              {t.isOwner ? (
                <Badge tone="brand">בעלים</Badge>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    removeTraveler(t.id);
                    toast.show(`${t.name} הוסר מהטיול`);
                  }}
                  aria-label={`הסרת ${t.name}`}
                  className="shrink-0 p-1.5 rounded-lg text-faint hover:text-danger hover:bg-danger-soft transition"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          ))}

          <div className="flex gap-2 px-4 py-3">
            <input
              value={travelerName}
              onChange={(e) => setTravelerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && travelerName.trim()) {
                  addTraveler(trip.id, travelerName);
                  setTravelerName('');
                }
              }}
              placeholder="שם מטייל חדש"
              className="flex-1 h-10 px-3 rounded-xl bg-inset border border-line text-[14px] outline-none focus:border-brand transition"
            />
            <Button
              size="sm"
              disabled={!travelerName.trim()}
              onClick={() => {
                addTraveler(trip.id, travelerName);
                setTravelerName('');
                toast.success('המטייל נוסף');
              }}
            >
              <UserPlus className="size-4" />
              הוספה
            </Button>
          </div>
        </Card>
      </section>

      {/* ---------------- currencies ---------------- */}
      <section className="mb-5">
        <SectionTitle
          action={
            <button
              type="button"
              onClick={() => void doRefreshRates()}
              disabled={refreshing}
              className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand disabled:opacity-50"
            >
              <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
              עדכון שערים
            </button>
          }
        >
          מטבעות ושערי המרה
        </SectionTitle>
        <Card className="p-4 space-y-3">
          <Select
            label="הוספת מטבע לטיול"
            value=""
            onChange={(e) => {
              const code = e.target.value as CurrencyCode;
              if (!code || trip.currencies.includes(code)) return;
              updateTrip(trip.id, {
                currencies: [...trip.currencies, code],
                rates: { ...trip.rates, [code]: trip.rates[code] ?? 1 },
              });
              toast.success(`${code} נוסף לטיול`);
            }}
          >
            <option value="">בחרי מטבע…</option>
            {CURRENCIES.filter((c) => !trip.currencies.includes(c)).map((c) => (
              <option key={c} value={c}>
                {CURRENCY_META[c].symbol} {CURRENCY_META[c].label} ({c})
              </option>
            ))}
          </Select>

          {trip.currencies.map((code) => (
            <div key={code} className="rounded-xl bg-inset px-3 py-2.5">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[13.5px] font-medium">
                  {CURRENCY_META[code].symbol} {code} · {CURRENCY_META[code].label}
                </span>
                {code === trip.baseCurrency ? (
                  <Badge tone="brand">מטבע הטיול</Badge>
                ) : (
                  trip.currencies.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        updateTrip(trip.id, {
                          currencies: trip.currencies.filter((c) => c !== code),
                        })
                      }
                      aria-label={`הסרת ${code}`}
                      className="shrink-0 p-1 rounded-lg text-faint hover:text-danger transition"
                    >
                      <X className="size-4" />
                    </button>
                  )
                )}
              </div>
              {code !== trip.baseCurrency && (
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-muted shrink-0 ltr-nums">1 {code} =</span>
                  <input
                    type="number"
                    step="0.0001"
                    min={0}
                    dir="ltr"
                    value={trip.rates[code] ?? ''}
                    onChange={(e) =>
                      updateTrip(trip.id, {
                        rates: { ...trip.rates, [code]: Number(e.target.value) || 0 },
                        ratesSource: 'manual',
                      })
                    }
                    aria-label={`שער עבור ${code}`}
                    className="min-w-0 flex-1 h-10 px-3 rounded-xl bg-surface border border-line text-[14px] outline-none focus:border-brand transition"
                  />
                  <span className="text-[12px] text-muted shrink-0">{trip.baseCurrency}</span>
                </div>
              )}
            </div>
          ))}

          <p className="text-[11.5px] text-faint pt-1">
            {trip.ratesUpdatedAt
              ? `עודכן לאחרונה ${formatShortDate(trip.ratesUpdatedAt.slice(0, 10))} · ${
                  trip.ratesSource === 'api' ? 'שער מקוון' : 'שער ידני'
                }`
              : 'שערים ידניים — אפשר לעדכן משער חליפין מקוון'}
          </p>
        </Card>
      </section>

      {/* ---------------- sharing ---------------- */}
      <section className="mb-5">
        <SectionTitle>שיתוף</SectionTitle>
        <Link
          href="/share"
          className="flex items-center gap-3.5 rounded-2xl border border-line bg-surface px-4 py-3.5 hover:bg-subtle transition"
        >
          <Share2 className="size-[18px] shrink-0 stroke-[1.5] text-muted" />
          <span className="flex-1 text-[14.5px]">מי בטיול הזה</span>
          <ChevronLeft className="size-4 text-faint shrink-0" />
        </Link>
      </section>

      {/* ---------------- app ---------------- */}
      <section className="mb-5">
        <SectionTitle>תצוגה והתנהגות</SectionTitle>
        <Card className="p-4 space-y-3">
          <div>
            <p className="text-[13px] font-medium text-muted mb-2">ערכת נושא</p>
            <Segmented
              value={settings.theme}
              onChange={(v) => settings.setTheme(v as ThemePreference)}
              options={[
                {
                  value: 'system',
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <Globe className="size-3.5" />
                      מערכת
                    </span>
                  ),
                },
                {
                  value: 'light',
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <Sun className="size-3.5" />
                      בהיר
                    </span>
                  ),
                },
                {
                  value: 'dark',
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <Moon className="size-3.5" />
                      כהה
                    </span>
                  ),
                },
              ]}
            />
          </div>

          <div className="divide-y divide-[var(--border)]">
            <Toggle
              checked={settings.showConversions}
              onChange={settings.setShowConversions}
              label="הצגת המרה למטבע הטיול"
              description="מציג ‎≈ ₪1,720 מתחת לכל סכום במטבע זר"
            />
            <Toggle
              checked={settings.liveRouting}
              onChange={settings.setLiveRouting}
              label="זמני נסיעה מדויקים (מקוון)"
              description="משתמש בשירות ניתוב דרכים במקום בהערכה מקומית. דורש אינטרנט."
            />
            <Toggle
              checked={settings.onlineSearch}
              onChange={settings.setOnlineSearch}
              label="חיפוש מקומות מקוון"
              description="מחפש מקומות ב-OpenStreetMap. בלי זה מסך החיפוש לא יחזיר תוצאות."
            />
          </div>
        </Card>
      </section>

      {/* ---------------- data ---------------- */}
      <section>
        <SectionTitle>נתונים</SectionTitle>
        <Card className="p-4 space-y-2.5">
          <p className="text-[12.5px] text-muted leading-relaxed">
            {cloudReady
              ? 'הטיולים שלך שמורים בחשבון ומסונכרנים בין המכשירים. עותק נשמר גם במכשיר הזה כדי שהאפליקציה תעבוד גם בלי רשת.'
              : 'כל נתוני הטיול נשמרים בדפדפן של המכשיר הזה בלבד ולא נשלחים לשום מקום. כדאי לייצא גיבוי לפני נסיעה, ולייבא אותו במכשיר נוסף.'}
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="secondary" onClick={doExport}>
              <Download className="size-4" />
              ייצוא גיבוי
            </Button>
            <Button variant="secondary" onClick={() => fileInput.current?.click()}>
              <Upload className="size-4" />
              ייבוא גיבוי
            </Button>
          </div>

          {/* Wiping only makes sense for device-local data — in cloud mode it
              would look like it deleted everyone's trip. */}
          {cloudReady ? (
            <p className="text-[11.5px] text-faint leading-relaxed pt-1">
              למחיקת טיול מהחשבון — פותחים את ״הטיולים שלי״ ומוחקים אותו משם. המחיקה משפיעה על
              כל מי שמשתתף בטיול.
            </p>
          ) : (
            <Button
              variant="ghost"
              fullWidth
              className="text-danger hover:bg-danger-soft"
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 className="size-4" />
              מחיקת הכל
            </Button>
          )}
        </Card>
      </section>

      {/* ---------------- trip edit sheet ---------------- */}
      <TripSheet key={String(tripSheet)} open={tripSheet} onClose={() => setTripSheet(false)} />

      <ConfirmDialog
        open={confirmClear}
        title="למחוק את כל הנתונים?"
        message="כל הטיולים, המסלולים, ההוצאות והמסמכים יימחקו מהמכשיר. פעולה זו אינה ניתנת לביטול — כדאי לייצא גיבוי קודם."
        confirmLabel="מחיקת הכל"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          void clearAll();
          setConfirmClear(false);
          toast.show('כל הנתונים נמחקו');
        }}
      />
    </AppShell>
  );
}

function Line({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[13px] text-muted shrink-0">{label}</span>
      <span className={cn('text-[14px] font-medium text-end truncate', ltr && 'ltr-nums')}>
        {value}
      </span>
    </div>
  );
}

function TripSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const active = useActiveTrip();
  const updateTrip = useTripStore((s) => s.updateTrip);
  // The parent keys this component on `open`, so the initialiser runs afresh
  // every time the sheet is opened — no state-syncing effect needed.
  const [form, setForm] = useState(() => ({
    name: active?.trip.name ?? '',
    destination: active?.trip.destination ?? '',
    countryCode: active?.trip.countryCode ?? '',
    startDate: active?.trip.startDate ?? '',
    endDate: active?.trip.endDate ?? '',
    totalBudget: String(active?.trip.totalBudget ?? 0),
    baseCurrency: (active?.trip.baseCurrency ?? 'ILS') as CurrencyCode,
  }));

  if (!active) return null;
  const patch = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));
  const datesValid = !!form.startDate && !!form.endDate && form.endDate >= form.startDate;
  const valid = form.name.trim().length > 0 && datesValid;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="עריכת פרטי הטיול"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={onClose}>
            ביטול
          </Button>
          <Button
            fullWidth
            disabled={!valid}
            onClick={() => {
              updateTrip(active.trip.id, {
                name: form.name.trim(),
                destination: form.destination.trim(),
                countryCode: form.countryCode.trim().toUpperCase().slice(0, 2),
                startDate: form.startDate,
                endDate: form.endDate,
                totalBudget: Number(form.totalBudget) || 0,
                baseCurrency: form.baseCurrency,
              });
              toast.success('פרטי הטיול עודכנו');
              onClose();
            }}
          >
            <Check className="size-4" />
            שמירה
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pb-4">
        <TextInput
          label="שם הטיול"
          required
          value={form.name}
          onChange={(e) => patch({ name: e.target.value })}
        />
        <TextInput
          label="יעד"
          value={form.destination}
          onChange={(e) => patch({ destination: e.target.value })}
        />
        <TextInput
          label="קוד מדינה"
          maxLength={2}
          className="uppercase"
          value={form.countryCode}
          onChange={(e) => patch({ countryCode: e.target.value.toUpperCase() })}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextInput
            label="תאריך התחלה"
            type="date"
            value={form.startDate}
            onChange={(e) => patch({ startDate: e.target.value })}
          />
          <TextInput
            label="תאריך סיום"
            type="date"
            min={form.startDate}
            value={form.endDate}
            error={!datesValid ? 'טווח תאריכים לא תקין' : undefined}
            onChange={(e) => patch({ endDate: e.target.value })}
          />
        </div>
        <p className="text-[12px] text-muted bg-inset rounded-xl px-3 py-2.5 leading-relaxed">
          שינוי התאריכים יעדכן את ימי המסלול. ימים שיוצאים מהטווח החדש — הפעילויות שלהם יעברו ליום
          האחרון, ולא יימחקו.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <TextInput
            label="תקציב כולל"
            type="number"
            inputMode="decimal"
            min={0}
            prefix={CURRENCY_META[form.baseCurrency].symbol}
            value={form.totalBudget}
            onChange={(e) => patch({ totalBudget: e.target.value })}
          />
          <Select
            label="מטבע ראשי"
            value={form.baseCurrency}
            onChange={(e) => patch({ baseCurrency: e.target.value as CurrencyCode })}
          >
            {active.trip.currencies.map((c) => (
              <option key={c} value={c}>
                {CURRENCY_META[c].symbol} {c}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </Sheet>
  );
}
