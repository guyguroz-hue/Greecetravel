'use client';

import type { ActiveTrip } from '@/lib/store/hooks';
import { assistantReply, opProblem } from './assistant-schema';
import { buildContext, localAssistant, type AssistantAnswer, type AssistantProvider } from './assistant';
import { describeOp, type PlanLine, type PlanOp } from './assistant-actions';

/**
 * The assistant, backed by a real model.
 *
 * Three things are deliberate here.
 *
 * The model never writes. It proposes operations; they arrive as the same
 * `PlanLine[]` the pattern-matching assistant produces, render in the same
 * confirmation card, and are applied by the same store action after the person
 * taps. Giving a model direct write access to someone's trip would mean a
 * single misread date silently rewrites their itinerary.
 *
 * What comes back over the wire is re-validated against the schema. The server
 * constrains generation, but the client is the side that writes, and a
 * response can be well-formed and still nonsense — a hotel checking out before
 * it checks in, an amount of 1e21. A rejected operation is dropped with a
 * reason the person can read, not silently swallowed and not written.
 *
 * And when there is no model — no key configured, no network, a static export
 * with no server at all — this falls back to the deterministic assistant
 * rather than failing. The app has never required a backend and still doesn't.
 */

/** Set once a request comes back 501, so the fallback is instant afterwards. */
let modelUnavailable = false;

export function resetModelAvailability() {
  modelUnavailable = false;
}

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * The conversation so far, kept by the screen and passed back in. Trimmed on
 * the server too; kept short here so a long session does not grow unbounded
 * in memory either.
 */
const history: Turn[] = [];

export function clearHistory() {
  history.length = 0;
}

function toPlanLines(ops: PlanOp[], rejected: string[]): PlanLine[] {
  const lines: PlanLine[] = ops.map((op) => ({ source: describeOp(op), op }));
  for (const reason of rejected) lines.push({ source: reason, problem: 'הפעולה נדחתה' });
  return lines;
}

export const remoteAssistant: AssistantProvider = {
  id: 'claude',
  async ask(question, trip: ActiveTrip, today) {
    if (modelUnavailable) return localAssistant.ask(question, trip, today);

    let res: Response;
    try {
      res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          today,
          history: history.slice(-6),
          context: buildContext(trip, today),
        }),
      });
    } catch {
      // Offline, or a static export with no route behind the path.
      return withNote(
        await localAssistant.ask(question, trip, today),
        'אין חיבור למודל כרגע, אז עניתי מהנתונים בלבד.'
      );
    }

    if (res.status === 501 || res.status === 404) {
      // No key configured. Stop asking for the rest of the session.
      modelUnavailable = true;
      return localAssistant.ask(question, trip, today);
    }

    if (!res.ok) {
      const reason = await res
        .json()
        .then((b: { error?: string }) => b.error)
        .catch(() => undefined);
      return withNote(
        await localAssistant.ask(question, trip, today),
        reason ?? 'המודל לא זמין כרגע, אז עניתי מהנתונים בלבד.'
      );
    }

    const body = (await res.json()) as unknown;
    const parsed = assistantReply.safeParse(body);
    if (!parsed.success) {
      return withNote(
        await localAssistant.ask(question, trip, today),
        'התשובה מהמודל הגיעה בפורמט לא צפוי, אז עניתי מהנתונים בלבד.'
      );
    }

    const ops: PlanOp[] = [];
    const rejected: string[] = [];
    for (const op of parsed.data.operations) {
      const problem = opProblem(op);
      if (problem) rejected.push(`${describeOp(op)} — ${problem}`);
      else ops.push(op);
    }

    history.push({ role: 'user', content: question });
    history.push({ role: 'assistant', content: parsed.data.reply });
    if (history.length > 12) history.splice(0, history.length - 12);

    return {
      text: parsed.data.reply,
      plan: ops.length > 0 || rejected.length > 0 ? toPlanLines(ops, rejected) : undefined,
    };
  },
};

/** Marks an answer that came from the fallback, and says why. */
function withNote(answer: AssistantAnswer, note: string): AssistantAnswer {
  return { ...answer, text: `${note}\n\n${answer.text}` };
}
