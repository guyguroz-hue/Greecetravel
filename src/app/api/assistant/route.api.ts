import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { assistantReply } from '@/lib/services/assistant-schema';

/**
 * The only server-side code in the app.
 *
 * It exists for one reason: an API key cannot go in the browser. Everything
 * else still runs on the device — this route holds no state, no database and
 * no session. It takes a question plus the slice of trip data needed to answer
 * it, asks the model, and hands back an answer and a list of proposed
 * operations. The client is what decides whether any of them happen.
 *
 * The file is named `route.api.ts` rather than `route.ts` so the static export
 * build can leave it out entirely (see `next.config.ts`). `npm run build:static`
 * still produces a fully working app; it just falls back to the built-in
 * deterministic assistant, because there is no server to ask.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Default model. Overridable, because the right trade here is the owner's to
 * make: a family trip planner asks a handful of questions a day, and the
 * difference between tiers is fractions of a cent per question either way.
 */
const MODEL = process.env.ASSISTANT_MODEL || 'claude-opus-5';

/**
 * A ceiling on what one request may carry.
 *
 * The client sends a summary of the trip rather than the whole store, but a
 * long trip still grows, and nothing else here bounds the cost of a single
 * call. 120KB is far more than a summarised trip needs and far less than an
 * accident.
 */
const MAX_BODY_BYTES = 120_000;

const SYSTEM = `את/ה העוזר של אפליקציית תכנון טיולים בשם "My Trip Planner". המשתמש ישראלי והשפה היא עברית.

יש לך שני תפקידים:

1. לענות על שאלות על הטיול — אך ורק מתוך הנתונים שמסופקים לך בהודעה. אם משהו לא נמצא בנתונים, אמור/י שאין לך את המידע. אל תמציא/י מסעדות, מחירים, זמני נסיעה, שעות פתיחה או כל עובדה שלא נמצאת בנתונים. ידע כללי על יעדים מותר רק כשהמשתמש שואל במפורש עצה כללית, ואז אמור/י בבירור שזו המלצה כללית ולא מתוך הטיול.

2. לבצע פעולות — כשהמשתמש מבקש להוסיף משהו, או מדביק נתונים (רשימת הזמנות, הוצאות, טיסות), החזר/י אותם ב-operations. כל פעולה נכתבת לטיול רק אחרי שהמשתמש מאשר אותה במסך, אז עדיף להציע פעולה מדויקת מאשר לא להציע כלום — אבל לעולם אל תמציא/י סכום, תאריך או שם שלא נאמרו.

כללים לפעולות:
- תאריכים תמיד YYYY-MM-DD. תאריך חלקי כמו "29/8" — השלם/י את השנה מתאריכי הטיול.
- "מחר", "יום ראשון הקרוב", "היום" — חשב/י ביחס ל-today שנמסר לך.
- מטבע: אם לא נאמר, השתמש/י במטבע הבסיס של הטיול.
- הוצאה שכבר שולמה: paid=true. אם נאמר "לא שולם" או שזו הזמנה עתידית: paid=false.
- פעילות חייבת ליפול בתוך תאריכי הטיול. אם המשתמש ביקש תאריך מחוץ לטווח, אל תמציא/י תאריך אחר — הסבר/י ב-reply.
- **הוצאה שהיא גם חוויה — החזר/י שתי פעולות.** ארוחה, בית קפה, אטרקציה, כרטיס למוזיאון או מעבורת הם גם הוצאה בתקציב וגם פעילות ביומן, לאותו תאריך ובאותה שעה. לינה, טיסה, השכרת רכב ודלק הם הוצאה בלבד — למלון ולטיסה יש רשומה משלהם ופעילות נוספת תיצור כפילות.
- אם המשתמש רק שואל שאלה, operations חייב להיות ריק.

כללים לתשובה:
- קצר. שתיים־שלוש שורות לכל היותר. המשתמש קורא בטלפון.
- אל תחזור/י על רשימת הפעולות בטקסט — הן מוצגות למשתמש ממילא בכרטיס נפרד. במקום זה אמור/י מה זיהית ומה דורש תשומת לב.
- בלי אימוג'ים, בלי כותרות, בלי markdown.`;

