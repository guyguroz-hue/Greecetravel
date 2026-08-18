'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { ArrowRight, Luggage, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { PRIMARY_NAV, SECONDARY_NAV } from './nav-items';
import { useActiveTrip, useTripStatus } from '@/lib/store/hooks';
import { useTripStore } from '@/lib/store/trip-store';
import { toast } from '@/lib/store/ui-store';
import { countryFlag } from '@/lib/utils/format';
import { formatDateRange } from '@/lib/utils/date';
import { LoadingScreen } from '@/components/ui/Feedback';

/**
 * The shell every trip screen lives in: a sidebar on desktop, a tab bar on
 * phones, and a sticky header carrying the screen title.
 */
export function AppShell({
  title,
  subtitle,
  actions,
  children,
  /** Screens that manage their own scrolling (the map) opt out of padding. */
  bleed = false,
  backHref,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  bleed?: boolean;
  backHref?: string;
}) {
  const status = useTripStatus();
  const active = useActiveTrip();
  const router = useRouter();

  // No trip selected once hydration settled — send the user to pick one.
  useEffect(() => {
    if (status === 'ready' && !active) router.replace('/');
  }, [status, active, router]);

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="min-h-dvh grid place-items-center">
        <LoadingScreen label="טוען את הטיול…" />
      </div>
    );
  }

  if (!active) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <LoadingScreen label="מעביר אותך לרשימת הטיולים…" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex">
      <DesktopSidebar />

      <div className="flex-1 min-w-0 flex flex-col lg:ps-64">
        <Header title={title} subtitle={subtitle} actions={actions} backHref={backHref} />

        <main
          className={cn(
            'flex-1 w-full mx-auto max-w-5xl',
            bleed ? '' : 'px-4 sm:px-6 pt-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-10'
          )}
        >
          {children}
        </main>
      </div>

      <MobileTabBar />
    </div>
  );
}

function Header({
  title,
  subtitle,
  actions,
  backHref,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
}) {
  return (
    <header className="sticky top-0 z-30 bg-bg/85 backdrop-blur-lg border-b border-line">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
        {backHref && (
          <Link
            href={backHref}
            aria-label="חזרה"
            className="-ms-2 size-9 grid place-items-center rounded-xl text-muted hover:bg-subtle hover:text-ink transition shrink-0"
          >
            <ArrowRight className="size-5" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold text-[17px] leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-[12px] text-muted truncate">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <UndoButton />
          {actions}
        </div>
      </div>
    </header>
  );
}

function UndoButton() {
  const undoCount = useTripStore((s) => s.undoStack.length);
  const undo = useTripStore((s) => s.undo);
  if (undoCount === 0) return null;
  return (
    <button
      type="button"
      onClick={() => {
        const label = undo();
        if (label) toast.show(`בוטל: ${label}`);
      }}
      aria-label="בטל פעולה אחרונה"
      title="בטל פעולה אחרונה"
      className="size-9 grid place-items-center rounded-xl text-muted hover:bg-subtle hover:text-ink transition"
    >
      <Undo2 className="size-[18px]" />
    </button>
  );
}

function DesktopSidebar() {
  const pathname = usePathname();
  const active = useActiveTrip();

  return (
    <aside className="hidden lg:flex fixed inset-y-0 start-0 w-64 flex-col border-e border-line bg-surface">
      <Link href="/" className="flex items-center gap-2.5 px-5 h-16 border-b border-line group">
        <span className="size-9 rounded-xl bg-brand text-brand-contrast grid place-items-center shrink-0">
          <Luggage className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block font-semibold text-[14.5px] leading-tight">My Trip Planner</span>
          <span className="block text-[11.5px] text-muted group-hover:text-brand transition">
            כל הטיולים שלי
          </span>
        </span>
      </Link>

      {active && (
        <div className="px-4 py-3.5 border-b border-line">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden>
              {countryFlag(active.trip.countryCode)}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-[13.5px] truncate">{active.trip.name}</p>
              <p className="text-[11.5px] text-muted ltr-nums">
                {formatDateRange(active.trip.startDate, active.trip.endDate)}
              </p>
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {PRIMARY_NAV.filter((i) => i.href !== '/more').map((item) => (
          <SidebarLink key={item.href} item={item} pathname={pathname} />
        ))}
        <div className="h-px bg-line my-2.5 mx-2" />
        {SECONDARY_NAV.map((item) => (
          <SidebarLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>
    </aside>
  );
}

function SidebarLink({
  item,
  pathname,
}: {
  item: (typeof PRIMARY_NAV)[number];
  pathname: string;
}) {
  const Icon = item.icon;
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 h-10 px-3 rounded-xl text-[14px] font-medium transition',
        active ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-subtle hover:text-ink'
      )}
    >
      <Icon className="size-[18px] shrink-0" />
      {item.label}
    </Link>
  );
}

function MobileTabBar() {
  const pathname = usePathname();
  const inMoreSection = SECONDARY_NAV.some(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`)
  );

  return (
    <nav
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-surface/95 backdrop-blur-xl border-t border-line"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch max-w-lg mx-auto">
        {PRIMARY_NAV.map((item) => {
          const Icon = item.icon;
          const isMore = item.href === '/more';
          const active =
            pathname === item.href ||
            pathname.startsWith(`${item.href}/`) ||
            (isMore && inMoreSection);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 h-[3.75rem] transition relative',
                active ? 'text-accent' : 'text-faint'
              )}
            >
              <Icon className={cn('size-[21px]', active ? 'stroke-[1.8]' : 'stroke-[1.5]')} />
              <span className={cn('text-[10.5px] tracking-[0.02em]', active ? 'font-semibold' : 'font-light')}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
