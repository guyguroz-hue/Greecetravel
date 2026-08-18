'use client';

import { getSupabase, isSupabaseConfigured } from './client';
import { DOCUMENTS_BUCKET } from './storage';

/**
 * Checks the app can run against the user's own Supabase project.
 *
 * Every check answers one question that can actually go wrong during setup,
 * and every failure carries the specific next step — the point is to turn
 * "it doesn't work" into "step 3 is missing".
 */

export type CheckStatus = 'ok' | 'fail' | 'warn' | 'skip';

export interface CheckResult {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  /** What to do about it, when it isn't ok. */
  fix?: string;
  /** Nothing after this can produce a meaningful answer, so stop the run. */
  fatal?: boolean;
}

const PROJECT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

/**
 * Supabase issues two shapes of browser key: the current `sb_publishable_…`
 * and the legacy JWT starting `eyJ`. Anything else was copied from the wrong
 * field, and `sb_secret_…` / a `service_role` JWT is a key that must never
 * reach the browser at all.
 */
function inspectKey(key: string): Omit<CheckResult, 'id' | 'label'> | null {
  if (/^sb_secret_/.test(key)) {
    return {
      status: 'fail',
      detail: 'המפתח שהוגדר הוא Secret key — הוא עוקף את כל חוקי ההרשאות ואסור שיגיע לדפדפן.',
      fix: 'להחליף מיד ל-Publishable key מ-Settings → API Keys, ואז לעשות Rotate למפתח הסודי שנחשף.',
      fatal: true,
    };
  }
  if (/\s/.test(key)) {
    return {
      status: 'warn',
      detail: 'במפתח יש רווח או שבירת שורה באמצע — כנראה הועתק בסימון ידני.',
      fix: 'להעתיק שוב עם כפתור ההעתקה שליד המפתח ב-Settings → API Keys.',
    };
  }
  if (!/^sb_publishable_/.test(key) && !key.startsWith('eyJ')) {
    return {
      status: 'warn',
      detail: 'המפתח לא נראה כמו מפתח של Supabase.',
      fix: 'מפתח תקין מתחיל ב-sb_publishable_ (הפורמט הנוכחי) או ב-eyJ (הישן). כדאי להעתיק שוב מ-Settings → API Keys.',
    };
  }
  return null;
}

function describe(err: unknown): string {
  if (!err) return '';
  if (typeof err === 'object') {
    const e = err as { message?: string; code?: string; hint?: string };
    const said = [e.code, e.message].filter(Boolean).join(' · ');
    if (said) return said;
    // A HEAD request carries no body to parse, so the error can be genuinely
    // blank. Printing the empty object as JSON just puzzles the reader.
    const json = JSON.stringify(err);
    return json === '{}' || /^\{"message":""\}$/.test(json) ? '' : json;
  }
  return String(err);
}

/* ------------------------------------------------------------------ */

async function checkEnv(): Promise<CheckResult> {
  if (!isSupabaseConfigured) {
    return {
      id: 'env',
      label: 'משתני הסביבה',
      status: 'fail',
      detail: 'NEXT_PUBLIC_SUPABASE_URL או NEXT_PUBLIC_SUPABASE_ANON_KEY חסרים.',
      fix: 'להוסיף את שניהם ב-Vercel תחת Settings → Environment Variables, ואז Redeploy. המשתנים נצרבים בזמן הבילד, ולכן פריסה מחדש היא חובה.',
      fatal: true,
    };
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(PROJECT_URL)) {
    return {
      id: 'env',
      label: 'משתני הסביבה',
      status: 'warn',
      detail: `הכתובת שהוגדרה היא ${PROJECT_URL}`,
      fix: 'בדרך כלל הכתובת נראית כמו https://abcdefgh.supabase.co — כדאי לוודא שהועתקה מ-Project Settings → API.',
    };
  }
  return {
    id: 'env',
    label: 'משתני הסביבה',
    status: 'ok',
    detail: PROJECT_URL,
  };
}

async function checkKey(): Promise<CheckResult> {
  const base = { id: 'key', label: 'המפתח הציבורי' };
  const problem = inspectKey(ANON_KEY);
  if (problem) return { ...base, ...problem };
  const kind = ANON_KEY.startsWith('sb_publishable_') ? 'Publishable key' : 'מפתח anon ישן (JWT)';
  return { ...base, status: 'ok', detail: `הפורמט תקין — ${kind}.` };
}