/**
 * Whether a model is configured, without calling one.
 *
 * The screen has to tell the person whether their trip data leaves the device,
 * and it cannot know that from the browser. This answers it for the cost of a
 * header — and never reveals the key itself, only that one is present.
 */
export async function GET() {
  const configured = !!process.env.ANTHROPIC_API_KEY;
  return Response.json({ configured, model: configured ? MODEL : null });
}

interface RequestBody {
  question?: unknown;
  context?: unknown;
  today?: unknown;
  history?: unknown;
}

function badRequest(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  // 501, not 500: the client reads this as "no model configured" and falls
  // back to the built-in assistant instead of showing an error.
  if (!apiKey) {
    return Response.json({ error: 'assistant model not configured' }, { status: 501 });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return badRequest('trip context too large', 413);

  let body: RequestBody;
  try {
    body = JSON.parse(raw) as RequestBody;
  } catch {
    return badRequest('invalid JSON');
  }

  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question) return badRequest('question is required');
  if (question.length > 4000) return badRequest('question too long');

  const today = typeof body.today === 'string' ? body.today : new Date().toISOString().slice(0, 10);
  const history = Array.isArray(body.history)
    ? body.history
        .filter(
          (t): t is { role: 'user' | 'assistant'; content: string } =>
            !!t &&
            typeof t === 'object' &&
            ((t as { role?: unknown }).role === 'user' ||
              (t as { role?: unknown }).role === 'assistant') &&
            typeof (t as { content?: unknown }).content === 'string'
        )
        // Only the recent turns: older ones cost tokens and rarely change the
        // answer, and the trip context is resent in full every time anyway.
        .slice(-6)
        .map((t) => ({ role: t.role, content: t.content.slice(0, 2000) }))
    : [];

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      thinking: { type: 'adaptive' },
      messages: [
        ...history,
        {
          role: 'user',
          content: [
            `today: ${today}`,
            '',
            'נתוני הטיול:',
            JSON.stringify(body.context ?? {}),
            '',
            'הודעת המשתמש:',
            question,
          ].join('\n'),
        },
      ],
      output_config: { format: zodOutputFormat(assistantReply) },
    });

    const parsed = response.parsed_output;
    if (!parsed) {
      return Response.json(
        { error: 'the model did not answer in the expected shape' },
        { status: 502 }
      );
    }

    return Response.json({
      reply: parsed.reply,
      operations: parsed.operations,
      model: response.model,
    });
  } catch (err) {
    // Everything below is reported to the client as a plain reason, because
    // the client's response to any of them is the same: say so and fall back
    // to the assistant that needs no network.
    if (err instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: 'המפתח של המודל נדחה' }, { status: 502 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return Response.json({ error: 'המודל עמוס כרגע, כדאי לנסות שוב' }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      console.error('[assistant] API error', err.status, err.message);
      return Response.json({ error: 'המודל לא זמין כרגע' }, { status: 502 });
    }
    // Structured-output parsing throws rather than returning null, so a model
    // that answers off-schema lands here. It has to be 502 and not 500: this
    // is a bad answer from upstream, not a broken server, and the client
    // falls back rather than showing a fault. Checked after `APIError`, which
    // extends this class.
    if (err instanceof Anthropic.AnthropicError) {
      console.error('[assistant] unusable model output', err.message);
      return Response.json(
        { error: 'המודל החזיר תשובה בפורמט לא צפוי' },
        { status: 502 }
      );
    }
    console.error('[assistant] unexpected', err);
    return Response.json({ error: 'שגיאה לא צפויה' }, { status: 500 });
  }
}
