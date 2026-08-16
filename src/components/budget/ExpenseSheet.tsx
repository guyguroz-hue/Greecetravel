'use client';

import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  CURRENCY_META,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_META,
  type CurrencyCode,
  type Expense,
  type ExpenseCategory,
  type Traveler,
  type Trip,
} from '@/lib/types';
import { todayISO } from '@/lib/utils/date';
import { convert } from '@/lib/services/currency';
import { formatApprox } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { useTripStore } from '@/lib/store/trip-store';
import { toast } from '@/lib/store/ui-store';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextArea, TextInput } from '@/components/ui/Field';
import { Avatar } from '@/components/ui/Bits';

interface Draft {
  date: string;
  category: ExpenseCategory;
  description: string;
  amount: string;
  currency: CurrencyCode;
  paid: boolean;
  paidById: string;
  splitBetween: string[];
  notes: string;
}

export function ExpenseSheet({
  open,
  onClose,
  expense,
  trip,
  travelers,
  defaults,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  expense: Expense | null;
  trip: Trip;
  travelers: Traveler[];
  defaults?: Partial<Draft>;
  onDelete?: () => void;
}) {
  const addExpense = useTripStore((s) => s.addExpense);
  const updateExpense = useTripStore((s) => s.updateExpense);
  const [touched, setTouched] = useState(false);

  const [draft, setDraft] = useState<Draft>(() => initial(expense, trip, travelers, defaults));

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const errors = useMemo(() => {
    const e: Partial<Record<keyof Draft, string>> = {};
    if (!draft.description.trim()) e.description = 'צריך תיאור';
    const amount = Number(draft.amount);
    if (draft.amount === '' || !Number.isFinite(amount)) e.amount = 'צריך סכום';
    else if (amount < 0) e.amount = 'הסכום לא יכול להיות שלילי';
    if (!draft.date) e.date = 'צריך תאריך';
    if (draft.splitBetween.length === 0) e.splitBetween = 'צריך לבחור לפחות מטייל אחד';
    return e;
  }, [draft]);

  const valid = Object.keys(errors).length === 0;

  const converted = useMemo(() => {
    const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || draft.currency === trip.baseCurrency) return null;
    return formatApprox(
      convert(amount, draft.currency, trip.baseCurrency, trip.rates),
      trip.baseCurrency
    );
  }, [draft.amount, draft.currency, trip]);

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    const payload = {
      tripId: trip.id,
      date: draft.date,
      category: draft.category,
      description: draft.description.trim(),
      amount: Number(draft.amount),
      currency: draft.currency,
      paid: draft.paid,
      paidById: draft.paidById || undefined,
      splitBetween: draft.splitBetween,
      notes: draft.notes.trim() || undefined,
    };
    if (expense) {
      updateExpense(expense.id, payload);
      toast.success('ההוצאה עודכנה');
    } else {
      addExpense(payload);
      toast.success('ההוצאה נוספה');
    }
    onClose();
  };

  const toggleSplit = (id: string) => {
    patch({
      splitBetween: draft.splitBetween.includes(id)
        ? draft.splitBetween.filter((x) => x !== id)
        : [...draft.splitBetween, id],
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={expense ? 'עריכת הוצאה' : 'הוצאה חדשה'}
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
          label="תיאור"
          required
          autoFocus
          placeholder="למשל: ארוחת ערב בנאוס מרמרס"
          value={draft.description}
          error={touched ? errors.description : undefined}
          onChange={(e) => patch({ description: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />

        <div className="grid grid-cols-2 gap-3">
          <TextInput
            label="סכום"
            required
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="0"
            prefix={CURRENCY_META[draft.currency].symbol}
            value={draft.amount}
            error={touched ? errors.amount : undefined}
            hint={converted ?? undefined}
            onChange={(e) => patch({ amount: e.target.value })}
          />
          <Select
            label="מטבע"
            value={draft.currency}
            onChange={(e) => patch({ currency: e.target.value as CurrencyCode })}
          >
            {trip.currencies.map((c) => (
              <option key={c} value={c}>
                {CURRENCY_META[c].symbol} {CURRENCY_META[c].label} ({c})
              </option>
            ))}
          </Select>
        </div>

        <TextInput
          label="תאריך"
          required
          type="date"
          value={draft.date}
          error={touched ? errors.date : undefined}
          onChange={(e) => patch({ date: e.target.value })}
        />

        <Field label="קטגוריה">
          <div className="flex flex-wrap gap-1.5">
            {EXPENSE_CATEGORIES.map((key) => {
              const meta = EXPENSE_CATEGORY_META[key];
              const active = draft.category === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => patch({ category: key })}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex items-center gap-1 px-2.5 h-8 rounded-lg text-[12.5px] font-medium border transition',
                    active ? 'border-transparent text-white' : 'border-line text-muted hover:bg-subtle'
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

        <label className="flex items-center gap-2.5 py-1 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.paid}
            onChange={(e) => patch({ paid: e.target.checked })}
            className="size-4.5 rounded accent-[var(--brand)]"
          />
          <span className="text-[14px]">ההוצאה כבר שולמה</span>
        </label>

        {travelers.length > 0 && (
          <Select
            label="מי שילם"
            value={draft.paidById}
            onChange={(e) => patch({ paidById: e.target.value })}
          >
            <option value="">לא צוין</option>
            {travelers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        )}

        {travelers.length > 1 && (
          <Field
            label="חלוקה בין"
            error={touched ? errors.splitBetween : undefined}
            hint="ההוצאה תתחלק שווה בשווה בין הנבחרים"
          >
            <div className="flex flex-wrap gap-1.5">
              {travelers.map((t) => {
                const on = draft.splitBetween.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleSplit(t.id)}
                    aria-pressed={on}
                    className={cn(
                      'inline-flex items-center gap-1.5 ps-1 pe-2.5 h-9 rounded-full border transition text-[13px] font-medium',
                      on
                        ? 'border-brand bg-brand-soft text-brand'
                        : 'border-line text-muted hover:bg-subtle'
                    )}
                  >
                    <Avatar name={t.name} color={t.color} size="sm" />
                    {t.name}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => patch({ splitBetween: travelers.map((t) => t.id) })}
                className="text-[12px] text-brand font-medium"
              >
                כולם
              </button>
              <span className="text-faint">·</span>
              <button
                type="button"
                onClick={() => patch({ splitBetween: [] })}
                className="text-[12px] text-muted"
              >
                ניקוי
              </button>
            </div>
          </Field>
        )}

        <TextArea
          label="הערות"
          value={draft.notes}
          onChange={(e) => patch({ notes: e.target.value })}
        />
      </div>
    </Sheet>
  );
}

function initial(
  expense: Expense | null,
  trip: Trip,
  travelers: Traveler[],
  defaults?: Partial<Draft>
): Draft {
  return {
    date: expense?.date ?? defaults?.date ?? todayISO(),
    category: expense?.category ?? defaults?.category ?? 'other',
    description: expense?.description ?? defaults?.description ?? '',
    amount:
      expense?.amount !== undefined ? String(expense.amount) : (defaults?.amount ?? ''),
    currency:
      expense?.currency ??
      defaults?.currency ??
      trip.currencies[trip.currencies.length - 1] ??
      trip.baseCurrency,
    paid: expense?.paid ?? defaults?.paid ?? false,
    paidById: expense?.paidById ?? defaults?.paidById ?? travelers[0]?.id ?? '',
    splitBetween:
      expense?.splitBetween && expense.splitBetween.length > 0
        ? expense.splitBetween
        : (defaults?.splitBetween ?? travelers.map((t) => t.id)),
    notes: expense?.notes ?? defaults?.notes ?? '',
  };
}
