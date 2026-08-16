'use client';

import { useSyncExternalStore, type ReactNode } from 'react';

/** The mounted flag never changes after hydration, so there is nothing to subscribe to. */
const subscribeNoop = () => () => {};
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, Info, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useToastStore } from '@/lib/store/ui-store';
import { Button } from './Button';
import { Sheet } from './Sheet';

/* ------------------------------ toasts ----------------------------- */

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  // Portals need a DOM. `useSyncExternalStore` reports false during the
  // prerender and true on the client without an extra render pass.
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-x-0 bottom-0 z-[60] pointer-events-none flex flex-col items-center gap-2 px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            'pointer-events-auto w-full max-w-sm flex items-center gap-3 px-4 py-3 rounded-2xl shadow-float',
            'border animate-[slide-up_0.2s_ease-out] bg-surface border-line'
          )}
        >
          <span
            className={cn(
              'shrink-0 size-7 grid place-items-center rounded-full',
              t.tone === 'success' && 'bg-success-soft text-success',
              t.tone === 'danger' && 'bg-danger-soft text-danger',
              t.tone === 'default' && 'bg-brand-soft text-brand'
            )}
          >
            {t.tone === 'success' ? (
              <Check className="size-4" />
            ) : t.tone === 'danger' ? (
              <AlertTriangle className="size-4" />
            ) : (
              <Info className="size-4" />
            )}
          </span>
          <p className="flex-1 text-[14px] leading-snug">{t.message}</p>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                t.action!.onClick();
                dismiss(t.id);
              }}
              className="shrink-0 text-[13px] font-semibold text-brand px-2 py-1 rounded-lg hover:bg-brand-soft transition"
            >
              {t.action.label}
            </button>
          )}
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="סגירה"
            className="shrink-0 text-faint hover:text-ink transition"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}

/* ---------------------------- confirm ------------------------------ */

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'מחיקה',
  cancelLabel = 'ביטול',
  destructive = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} fullWidth onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {message && <p className="text-[14.5px] text-muted leading-relaxed pb-2">{message}</p>}
    </Sheet>
  );
}

/* --------------------------- empty state --------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center px-6 py-12 rounded-2xl border border-dashed border-line bg-surface/50',
        className
      )}
    >
      {icon && (
        <div className="size-14 rounded-2xl bg-subtle grid place-items-center text-2xl mb-3.5 text-muted">
          {icon}
        </div>
      )}
      <h3 className="font-semibold text-[15.5px]">{title}</h3>
      {description && (
        <p className="text-[13.5px] text-muted mt-1.5 max-w-sm leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------------------------- loading ------------------------------ */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-muted', className)} aria-hidden />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-xl', className)} aria-hidden />;
}

export function LoadingScreen({ label = 'טוען…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24" role="status">
      <Spinner className="size-7" />
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

export function ScreenSkeleton() {
  return (
    <div className="space-y-4 animate-[fade-in_0.2s_ease-out]" aria-hidden>
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-44 w-full rounded-2xl" />
    </div>
  );
}

/* ----------------------------- errors ------------------------------ */

export function ErrorState({
  title = 'משהו השתבש',
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      icon={<AlertTriangle className="size-6 text-danger" />}
      title={title}
      description={message ?? 'לא הצלחנו לטעון את הנתונים. אפשר לנסות שוב.'}
      action={
        onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            נסה שוב
          </Button>
        )
      }
    />
  );
}
