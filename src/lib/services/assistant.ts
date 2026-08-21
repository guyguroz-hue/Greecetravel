import type { ActiveTrip } from '@/lib/store/hooks';
import {
  CATEGORY_META,
  type Activity,
  type Day,
  type ID,
} from '@/lib/types';
import {
  addDays,
  diffDays,
  formatDayMonth,
  formatDuration,
  formatWeekdayDate,
  todayISO,
} from '@/lib/utils/date';
import { formatKm, formatMoney, pluralNights } from '@/lib/utils/format';
import { haversineKm } from './geo';
import {
  buildTimeline,
  computeDayStats,
  groupActivitiesByDay,
  isOverloadedDay,
} from '@/lib/selectors/itinerary';
import { computeBalances, computeBudget, computeSettlements } from '@/lib/selectors/budget';
import { OP_LABEL, planFromText, type PlanLine, type PlanOp } from './assistant-actions';

/**
 * The trip assistant answers *only* from the trip's own data.
 *
 * It is deliberately deterministic rather than generative: every number in an
 * answer is computed from the store, so it can't hallucinate a restaurant, a
 * price or a driving time. `AssistantProvider` is the seam where a real LLM
 * can be plugged in later — it would receive the same grounded context bundle
 * that `buildContext` produces.
 */

export interface AssistantAnswer {
  text: string;
  /** Optional structured rows rendered as chips/cards under the answer. */
  bullets?: string[];
  /** Deep link offered as a follow-up button. */
  link?: { label: string; href: string };
  /** Set when the assistant genuinely has no grounded answer. */
  unknown?: boolean;
  /**
   * Things the assistant offers to create, when the input was data rather
   * than a question. Never applied by the assistant itself — the screen
   * renders these for confirmation and the store writes them.
   */
  plan?: PlanLine[];
}

export interface AssistantProvider {
  readonly id: string;
  ask(question: string, trip: ActiveTrip, today: string): Promise<AssistantAnswer>;
}

/* ------------------------------------------------------------------ *
 * Grounding context — also what an LLM provider would be handed.
 * ------------------------------------------------------------------ */

export function buildContext(t: ActiveTrip, today = todayISO()) {
  const byDay = groupActivitiesByDay(t.activities);
  return {
    trip: {
      name: t.trip.name,
      destination: t.trip.destination,
      startDate: t.trip.startDate,
      endDate: t.trip.endDate,
      baseCurrency: t.trip.baseCurrency,
      totalBudget: t.trip.totalBudget,
      travelers: t.travelers.map((x) => x.name),
    },
    today,
    days: t.days.map((d) => {
      const items = byDay.get(d.id) ?? [];
      const stats = computeDayStats(items);
      return {
        index: d.index,
        date: d.date,
        title: d.title,
        baseLocation: d.baseLocation,
        activities: items.map((a) => ({
          time: a.startTime,
          title: a.title,
          category: a.category,
          price: a.price,
          currency: a.currency,
        })),
        drivingMin: stats.drivingMin,
        drivingKm: stats.drivingKm,
        activityCount: stats.activityCount,
      };
    }),
    hotels: t.hotels.map((h) => ({
      name: h.name,
      city: h.city,
      checkIn: h.checkIn,
      checkOut: h.checkOut,
      booked: !!h.booked,
    })),
    flights: t.flights.map((f) => ({
      airline: f.airline,
      number: f.flightNumber,
      date: f.date,
      from: f.from.code,
      to: f.to.code,
      departureTime: f.departureTime,
    })),
    budget: computeBudget(t.trip, t.expenses, t.travelers.length),
    places: t.places.map((p) => ({ name: p.name, list: p.list, scheduled: !!p.dayId })),
  };
}

/* ------------------------------------------------------------------ *
 * Intent matching
 * ------------------------------------------------------------------ */