async function checkReachable(): Promise<CheckResult> {
  const base = { id: 'reach', label: 'חיבור לפרויקט' };
  try {
    // Both headers, because that is what supabase-js sends. With a legacy
    // anon JWT the gateway fills Authorization in from apikey on its own, so
    // apikey alone appeared to be enough — but with a publishable key it is
    // not, and the check then failed against a project the app itself could
    // talk to perfectly well.
    const res = await fetch(`${PROJECT_URL.replace(/\/$/, '')}/rest/v1/`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });
    // Any HTTP answer means the project exists and the key was accepted well
    // enough to route; 401/403 means the key itself is wrong.
    if (res.status === 401 || res.status === 403) {
      // The gateway explains *why* it rejected the key, and the two reasons
      // need opposite fixes: a wrong value is re-copied, whereas a disabled
      // legacy key is replaced with the publishable one. Without this the
      // screen can only say "the key is wrong", which sends people back to
      // re-copy the very key that will keep being refused.
      const reason = await res
        .clone()
        .json()
        .then((b: { message?: string; msg?: string; hint?: string }) =>
          [b.message ?? b.msg, b.hint].filter(Boolean).join(' — ')
        )
        .catch(() => '');
      const legacyDisabled = /legacy|disabled/i.test(reason);
      return {
        ...base,
        status: 'fail',
        detail: `הפרויקט עונה אבל דוחה את המפתח (${res.status}).${reason ? ` ${reason}` : ''}`,
        fix: legacyDisabled
          ? 'מפתחות ה-JWT הישנים מושבתים בפרויקט הזה. ב-Settings → API Keys להעתיק את ה-Publishable key (מתחיל ב-sb_publishable_), לעדכן אותו ב-Vercel ולעשות Redeploy.'
          : 'ב-Settings → API Keys להעתיק מחדש עם כפתור ההעתקה את ה-Publishable key (או את מפתח ה-anon public, אם הישנים עדיין פעילים), לעדכן ב-Vercel ולעשות Redeploy. לוודא שזה לא מפתח service_role או secret. חשוב: אם הבדיקות שמתחת ירוקות — המפתח דווקא תקין והאפליקציה עובדת; אז אין מה לתקן.',
      };
    }
    return { ...base, status: 'ok', detail: `הפרויקט עונה (${res.status}).` };
  } catch (err) {
    return {
      ...base,
      status: 'fail',
      detail: `לא הצלחנו להגיע לפרויקט. ${describe(err)}`,
      fix: 'לוודא שהכתובת נכונה ושהפרויקט ב-Supabase פעיל (פרויקטים חינמיים נכנסים לשינה אחרי חוסר שימוש — כניסה ללוח הבקרה מעירה אותם).',
      // No HTTP answer at all: the address is wrong or the project is
      // asleep, and every check below would just repeat the same timeout.
      fatal: true,
    };
  }
}

async function checkSchema(): Promise<CheckResult> {
  const base = { id: 'schema', label: 'הסכימה הורצה' };
  const supabase = getSupabase();
  if (!supabase) return { ...base, status: 'skip', detail: 'אין חיבור.' };

  // The RPC only exists if the migration ran. A valid-looking token that
  // matches nothing simply returns no rows.
  const { error } = await supabase.rpc('peek_trip_invite', { p_token: '__diagnostics__' });
  if (!error) return { ...base, status: 'ok', detail: 'הפונקציות והטריגרים קיימים.' };

  const code = (error as { code?: string }).code;
  if (code === 'PGRST202' || /does not exist|could not find/i.test(error.message)) {
    return {
      ...base,
      status: 'fail',
      detail: 'הפונקציה peek_trip_invite לא נמצאה.',
      fix: 'להריץ את supabase/migrations/0001_init.sql ב-SQL Editor של הפרויקט. זה יוצר את הטבלאות, ההרשאות, הטריגרים והפונקציות.',
    };
  }
  return { ...base, status: 'warn', detail: describe(error) };
}

