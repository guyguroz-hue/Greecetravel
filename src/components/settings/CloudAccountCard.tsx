'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CloudUpload, LogIn, LogOut, UserRound } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth-store';
import { useTripStore } from '@/lib/store/trip-store';
import { toast } from '@/lib/store/ui-store';
import { Card, SectionTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Bits';

/** Account state, and the one-time "bring my offline trips with me" move. */
export function CloudAccountCard() {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const uploadLocalTripsToCloud = useTripStore((s) => s.uploadLocalTripsToCloud);
  const syncError = useTripStore((s) => s.syncError);
  const [uploading, setUploading] = useState(false);

  if (status === 'disabled') return null;

  return (
    <section className="mb-5">
      <SectionTitle>חשבון</SectionTitle>

      {status === 'signed-in' && user ? (
        <Card className="p-4 space-y-3.5">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-[14.5px] truncate">{user.name}</p>
              <p className="text-[12px] text-muted truncate ltr-nums">{user.email}</p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                await signOut();
                toast.show('התנתקת. האפליקציה חזרה למצב מקומי.');
              }}
            >
              <LogOut className="size-4" />
              התנתקות
            </Button>
          </div>

          <p className="text-[12.5px] text-muted leading-relaxed">
            הטיולים שלך נשמרים בחשבון ומסונכרנים בין כל המכשירים והאנשים שהזמנת.{' '}
            <Link href="/setup" className="text-brand font-medium">
              בדיקת חיבור
            </Link>
          </p>

          {syncError && (
            <p className="text-[12.5px] text-warning bg-warning-soft rounded-xl px-3 py-2.5">
              {syncError}
            </p>
          )}

          <div className="border-t border-line pt-3">
            <Button
              variant="secondary"
              fullWidth
              loading={uploading}
              onClick={async () => {
                setUploading(true);
                const result = await uploadLocalTripsToCloud();
                setUploading(false);
                if (result.ok) toast.success(result.message);
                else toast.show(result.message);
              }}
            >
              <CloudUpload className="size-4" />
              העלאת טיולים שנשמרו במכשיר לחשבון
            </Button>
            <p className="text-[11.5px] text-faint mt-2 leading-relaxed">
              מעתיק טיולים שנוצרו לפני ההתחברות. קבצים שהועלו נשארים במכשיר וצריך להעלות אותם
              מחדש כדי שהמשפחה תראה אותם.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <span className="size-10 shrink-0 grid place-items-center rounded-xl bg-subtle text-muted">
              <UserRound className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="font-medium text-[14.5px]">לא מחוברים</p>
              <p className="text-[12.5px] text-muted mt-0.5 leading-relaxed">
                כרגע הנתונים נשמרים במכשיר הזה בלבד. התחברות מאפשרת לשתף את הטיול עם המשפחה
                ולראות אותו מכל מכשיר.
              </p>
            </div>
          </div>
          <Button fullWidth className="mt-4" onClick={() => router.push('/login')}>
            <LogIn className="size-4" />
            התחברות או הרשמה
          </Button>
          <Link
            href="/setup"
            className="block text-center text-[12.5px] text-muted hover:text-brand transition mt-2.5"
          >
            משהו לא עובד? בדיקת חיבור לשרת
          </Link>
        </Card>
      )}
    </section>
  );
}
