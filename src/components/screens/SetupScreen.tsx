'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  CircleAlert,
  CircleDashed,
  Minus,
  RefreshCw,
  X,
} from 'lucide-react';
import { runDiagnostics, type CheckResult, type CheckStatus } from '@/lib/supabase/diagnostics';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { cn } from '@/lib/utils/cn';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

const STATUS_META: Record<
  CheckStatus,
  { icon: typeof Check; tone: string; ring: string; label: string }
> = {
  ok: { icon: Check, tone: 'text-success', ring: 'bg-success-soft', label: 'תקין' },
  fail: { icon: X, tone: 'text-danger', ring: 'bg-danger-soft', label: 'תקלה' },
  warn: { icon: CircleAlert, tone: 'text-warning', ring: 'bg-warning-soft', label: 'לתשומת לב' },
  skip: { icon: Minus, tone: 'text-faint', ring: 'bg-subtle', label: 'לא נבדק' },
};

/**
 * Self-serve check that the backend is wired up correctly.
 *
 * Setting up Supabase involves five separate places (project, SQL editor,
 * auth URLs, API keys, Vercel env). When it doesn't work the symptom is
 * always the same — nothing syncs — so this names the step that is missing.
 */
export function SetupScreen() {
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);

  // Bumping this re-runs the whole sweep; the run itself lives in the effect
  // so its state updates all happen after an await.
  const [runToken, setRunToken] = useState(0);
  const run = useCallback(() => setRunToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setRunning(true);
      setResults([]);
      await runDiagnostics((r) => {
        if (!cancelled) setResults((prev) => [...prev, r]);
      });
      if (!cancelled) setRunning(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [runToken]);

  const failures = results.filter((r) => r.status === 'fail');
  const done = !running && results.length > 0;
  const allGood = done && failures.length === 0;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 bg-bg/85 backdrop-blur-lg border-b border-line">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link
            href="/"
            aria-label="חזרה"
            className="-ms-2 size-9 grid place-items-center rounded-xl text-muted hover:bg-subtle hover:text-ink transition"
          >
            <ArrowRight className="size-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-[17px] leading-tight">בדיקת חיבור לשרת</h1>
            <p className="text-[12px] text-muted">
              {running ? 'בודק…' : `${results.length} בדיקות`}
            </p>
          </div>
          <Button size="sm" variant="secondary" loading={running} onClick={run}>
            <RefreshCw className="size-4" />
            בדיקה מחדש
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-5 pb-16">
        {!isSupabaseConfigured && (
          <Card className="p-4 mb-4 bg-subtle border-transparent">
            <p className="text-[14px] font-medium">האפליקציה רצה במצב מקומי</p>
            <p className="text-[13px] text-muted mt-1.5 leading-relaxed">
              זה מצב תקין לגמרי — הכל נשמר במכשיר והאפליקציה עובדת במלואה. הבדיקות שלמטה
              רלוונטיות רק אם רוצים לשתף טיול עם אנשים נוספים.
            </p>
          </Card>
        )}

        {allGood && (
          <Card className="p-4 mb-4 bg-success-soft border-transparent">
            <p className="text-[14px] font-medium text-success">הכל מחובר כמו שצריך ✅</p>
            <p className="text-[13px] text-success/85 mt-1.5 leading-relaxed">
              אפשר להעלות את הטיול לחשבון במסך ״הטיולים שלי״, ואז להזמין את המשפחה מתוך
              ההגדרות של הטיול.
            </p>
          </Card>
        )}

        {done && failures.length > 0 && (
          <Card className="p-4 mb-4 bg-danger-soft border-transparent">
            <p className="text-[14px] font-medium text-danger">
              {failures.length === 1 ? 'נמצאה תקלה אחת' : `נמצאו ${failures.length} תקלות`}
            </p>
            <p className="text-[13px] text-danger/85 mt-1.5 leading-relaxed">
              כל תקלה למטה כוללת בדיוק מה לעשות. אחרי התיקון — ״בדיקה מחדש״.
            </p>
          </Card>
        )}

        <div className="space-y-2.5">
          {results.map((result) => {
            const meta = STATUS_META[result.status];
            const Icon = meta.icon;
            return (
              <Card key={result.id} className="p-3.5">
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      'size-7 shrink-0 grid place-items-center rounded-full mt-0.5',
                      meta.ring,
                      meta.tone
                    )}
                    aria-hidden
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-medium text-[14.5px]">{result.label}</h2>
                      <span className={cn('text-[11.5px] font-medium', meta.tone)}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-[12.5px] text-muted mt-1 leading-relaxed break-words">
                      {result.detail}
                    </p>
                    {result.fix && (
                      <p className="text-[12.5px] mt-2 bg-inset rounded-xl px-3 py-2 leading-relaxed">
                        <span className="font-medium">מה לעשות: </span>
                        {result.fix}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}

          {running && (
            <Card className="p-3.5 flex items-center gap-3 text-muted">
              <CircleDashed className="size-5 animate-spin" />
              <span className="text-[13.5px]">בודק…</span>
            </Card>
          )}
        </div>

        <p className="text-[12px] text-faint mt-6 leading-relaxed text-center">
          הוראות ההגדרה המלאות נמצאות בקובץ <code className="ltr-nums">supabase/README.md</code>{' '}
          בקוד המקור.
        </p>
      </main>
    </div>
  );
}