async function checkTables(): Promise<CheckResult> {
  const base = { id: 'tables', label: 'הטבלאות קיימות' };
  const supabase = getSupabase();
  if (!supabase) return { ...base, status: 'skip', detail: 'אין חיבור.' };

  const tables = ['trips', 'trip_members', 'days', 'activities', 'expenses', 'documents'];
  const missing: string[] = [];
  const denied: string[] = [];
  const other: string[] = [];

  for (const table of tables) {
    const { error } = await supabase.from(table).select('*', { head: true, count: 'exact' }).limit(1);
    if (!error) continue;
    const code = (error as { code?: string }).code;
    // 42P01 = relation does not exist. 42501 = no grant, which for these
    // tables means the migration's grants did not apply.
    if (code === '42P01' || /does not exist/i.test(error.message)) missing.push(table);
    else if (code === '42501') denied.push(table);
    // Anything else is still a failed read. Reporting it as "fine" is how a
    // rejected key ends up looking like a healthy schema.
    else other.push(describe(error));
  }

  if (missing.length > 0) {
    return {
      ...base,
      status: 'fail',
      detail: `חסרות טבלאות: ${missing.join(', ')}`,
      fix: 'להריץ את supabase/migrations/0001_init.sql ב-SQL Editor.',
    };
  }
  if (denied.length > 0) {
    return {
      ...base,
      status: 'warn',
      detail: `אין הרשאת קריאה ל: ${denied.join(', ')}`,
      fix: 'להריץ את הסכימה שוב — היא מגדירה את חוקי ההרשאות מחדש.',
    };
  }
  if (other.length > 0) {
    return {
      ...base,
      status: 'fail',
      detail: `הקריאה לטבלאות נכשלה${other[0] ? `: ${other[0]}` : ' — השרת דחה את הבקשה.'}`,
      fix: 'אם הבדיקה של המפתח למעלה נכשלה — זו אותה תקלה, ומספיק לתקן אותה.',
    };
  }
  return { ...base, status: 'ok', detail: `כל ${tables.length} הטבלאות שנבדקו קיימות.` };
}

async function checkStorage(): Promise<CheckResult> {
  const base = { id: 'storage', label: 'אחסון מסמכים' };
  const supabase = getSupabase();
  if (!supabase) return { ...base, status: 'skip', detail: 'אין חיבור.' };

  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).list('', { limit: 1 });
  if (!error) return { ...base, status: 'ok', detail: `ה-bucket ${DOCUMENTS_BUCKET} קיים.` };

  if (/not found|does not exist/i.test(error.message)) {
    return {
      ...base,
      status: 'fail',
      detail: `ה-bucket ${DOCUMENTS_BUCKET} לא נמצא.`,
      fix: 'החלק האחרון של הסכימה יוצר אותו. אם הוא לא נוצר — אפשר ליצור ידנית ב-Storage bucket פרטי בשם trip-documents ולהריץ שוב את הסכימה.',
    };
  }
  // A key that was refused outright says nothing about the bucket, so it must
  // not be reported as one that exists and is merely protected.
  if (/api key|unauthorized|invalid.*jwt|jwt.*invalid/i.test(error.message)) {
    return {
      ...base,
      status: 'fail',
      detail: describe(error),
      fix: 'אם הבדיקה של המפתח למעלה נכשלה — זו אותה תקלה, ומספיק לתקן אותה.',
    };
  }
  // A permission error while signed out is the expected, correct behaviour.
  return {
    ...base,
    status: 'ok',
    detail: 'ה-bucket קיים ומוגן — גישה נפתחת רק לחברי הטיול.',
  };
}

async function checkAuth(): Promise<CheckResult> {
  const base = { id: 'auth', label: 'התחברות' };
  const supabase = getSupabase();
  if (!supabase) return { ...base, status: 'skip', detail: 'אין חיבור.' };

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    return { ...base, status: 'warn', detail: describe(error) };
  }
  if (!data.session) {
    return {
      ...base,
      status: 'warn',
      detail: 'לא מחוברים כרגע — האפליקציה עובדת במצב מקומי.',
      fix: 'להתחבר במסך ההתחברות. אם הקישור מהמייל לא מחזיר אותך לאפליקציה, צריך להוסיף את כתובת /auth/callback תחת Authentication → URL Configuration.',
    };
  }
  return {
    ...base,
    status: 'ok',
    detail: `מחוברים כ-${data.session.user.email ?? data.session.user.id}.`,
  };
}

/** Reads a JWT's payload without verifying it — enough to see its claims. */
function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * The check that separates "signed in" from "signed in as far as the database
 * is concerned".
 *
 * The device can hold a perfectly good-looking session while Postgres sees an
 * anonymous request — and because an anonymous SELECT under these policies
 * returns zero rows instead of an error, that state looks exactly like a new
 * empty account until the first write is refused.
 */
