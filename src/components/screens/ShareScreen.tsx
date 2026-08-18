'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CloudUpload, LogIn, Users } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useActiveTrip } from '@/lib/store/hooks';
import { useAuthStore } from '@/lib/store/auth-store';
import { useTripStore } from '@/lib/store/trip-store';
import { toast } from '@/lib/store/ui-store';
import { getLocalRepository } from '@/lib/db';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TripMembersCard } from '@/components/settings/TripMembersCard';

/**
 * Sharing has its own screen because it used to have none.
 *
 * It lived at the bottom of Settings and only rendered when signed in, so
 * someone looking for "how do I add my family" found "מטיילים" — the list of
 * people expenses are split between — and reasonably concluded that names were
 * all the app could do. Now the entry is always visible, and when it cannot
 * work yet it says which step is missing instead of hiding.
 */
export function ShareScreen() {
  const router = useRouter();
  const active = useActiveTrip();
  const authStatus = useAuthStore((s) => s.status);
  const uploadLocalTripsToCloud = useTripStore((s) => s.uploadLocalTripsToCloud);
  const trips = useTripStore((s) => s.data.trips);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // How many trips are on this device but not in the account. Read the same
  // way the trips list reads it, so both agree about what is left behind.
  const [localOnly, setLocalOnly] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (authStatus !== 'signed-in') {
        if (!cancelled) setLocalOnly(0);
        return;
      }
      const stored = await getLocalRepository().load();
      const inAccount = new Set(trips.map((t) => t.id));
      const count = (stored?.trips ?? []).filter((t) => !inAccount.has(t.id)).length;
      if (!cancelled) setLocalOnly(count);
    })();
    return () => {
      cancelled = true;
    };
  }, [authStatus, trips]);

  if (!active) return null;
  const { trip } = active;

  const signedIn = authStatus === 'signed-in';
  // The trips list is served by the cloud repository whenever someone is
  // signed in, so a trip open here is by definition a trip in the account.
  const ready = isSupabaseConfigured && signedIn;

  return (
    <AppShell title="שיתוף הטיול" subtitle={trip.name}>
      {ready ? (
        <TripMembersCard tripId={trip.id} tripName={trip.name} />
      ) : (
        <>
          <Card className="p-5 mb-4">
            <span className="size-11 grid place-items-center rounded-2xl bg-accent-soft text-accent mb-3.5">
              <Users className="size-5 stroke-[1.5]" />
            </span>
            <h2 className="text-[19px] font-light leading-tight">
              שיתוף הטיול עם המשפחה
            </h2>
            <p className="text-[13.5px] text-muted mt-2.5 leading-relaxed">
              כל מי שמצטרף רואה את אותו מסלול, אותו תקציב ואותם מסמכים — ושינוי של אחד מופיע
              אצל כולם באותו רגע. אפשר לתת הרשאת עריכה או צפייה בלבד.
            </p>
          </Card>

          <ol className="flex flex-col gap-2.5">
            <Step
              n={1}
              done={isSupabaseConfigured}
              title="חשבון מוגדר לאפליקציה"
              body={
                isSupabaseConfigured
                  ? 'מוגדר.'
                  : 'האפליקציה רצה במצב מקומי — הנתונים נשמרים במכשיר הזה בלבד.'
              }
              action={
                isSupabaseConfigured ? null : (
                  <Link href="/setup" className="text-[13px] text-accent font-medium">
                    בדיקת חיבור
                  </Link>
                )
              }
            />

            <Step
              n={2}
              done={signedIn}
              title="התחברות"
              body={signedIn ? 'מחוברים.' : 'צריך חשבון כדי שיהיה למי לשייך את הטיול.'}
              action={
                signedIn ? null : (
                  <Button size="sm" onClick={() => router.push('/login?next=/share')}>
                    <LogIn className="size-4" />
                    התחברות
                  </Button>
                )
              }
            />

            <Step
              n={3}
              done={ready && localOnly === 0}
              title="הטיול בחשבון"
              body={
                !signedIn
                  ? 'אחרי ההתחברות הטיולים עוברים לחשבון ואפשר להזמין אליהם.'
                  : localOnly > 0
                    ? `יש ${localOnly === 1 ? 'טיול אחד' : `${localOnly} טיולים`} שנשמרו במכשיר הזה ועדיין לא בחשבון.`
                    : 'הטיול בחשבון.'
              }
              action={
                signedIn && localOnly > 0 ? (
                  <Button
                    size="sm"
                    loading={uploading}
                    onClick={async () => {
                      setUploading(true);
                      setUploadError(null);
                      const result = await uploadLocalTripsToCloud();
                      setUploading(false);
                      if (result.ok) toast.success(result.message);
                      else setUploadError(result.message);
                    }}
                  >
                    <CloudUpload className="size-4" />
                    העלאה
                  </Button>
                ) : null
              }
            />
          </ol>

          {uploadError && (
            <div className="mt-3 rounded-xl bg-danger-soft px-3.5 py-3">
              <p className="text-[12.5px] text-danger leading-relaxed break-words select-text">
                {uploadError}
              </p>
              <p className="text-[11.5px] text-danger/75 mt-1.5">
                הטיול נשאר שמור במכשיר — שום דבר לא אבד.
              </p>
            </div>
          )}

          <p className="text-[12px] text-faint mt-6 leading-relaxed">
            ״מטיילים״ בהגדרות הם משהו אחר: מי שההוצאות מתחלקות בינינו — יכול להיות ילד בלי
            טלפון. כאן מדובר במי שיש לו גישה לאפליקציה.
          </p>
        </>
      )}
    </AppShell>
  );
}

/** One numbered prerequisite, ticked when it is satisfied. */
function Step({
  n,
  done,
  title,
  body,
  action,
}: {
  n: number;
  done: boolean;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3.5 rounded-2xl border border-line bg-surface px-4 py-3.5">
      <span
        className={
          done
            ? 'size-7 shrink-0 grid place-items-center rounded-full bg-success-soft text-success text-[12px]'
            : 'size-7 shrink-0 grid place-items-center rounded-full bg-subtle text-muted text-[12px] ltr-nums'
        }
        aria-hidden
      >
        {done ? '✓' : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px]">{title}</p>
        <p className="text-[12.5px] text-muted mt-1 leading-relaxed">{body}</p>
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </li>
  );
}
