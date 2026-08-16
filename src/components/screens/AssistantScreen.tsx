'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowUp, ChevronLeft, Info, Sparkles } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useActiveTrip } from '@/lib/store/hooks';
import {
  SUGGESTED_QUESTIONS,
  askAssistant,
  type AssistantAnswer,
} from '@/lib/services/assistant';
import { todayISO } from '@/lib/utils/date';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Feedback';

interface Turn {
  id: string;
  question: string;
  answer?: AssistantAnswer;
}

export function AssistantScreen() {
  const active = useActiveTrip();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const nextTurnId = useRef(0);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, busy]);

  const ask = async (question: string) => {
    if (!active || !question.trim() || busy) return;
    const id = `turn-${(nextTurnId.current += 1)}`;
    setTurns((t) => [...t, { id, question }]);
    setInput('');
    setBusy(true);
    const answer = await askAssistant(question, active, todayISO());
    setTurns((t) => t.map((turn) => (turn.id === id ? { ...turn, answer } : turn)));
    setBusy(false);
  };

  if (!active) return null;

  return (
    <AppShell title="עוזר הטיול" subtitle={active.trip.name} backHref="/more">
      <div className="flex flex-col min-h-[calc(100dvh-12rem)]">
        {turns.length === 0 ? (
          <div className="flex-1">
            <div className="text-center py-8">
              <span className="inline-grid place-items-center size-14 rounded-2xl bg-brand-soft text-brand mb-3">
                <Sparkles className="size-6" />
              </span>
              <h2 className="font-semibold text-[17px]">שאלי אותי על הטיול</h2>
              <p className="text-[13.5px] text-muted mt-1.5 max-w-md mx-auto leading-relaxed">
                אני עונה רק לפי הנתונים שהזנת — מסלול, נסיעות, מלונות, טיסות, תקציב ומקומות
                שמורים. אני לא ממציא מידע שאין לי.
              </p>
            </div>

            <div className="space-y-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void ask(q)}
                  className="w-full flex items-center justify-between gap-3 px-4 h-12 rounded-2xl border border-line bg-surface text-start hover:border-brand hover:bg-brand-soft/30 transition"
                >
                  <span className="text-[14px]">{q}</span>
                  <ChevronLeft className="size-4 text-faint shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-4 pb-4">
            {turns.map((turn) => (
              <div key={turn.id} className="space-y-2.5">
                <div className="flex justify-start">
                  <p className="max-w-[85%] bg-brand text-brand-contrast rounded-2xl rounded-ss-md px-3.5 py-2.5 text-[14px] leading-snug">
                    {turn.question}
                  </p>
                </div>

                {turn.answer ? (
                  <div className="flex justify-end">
                    <div
                      className={cn(
                        'max-w-[92%] rounded-2xl rounded-se-md px-3.5 py-3 border',
                        turn.answer.unknown
                          ? 'bg-warning-soft border-transparent'
                          : 'bg-surface border-line'
                      )}
                    >
                      <p className="text-[14px] leading-relaxed">{turn.answer.text}</p>

                      {turn.answer.bullets && turn.answer.bullets.length > 0 && (
                        <ul className="mt-2.5 space-y-1.5">
                          {turn.answer.bullets.map((b, i) => (
                            <li
                              key={i}
                              className="text-[13px] text-muted bg-inset rounded-lg px-2.5 py-1.5 leading-snug"
                            >
                              {b}
                            </li>
                          ))}
                        </ul>
                      )}

                      {turn.answer.link && (
                        <Link
                          href={turn.answer.link.href}
                          className="inline-flex items-center gap-1 mt-2.5 text-[12.5px] font-medium text-brand"
                        >
                          {turn.answer.link.label}
                          <ChevronLeft className="size-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <div className="rounded-2xl rounded-se-md px-4 py-3 bg-surface border border-line">
                      <Spinner className="size-4" />
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}

        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-4 pt-2 bg-bg">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void ask(input);
              }}
              placeholder="מה אנחנו עושים מחר?"
              aria-label="שאלה לעוזר"
              className="flex-1 h-12 px-4 rounded-2xl bg-surface border border-line text-[15px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
            />
            <Button
              onClick={() => void ask(input)}
              disabled={!input.trim() || busy}
              aria-label="שליחה"
              className="size-12 shrink-0 rounded-2xl p-0"
            >
              <ArrowUp className="size-5" />
            </Button>
          </div>

          <p className="flex items-start gap-1.5 text-[11.5px] text-faint mt-2 px-1 leading-relaxed">
            <Info className="size-3.5 shrink-0 mt-px" />
            העוזר מחשב תשובות ישירות מנתוני הטיול במכשיר שלך. אין כאן שליחת מידע לשום שירות חיצוני.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