async function checkIdentity(): Promise<CheckResult> {
  const base = { id: 'identity', label: 'הזהות שהשרת מזהה' };
  const supabase = getSupabase();
  if (!supabase) return { ...base, status: 'skip', detail: 'אין חיבור.' };

  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) return { ...base, status: 'skip', detail: 'רלוונטי רק אחרי התחברות.' };

  const claims = decodeJwt(sess.session.access_token) ?? {};
  const role = typeof claims.role === 'string' ? claims.role : '(אין)';
  const exp = typeof claims.exp === 'number' ? claims.exp : null;
  const secondsLeft = exp ? exp - Math.floor(Date.now() / 1000) : null;

  // getUser() is answered by the server, so unlike getSession() it cannot be
  // satisfied by a stale token sitting in local storage.
  const { data: who, error } = await supabase.auth.getUser();
  if (error || !who.user) {
    return {
      ...base,
      status: 'fail',
      detail:
        `המכשיר מחזיק חיבור פעיל, אבל השרת לא מקבל אותו` +
        (secondsLeft !== null && secondsLeft <= 0 ? ' — התוקן של החיבור פג.' : '.') +
        (error ? ` ${describe(error)}` : ''),
      fix: 'להתנתק ולהתחבר מחדש. אם זה חוזר, סימן שהמפתח ב-Vercel שייך לפרויקט אחר מזה שההתחברות נעשית מולו.',
    };
  }

  if (role !== 'authenticated') {
    return {
      ...base,
      status: 'fail',
      detail: `החיבור מזוהה בתור ״${role}״ ולא בתור authenticated, ולכן כל כתיבה תידחה.`,
      fix: 'להתנתק ולהתחבר מחדש.',
    };
  }

  // Proof that auth.uid() resolves inside Postgres: the profile row is
  // visible only to its owner, so getting it back means the JWT arrived.
  const { data: rows, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', who.user.id);

  if (profileError) {
    return { ...base, status: 'warn', detail: describe(profileError) };
  }
  if (!rows || rows.length === 0) {
    return {
      ...base,
      status: 'fail',
      detail:
        'השרת מזהה את החשבון, אבל בתוך מסד הנתונים הבקשות מגיעות בלי זהות — ' +
        'ולכן כתיבה נדחית וקריאה מחזירה ריק במקום שגיאה.',
      fix: 'להריץ את supabase/migrations/0001_init.sql שוב ב-SQL Editor. אם זה לא עוזר — ב-Supabase תחת Settings → API Keys לוודא שהמפתח שב-Vercel שייך לפרויקט הזה.',
    };
  }

  return {
    ...base,
    status: 'ok',
    detail: `מזוהה כ-${who.user.email ?? who.user.id} בתפקיד authenticated, וגם מסד הנתונים רואה את זה.`,
  };
}

async function checkMyData(): Promise<CheckResult> {
  const base = { id: 'data', label: 'קריאת הטיולים שלך' };
  const supabase = getSupabase();
  if (!supabase) return { ...base, status: 'skip', detail: 'אין חיבור.' };

  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    return { ...base, status: 'skip', detail: 'רלוונטי רק אחרי התחברות.' };
  }

  const { data, error } = await supabase.from('trips').select('id, name');
  if (error) {
    return {
      ...base,
      status: 'fail',
      detail: describe(error),
      fix: 'כנראה חוקי ההרשאות לא הורצו במלואם. כדאי להריץ את הסכימה שוב.',
    };
  }
  return {
    ...base,
    status: 'ok',
    detail:
      data.length === 0
        ? 'החיבור תקין. אין עדיין טיולים בחשבון — אפשר להעלות את הטיול מהמכשיר במסך ״הטיולים שלי״.'
        : `${data.length} טיולים בחשבון: ${data.map((t) => t.name).join(', ')}`,
  };
}

/* ------------------------------------------------------------------ */

/**
 * Runs the checks in order and reports each one as it resolves, so the screen
 * fills in progressively instead of sitting blank while a timeout expires.
 */
export async function runDiagnostics(
  onResult: (result: CheckResult) => void
): Promise<CheckResult[]> {
  const steps = [
    checkEnv,
    checkKey,
    checkReachable,
    checkSchema,
    checkTables,
    checkStorage,
    checkAuth,
    checkIdentity,
    checkMyData,
  ];
  const results: CheckResult[] = [];

  for (const step of steps) {
    let result: CheckResult;
    try {
      result = await step();
    } catch (err) {
      result = {
        id: step.name,
        label: step.name,
        status: 'fail',
        detail: describe(err),
      };
    }
    results.push(result);
    onResult(result);

    // A rejected key is deliberately *not* fatal: the checks below go through
    // supabase-js, so if this hand-rolled request is the thing that is wrong,
    // they will say so instead of the run stopping on a false alarm.
    if (result.fatal) break;
  }

  return results;
}
