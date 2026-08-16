'use client';

import { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Filter,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AppShell } from '@/components/layout/AppShell';
import { useActiveTrip } from '@/lib/store/hooks';
import { useTripStore } from '@/lib/store/trip-store';
import { toast } from '@/lib/store/ui-store';
import {
  computeBalances,
  computeBudget,
  computeCategoryTotals,
  computeSettlements,
} from '@/lib/selectors/budget';
import {
  CURRENCY_META,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_META,
  type Expense,
  type ExpenseCategory,
} from '@/lib/types';
import { formatDayMonth } from '@/lib/utils/date';
import { formatMoney, formatPercent } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { Card, SectionTitle, Stat } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Segmented, Select } from '@/components/ui/Field';
import { ConfirmDialog, EmptyState } from '@/components/ui/Feedback';
import { Avatar, ProgressBar } from '@/components/ui/Bits';
import { Money } from '@/components/common/Money';
import { StatusChip } from '@/components/common/PaidToggle';
import { QuickAddBar } from '@/components/budget/QuickAddBar';
import { ExpenseSheet } from '@/components/budget/ExpenseSheet';

type Tab = 'overview' | 'expenses' | 'split';

export function BudgetScreen() {
  const active = useActiveTrip();
  const updateExpense = useTripStore((s) => s.updateExpense);
  const deleteExpense = useTripStore((s) => s.deleteExpense);
  const undo = useTripStore((s) => s.undo);

  const [tab, setTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState<Expense | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | 'all'>('all');
  const [paidFilter, setPaidFilter] = useState<'all' | 'paid' | 'unpaid'>('all');

  const derived = useMemo(() => {
    if (!active) return null;
    const { trip, expenses, travelers } = active;
    const budget = computeBudget(trip, expenses, travelers.length);
    const categories = computeCategoryTotals(trip, expenses);
    const balances = computeBalances(trip, expenses, travelers);
    const settlements = computeSettlements(balances);
    return { budget, categories, balances, settlements };
  }, [active]);

  const filtered = useMemo(() => {
    if (!active) return [];
    const q = query.trim().toLowerCase();
    return active.expenses.filter((e) => {
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
      if (paidFilter === 'paid' && !e.paid) return false;
      if (paidFilter === 'unpaid' && e.paid) return false;
      if (q && !`${e.description} ${e.notes ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [active, query, categoryFilter, paidFilter]);

  if (!active || !derived) return null;
  const { trip, travelers } = active;
  const { budget, categories, balances, settlements } = derived;
  const overBudget = budget.remaining < 0;

  return (
    <AppShell
      title="תקציב"
      subtitle={`${formatMoney(budget.planned, trip.baseCurrency)} מתוך ${formatMoney(
        trip.totalBudget,
        trip.baseCurrency
      )}`}
      actions={
        <Button
          size="sm"
          aria-label="הוספת הוצאה"
          onClick={() => {
            setEditing(null);
            setSheetOpen(true);
          }}
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">הוצאה</span>
        </Button>
      }
    >
      <Segmented
        value={tab}
        onChange={setTab}
        className="mb-4"
        options={[
          { value: 'overview', label: 'סקירה' },
          { value: 'expenses', label: `הוצאות (${active.expenses.length})` },
          { value: 'split', label: 'חלוקה' },
        ]}
      />

      {tab === 'overview' && (
        <div className="space-y-5">
          {/* headline */}
          <Card className="p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] text-muted">תקציב כולל</span>
              <span className="text-2xl font-semibold ltr-nums">
                {formatMoney(trip.totalBudget, trip.baseCurrency)}
              </span>
            </div>
            <ProgressBar
              className="my-3.5 h-2.5"
              max={Math.max(trip.totalBudget, budget.planned, 1)}
              value={budget.planned}
              segments={[
                { value: budget.paid, color: 'var(--brand)' },
                {
                  value: Math.max(0, budget.upcoming),
                  color: 'color-mix(in oklab, var(--brand) 32%, transparent)',
                },
              ]}
            />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13.5px]">
              <Row label="מתוכנן" value={formatMoney(budget.planned, trip.baseCurrency)} />
              <Row
                label="שולם"
                value={formatMoney(budget.paid, trip.baseCurrency)}
                tone="success"
              />
              <Row
                label="עוד לתשלום"
                value={formatMoney(budget.upcoming, trip.baseCurrency)}
                tone="warning"
              />
              <Row
                label={overBudget ? 'חריגה' : 'נותר'}
                value={formatMoney(Math.abs(budget.remaining), trip.baseCurrency)}
                tone={overBudget ? 'danger' : 'success'}
              />
            </dl>
            {overBudget && (
              <p className="mt-3 text-[12.5px] text-danger bg-danger-soft rounded-xl px-3 py-2">
                ⚠️ ההוצאות המתוכננות חורגות מהתקציב ב-
                {formatMoney(Math.abs(budget.remaining), trip.baseCurrency)}.
              </p>
            )}
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Stat
              icon={<Wallet className="size-3.5" />}
              label="עלות לאדם"
              value={formatMoney(budget.perPerson, trip.baseCurrency)}
              hint={`${budget.travelers} מטיילים`}
            />
            <Stat
              icon={<TrendingUp className="size-3.5" />}
              label="עלות ליום"
              value={formatMoney(budget.perDay, trip.baseCurrency)}
              hint={`${budget.days} ימים`}
            />
          </div>

          {categories.length > 0 ? (
            <>
              <section>
                <SectionTitle>פילוח לפי קטגוריה</SectionTitle>
                <Card className="p-4">
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categories}
                          dataKey="planned"
                          nameKey="label"
                          innerRadius="56%"
                          outerRadius="88%"
                          paddingAngle={2}
                          stroke="var(--bg-elevated)"
                          strokeWidth={2}
                        >
                          {categories.map((c) => (
                            <Cell key={c.category} fill={c.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number, name: string) => [
                            formatMoney(value, trip.baseCurrency),
                            name,
                          ]}
                          contentStyle={{
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border)',
                            borderRadius: 12,
                            fontSize: 13,
                            direction: 'rtl',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <ul className="mt-3 space-y-2.5">
                    {categories.map((c) => (
                      <li key={c.category}>
                        <div className="flex items-center justify-between gap-3 text-[13.5px]">
                          <span className="flex items-center gap-2 min-w-0">
                            <span
                              className="size-2.5 rounded-full shrink-0"
                              style={{ background: c.color }}
                              aria-hidden
                            />
                            <span aria-hidden>{c.emoji}</span>
                            <span className="truncate">{c.label}</span>
                            <span className="text-faint text-[11.5px] shrink-0">
                              {formatPercent(c.share)}
                            </span>
                          </span>
                          <span className="font-semibold ltr-nums shrink-0">
                            {formatMoney(c.planned, trip.baseCurrency)}
                          </span>
                        </div>
                        <ProgressBar
                          className="h-1.5 mt-1"
                          max={c.planned || 1}
                          value={c.paid}
                          segments={[{ value: c.paid, color: c.color }]}
                        />
                      </li>
                    ))}
                  </ul>
                </Card>
              </section>

              <section>
                <SectionTitle>שולם מול מתוכנן</SectionTitle>
                <Card className="p-4">
                  <div className="h-52" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={categories.slice(0, 7).map((c) => ({
                          name: c.emoji,
                          label: c.label,
                          paid: Math.round(c.paid),
                          upcoming: Math.round(Math.max(0, c.planned - c.paid)),
                        }))}
                        margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
                      >
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 15 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: 'var(--text-faint)' }}
                          axisLine={false}
                          tickLine={false}
                          width={44}
                          tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))}
                        />
                        <Tooltip
                          formatter={(value: number, key: string) => [
                            formatMoney(value, trip.baseCurrency),
                            key === 'paid' ? 'שולם' : 'עוד לתשלום',
                          ]}
                          labelFormatter={(_, payload) =>
                            (payload?.[0]?.payload as { label?: string })?.label ?? ''
                          }
                          cursor={{ fill: 'var(--bg-subtle)' }}
                          contentStyle={{
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border)',
                            borderRadius: 12,
                            fontSize: 13,
                            direction: 'rtl',
                          }}
                        />
                        <Bar dataKey="paid" stackId="a" fill="var(--brand)" radius={[0, 0, 0, 0]} />
                        <Bar
                          dataKey="upcoming"
                          stackId="a"
                          fill="color-mix(in oklab, var(--brand) 30%, transparent)"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </section>
            </>
          ) : (
            <EmptyState
              icon="💰"
              title="אין עדיין הוצאות"
              description="אפשר להוסיף הוצאה מלאה, או פשוט להקליד ״+ ‎€35 ארוחת ערב 25/8״ בשורה המהירה."
              action={
                <Button
                  onClick={() => {
                    setEditing(null);
                    setSheetOpen(true);
                  }}
                >
                  <Plus className="size-4" />
                  הוספת הוצאה
                </Button>
              }
            />
          )}

          {trip.currencies.length > 1 && (
            <section>
              <SectionTitle>שערי המרה</SectionTitle>
              <Card className="p-4 space-y-2">
                {trip.currencies
                  .filter((c) => c !== trip.baseCurrency)
                  .map((c) => (
                    <div key={c} className="flex items-center justify-between text-[13.5px]">
                      <span className="flex items-center gap-1.5">
                        <ArrowLeftRight className="size-3.5 text-faint" />
                        1 {CURRENCY_META[c].symbol} ({c})
                      </span>
                      <span className="font-semibold ltr-nums">
                        {formatMoney(trip.rates[c] ?? 1, trip.baseCurrency, { decimals: 2 })}
                      </span>
                    </div>
                  ))}
                <p className="text-[11.5px] text-faint pt-1">
                  {trip.ratesSource === 'api' ? 'עודכן משער חליפין מקוון' : 'שער ידני'} · ניתן לעדכן
                  בהגדרות
                </p>
              </Card>
            </section>
          )}
        </div>
      )}

      {tab === 'expenses' && (
        <div className="space-y-3">
          <QuickAddBar trip={trip} travelers={travelers} />

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute inset-y-0 start-3 my-auto size-4 text-faint pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="חיפוש בהוצאות…"
                className="w-full h-10 ps-9 pe-3 rounded-xl bg-inset border border-line text-[14px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
              />
            </div>
            <Select
              value={paidFilter}
              onChange={(e) => setPaidFilter(e.target.value as typeof paidFilter)}
              className="h-10 w-auto min-w-28"
            >
              <option value="all">הכל</option>
              <option value="paid">שולם</option>
              <option value="unpaid">לא שולם</option>
            </Select>
          </div>

          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            <FilterChip
              active={categoryFilter === 'all'}
              onClick={() => setCategoryFilter('all')}
              label="כל הקטגוריות"
              icon={<Filter className="size-3" />}
            />
            {EXPENSE_CATEGORIES.map((c) => {
              const meta = EXPENSE_CATEGORY_META[c];
              const count = active.expenses.filter((e) => e.category === c).length;
              if (count === 0) return null;
              return (
                <FilterChip
                  key={c}
                  active={categoryFilter === c}
                  onClick={() => setCategoryFilter(c)}
                  label={`${meta.emoji} ${meta.label} (${count})`}
                />
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon="🔍"
              title="אין הוצאות שתואמות לסינון"
              description="אפשר לנקות את החיפוש או לבחור קטגוריה אחרת."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery('');
                    setCategoryFilter('all');
                    setPaidFilter('all');
                  }}
                >
                  ניקוי סינון
                </Button>
              }
            />
          ) : (
            <Card className="divide-y divide-[var(--border)] overflow-hidden">
              {filtered.map((expense) => {
                const meta = EXPENSE_CATEGORY_META[expense.category];
                const payer = travelers.find((t) => t.id === expense.paidById);
                return (
                  <div key={expense.id} className="flex items-center gap-3 px-3.5 py-3">
                    <span
                      className="size-9 shrink-0 grid place-items-center rounded-xl text-base"
                      style={{ background: `color-mix(in oklab, ${meta.color} 14%, transparent)` }}
                      aria-hidden
                    >
                      {meta.emoji}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(expense);
                        setSheetOpen(true);
                      }}
                      className="flex-1 min-w-0 text-start"
                    >
                      <p className="text-[14px] font-medium truncate">{expense.description}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[11.5px] text-muted ltr-nums">
                          {formatDayMonth(expense.date)}
                        </span>
                        <span className="text-[11.5px] text-faint">{meta.label}</span>
                        {payer && (
                          <span className="inline-flex items-center gap-1 text-[11.5px] text-muted">
                            <Avatar name={payer.name} color={payer.color} size="xs" />
                            {payer.name}
                          </span>
                        )}
                      </div>
                    </button>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Money
                        amount={expense.amount}
                        currency={expense.currency}
                        trip={trip}
                        className="text-[14px] font-semibold"
                      />
                      <StatusChip
                        active={expense.paid}
                        activeLabel="שולם"
                        inactiveLabel="לא שולם"
                        onClick={() => updateExpense(expense.id, { paid: !expense.paid })}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(expense)}
                      aria-label={`מחיקת ${expense.description}`}
                      className="shrink-0 p-1.5 rounded-lg text-faint hover:text-danger hover:bg-danger-soft transition"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      )}

      {tab === 'split' && (
        <div className="space-y-5">
          {travelers.length < 2 ? (
            <EmptyState
              icon="👥"
              title="חלוקת הוצאות דורשת לפחות שני מטיילים"
              description="אפשר להוסיף מטיילים בהגדרות הטיול."
            />
          ) : (
            <>
              <section>
                <SectionTitle>כמה כל אחד שילם</SectionTitle>
                <Card className="p-4 space-y-3.5">
                  {balances.map((b) => {
                    const maxPaid = Math.max(...balances.map((x) => x.paidOut), 1);
                    return (
                      <div key={b.travelerId}>
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                          <span className="flex items-center gap-2 min-w-0">
                            <Avatar name={b.name} color={b.color} size="sm" />
                            <span className="text-[14px] font-medium truncate">{b.name}</span>
                          </span>
                          <span className="text-[13.5px] font-semibold ltr-nums shrink-0">
                            {formatMoney(b.paidOut, trip.baseCurrency)}
                          </span>
                        </div>
                        <ProgressBar
                          max={maxPaid}
                          value={b.paidOut}
                          segments={[{ value: b.paidOut, color: b.color }]}
                          className="h-1.5"
                        />
                        <div className="flex justify-between text-[11.5px] text-faint mt-1 ltr-nums">
                          <span>חלקו: {formatMoney(b.owes, trip.baseCurrency)}</span>
                          <span
                            className={cn(
                              'font-medium',
                              b.balance > 0.5
                                ? 'text-success'
                                : b.balance < -0.5
                                  ? 'text-danger'
                                  : 'text-faint'
                            )}
                          >
                            {b.balance > 0.5
                              ? `מגיע לו ${formatMoney(b.balance, trip.baseCurrency)}`
                              : b.balance < -0.5
                                ? `חייב ${formatMoney(Math.abs(b.balance), trip.baseCurrency)}`
                                : 'מאוזן'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </Card>
              </section>

              <section>
                <SectionTitle>מי צריך להחזיר למי</SectionTitle>
                {settlements.length === 0 ? (
                  <Card className="p-6 text-center">
                    <p className="text-2xl mb-2" aria-hidden>
                      ✅
                    </p>
                    <p className="text-[14px] font-medium">כולם מאוזנים</p>
                    <p className="text-[12.5px] text-muted mt-1">אין החזרים פתוחים בין המטיילים.</p>
                  </Card>
                ) : (
                  <Card className="divide-y divide-[var(--border)]">
                    {settlements.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3">
                        <Avatar
                          name={s.fromName}
                          color={balances.find((b) => b.travelerId === s.fromId)?.color}
                          size="sm"
                        />
                        <span className="text-[13.5px] font-medium">{s.fromName}</span>
                        <span className="text-faint" aria-hidden>
                          ←
                        </span>
                        <Avatar
                          name={s.toName}
                          color={balances.find((b) => b.travelerId === s.toId)?.color}
                          size="sm"
                        />
                        <span className="text-[13.5px] font-medium flex-1">{s.toName}</span>
                        <span className="text-[14px] font-semibold ltr-nums text-brand">
                          {formatMoney(s.amount, trip.baseCurrency)}
                        </span>
                      </div>
                    ))}
                  </Card>
                )}
              </section>

              <p className="text-[12px] text-faint text-center px-6">
                החישוב מבוסס על שדות ״מי שילם״ ו״חלוקה בין״ בכל הוצאה, וממיר הכל למטבע הטיול.
              </p>
            </>
          )}
        </div>
      )}

      <ExpenseSheet
        key={`${editing?.id ?? 'new'}:${sheetOpen}`}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        expense={editing}
        trip={trip}
        travelers={travelers}
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
        title="למחוק את ההוצאה?"
        message={pendingDelete?.description}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const desc = pendingDelete?.description ?? '';
          if (pendingDelete) deleteExpense(pendingDelete.id);
          setPendingDelete(null);
          setEditing(null);
          toast.show(`"${desc}" נמחקה`, {
            action: {
              label: 'בטל',
              onClick: () => {
                undo();
                toast.success('ההוצאה שוחזרה');
              },
            },
          });
        }}
      />
    </AppShell>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'warning' | 'danger';
}) {
  return (
    <div>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd
        className={cn(
          'font-semibold ltr-nums',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning',
          tone === 'danger' && 'text-danger'
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'shrink-0 inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-[12.5px] font-medium border transition whitespace-nowrap',
        active
          ? 'bg-brand text-brand-contrast border-transparent'
          : 'bg-surface border-line text-muted hover:bg-subtle'
      )}
    >
      {icon}
      {label}
    </button>
  );
}
