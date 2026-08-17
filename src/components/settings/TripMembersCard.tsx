'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Link2, Mail, Share2, Trash2, UserPlus } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth-store';
import { toast } from '@/lib/store/ui-store';
import {
  ROLE_LABEL,
  createInvite,
  fetchInvites,
  fetchMembers,
  inviteLink,
  removeMember,
  revokeInvite,
  setMemberRole,
  type TripInvite,
  type TripMember,
  type TripRole,
} from '@/lib/supabase/members';
import { formatShortDate } from '@/lib/utils/date';
import { cn } from '@/lib/utils/cn';
import { Card, SectionTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { ConfirmDialog, Spinner } from '@/components/ui/Feedback';
import { Avatar, Badge } from '@/components/ui/Bits';

export function TripMembersCard({ tripId, tripName }: { tripId: string; tripName: string }) {
  const me = useAuthStore((s) => s.user);

  // `null` means "not fetched yet", which is what drives the spinner —
  // no separate loading flag to keep in step.
  const [members, setMembers] = useState<TripMember[] | null>(null);
  const [invites, setInvites] = useState<TripInvite[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TripRole>('editor');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<TripMember | null>(null);

  // Bumping this re-runs the fetch. Keeping the request inside the effect
  // means it can be cancelled cleanly when the trip changes mid-flight.
  const [reloadToken, setReloadToken] = useState(0);
  const refresh = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [m, i] = await Promise.all([fetchMembers(tripId), fetchInvites(tripId)]);
        if (cancelled) return;
        setMembers(m);
        setInvites(i.filter((x) => !x.acceptedAt));
      } catch (err) {
        console.error('[members] load failed', err);
        if (!cancelled) setMembers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tripId, reloadToken]);

  const loading = members === null;
  const myRole = (members ?? []).find((m) => m.userId === me?.id)?.role ?? 'viewer';
  const isOwner = myRole === 'owner';

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
      toast.success('הקישור הועתק');
    } catch {
      toast.error('לא הצלחנו להעתיק. אפשר לסמן ולהעתיק ידנית.');
    }
  };

  const invite = async (withEmail: boolean) => {
    setBusy(true);
    try {
      const created = await createInvite(tripId, role, withEmail ? email : undefined);
      setEmail('');
      refresh();
      if (withEmail) {
        toast.success('ההזמנה נוצרה — שלחי את הקישור');
      }
      await copy(inviteLink(created.token), created.id);
    } catch (err) {
      console.error('[members] invite failed', err);
      toast.error('יצירת ההזמנה נכשלה.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-5">
      <SectionTitle>מי בטיול הזה</SectionTitle>

      <Card className="divide-y divide-[var(--border)]">
        {loading ? (
          <div className="p-6 grid place-items-center">
            <Spinner />
          </div>
        ) : (
          <>
            {(members ?? []).map((m) => {
              const isMe = m.userId === me?.id;
              return (
                <div key={m.userId} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={m.name} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[14px] truncate">
                      {m.name}
                      {isMe && <span className="text-muted font-normal"> (את/ה)</span>}
                    </p>
                    <p className="text-[11.5px] text-muted truncate ltr-nums">{m.email}</p>
                  </div>

                  {isOwner && !isMe ? (
                    <Select
                      value={m.role}
                      aria-label={`הרשאה עבור ${m.name}`}
                      className="h-9 w-auto min-w-24"
                      onChange={async (e) => {
                        const next = e.target.value as TripRole;
                        try {
                          await setMemberRole(tripId, m.userId, next);
                          refresh();
                          toast.success(`ההרשאה של ${m.name} עודכנה`);
                        } catch {
                          toast.error('עדכון ההרשאה נכשל.');
                        }
                      }}
                    >
                      <option value="viewer">צפייה</option>
                      <option value="editor">עריכה</option>
                      <option value="owner">בעלים</option>
                    </Select>
                  ) : (
                    <Badge tone={m.role === 'owner' ? 'brand' : 'neutral'}>
                      {ROLE_LABEL[m.role]}
                    </Badge>
                  )}

                  {isOwner && !isMe && (
                    <button
                      type="button"
                      onClick={() => setPendingRemove(m)}
                      aria-label={`הסרת ${m.name} מהטיול`}
                      className="shrink-0 p-1.5 rounded-lg text-faint hover:text-danger hover:bg-danger-soft transition"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              );
            })}

            {invites.length > 0 && (
              <div className="px-4 py-3 space-y-2">
                <p className="text-[12px] font-medium text-muted">הזמנות פתוחות</p>
                {invites.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-2">
                    <span className="size-8 shrink-0 grid place-items-center rounded-lg bg-subtle text-muted">
                      {inv.email ? <Mail className="size-4" /> : <Link2 className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] truncate ltr-nums">
                        {inv.email ?? 'קישור שיתוף'}
                      </p>
                      <p className="text-[11px] text-faint ltr-nums">
                        {ROLE_LABEL[inv.role]} · בתוקף עד {formatShortDate(inv.expiresAt.slice(0, 10))}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copy(inviteLink(inv.token), inv.id)}
                      aria-label="העתקת הקישור"
                      className={cn(
                        'shrink-0 p-1.5 rounded-lg transition',
                        copied === inv.id
                          ? 'text-success bg-success-soft'
                          : 'text-muted hover:text-brand hover:bg-brand-soft'
                      )}
                    >
                      {copied === inv.id ? (
                        <Check className="size-4" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </button>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={async () => {
                          await revokeInvite(inv.id);
                          refresh();
                          toast.show('ההזמנה בוטלה');
                        }}
                        aria-label="ביטול ההזמנה"
                        className="shrink-0 p-1.5 rounded-lg text-faint hover:text-danger transition"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {isOwner ? (
              <div className="px-4 py-3 space-y-2.5">
                <div className="flex gap-2">
                  <input
                    type="email"
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    aria-label="אימייל להזמנה"
                    className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-inset border border-line text-[14px] outline-none focus:border-brand transition"
                  />
                  <Select
                    value={role}
                    aria-label="הרשאה"
                    onChange={(e) => setRole(e.target.value as TripRole)}
                    className="h-10 w-auto min-w-24"
                  >
                    <option value="editor">עריכה</option>
                    <option value="viewer">צפייה</option>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    loading={busy}
                    disabled={!/^\S+@\S+\.\S+$/.test(email)}
                    onClick={() => void invite(true)}
                  >
                    <UserPlus className="size-4" />
                    הזמנה למייל
                  </Button>
                  <Button variant="secondary" loading={busy} onClick={() => void invite(false)}>
                    <Share2 className="size-4" />
                    קישור לשיתוף
                  </Button>
                </div>

                <p className="text-[11.5px] text-faint leading-relaxed">
                  ״הזמנה למייל״ שומרת את הכתובת ומצרפת אותה אוטומטית כשהיא נכנסת בפעם הראשונה.
                  ״קישור לשיתוף״ יוצר קישור שאפשר לשלוח בוואטסאפ — כל מי שיפתח אותו ויתחבר יצטרף
                  לטיול ״{tripName}״.
                </p>
              </div>
            ) : (
              <p className="px-4 py-3 text-[12.5px] text-muted">
                רק בעלים של הטיול יכולים להזמין אנשים או לשנות הרשאות.
              </p>
            )}
          </>
        )}
      </Card>

      <ConfirmDialog
        open={pendingRemove !== null}
        title={`להסיר את ${pendingRemove?.name} מהטיול?`}
        message="הם יאבדו גישה לטיול. ההוצאות שכבר נרשמו יישארו."
        confirmLabel="הסרה"
        onCancel={() => setPendingRemove(null)}
        onConfirm={async () => {
          const target = pendingRemove;
          setPendingRemove(null);
          if (!target) return;
          try {
            await removeMember(tripId, target.userId);
            refresh();
            toast.show(`${target.name} הוסר מהטיול`);
          } catch {
            toast.error('ההסרה נכשלה.');
          }
        }}
      />
    </section>
  );
}
