'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Luggage, UserPlus } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth-store';
import { useTripStore } from '@/lib/store/trip-store';
import { toast } from '@/lib/store/ui-store';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { ROLE_LABEL, acceptInvite, peekInvite, type InvitePreview } from '@/lib/supabase/members';
import { countryFlag } from '@/lib/utils/format';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState, LoadingScreen } from '@/components/ui/Feedback';
import { Badge } from '@/components/ui/Bits';

function JoinInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const authStatus = useAuthStore((s) => s.status);
  const setActiveTrip = useTripStore((s) => s.setActiveTrip);
  const rehydrate = useTripStore((s) => s.rehydrate);

  // One piece of state: the outcome of looking the invite up. `null` is
  // "still looking", which keeps the effect free of synchronous setState.
  const [result, setResult] = useState<
    { kind: 'ready'; preview: InvitePreview } | { kind: 'missing' } | { kind: 'error' } | null
  >(null);
  const [joining, setJoining] = useState(false);

  // The invite can be previewed before signing in, so the user knows what
  // they are being asked to join before being asked for an email.
  useEffect(() => {
    if (!token || !isSupabaseConfigured) {
      // Resolved asynchronously so the effect never sets state during render.
      const t = setTimeout(() => setResult({ kind: 'missing' }), 0);
      return () => clearTimeout(t);
    }
    let cancelled = false;
    peekInvite(token)
      .then((p) => {
        if (!cancelled) setResult(p ? { kind: 'ready', preview: p } : { kind: 'missing' });
      })
      .catch(() => {
        if (!cancelled) setResult({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const join = async () => {
    if (authStatus !== 'signed-in') {
      router.push(`/login?next=${encodeURIComponent(`/join?token=${token}`)}`);
      return;
    }
    setJoining(true);
    try {
      const tripId = await acceptInvite(token);
      await rehydrate();
      setActiveTrip(tripId);
      toast.success('הצטרפת לטיול');
      router.replace('/dashboard');
    } catch (err) {
      console.error('[join] failed', err);
      toast.error('ההצטרפות נכשלה. ייתכן שההזמנה בוטלה או פגה.');
      setJoining(false);
    }
  };

  const preview = result?.kind === 'ready' ? result.preview : null;

  if (result === null) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <LoadingScreen label="בודק את ההזמנה…" />
      </div>
    );
  }

  if (result.kind === 'error') {
    return (
      <div className="min-h-dvh grid place-items-center px-4">
        <ErrorState
          title="לא הצלחנו לבדוק את ההזמנה"
          message="ייתכן שאין חיבור לאינטרנט. אפשר לנסות שוב."
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  if (result.kind === 'missing' || !preview) {
    return (
      <div className="min-h-dvh grid place-items-center px-4">
        <Card className="p-6 max-w-md text-center">
          <p className="text-3xl mb-3" aria-hidden>
            🔗
          </p>
          <h1 className="font-semibold text-[17px]">ההזמנה לא נמצאה</h1>
          <p className="text-[13.5px] text-muted mt-2 leading-relaxed">
            הקישור אינו תקין או שההזמנה בוטלה. כדאי לבקש קישור חדש ממי ששיתף אותך.
          </p>
          <Button className="mt-5" onClick={() => router.replace('/')}>
            לטיולים שלי
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh grid place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <span className="inline-grid place-items-center size-14 rounded-2xl bg-brand text-brand-contrast mb-3.5">
            <Luggage className="size-7" />
          </span>
          <h1 className="font-semibold text-[19px]">הוזמנת לטיול</h1>
        </div>

        <Card className="p-5 text-center">
          <p className="text-2xl mb-1.5" aria-hidden>
            {countryFlag('') === '🌍' ? '🧳' : ''}
          </p>
          <h2 className="font-semibold text-[18px]">{preview.tripName}</h2>
          {preview.destination && (
            <p className="text-[13.5px] text-muted mt-1">{preview.destination}</p>
          )}
          <div className="mt-3">
            <Badge tone="brand">הרשאת {ROLE_LABEL[preview.role]}</Badge>
          </div>

          {preview.expired ? (
            <p className="mt-5 text-[13.5px] text-danger bg-danger-soft rounded-xl px-3 py-2.5">
              תוקף ההזמנה פג. כדאי לבקש קישור חדש.
            </p>
          ) : (
            <>
              <Button fullWidth className="mt-5" loading={joining} onClick={() => void join()}>
                <UserPlus className="size-4" />
                {authStatus === 'signed-in' ? 'הצטרפות לטיול' : 'התחברות והצטרפות'}
              </Button>
              {authStatus !== 'signed-in' && (
                <p className="text-[12px] text-faint mt-3 leading-relaxed">
                  נבקש ממך אימייל ונשלח קישור כניסה. אחריו תצורפי לטיול אוטומטית.
                </p>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

export function JoinScreen() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh grid place-items-center">
          <LoadingScreen />
        </div>
      }
    >
      <JoinInner />
    </Suspense>
  );
}
