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
}

const PROJECT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';

function describe(err: unknown): string {
  if (!err) return '';
  if (typeof err === 'object') {
    const e = err as { message?: string; code?: string; hint?: string };
    return [e.code, e.message].filter(Boolean).join(' · ') || JSON.stringify(err);
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

async function checkReachable(): Promise<CheckResult> {
  const base = { id: 'reach', label: 'חיבור לפרויקט' };
  try {
    const res = await fetch(`${PROJECT_URL.replace(/\/$/, '')}/rest/v1/`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' },
    });
    // Any HTTP answer means the project exists and the key was accepted well
    // enough to route; 401/403 means the key itself is wrong.
    if (res.status === 401 || res.status === 403) {
      return {
        ...base,
        status: 'fail',
        detail: `הפרויקט עונה אבל דוחה את המפתח (${res.status}).`,
        fix: 'להעתיק מחדש את המפתח anon public מ-Project Settings → API. שימי לב שזה לא מפתח service_role.',
      };
    }
    return { ...base, status: 'ok', detail: `הפרויקט עונה (${res.status}).` };
  } catch (err) {
    return {
      ...base,
      status: 'fail',
      detail: `לא הצלחנו להגיע לפרויקט. ${describe(err)}`,
      fix: 'לוודא שהכתובת נכונה ושהפרויקט ב-Supabase פעיל (פרויקטים חינמיים נכנסים לשינה אחרי חוסר שימוש — כניסה ללוח הבקרה מעירה אותם).',
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

  for (const table of tables) {
    const { error } = await supabase.from(table).select('*', { head: true, count: 'exact' }).limit(1);
    if (!error) continue;
    const code = (error as { code?: string }).code;
    // 42P01 = relation does not exist. 42501 = no grant, which for these
    // tables means the migration's grants did not apply.
    if (code === '42P01' || /does not exist/i.test(error.message)) missing.push(table);
    else if (code === '42501') denied.push(table);
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
  const steps = [checkEnv, checkReachable, checkSchema, checkTables, checkStorage, checkAuth, checkMyData];
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

    // Nothing below can succeed if we cannot even reach the project.
    if (result.id === 'reach' && result.status === 'fail') break;
    if (result.id === 'env' && result.status === 'fail') break;
  }

  return results;
}
