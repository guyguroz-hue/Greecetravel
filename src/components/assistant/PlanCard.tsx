'use client';

import { useState } from 'react';
import { AlertTriangle, BedDouble, Check, Plane, Wallet, MapPin } from 'lucide-react';
import {
  describeOp,
  OP_LABEL,
  type PlanLine,
  type PlanOp,
} from '@/lib/services/assistant-actions';
import { useTripStore } from '@/lib/store/trip-store';
import { toast } from '@/lib/store/ui-store';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';

const ICON: Record<PlanOp['kind'], typeof Wallet> = {
  expense: Wallet,
  hotel: BedDouble,
  flight: Plane,
  activity: MapPin,
};

/**
 * What the assistant proposes to create, before it creates anything.
 *
 * The confirmation step is the feature, not an obstacle in front of it. A
 * parser reading pasted text will sometimes take a date for an amount or a
 * hotel for an expense, and the difference between a useful assistant and a
 * dangerous one is entirely whether that mistake is visible for two seconds
 * before it lands in the trip. Rows start ticked, so agreeing costs one tap;
 * disagreeing costs one tap as well.
 */
export function PlanCard({ plan }: { plan: PlanLine[] }) {
  const applyPlan = useTripStore((s) => s.applyPlan);
  const undo = useTripStore((s) => s.undo);

  const usable = plan.filter((l) => l.op);
  const rejected = plan.filter((l) => !l.op);

  const [chosen, setChosen] = useState<Set<number>>(
    () => new Set(plan.map((l, i) => (l.op ? i : -1)).filter((i) => i >= 0))
  );
  const [done, setDone] = useState<number | null>(null);

  const toggle = (i: number) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const apply = () => {
    const ops = plan.filter((l, i) => l.op && chosen.has(i)).map((l) => l.op!);
    if (ops.length === 0) return;
    const result = applyPlan(ops);
    setDone(result.added);

    for (const reason of result.skipped) toast.show(`לא נוסף: ${reason}`);
    toast.show(`נוספו ${result.added} פריטים לטיול`, {
      action: {
        label: 'בטל',
        onClick: () => {
          undo();
          setDone(null);
          toast.success('ההוספה בוטלה');
        },
      },
    });
  };

  if (usable.length === 0) return null;

  if (done !== null) {
    return (
      <div className="mt-2.5 rounded-xl bg-success-soft px-3 py-2.5 flex items-center gap-2">
        <Check className="size-4 text-success shrink-0" />
        <p className="text-[13px]">נוספו {done} פריטים לטיול.</p>
      </div>
    );
  }

  return (
    <div className="mt-2.5 space-y-2">
      <ul className="space-y-1.5">
        {plan.map((line, i) =>
          line.op ? (
            <li key={i}>
              <button
                type="button"
                onClick={() => toggle(i)}
                aria-pressed={chosen.has(i)}
                className={cn(
                  'w-full flex items-start gap-2.5 rounded-xl border px-2.5 py-2 text-start transition',
                  chosen.has(i)
                    ? 'border-brand bg-brand-soft/40'
                    : 'border-line bg-inset opacity-60'
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 size-4 rounded border grid place-items-center shrink-0 transition',
                    chosen.has(i) ? 'bg-brand border-brand text-brand-contrast' : 'border-line'
                  )}
                >
                  {chosen.has(i) && <Check className="size-3" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[11px] text-muted">
                    {(() => {
                      const Icon = ICON[line.op.kind];
                      return <Icon className="size-3" />;
                    })()}
                    {OP_LABEL[line.op.kind]}
                  </span>
                  <span className="block text-[13px] leading-snug mt-0.5">
                    {describeOp(line.op)}
                  </span>
                </span>
              </button>
            </li>
          ) : null
        )}
      </ul>

      {/* Lines that could not be read are shown rather than dropped, so a
          paste of twenty never quietly becomes nineteen. */}
      {rejected.length > 0 && (
        <div className="rounded-xl bg-warning-soft px-2.5 py-2 space-y-1">
          {rejected.map((line, i) => (
            <p key={i} className="flex items-start gap-1.5 text-[11.5px] leading-relaxed">
              <AlertTriangle className="size-3.5 text-warning shrink-0 mt-px" />
              <span>
                <span className="font-medium">{line.source}</span>
                <span className="text-muted"> — {line.problem}</span>
              </span>
            </p>
          ))}
        </div>
      )}

      <Button onClick={apply} disabled={chosen.size === 0} className="w-full">
        <Check className="size-4" />
        הוספה לטיול ({chosen.size})
      </Button>
    </div>
  );
}
