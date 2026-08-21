import { z } from 'zod';
import { CURRENCIES, EXPENSE_CATEGORIES, ACTIVITY_CATEGORIES } from '@/lib/types';

/**
 * The shape the model must answer in, and the gate everything it says passes
 * through before it can touch a trip.
 *
 * This is not only a prompt convenience. The operations below are written into
 * the person's own data, so the model's output is untrusted input in the
 * ordinary security sense: a hallucinated category, a date like "next Tuesday",
 * or a string where a number belongs would otherwise be stored verbatim and
 * corrupt the trip. Parsing here means a malformed operation is dropped with a
 * reason rather than written.
 *
 * The same schema runs on both sides. The server uses it to constrain
 * generation; the client re-validates what came back over the wire, because a
 * response can be shaped correctly and still be wrong, and the client is the
 * side that actually writes.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'time must be HH:MM');

const currency = z.enum(CURRENCIES);

/** A positive, plausible amount. Guards against a stray exponent or a NaN. */
const money = z.number().positive().max(1_000_000);

export const expenseOp = z.object({
  kind: z.literal('expense'),
  date: isoDate,
  amount: money,
  currency,
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().min(1).max(120),
  paid: z.boolean(),
});

export const hotelOp = z.object({
  kind: z.literal('hotel'),
  name: z.string().min(1).max(80),
  city: z.string().max(60),
  checkIn: isoDate,
  checkOut: isoDate,
  totalPrice: money.optional(),
  currency,
  paid: z.boolean(),
});

export const flightOp = z.object({
  kind: z.literal('flight'),
  airline: z.string().min(1).max(60),
  flightNumber: z.string().min(2).max(10),
  date: isoDate,
  departureTime: hhmm.optional(),
  fromCode: z.string().max(4),
  toCode: z.string().max(4),
  price: money.optional(),
  currency,
});

export const activityOp = z.object({
  kind: z.literal('activity'),
  date: isoDate,
  title: z.string().min(1).max(120),
  startTime: hhmm.optional(),
  category: z.enum(ACTIVITY_CATEGORIES),
});

export const planOp = z.discriminatedUnion('kind', [
  expenseOp,
  hotelOp,
  flightOp,
  activityOp,
]);

export const assistantReply = z.object({
  /**
   * What to say. Written for someone glancing at a phone, in Hebrew, and
   * never a restatement of the list below — the list renders itself.
   */
  reply: z.string().min(1).max(1200),
  /** Empty unless the person asked for something to be added. */
  operations: z.array(planOp).max(40),
});

export type AssistantReply = z.infer<typeof assistantReply>;

/**
 * A check-out must be after its check-in, and a stay of a year is a typo.
 *
 * Kept out of the schema on purpose: a model that gets this wrong should have
 * that one operation dropped with a reason the person can see, not have the
 * whole reply rejected.
 */
export function opProblem(op: z.infer<typeof planOp>): string | undefined {
  if (op.kind === 'hotel') {
    if (op.checkOut <= op.checkIn) return 'תאריך היציאה לא אחרי הכניסה';
    const nights =
      (Date.parse(op.checkOut) - Date.parse(op.checkIn)) / 86_400_000;
    if (nights > 120) return 'שהייה ארוכה מדי מכדי להיות אמיתית';
  }
  return undefined;
}
