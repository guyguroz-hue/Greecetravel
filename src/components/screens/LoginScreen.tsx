'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ArrowLeft, KeyRound, Luggage, Mail, MailCheck, User } from 'lucide-react';
import { MIN_PASSWORD_LENGTH, useAuthStore } from '@/lib/store/auth-store';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { Card } from '@/components/ui/Card';
import { LoadingScreen } from '@/components/ui/Feedback';
import { cn } from '@/lib/utils/cn';

/** The wordmark, drawn rather than fetched — the page loads no third-party assets. */
function GoogleMark() {
  return (
    <svg className="size-[18px]" viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

type Mode = 'password' | 'signup' | 'link';

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';

  const status = useAuthStore((s) => s.status);
  const signInWithEmail = useAuthStore((s) => s.signInWithEmail);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const signInWithPassword = useAuthStore((s) => s.signInWithPassword);
  const signUpWithPassword = useAuthStore((s) => s.signUpWithPassword);
  const linkSentTo = useAuthStore((s) => s.linkSentTo);
  const clearLinkSent = useAuthStore((s) => s.clearLinkSent);

  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<null | 'google' | 'form'>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmSentTo, setConfirmSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'signed-in') router.replace(next);
  }, [status, router, next]);

  const submit = async () => {
    setBusy('form');
    setError(null);
    const result =
      mode === 'link'
        ? await signInWithEmail(email)
        : mode === 'signup'
          ? await signUpWithPassword(email, password, name)
          : await signInWithPassword(email, password);
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (result.needsConfirmation) setConfirmSentTo(email.trim().toLowerCase());
    // A successful password sign-in flips `status`, and the effect above
    // handles the redirect — there is nothing to do here.
  };

  const google = async () => {
    setBusy('google');
    setError(null);
    const result = await signInWithGoogle(next === '/' ? undefined : next);
    // On success the browser is already navigating away; only a failure
    // returns control to this screen.
    if (!result.ok) {
      setBusy(null);
      setError(result.message);
    }
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

  const sentTo = linkSentTo ?? confirmSentTo;
  const isSignup = mode === 'signup';

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-7">
          <span className="inline-grid place-items-center size-14 rounded-2xl bg-brand text-brand-contrast mb-3.5">
            <Luggage className="size-7" />
          </span>
          <h1 className="font-semibold text-[21px]">My Trip Planner</h1>
          <p className="text-[13.5px] text-muted mt-1.5 leading-relaxed">
            התחברות כדי לתכנן טיולים יחד עם המשפחה — כולם רואים את אותו מסלול, אותו תקציב
            ואותם מסמכים.
          </p>
        </div>

        {sentTo ? (
          <Card className="p-6 text-center">
            <span className="inline-grid place-items-center size-12 rounded-2xl bg-success-soft text-success mb-3">
              <MailCheck className="size-6" />
            </span>
            <h2 className="font-semibold text-[16px]">
              {confirmSentTo ? 'כמעט שם — צריך לאשר את הכתובת' : 'בדוק את המייל'}
            </h2>
            <p className="text-[13.5px] text-muted mt-2 leading-relaxed">
              שלחנו {confirmSentTo ? 'קישור אישור' : 'קישור כניסה'} ל־
              <span className="font-medium text-ink ltr-nums"> {sentTo}</span>.
              {confirmSentTo
                ? ' אחרי לחיצה עליו אפשר להתחבר עם הסיסמה שבחרת, בלי מיילים נוספים.'
                : ' הקישור תקף לשעה, ופותח את האפליקציה ישירות.'}
            </p>
            <Button
              variant="secondary"
              className="mt-5"
              onClick={() => {
                clearLinkSent();
                setConfirmSentTo(null);
                setMode('password');
              }}
            >
              חזרה להתחברות
            </Button>
          </Card>
        ) : (
          <Card className="p-5">
            <Button
              variant="secondary"
              fullWidth
              loading={busy === 'google'}
              disabled={busy !== null}
              onClick={() => void google()}
            >
              {busy !== 'google' && <GoogleMark />}
              המשך עם Google
            </Button>

            <div className="flex items-center gap-3 my-4" aria-hidden>
              <span className="h-px flex-1 bg-line" />
              <span className="text-[12px] text-faint">או</span>
              <span className="h-px flex-1 bg-line" />
            </div>

            {mode !== 'link' && (
              <div
                role="tablist"
                aria-label="כניסה או הרשמה"
                className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-inset mb-4"
              >
                {(
                  [
                    ['password', 'כניסה'],
                    ['signup', 'הרשמה'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={mode === value}
                    onClick={() => {
                      setMode(value);
                      setError(null);
                    }}
                    className={cn(
                      'h-9 rounded-lg text-[13.5px] font-medium transition',
                      mode === value
                        ? 'bg-surface text-ink shadow-card'
                        : 'text-muted hover:text-ink'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {isSignup && (
                <TextInput
                  label="השם שלך"
                  autoComplete="name"
                  placeholder="איך שהמשפחה תראה אותך"
                  prefix={<User className="size-4" />}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              )}

              <TextInput
                label="כתובת אימייל"
                type="email"
                dir="ltr"
                autoComplete="email"
                placeholder="name@example.com"
                prefix={<Mail className="size-4" />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submit();
                }}
              />

              {mode !== 'link' && (
                <TextInput
                  label="סיסמה"
                  type="password"
                  dir="ltr"
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  hint={isSignup ? `לפחות ${MIN_PASSWORD_LENGTH} תווים` : undefined}
                  prefix={<KeyRound className="size-4" />}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void submit();
                  }}
                />
              )}
            </div>

            {error && (
              <p className="text-[12.5px] text-danger bg-danger-soft rounded-xl px-3 py-2.5 mt-3 leading-relaxed">
                {error}
              </p>
            )}

            <Button
              fullWidth
              className="mt-4"
              loading={busy === 'form'}
              disabled={busy !== null}
              onClick={() => void submit()}
            >
              {mode === 'link' ? 'שליחת קישור כניסה' : isSignup ? 'יצירת חשבון' : 'כניסה'}
            </Button>

            <button
              type="button"
              onClick={() => {
                setMode(mode === 'link' ? 'password' : 'link');
                setError(null);
              }}
              className="mt-3 w-full text-[12.5px] text-muted hover:text-brand transition"
            >
              {mode === 'link'
                ? 'חזרה לכניסה עם סיסמה'
                : 'שכחת סיסמה? כניסה עם קישור חד־פעמי למייל'}
            </button>
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
