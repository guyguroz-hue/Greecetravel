'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingScreen } from '@/components/ui/Feedback';

/**
 * Where the magic link lands. The Supabase client is configured with
 * `detectSessionInUrl`, so it exchanges the code for a session on its own;
 * this screen just waits for that to finish and then gets out of the way.
 */
function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      router.replace('/');
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      router.replace('/');
      return;
    }

    // An error can come back in the query string or the hash fragment.
    const hash = new URLSearchParams(
      typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : ''
    );
    const errorDescription =
      params.get('error_description') || hash.get('error_description') || null;
    if (errorDescription) {
      const t = setTimeout(() => setFailed(errorDescription), 0);
      return () => clearTimeout(t);
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      router.replace(next);
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) finish();
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) finish();
    });

    // If nothing arrives, say so rather than spinning forever.
    const timeout = setTimeout(() => {
      if (!done) setFailed('הקישור אינו תקף יותר. אפשר לבקש קישור חדש.');
    }, 8000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [router, next, params]);

  if (failed) {
    return (
      <div className="min-h-dvh grid place-items-center px-4">
        <Card className="p-6 max-w-md text-center">
          <p className="text-3xl mb-3" aria-hidden>
            ⏳
          </p>
          <h1 className="font-semibold text-[17px]">הכניסה לא הושלמה</h1>
          <p className="text-[13.5px] text-muted mt-2 leading-relaxed">{failed}</p>
          <Button className="mt-5" onClick={() => router.replace('/login')}>
            שליחת קישור חדש
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh grid place-items-center">
      <LoadingScreen label="מכניס אותך…" />
    </div>
  );
}

export function AuthCallbackScreen() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh grid place-items-center">
          <LoadingScreen />
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