const norm = (s: string) => s.trim().toLowerCase().replace(/[?!.,״"']/g, '');
const has = (q: string, ...words: string[]) => words.some((w) => q.includes(w));

function dayLabel(day: Day) {
  return `יום ${day.index} — ${day.title} (${formatDayMonth(day.date)})`;
}

function describeActivity(a: Activity) {
  const meta = CATEGORY_META[a.category];
  const time = a.startTime ? `${a.startTime} · ` : '';
  return `${time}${meta.emoji} ${a.title}`;
}

function findDayByDate(t: ActiveTrip, date: string) {
  return t.days.find((d) => d.date === date);
}

/** Resolves phrases like "מחר", "היום", "יום 4", "25.8" to a day row. */
function resolveDay(q: string, t: ActiveTrip, today: string): Day | undefined {
  if (has(q, 'מחרתיים')) return findDayByDate(t, addDays(today, 2));
  if (has(q, 'מחר', 'tomorrow')) return findDayByDate(t, addDays(today, 1));
  if (has(q, 'אתמול')) return findDayByDate(t, addDays(today, -1));
  if (has(q, 'היום', 'today')) return findDayByDate(t, today);

  const dayNum = q.match(/יום\s*(\d{1,2})|day\s*(\d{1,2})/);
  if (dayNum) {
    const n = Number(dayNum[1] ?? dayNum[2]);
    const hit = t.days.find((d) => d.index === n);
    if (hit) return hit;
  }

  const dm = q.match(/(\d{1,2})[./](\d{1,2})/);
  if (dm) {
    const d = Number(dm[1]);
    const m = Number(dm[2]);
    const hit = t.days.find((day) => {
      const [, mm, dd] = day.date.split('-').map(Number);
      return mm === m && dd === d;
    });
    if (hit) return hit;
  }
  return undefined;
}

/** Finds a location the user named, matching against days, places and activities. */
function resolveLocation(q: string, t: ActiveTrip): { name: string; lat: number; lng: number } | null {
  const candidates: { name: string; lat: number; lng: number }[] = [];
  for (const p of t.places) if (p.location) candidates.push({ name: p.name, ...p.location });
  for (const a of t.activities) if (a.location) candidates.push({ name: a.title, ...a.location });
  for (const h of t.hotels) if (h.location) candidates.push({ name: h.city, ...h.location });
  for (const d of t.days) {
    if (!d.baseLocation) continue;
    const anchor = t.activities.find((a) => a.dayId === d.id && a.location);
    if (anchor?.location) candidates.push({ name: d.baseLocation, ...anchor.location });
  }

  let best: { name: string; lat: number; lng: number } | null = null;
  let bestLen = 0;
  for (const c of candidates) {
    const name = norm(c.name);
    // Match on any word of 3+ characters so "מטסובו" hits "מוזיאון Averoff מטסובו".
    for (const word of name.split(/[\s,·—–-]+/)) {
      if (word.length >= 3 && q.includes(word) && word.length > bestLen) {
        best = c;
        bestLen = word.length;
      }
    }
  }
  return best;
}

const answerHandlers: {
  id: string;
  match: (q: string) => boolean;
  run: (q: string, t: ActiveTrip, today: string) => AssistantAnswer | null;
}[] = [
  /* ---------------- what are we doing on <day> ---------------- */
  {
    id: 'day-plan',
    match: (q) =>
      has(q, 'מה אנחנו עושים', 'מה עושים', 'מה יש לנו', 'מה מתוכנן', 'לוח זמנים', 'תוכנית', 'what are we doing'),
    run: (q, t, today) => {
      const day = resolveDay(q, t, today) ?? findDayByDate(t, today) ?? t.days[0];
      if (!day) return null;
      const items = t.activities.filter((a) => a.dayId === day.id);
      if (items.length === 0) {
        return {
          text: `${dayLabel(day)} — עדיין אין פעילויות מתוכננות ליום הזה.`,
          link: { label: 'פתיחת המסלול', href: '/itinerary' },
        };
      }
      const timeline = buildTimeline(items);
      const stats = computeDayStats(items);
      return {
        text: `${dayLabel(day)}, ${formatWeekdayDate(day.date)}. ${items.length} פעילויות${
          stats.drivingMin > 0 ? `, כ-${formatDuration(stats.drivingMin)} נסיעה` : ''
        }.`,
        bullets: timeline.map((e) => describeActivity(e.activity)),
        link: { label: 'פתיחת היום במסלול', href: '/itinerary' },
      };
    },
  },

  /* ---------------- too much driving? ---------------- */
  {
    id: 'driving',
    match: (q) => has(q, 'נסיע', 'נהיג', 'לנהוג', 'דרך ארוכה', 'driving', 'יותר מדי'),
    run: (q, t, today) => {
      const day = resolveDay(q, t, today);
      const byDay = groupActivitiesByDay(t.activities);
      if (day) {
        const stats = computeDayStats(byDay.get(day.id) ?? []);
        const verdict =
          stats.drivingMin > 240
            ? 'זה יום נסיעות כבד — שווה לפצל אותו.'
            : stats.drivingMin > 150
              ? 'זה סביר, אבל לא יישאר הרבה זמן פנוי.'
              : 'זה יום נוח מבחינת נסיעות.';
        return {
          text: `${dayLabel(day)}: כ-${formatDuration(stats.drivingMin)} נסיעה, ${formatKm(
            stats.drivingKm
          )}. ${verdict}`,
          bullets:
            stats.tightLegs > 0
              ? [`⚠️ ${stats.tightLegs} מעברים שבהם זמן הנסיעה ארוך מהפער בין הפעילויות`]
              : undefined,
          link: { label: 'פתיחת המסלול', href: '/itinerary' },
        };
      }
      const heavy = t.days
        .map((d) => ({ d, stats: computeDayStats(byDay.get(d.id) ?? []) }))
        .filter((x) => x.stats.drivingMin > 0)
        .sort((a, b) => b.stats.drivingMin - a.stats.drivingMin)
        .slice(0, 4);
      if (heavy.length === 0) return null;
      return {
        text: 'הימים עם הכי הרבה נסיעה בטיול:',
        bullets: heavy.map(
          (x) =>
            `${dayLabel(x.d)} — ${formatDuration(x.stats.drivingMin)}, ${formatKm(x.stats.drivingKm)}`
        ),
        link: { label: 'פתיחת המסלול', href: '/itinerary' },
      };
    },
  },

  /* ---------------- find a calmer day ---------------- */
  {
    id: 'calm-day',
    match: (q) => has(q, 'רגוע', 'פנוי', 'קל יותר', 'להוריד קצב', 'יום חופשי', 'calmer'),
    run: (_q, t) => {
      const byDay = groupActivitiesByDay(t.activities);
      const scored = t.days
        .map((d) => {
          const stats = computeDayStats(byDay.get(d.id) ?? []);
          return { d, stats, score: stats.activityCount * 20 + stats.drivingMin + stats.spanMin / 4 };
        })
        .sort((a, b) => a.score - b.score)
        .slice(0, 3);
      return {
        text: 'הימים הרגועים ביותר במסלול הנוכחי:',
        bullets: scored.map(
          (x) =>
            `${dayLabel(x.d)} — ${x.stats.activityCount} פעילויות, ${formatDuration(
              x.stats.drivingMin
            )} נסיעה`
        ),
        link: { label: 'פתיחת המסלול', href: '/itinerary' },
      };
    },
  },

  /* ---------------- overloaded days ---------------- */
  {
    id: 'overloaded',
    match: (q) => has(q, 'עמוס', 'צפוף', 'לחוץ', 'overload'),
    run: (_q, t) => {
      const byDay = groupActivitiesByDay(t.activities);
      const heavy = t.days
        .map((d) => ({ d, stats: computeDayStats(byDay.get(d.id) ?? []) }))
        .filter((x) => isOverloadedDay(x.stats));
      if (heavy.length === 0) {
        return { text: 'אין כרגע ימים שנראים עמוסים מדי — כל הימים בטווח סביר.' };
      }
      return {
        text: `${heavy.length} ימים נראים עמוסים מדי:`,
        bullets: heavy.map(
          (x) =>
            `${dayLabel(x.d)} — ${x.stats.activityCount} פעילויות, ${formatDuration(
              x.stats.drivingMin
            )} נסיעה, פרוס על ${formatDuration(x.stats.spanMin)}`
        ),
        link: { label: 'פתיחת המסלול', href: '/itinerary' },
      };
    },
  },

  /* ---------------- budget ---------------- */
  {
    id: 'budget',
    match: (q) => has(q, 'תקציב', 'חורג', 'כסף', 'עולה', 'עלות', 'הוצא', 'budget'),
    run: (_q, t) => {
      const b = computeBudget(t.trip, t.expenses, t.travelers.length);
      const cur = t.trip.baseCurrency;
      const over = b.remaining < 0;
      return {
        text: over
          ? `כן — אנחנו חורגים ב-${formatMoney(Math.abs(b.remaining), cur)}. מתוכנן ${formatMoney(
              b.planned,
              cur
            )} מול תקציב של ${formatMoney(b.budget, cur)}.`
          : `לא. מתוכנן ${formatMoney(b.planned, cur)} מתוך תקציב של ${formatMoney(
              b.budget,
              cur
            )} — נשארו ${formatMoney(b.remaining, cur)}.`,
        bullets: [
          `שולם עד כה: ${formatMoney(b.paid, cur)}`,
          `עוד צפוי לתשלום: ${formatMoney(b.upcoming, cur)}`,
          `עלות לאדם: ${formatMoney(b.perPerson, cur)}`,
          `עלות ליום: ${formatMoney(b.perDay, cur)}`,
        ],
        link: { label: 'פתיחת התקציב', href: '/budget' },
      };
    },
  },

  /* ---------------- who owes whom ---------------- */
  {
    id: 'settle',
    match: (q) => has(q, 'מי חייב', 'להחזיר', 'מאזן', 'חלוקה', 'settle'),
    run: (_q, t) => {
      const balances = computeBalances(t.trip, t.expenses, t.travelers);
      const settlements = computeSettlements(balances);
      const cur = t.trip.baseCurrency;
      if (settlements.length === 0) {
        return { text: 'כרגע כולם מאוזנים — אין החזרים פתוחים.' };
      }
      return {
        text: 'כדי לאזן את ההוצאות המשותפות:',
        bullets: settlements.map(
          (s) => `${s.fromName} → ${s.toName}: ${formatMoney(s.amount, cur)}`
        ),
        link: { label: 'פתיחת מאזן ההוצאות', href: '/budget' },
      };
    },
  },

  /* ---------------- what can we add near X ---------------- */
  {
    id: 'nearby',
    match: (q) => has(q, 'להוסיף', 'ליד', 'בסביבה', 'קרוב', 'מה יש', 'nearby'),
    run: (q, t) => {
      const anchor = resolveLocation(q, t);
      if (!anchor) return null;
      const unscheduled = t.places.filter((p) => !p.dayId && p.location);
      if (unscheduled.length === 0) {
        return {
          text: `לא נשארו מקומות ברשימת המקומות שעדיין לא שובצו למסלול, אז אין לי מה להציע ליד ${anchor.name} מתוך הנתונים שלך.`,
          link: { label: 'פתיחת רשימת המקומות', href: '/places' },
        };
      }
      const near = unscheduled
        .map((p) => ({ p, km: haversineKm(anchor, p.location!) }))
        .sort((a, b) => a.km - b.km)
        .slice(0, 5);
      return {
        text: `מתוך רשימת המקומות שלך, אלה הקרובים ביותר ל${anchor.name}:`,
        bullets: near.map(
          (x) => `${CATEGORY_META[x.p.category].emoji} ${x.p.name} — ${formatKm(x.km)} משם`
        ),
        link: { label: 'פתיחת רשימת המקומות', href: '/places' },
      };
    },
  },

  /* ---------------- can we fit place X into the itinerary ---------------- */
  {
    id: 'fit-place',
    match: (q) => has(q, 'לשלב', 'להכניס', 'לשבץ', 'איפה כדאי', 'fit'),
    run: (q, t) => {
      const anchor = resolveLocation(q, t);
      if (!anchor) return null;
      const byDay = groupActivitiesByDay(t.activities);
      const scored = t.days
        .map((d) => {
          const items = byDay.get(d.id) ?? [];
          const withLoc = items.filter((a) => a.location);
          if (withLoc.length === 0) return null;
          const nearest = Math.min(...withLoc.map((a) => haversineKm(anchor, a.location!)));
          const stats = computeDayStats(items);
          return { d, nearest, stats };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .sort((a, b) => a.nearest - b.nearest || a.stats.activityCount - b.stats.activityCount)
        .slice(0, 3);

      if (scored.length === 0) return null;
      const best = scored[0];
      return {
        text: `${anchor.name} מתאים הכי טוב ל${dayLabel(best.d)} — ${formatKm(
          best.nearest
        )} מהפעילות הקרובה ביותר באותו יום, ויש שם ${best.stats.activityCount} פעילויות.`,
        bullets: scored.map(
          (x) => `${dayLabel(x.d)} — ${formatKm(x.nearest)} משם, ${x.stats.activityCount} פעילויות`
        ),
        link: { label: 'פתיחת המסלול', href: '/itinerary' },
      };
    },
  },

  /* ---------------- hotels ---------------- */
  {
    id: 'hotels',
    match: (q) => has(q, 'מלון', 'לינה', 'ישנים', 'hotel'),
    run: (q, t, today) => {
      const day = resolveDay(q, t, today);
      if (day) {
        const hotel = t.hotels.find((h) => day.date >= h.checkIn && day.date < h.checkOut);
        return {
          text: hotel
            ? `ב${dayLabel(day)} אתם ישנים ב-${hotel.name}, ${hotel.city}.`
            : `ל${dayLabel(day)} אין מלון משויך בנתונים.`,
          link: { label: 'פתיחת המלונות', href: '/hotels' },
        };
      }
      if (t.hotels.length === 0) return null;
      return {
        text: `${t.hotels.length} מלונות בטיול:`,
        bullets: t.hotels.map((h) => {
          const nights = Math.max(1, diffDays(h.checkIn, h.checkOut));
          return `${h.name}, ${h.city} — ${formatDayMonth(h.checkIn)}–${formatDayMonth(
            h.checkOut
          )} (${pluralNights(nights)})${h.booked ? '' : ' ⚠️ ללא הזמנה'}`;
        }),
        link: { label: 'פתיחת המלונות', href: '/hotels' },
      };
    },
  },

  /* ---------------- flights ---------------- */
  {
    id: 'flights',
    match: (q) => has(q, 'טיסה', 'טיסות', 'שדה תעופה', 'flight'),
    run: (_q, t) => {
      if (t.flights.length === 0) return null;
      return {
        text: 'הטיסות בטיול:',
        bullets: t.flights.map(
          (f) =>
            `${formatDayMonth(f.date)} · ${f.airline} ${f.flightNumber} · ${f.from.code} → ${
              f.to.code
            }${f.departureTime ? ` · ${f.departureTime}` : ''}`
        ),
        link: { label: 'פתיחת הטיסות', href: '/flights' },
      };
    },
  },

  /* ---------------- unbooked ---------------- */
  {
    id: 'unbooked',
    match: (q) => has(q, 'ללא הזמנה', 'לא הזמנו', 'להזמין', 'חסר', 'unbooked'),
    run: (_q, t) => {
      const missing: string[] = [];
      for (const h of t.hotels) if (!h.booked) missing.push(`🏨 ${h.name} — ${h.city}`);
      for (const f of t.flights) if (!f.booked) missing.push(`✈️ ${f.airline} ${f.flightNumber}`);
      for (const c of t.cars) if (!c.booked) missing.push(`🚗 ${c.company || 'רכב שכור'}`);
      const unpaid = t.expenses.filter((e) => !e.paid).length;
      if (missing.length === 0) {
        return {
          text: `הכל מוזמן. ${unpaid > 0 ? `נשארו ${unpaid} הוצאות שטרם שולמו.` : ''}`.trim(),
          link: unpaid > 0 ? { label: 'פתיחת התקציב', href: '/budget' } : undefined,
        };
      }
      return { text: 'הדברים שעדיין ללא הזמנה:', bullets: missing };
    },
  },

  /* ---------------- how many days left ---------------- */
  {
    id: 'countdown',
    match: (q) => has(q, 'כמה ימים', 'מתי יוצאים', 'נשאר', 'countdown'),
    run: (_q, t, today) => {
      const toStart = diffDays(today, t.trip.startDate);
      if (toStart > 0) {
        return {
          text: `הטיול מתחיל בעוד ${toStart} ימים, ב-${formatWeekdayDate(t.trip.startDate)}.`,
        };
      }
      const toEnd = diffDays(today, t.trip.endDate);
      if (toEnd >= 0) {
        const current = t.days.find((d) => d.date === today);
        return {
          text: `אתם ביום ${current?.index ?? '?'} מתוך ${t.days.length}. נשארו עוד ${toEnd} ימים.`,
        };
      }
      return { text: 'הטיול הסתיים. אפשר לעבור על ההוצאות ולסגור מאזן.' };
    },
  },
];

/**
 * Is this text to be filed rather than a question to be answered?
 *
 * The tell is shape, not vocabulary. A question is one line and usually ends
 * in a question mark; pasted data is several lines, or one line carrying both
 * a number and a date. Guessing wrong in the safe direction costs nothing —
 * a proposal is shown, not applied — so the test leans towards offering.
 */
function looksLikeData(text: string, lines: string[]): boolean {
  if (/\?\s*$/.test(text.trim())) return false;
  if (lines.length > 1) return true;
  // A single line still counts when it carries an amount and a date, which is
  // what one pasted booking looks like.
  return /\d/.test(text) && /[./]\d{1,2}\b/.test(text) && /\d{2,}/.test(text);
}

/** The built-in, fully grounded provider. */
export const localAssistant: AssistantProvider = {
  id: 'local',
  async ask(question, trip, today) {
    const q = norm(question);
    if (!q) {
      return { text: 'אפשר לשאול אותי כל דבר על הטיול הזה.', unknown: true };
    }

    // Data first: a paste that also happens to contain a question word must
    // not be answered as a question and thrown away.
    const rawLines = question
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (looksLikeData(question, rawLines)) {
      const plan = planFromText(question, {
        defaultCurrency: trip.trip.baseCurrency,
        startDate: trip.trip.startDate,
        endDate: trip.trip.endDate,
        today,
      });
      const understood = plan.filter((l) => l.op).length;
      if (understood > 0) {
        const counts = new Map<string, number>();
        for (const line of plan) {
          if (!line.op) continue;
          counts.set(line.op.kind, (counts.get(line.op.kind) ?? 0) + 1);
        }
        const summary = [...counts.entries()]
          .map(([kind, n]) => `${n} ${OP_LABEL[kind as PlanOp['kind']]}${n > 1 ? 'ות' : ''}`)
          .join(' · ');
        const missed = plan.length - understood;
        return {
          text:
            `זיהיתי ${summary}. ` +
            (missed > 0 ? `${missed} שורות לא הצלחתי לקרוא. ` : '') +
            'עברי על הרשימה ואשר — עד אז לא נגעתי בכלום.',
          plan,
        };
      }
    }

    for (const handler of answerHandlers) {
      if (!handler.match(q)) continue;
      const answer = handler.run(q, trip, today);
      if (answer) return answer;
    }
    return {
      text: 'לא מצאתי תשובה לזה בנתוני הטיול, ואני לא ממציא מידע שאין לי. נסי לשאול על המסלול, נסיעות, מלונות, טיסות, תקציב או מקומות שמורים.',
      unknown: true,
    };
  },
};

let provider: AssistantProvider = localAssistant;

export function setAssistantProvider(next: AssistantProvider) {
  provider = next;
}

export function askAssistant(question: string, trip: ActiveTrip, today = todayISO()) {
  return provider.ask(question, trip, today);
}

/** Starter prompts shown when the assistant is empty. */
export const SUGGESTED_QUESTIONS = [
  'מה אנחנו עושים מחר?',
  'יש לנו יותר מדי נסיעות ביום 3?',
  'אנחנו חורגים מהתקציב?',
  'תמצא לי יום רגוע יותר',
  'מה אפשר להוסיף ליד מטסובו?',
  'מי צריך להחזיר למי?',
  'מה עדיין ללא הזמנה?',
];

export type { ID };
