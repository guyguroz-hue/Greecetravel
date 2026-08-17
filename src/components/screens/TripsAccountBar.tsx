'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CloudUpload, LogIn, LogOut } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth-store';
import { useTripStore } from '@/lib/store/trip-store';
import { toast } from '@/lib/store/ui-store';
import { getLocalRepository } from '@/lib/db';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Bits';

/**
 * Account state on the trips list.
 *
 * This is also the only place a freshly signed-in user with no trips can be
 * offered their offline trips — Settings needs an open trip to render, and
 * they don't have one yet.
 */
export function TripsAccountBar() {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const trips = useTripStore((s) => s.data.trips);
  const uploadLocalTripsToCloud = useTripStore((s) => s.uploadLocalTripsToCloud);

  const [localOnly, setLocalOnly] = useState(0);
  const [uploading, setUploading] = useState(false);

  // How many trips exist on this device but not yet in the account. The read
  // is async in both branches so the effect never sets state synchronously.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (status !== 'signed-in') {
        if (!cancelled) setLocalOnly(0);
        return;
      }
      const local = await getLocalRepository().load();
      if (cancelled) return;
      const cloudIds = new Set(trips.map((t) => t.id));
      setLocalOnly((local?.trips ?? []).filter((t) => !cloudIds.has(t.id)).length);
    })();
    return () => {
      cancelled = true;
    };
  }, [status, trips]);

  if (!isSupabaseConfigured || status === 'disabled' || status === 'loading') return null;

  if (status !== 'signed-in') {
    return (
      <Card className="p-3.5 mb-4 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-medium">מתכננים יחד?</p>
          <p className="text-[12px] text-muted mt-0.5 leading-snug">
            התחברי כדי לשתף את הטיול עם המשפחה ולראות אותו מכל מכשיר.
          </p>
        </div>
        <Button size="sm" className="shrink-0" onClick={() => router.push('/login')}>
          <LogIn className="size-4" />
          התחברות
        </Button>
      </Card>
    );
  }

  return (
    <div className="mb-4 space-y-2.5">
      <Card className="p-3 flex items-center gap-2.5">
        <Avatar name={user?.name ?? 'אני'} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium truncate">{user?.name}</p>
          <p className="text-[11.5px] text-muted truncate ltr-nums">{user?.email}</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            await signOut();
            toast.show('התנתקת. האפליקציה חזרה למצב מקומי.');
          }}
          className="shrink-0 inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-danger px-2 py-1 rounded-lg transition"
        >
          <LogOut className="size-3.5" />
          התנתקות
        </button>
      </Card>

      {localOnly > 0 && (
        <Card className="p-3.5 bg-brand-soft border-transparent">
          <p className="text-[13.5px] font-medium text-brand">
            {localOnly === 1
              ? 'יש טיול אחד שנשמר במכשיר הזה ועדיין לא בחשבון'
              : `יש ${localOnly} טיולים שנשמרו במכשיר הזה ועדיין לא בחשבון`}
          </p>
          <p className="text-[12px] text-brand/80 mt-0.5 leading-snug">
            העלאה תאפשר לך לפתוח אותם מכל מכשיר ולשתף אותם עם המשפחה.
          </p>
          <Button
            size="sm"
            className="mt-2.5"
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
            העלאה לחשבון
          </Button>
        </Card>
      )}
    </div>
  );
}
