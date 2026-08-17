'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ArrowLeft, Luggage, Mail, MailCheck } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth-store';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { Card } from '@/components/ui/Card';
import { LoadingScreen } from '@/components/ui/Feedback';

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';

  const status = useAuthStore((s) => s.status);
  const signInWithEmail = useAuthStore((s) => s.signInWithEmail);
  const linkSentTo = useAuthStore((s) => s.linkSentTo);
  const clearLinkSent = useAuthStore((s) => s.clearLinkSent);

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'signed-in') router.replace(next);
  }, [status, router, next]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await signInWithEmail(email);
    setBusy(false);
    if (!result.ok) setError(result.message);
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-dvh grid place-items-center px-4">
        <Card className="p-6 max-w-md text-center">
          <h1 className="font-semibold text-[17px]">חשבונות אינם מופעלים</h1>
          <p className="text-[13.5px] text-muted mt-2 leading-relaxed">
            האפליקציה רצה במצב מקומי — כל הנתונים נשמרים במכשיר הזה בלבד. כדי לשתף טיול עם
            אנשים נוספים צריך להגדיר את משתני הסביבה של Supabase.
          </p>
          <Button className="mt-5" onClick={() => router.replace('/')}>
            חזרה לטיולים
          </Button>
        </Card>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="min-h-dvh grid place-items-center">
        <LoadingScreen label="בודק חיבור…" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-7">
          <span className="inline-grid place-items-center size-14 rounded-2xl bg-brand text-brand-contrast mb-3.5">
            <Luggage className="size-7" />
          </span>
          <h1 className="font-semibold text-[21px]">My Trip Planner</h1>
          <p className="text-[13.5px] text-muted mt-1.5 leading-relaxed">
            התחברי כדי לתכנן טיולים יחד עם המשפחה — כולם רואים את אותו מסלול, אותו תקציב ואותם
            מסמכים.
          </p>
        </div>

        {linkSentTo ? (
          <Card className="p-6 text-center">
            <span className="inline-grid place-items-center size-12 rounded-2xl bg-success-soft text-success mb-3">
              <MailCheck className="size-6" />
            </span>
            <h2 className="font-semibold text-[16px]">בדקי את המייל</h2>
            <p className="text-[13.5px] text-muted mt-2 leading-relaxed">
              שלחנו קישור כניסה ל־
              <span className="font-medium text-ink ltr-nums"> {linkSentTo}</span>. הקישור תקף
              לשעה, ופותח את האפליקציה ישירות.
            </p>
            <Button variant="secondary" className="mt-5" onClick={clearLinkSent}>
              שליחה לכתובת אחרת
            </Button>
          </Card>
        ) : (
          <Card className="p-5">
            <TextInput
              label="כתובת אימייל"
              type="email"
              dir="ltr"
              autoFocus
              autoComplete="email"
              placeholder="name@example.com"
              prefix={<Mail className="size-4" />}
              value={email}
              error={error ?? undefined}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit();
              }}
            />
            <Button fullWidth className="mt-4" loading={busy} onClick={() => void submit()}>
              שליחת קישור כניסה
            </Button>
            <p className="text-[12px] text-faint mt-3 leading-relaxed text-center">
              אין צורך בסיסמה. נשלח לך קישור חד־פעמי למייל.
            </p>
          </Card>
        )}

        <button
          type="button"
          onClick={() => router.replace('/')}
          className="mt-5 w-full inline-flex items-center justify-center gap-1.5 text-[13px] text-muted hover:text-brand transition"
        >
          <ArrowLeft className="size-3.5" />
          המשך בלי חשבון, במכשיר הזה בלבד
        </button>
      </div>
    </div>
  );
}

export function LoginScreen() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh grid place-items-center">
          <LoadingScreen />
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
