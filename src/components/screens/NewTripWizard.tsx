'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ArrowRight, Check, Minus, Plus, Sparkles } from 'lucide-react';
import { useTripStore, type CreateTripInput } from '@/lib/store/trip-store';
import { toast } from '@/lib/store/ui-store';
import { CURRENCIES, CURRENCY_META, type CurrencyCode } from '@/lib/types';
import { addDays, daysBetweenInclusive, formatDateRange, todayISO } from '@/lib/utils/date';
import { formatMoney, pluralDays } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextInput, Toggle } from '@/components/ui/Field';
import { COVER_PRESETS, CoverImage } from '@/components/layout/CoverImage';

/**
 * Four short steps rather than one long form. Nothing is required beyond a
 * name, a destination and dates — everything else has a working default.
 */
const STEPS = ['הטיול', 'תאריכים', 'מטיילים ותקציב', 'מה כלול'] as const;

interface Draft {
  name: string;
  destination: string;
  countryCode: string;
  coverImage: string;
  startDate: string;
  endDate: string;
  travelerNames: string[];
  baseCurrency: CurrencyCode;
  extraCurrency: CurrencyCode | '';
  totalBudget: string;
  seedFlights: boolean;
  seedCar: boolean;
  seedHotel: boolean;
}

export function NewTripWizard() {
  const router = useRouter();
  const createTrip = useTripStore((s) => s.createTrip);
  const [step, setStep] = useState(0);

  const [draft, setDraft] = useState<Draft>(() => {
    const start = addDays(todayISO(), 30);
    return {
      name: '',
      destination: '',
      countryCode: '',
      coverImage: 'greece',
      startDate: start,
      endDate: addDays(start, 6),
      travelerNames: ['אני', ''],
      baseCurrency: 'ILS',
      extraCurrency: 'EUR',
      totalBudget: '',
      seedFlights: true,
      seedCar: false,
      seedHotel: true,
    };
  });

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const nights = useMemo(() => {
    if (draft.endDate < draft.startDate) return 0;
    return daysBetweenInclusive(draft.startDate, draft.endDate);
  }, [draft.startDate, draft.endDate]);

  const errors = useMemo(() => {
    const e: Partial<Record<keyof Draft, string>> = {};
    if (step === 0) {
      if (!draft.name.trim()) e.name = 'צריך שם לטיול';
      if (!draft.destination.trim()) e.destination = 'צריך יעד';
    }
    if (step === 1) {
      if (!draft.startDate) e.startDate = 'צריך תאריך התחלה';
      if (!draft.endDate) e.endDate = 'צריך תאריך סיום';
      else if (draft.endDate < draft.startDate) e.endDate = 'תאריך הסיום לפני ההתחלה';
      else if (nights > 120) e.endDate = 'טיול ארוך מ-120 יום — כדאי לפצל לשני טיולים';
    }
    if (step === 2) {
      if (draft.travelerNames.filter((n) => n.trim()).length === 0) {
        e.travelerNames = 'צריך לפחות מטייל אחד';
      }
      const budget = Number(draft.totalBudget);
      if (draft.totalBudget && (!Number.isFinite(budget) || budget < 0)) {
        e.totalBudget = 'תקציב לא תקין';
      }
    }
    return e;
  }, [draft, step, nights]);

  const canAdvance = Object.keys(errors).length === 0;

  const submit = () => {
    const names = draft.travelerNames.map((n) => n.trim()).filter(Boolean);
    const currencies: CurrencyCode[] = draft.extraCurrency
      ? [draft.baseCurrency, draft.extraCurrency]
      : [draft.baseCurrency];

    const input: CreateTripInput = {
      name: draft.name.trim(),
      destination: draft.destination.trim(),
      countryCode: draft.countryCode.trim().toUpperCase().slice(0, 2),
      coverImage: draft.coverImage,
      startDate: draft.startDate,
      endDate: draft.endDate,
      travelerNames: names.length > 0 ? names : ['אני'],
      baseCurrency: draft.baseCurrency,
      currencies,
      totalBudget: Number(draft.totalBudget) || 0,
      seedFlights: draft.seedFlights,
      seedCar: draft.seedCar,
      seedHotel: draft.seedHotel,
    };

    createTrip(input);
    toast.success('הטיול נוצר — אפשר להתחיל לתכנן');
    router.push('/dashboard');
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 bg-bg/85 backdrop-blur-lg border-b border-line">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            type="button"
            onClick={() => (step === 0 ? router.push('/') : setStep((s) => s - 1))}
            aria-label="חזרה"
            className="-ms-2 size-9 grid place-items-center rounded-xl text-muted hover:bg-subtle hover:text-ink transition"
          >
            <ArrowRight className="size-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-[16px] leading-tight">טיול חדש</h1>
            <p className="text-[12px] text-muted">
              שלב {step + 1} מתוך {STEPS.length} · {STEPS[step]}
            </p>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-2.5">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  i <= step ? 'bg-brand' : 'bg-subtle'
                )}
              />
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-5 pb-32">
        {step === 0 && (
          <div className="space-y-5 animate-[slide-up_0.2s_ease-out]">
            <TextInput
              label="שם הטיול"
              required
              autoFocus
              placeholder="למשל: צפון יוון — אוגוסט 2026"
              value={draft.name}
              error={errors.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
            <TextInput
              label="יעד"
              required
              placeholder="למשל: צפון יוון"
              value={draft.destination}
              error={errors.destination}
              onChange={(e) => patch({ destination: e.target.value })}
            />
            <TextInput
              label="קוד מדינה"
              hint="שתי אותיות, לדגל על כרטיס הטיול. למשל GR, IT, TH"
              maxLength={2}
              placeholder="GR"
              className="uppercase"
              value={draft.countryCode}
              onChange={(e) => patch({ countryCode: e.target.value.toUpperCase() })}
            />

            <Field label="תמונת רקע">
              <div className="grid grid-cols-3 gap-2.5">
                {COVER_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => patch({ coverImage: preset.key })}
                    aria-pressed={draft.coverImage === preset.key}
                    className={cn(
                      'relative rounded-xl overflow-hidden ring-2 transition',
                      draft.coverImage === preset.key
                        ? 'ring-brand'
                        : 'ring-transparent hover:ring-line-strong'
                    )}
                  >
                    <CoverImage variant={preset.key} rounded={false} className="h-16" />
                    <span className="absolute inset-x-0 bottom-0 text-[11px] text-white font-medium py-1 text-center">
                      {preset.label}
                    </span>
                    {draft.coverImage === preset.key && (
                      <span className="absolute top-1.5 end-1.5 size-5 rounded-full bg-brand grid place-items-center">
                        <Check className="size-3 text-brand-contrast" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5 animate-[slide-up_0.2s_ease-out]">
            <div className="grid grid-cols-2 gap-3">
              <TextInput
                label="תאריך התחלה"
                type="date"
                required
                value={draft.startDate}
                error={errors.startDate}
                onChange={(e) => {
                  const startDate = e.target.value;
                  patch({
                    startDate,
                    endDate: draft.endDate < startDate ? startDate : draft.endDate,
                  });
                }}
              />
              <TextInput
                label="תאריך סיום"
                type="date"
                required
                min={draft.startDate}
                value={draft.endDate}
                error={errors.endDate}
                onChange={(e) => patch({ endDate: e.target.value })}
              />
            </div>

            {nights > 0 && !errors.endDate && (
              <div className="bg-brand-soft text-brand rounded-2xl px-4 py-3.5 text-[14px]">
                <p className="font-semibold ltr-nums">
                  {formatDateRange(draft.startDate, draft.endDate)}
                </p>
                <p className="text-[13px] opacity-85 mt-0.5">
                  {pluralDays(nights)} · ניצור לך {nights} ימים במסלול
                </p>
              </div>
            )}

            <Field label="קיצורי דרך">
              <div className="flex flex-wrap gap-2">
                {[3, 5, 7, 10, 14].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => patch({ endDate: addDays(draft.startDate, n - 1) })}
                    className="px-3 h-9 rounded-xl border border-line text-[13px] font-medium hover:bg-subtle transition"
                  >
                    {pluralDays(n)}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-[slide-up_0.2s_ease-out]">
            <Field
              label="מטיילים"
              error={errors.travelerNames}
              hint="השמות משמשים לחלוקת הוצאות משותפות"
            >
              <div className="space-y-2">
                {draft.travelerNames.map((name, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={name}
                      placeholder={`מטייל ${i + 1}`}
                      onChange={(e) => {
                        const next = [...draft.travelerNames];
                        next[i] = e.target.value;
                        patch({ travelerNames: next });
                      }}
                      className="flex-1 h-11 px-3 rounded-xl bg-inset border border-line text-[15px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
                    />
                    {draft.travelerNames.length > 1 && (
                      <button
                        type="button"
                        aria-label="הסרת מטייל"
                        onClick={() =>
                          patch({ travelerNames: draft.travelerNames.filter((_, j) => j !== i) })
                        }
                        className="size-11 grid place-items-center rounded-xl border border-line text-muted hover:text-danger hover:border-danger transition"
                      >
                        <Minus className="size-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => patch({ travelerNames: [...draft.travelerNames, ''] })}
                  className="w-full h-11 rounded-xl border border-dashed border-line text-[14px] text-muted hover:text-brand hover:border-brand transition inline-flex items-center justify-center gap-1.5"
                >
                  <Plus className="size-4" />
                  הוספת מטייל
                </button>
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="מטבע הטיול"
                value={draft.baseCurrency}
                onChange={(e) => patch({ baseCurrency: e.target.value as CurrencyCode })}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {CURRENCY_META[c].symbol} {CURRENCY_META[c].label} ({c})
                  </option>
                ))}
              </Select>
              <Select
                label="מטבע מקומי ביעד"
                hint="אפשר להוסיף עוד מטבעות בהגדרות"
                value={draft.extraCurrency}
                onChange={(e) => patch({ extraCurrency: e.target.value as CurrencyCode | '' })}
              >
                <option value="">ללא</option>
                {CURRENCIES.filter((c) => c !== draft.baseCurrency).map((c) => (
                  <option key={c} value={c}>
                    {CURRENCY_META[c].symbol} {CURRENCY_META[c].label} ({c})
                  </option>
                ))}
              </Select>
            </div>

            <TextInput
              label="תקציב כולל"
              type="number"
              inputMode="decimal"
              min={0}
              placeholder="35000"
              prefix={CURRENCY_META[draft.baseCurrency].symbol}
              hint="אפשר להשאיר ריק ולהגדיר מאוחר יותר"
              value={draft.totalBudget}
              error={errors.totalBudget}
              onChange={(e) => patch({ totalBudget: e.target.value })}
            />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-[slide-up_0.2s_ease-out]">
            <div className="bg-surface border border-line rounded-2xl px-4 divide-y divide-[var(--border)]">
              <Toggle
                checked={draft.seedFlights}
                onChange={(v) => patch({ seedFlights: v })}
                label="✈️ יש טיסות"
                description="ניצור שורות ריקות לטיסת הלוך וחזור"
              />
              <Toggle
                checked={draft.seedHotel}
                onChange={(v) => patch({ seedHotel: v })}
                label="🏨 יש מלונות"
                description="ניצור מלון ראשון לכל תקופת הטיול"
              />
              <Toggle
                checked={draft.seedCar}
                onChange={(v) => patch({ seedCar: v })}
                label="🚗 יש רכב שכור"
                description="ניצור שורת השכרה עם תאריכי הטיול"
              />
            </div>

            <Summary draft={draft} nights={nights} />
          </div>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 bg-surface/95 backdrop-blur-xl border-t border-line">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex gap-2.5">
          {step > 0 && (
            <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
              הקודם
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button fullWidth disabled={!canAdvance} onClick={() => setStep((s) => s + 1)}>
              המשך
            </Button>
          ) : (
            <Button fullWidth onClick={submit}>
              <Sparkles className="size-4" />
              יצירת הטיול
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Summary({ draft, nights }: { draft: Draft; nights: number }) {
  const budget = Number(draft.totalBudget) || 0;
  const people = draft.travelerNames.filter((n) => n.trim()).length || 1;
  return (
    <div className="rounded-2xl overflow-hidden border border-line">
      <CoverImage variant={draft.coverImage} rounded={false} className="h-28">
        <div className="h-28 flex flex-col justify-end p-4">
          <p className="text-white/85 text-[12px]">{draft.destination || 'יעד'}</p>
          <h2 className="text-white font-semibold text-[17px] truncate">
            {draft.name || 'הטיול שלי'}
          </h2>
        </div>
      </CoverImage>
      <dl className="bg-surface p-4 grid grid-cols-2 gap-x-4 gap-y-3 text-[13.5px]">
        <div>
          <dt className="text-muted text-[12px]">תאריכים</dt>
          <dd className="font-medium ltr-nums">
            {formatDateRange(draft.startDate, draft.endDate)}
          </dd>
        </div>
        <div>
          <dt className="text-muted text-[12px]">משך</dt>
          <dd className="font-medium">{pluralDays(nights)}</dd>
        </div>
        <div>
          <dt className="text-muted text-[12px]">מטיילים</dt>
          <dd className="font-medium">{people}</dd>
        </div>
        <div>
          <dt className="text-muted text-[12px]">תקציב</dt>
          <dd className="font-medium ltr-nums">
            {budget > 0 ? formatMoney(budget, draft.baseCurrency) : 'לא הוגדר'}
          </dd>
        </div>
      </dl>
    </div>
  );
}
