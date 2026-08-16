'use client';

import { useState } from 'react';
import { CheckSquare, ChevronDown, Plus, Trash2, X } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useActiveTrip } from '@/lib/store/hooks';
import { useTripStore } from '@/lib/store/trip-store';
import { toast } from '@/lib/store/ui-store';
import {
  CHECKLIST_GROUPS,
  CHECKLIST_GROUP_META,
  type Checklist,
  type ChecklistGroup,
} from '@/lib/types';
import { cn } from '@/lib/utils/cn';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select, TextInput } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { ConfirmDialog, EmptyState } from '@/components/ui/Feedback';
import { ProgressBar } from '@/components/ui/Bits';

export function ChecklistsScreen() {
  const active = useActiveTrip();
  const addChecklist = useTripStore((s) => s.addChecklist);
  const deleteChecklist = useTripStore((s) => s.deleteChecklist);
  const addChecklistItem = useTripStore((s) => s.addChecklistItem);
  const toggleChecklistItem = useTripStore((s) => s.toggleChecklistItem);
  const deleteChecklistItem = useTripStore((s) => s.deleteChecklistItem);
  const undo = useTripStore((s) => s.undo);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [newSheetOpen, setNewSheetOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Checklist | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newGroup, setNewGroup] = useState<ChecklistGroup>('custom');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (!active) return null;
  const { trip, checklists } = active;

  const totalItems = checklists.reduce((n, c) => n + c.items.length, 0);
  const doneItems = checklists.reduce((n, c) => n + c.items.filter((i) => i.done).length, 0);

  const toggleCollapsed = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submitItem = (checklistId: string) => {
    const text = (drafts[checklistId] ?? '').trim();
    if (!text) return;
    addChecklistItem(checklistId, text);
    setDrafts((d) => ({ ...d, [checklistId]: '' }));
  };

  return (
    <AppShell
      title="צ׳קליסטים"
      subtitle={totalItems > 0 ? `${doneItems} מתוך ${totalItems} סומנו` : undefined}
      backHref="/more"
      actions={
        <Button
          size="sm"
          aria-label="יצירת רשימה"
          onClick={() => setNewSheetOpen(true)}
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">רשימה</span>
        </Button>
      }
    >
      {totalItems > 0 && (
        <Card className="p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-semibold text-muted">התקדמות כללית</span>
            <span className="text-[13px] font-semibold ltr-nums">
              {Math.round((doneItems / totalItems) * 100)}%
            </span>
          </div>
          <ProgressBar value={doneItems} max={totalItems} tone="success" />
        </Card>
      )}

      {checklists.length === 0 ? (
        <EmptyState
          icon={<CheckSquare className="size-6" />}
          title="אין עדיין רשימות"
          description="רשימות לפני הטיסה, למזוודות, למעבר בין מלונות — כדי ששום דבר לא יישכח."
          action={
            <Button onClick={() => setNewSheetOpen(true)}>
              <Plus className="size-4" />
              יצירת רשימה
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {checklists.map((list) => {
            const meta = CHECKLIST_GROUP_META[list.group];
            const done = list.items.filter((i) => i.done).length;
            const isCollapsed = collapsed.has(list.id);
            const allDone = list.items.length > 0 && done === list.items.length;

            return (
              <Card key={list.id} className="overflow-hidden">
                <div className="flex items-center gap-2.5 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleCollapsed(list.id)}
                    aria-expanded={!isCollapsed}
                    className="flex items-center gap-2.5 flex-1 min-w-0 text-start"
                  >
                    <span className="text-lg shrink-0" aria-hidden>
                      {meta.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-[14.5px] truncate">
                        {list.title}
                      </span>
                      <span
                        className={cn(
                          'block text-[12px] ltr-nums',
                          allDone ? 'text-success' : 'text-muted'
                        )}
                      >
                        {done} / {list.items.length}
                        {allDone && ' · הכל מוכן ✓'}
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        'size-4 text-faint shrink-0 transition-transform',
                        isCollapsed && '-rotate-90'
                      )}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(list)}
                    aria-label={`מחיקת ${list.title}`}
                    className="shrink-0 p-1.5 rounded-lg text-faint hover:text-danger hover:bg-danger-soft transition"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                {list.items.length > 0 && (
                  <ProgressBar
                    value={done}
                    max={list.items.length}
                    tone={allDone ? 'success' : 'brand'}
                    className="h-1 rounded-none"
                  />
                )}

                {!isCollapsed && (
                  <>
                    <ul className="divide-y divide-[var(--border)]">
                      {list.items.map((item) => (
                        <li key={item.id} className="flex items-center gap-3 px-4 py-2.5 group">
                          <button
                            type="button"
                            onClick={() => toggleChecklistItem(list.id, item.id)}
                            role="checkbox"
                            aria-checked={item.done}
                            className={cn(
                              'size-5 shrink-0 rounded-md border-2 grid place-items-center transition',
                              item.done
                                ? 'bg-success border-success text-white'
                                : 'border-line-strong hover:border-brand'
                            )}
                          >
                            {item.done && (
                              <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
                                <path
                                  d="M2 6.2 4.6 8.8 10 3.4"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </button>
                          <span
                            className={cn(
                              'flex-1 text-[14px] leading-snug',
                              item.done && 'line-through text-faint'
                            )}
                          >
                            {item.text}
                          </span>
                          <button
                            type="button"
                            onClick={() => deleteChecklistItem(list.id, item.id)}
                            aria-label={`הסרת ${item.text}`}
                            className="shrink-0 p-1 rounded-lg text-faint opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-danger transition"
                          >
                            <X className="size-4" />
                          </button>
                        </li>
                      ))}
                    </ul>

                    <div className="px-4 py-2.5 border-t border-line">
                      <div className="flex gap-2">
                        <input
                          value={drafts[list.id] ?? ''}
                          onChange={(e) =>
                            setDrafts((d) => ({ ...d, [list.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submitItem(list.id);
                          }}
                          placeholder="הוספת פריט…"
                          aria-label={`הוספת פריט ל${list.title}`}
                          className="flex-1 h-10 px-3 rounded-xl bg-inset border border-line text-[14px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
                        />
                        <button
                          type="button"
                          onClick={() => submitItem(list.id)}
                          disabled={!(drafts[list.id] ?? '').trim()}
                          aria-label="הוספה"
                          className="size-10 shrink-0 grid place-items-center rounded-xl bg-brand text-brand-contrast disabled:opacity-40 transition"
                        >
                          <Plus className="size-4" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Sheet
        open={newSheetOpen}
        onClose={() => setNewSheetOpen(false)}
        title="רשימה חדשה"
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setNewSheetOpen(false)}>
              ביטול
            </Button>
            <Button
              fullWidth
              disabled={!newTitle.trim()}
              onClick={() => {
                addChecklist({
                  tripId: trip.id,
                  title: newTitle.trim(),
                  group: newGroup,
                  items: [],
                });
                setNewTitle('');
                setNewGroup('custom');
                setNewSheetOpen(false);
                toast.success('הרשימה נוצרה');
              }}
            >
              יצירה
            </Button>
          </div>
        }
      >
        <div className="space-y-4 pb-4">
          <TextInput
            label="שם הרשימה"
            required
            autoFocus
            placeholder="למשל: ציוד צילום"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <Select
            label="סוג"
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value as ChecklistGroup)}
          >
            {CHECKLIST_GROUPS.map((g) => (
              <option key={g} value={g}>
                {CHECKLIST_GROUP_META[g].emoji} {CHECKLIST_GROUP_META[g].label}
              </option>
            ))}
          </Select>
        </div>
      </Sheet>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`למחוק את "${pendingDelete?.title}"?`}
        message="כל הפריטים ברשימה יימחקו."
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const title = pendingDelete?.title ?? '';
          if (pendingDelete) deleteChecklist(pendingDelete.id);
          setPendingDelete(null);
          toast.show(`"${title}" נמחקה`, {
            action: {
              label: 'בטל',
              onClick: () => {
                undo();
                toast.success('הרשימה שוחזרה');
              },
            },
          });
        }}
      />
    </AppShell>
  );
}
