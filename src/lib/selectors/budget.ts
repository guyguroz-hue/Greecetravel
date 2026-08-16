import { convert } from '@/lib/services/currency';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_META,
  type CurrencyCode,
  type Expense,
  type ExpenseCategory,
  type ID,
  type Traveler,
  type Trip,
} from '@/lib/types';
import { daysBetweenInclusive } from '@/lib/utils/date';

export interface BudgetTotals {
  /** Ceiling the user set for the trip. */
  budget: number;
  /** Everything entered, paid or not. */
  planned: number;
  /** Already paid out. */
  paid: number;
  /** Entered but still owing. */
  upcoming: number;
  /** budget − planned. Negative means over budget. */
  remaining: number;
  perPerson: number;
  perDay: number;
  currency: CurrencyCode;
  travelers: number;
  days: number;
}

export interface CategoryTotal {
  category: ExpenseCategory;
  label: string;
  emoji: string;
  color: string;
  planned: number;
  paid: number;
  count: number;
  share: number;
}

export function expenseInBase(expense: Expense, trip: Trip): number {
  return convert(expense.amount, expense.currency, trip.baseCurrency, trip.rates);
}

export function computeBudget(
  trip: Trip,
  expenses: Expense[],
  travelerCount: number
): BudgetTotals {
  let planned = 0;
  let paid = 0;
  for (const e of expenses) {
    const value = expenseInBase(e, trip);
    planned += value;
    if (e.paid) paid += value;
  }
  const days = daysBetweenInclusive(trip.startDate, trip.endDate);
  const people = Math.max(1, travelerCount);
  return {
    budget: trip.totalBudget,
    planned,
    paid,
    upcoming: planned - paid,
    remaining: trip.totalBudget - planned,
    perPerson: planned / people,
    perDay: days > 0 ? planned / days : planned,
    currency: trip.baseCurrency,
    travelers: people,
    days,
  };
}

export function computeCategoryTotals(trip: Trip, expenses: Expense[]): CategoryTotal[] {
  const acc = new Map<ExpenseCategory, { planned: number; paid: number; count: number }>();
  for (const c of EXPENSE_CATEGORIES) acc.set(c, { planned: 0, paid: 0, count: 0 });

  let total = 0;
  for (const e of expenses) {
    const value = expenseInBase(e, trip);
    const bucket = acc.get(e.category) ?? { planned: 0, paid: 0, count: 0 };
    bucket.planned += value;
    bucket.count += 1;
    if (e.paid) bucket.paid += value;
    acc.set(e.category, bucket);
    total += value;
  }

  return EXPENSE_CATEGORIES.map((category) => {
    const bucket = acc.get(category)!;
    const meta = EXPENSE_CATEGORY_META[category];
    return {
      category,
      label: meta.label,
      emoji: meta.emoji,
      color: meta.color,
      planned: bucket.planned,
      paid: bucket.paid,
      count: bucket.count,
      share: total > 0 ? bucket.planned / total : 0,
    };
  })
    .filter((c) => c.count > 0)
    .sort((a, b) => b.planned - a.planned);
}

/* ------------------------------------------------------------------ *
 * Shared expenses / settle up
 * ------------------------------------------------------------------ */

export interface TravelerBalance {
  travelerId: ID;
  name: string;
  color: string;
  /** Money this person actually put on their card. */
  paidOut: number;
  /** Their share of everything they take part in. */
  owes: number;
  /** paidOut − owes. Positive = others owe them. */
  balance: number;
}

export interface Settlement {
  fromId: ID;
  fromName: string;
  toId: ID;
  toName: string;
  amount: number;
}

export function computeBalances(
  trip: Trip,
  expenses: Expense[],
  travelers: Traveler[]
): TravelerBalance[] {
  const byId = new Map(travelers.map((t) => [t.id, t]));
  const paidOut = new Map<ID, number>();
  const owes = new Map<ID, number>();
  for (const t of travelers) {
    paidOut.set(t.id, 0);
    owes.set(t.id, 0);
  }

  for (const e of expenses) {
    const value = expenseInBase(e, trip);
    if (e.paidById && paidOut.has(e.paidById)) {
      paidOut.set(e.paidById, (paidOut.get(e.paidById) ?? 0) + value);
    }
    const participants = (e.splitBetween.length ? e.splitBetween : travelers.map((t) => t.id))
      .filter((id) => byId.has(id));
    if (participants.length === 0) continue;
    const share = value / participants.length;
    for (const id of participants) owes.set(id, (owes.get(id) ?? 0) + share);
  }

  return travelers.map((t) => {
    const out = paidOut.get(t.id) ?? 0;
    const due = owes.get(t.id) ?? 0;
    return {
      travelerId: t.id,
      name: t.name,
      color: t.color,
      paidOut: out,
      owes: due,
      balance: out - due,
    };
  });
}

/**
 * Greedy settle-up: repeatedly match the biggest debtor with the biggest
 * creditor. Produces at most n−1 transfers, which is the minimum possible.
 */
export function computeSettlements(balances: TravelerBalance[]): Settlement[] {
  const EPSILON = 0.5; // don't chase sub-shekel rounding
  const debtors = balances
    .filter((b) => b.balance < -EPSILON)
    .map((b) => ({ ...b, remaining: -b.balance }))
    .sort((a, b) => b.remaining - a.remaining);
  const creditors = balances
    .filter((b) => b.balance > EPSILON)
    .map((b) => ({ ...b, remaining: b.balance }))
    .sort((a, b) => b.remaining - a.remaining);

  const out: Settlement[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].remaining, creditors[j].remaining);
    if (amount > EPSILON) {
      out.push({
        fromId: debtors[i].travelerId,
        fromName: debtors[i].name,
        toId: creditors[j].travelerId,
        toName: creditors[j].name,
        amount,
      });
    }
    debtors[i].remaining -= amount;
    creditors[j].remaining -= amount;
    if (debtors[i].remaining <= EPSILON) i++;
    if (creditors[j].remaining <= EPSILON) j++;
  }
  return out;
}

/** Daily spend series for the budget chart. */
export function computeDailySpend(
  trip: Trip,
  expenses: Expense[]
): { date: string; planned: number; paid: number }[] {
  const map = new Map<string, { planned: number; paid: number }>();
  for (const e of expenses) {
    const value = expenseInBase(e, trip);
    const bucket = map.get(e.date) ?? { planned: 0, paid: 0 };
    bucket.planned += value;
    if (e.paid) bucket.paid += value;
    map.set(e.date, bucket);
  }
  return [...map.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
