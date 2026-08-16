'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  ExternalLink,
  Eye,
  FileText,
  Link2,
  Paperclip,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useActiveTrip } from '@/lib/store/hooks';
import { useTripStore } from '@/lib/store/trip-store';
import { toast } from '@/lib/store/ui-store';
import { createObjectUrl, getBlob, putBlob, revokeObjectUrl } from '@/lib/db';
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_META,
  type DocumentCategory,
  type TripDocument,
} from '@/lib/types';
import { formatShortDate, todayISO } from '@/lib/utils/date';
import { formatFileSize, safeExternalUrl } from '@/lib/utils/format';
import { newId } from '@/lib/utils/id';
import { cn } from '@/lib/utils/cn';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextArea, TextInput } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { ConfirmDialog, EmptyState, Spinner } from '@/components/ui/Feedback';
import { Badge } from '@/components/ui/Bits';

/** Anything larger than this would blow past a comfortable IndexedDB budget. */
const MAX_FILE_BYTES = 12 * 1024 * 1024;

export function DocumentsScreen() {
  const active = useActiveTrip();
  const addDocument = useTripStore((s) => s.addDocument);
  const updateDocument = useTripStore((s) => s.updateDocument);
  const deleteDocument = useTripStore((s) => s.deleteDocument);
  const undo = useTripStore((s) => s.undo);

  const [filter, setFilter] = useState<DocumentCategory | 'all'>('all');
  const [editing, setEditing] = useState<TripDocument | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TripDocument | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!active) return [];
    return filter === 'all'
      ? active.documents
      : active.documents.filter((d) => d.category === filter);
  }, [active, filter]);

  if (!active) return null;
  const { trip, documents, hotels, flights, cars, days } = active;

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    let added = 0;
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`"${file.name}" גדול מדי (מעל ${formatFileSize(MAX_FILE_BYTES)})`);
        continue;
      }
      try {
        const key = newId('blob');
        await putBlob(key, file);
        addDocument({
          tripId: trip.id,
          name: file.name,
          category: guessCategory(file.name),
          date: todayISO(),
          fileKey: key,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
        });
        added++;
      } catch (err) {
        console.error('[documents] upload failed', err);
        toast.error(`ההעלאה של "${file.name}" נכשלה`);
      }
    }
    setUploading(false);
    if (added > 0) toast.success(`${added === 1 ? 'קובץ אחד הועלה' : `${added} קבצים הועלו`}`);
    if (fileInput.current) fileInput.current.value = '';
  };

  return (
    <AppShell
      title="מסמכים"
      subtitle={`${documents.length} מסמכים`}
      backHref="/more"
      actions={
        <Button
          size="sm"
          aria-label="הוספת מסמך"
          onClick={() => {
            setEditing(null);
            setSheetOpen(true);
          }}
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">מסמך</span>
        </Button>
      }
    >
      <input
        ref={fileInput}
        type="file"
        multiple
        accept="image/*,application/pdf,.pdf,.png,.jpg,.jpeg,.heic,.webp"
        className="sr-only"
        onChange={(e) => void onFiles(e.target.files)}
      />

      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        disabled={uploading}
        className="w-full mb-4 rounded-2xl border-2 border-dashed border-line hover:border-brand hover:bg-brand-soft/30 transition py-6 flex flex-col items-center gap-2 disabled:opacity-60"
      >
        {uploading ? (
          <Spinner className="size-6" />
        ) : (
          <Upload className="size-6 text-muted" aria-hidden />
        )}
        <span className="text-[14px] font-medium">
          {uploading ? 'מעלה…' : 'העלאת כרטיסים, אישורים ו-PDF'}
        </span>
        <span className="text-[12px] text-muted">
          הקבצים נשמרים במכשיר שלך בלבד · עד {formatFileSize(MAX_FILE_BYTES)} לקובץ
        </span>
      </button>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 mb-4">
        <FilterChip
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          label={`הכל (${documents.length})`}
        />
        {DOCUMENT_CATEGORIES.map((c) => {
          const count = documents.filter((d) => d.category === c).length;
          if (count === 0) return null;
          const meta = DOCUMENT_CATEGORY_META[c];
          return (
            <FilterChip
              key={c}
              active={filter === c}
              onClick={() => setFilter(c)}
              label={`${meta.emoji} ${meta.label} (${count})`}
            />
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-6" />}
          title={documents.length === 0 ? 'עוד לא נוספו מסמכים' : 'אין מסמכים בקטגוריה הזו'}
          description="כרטיסי טיסה, אישורי מלון, פוליסת ביטוח וכרטיסים לאטרקציות — הכל בהישג יד גם בלי רשת."
          action={
            <Button variant="secondary" onClick={() => fileInput.current?.click()}>
              <Upload className="size-4" />
              העלאת קובץ
            </Button>
          }
        />
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {filtered.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              onEdit={() => {
                setEditing(doc);
                setSheetOpen(true);
              }}
              onDelete={() => setPendingDelete(doc)}
            />
          ))}
        </div>
      )}

      <DocumentSheet
        key={`${editing?.id ?? 'new'}:${sheetOpen}`}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        doc={editing}
        links={{ hotels, flights, cars, days }}
        onSave={(payload) => {
          if (editing) {
            updateDocument(editing.id, payload);
            toast.success('המסמך עודכן');
          } else {
            addDocument({ ...payload, tripId: trip.id });
            toast.success('המסמך נוסף');
          }
        }}
        onDelete={
          editing
            ? () => {
                setPendingDelete(editing);
                setSheetOpen(false);
              }
            : undefined
        }
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`למחוק את "${pendingDelete?.name}"?`}
        message={
          pendingDelete?.fileKey
            ? 'הקובץ יימחק מהמכשיר. אפשר לבטל מיד לאחר המחיקה.'
            : 'המסמך יוסר מהרשימה.'
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const name = pendingDelete?.name ?? '';
          if (pendingDelete) deleteDocument(pendingDelete.id);
          setPendingDelete(null);
          setEditing(null);
          toast.show(`"${name}" נמחק`, {
            action: {
              label: 'בטל',
              onClick: () => {
                undo();
                toast.success('המסמך שוחזר');
              },
            },
          });
        }}
      />
    </AppShell>
  );
}

function DocumentCard({
  doc,
  onEdit,
  onDelete,
}: {
  doc: TripDocument;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = DOCUMENT_CATEGORY_META[doc.category];
  const externalUrl = safeExternalUrl(doc.url);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Object URLs are created on demand and released when the card unmounts.
  useEffect(() => {
    return () => {
      if (blobUrl) revokeObjectUrl(blobUrl);
    };
  }, [blobUrl]);

  const openFile = async () => {
    if (!doc.fileKey) return;
    if (blobUrl) {
      window.open(blobUrl, '_blank', 'noopener');
      return;
    }
    setLoading(true);
    const blob = await getBlob(doc.fileKey);
    setLoading(false);
    if (!blob) {
      toast.error('הקובץ לא נמצא במכשיר. ייתכן שנמחק מהדפדפן.');
      return;
    }
    const url = createObjectUrl(blob);
    setBlobUrl(url);
    window.open(url, '_blank', 'noopener');
  };

  return (
    <Card className="overflow-hidden">
      <button type="button" onClick={onEdit} className="w-full text-start p-3.5 flex gap-2.5">
        <span className="size-10 shrink-0 grid place-items-center rounded-xl bg-subtle text-lg" aria-hidden>
          {meta.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-[14px] leading-snug truncate">{doc.name}</h3>
          <div className="flex items-center flex-wrap gap-1.5 mt-1">
            <Badge>{meta.label}</Badge>
            {doc.date && (
              <span className="text-[11.5px] text-faint ltr-nums">{formatShortDate(doc.date)}</span>
            )}
            {doc.size !== undefined && (
              <span className="text-[11.5px] text-faint ltr-nums">{formatFileSize(doc.size)}</span>
            )}
            {doc.fileKey ? (
              <Badge tone="success">
                <Paperclip className="size-3" />
                קובץ
              </Badge>
            ) : doc.url ? (
              <Badge tone="brand">
                <Link2 className="size-3" />
                קישור
              </Badge>
            ) : null}
          </div>
          {doc.notes && (
            <p className="text-[12px] text-muted mt-1.5 line-clamp-2 leading-relaxed">
              {doc.notes}
            </p>
          )}
        </div>
      </button>

      <div className="flex items-center gap-1 px-2.5 pb-2.5">
        {doc.fileKey && (
          <button
            type="button"
            onClick={() => void openFile()}
            disabled={loading}
            className="inline-flex items-center gap-1 text-[12px] text-brand px-2 py-1 rounded-lg hover:bg-brand-soft transition disabled:opacity-50"
          >
            {loading ? <Spinner className="size-3.5" /> : <Eye className="size-3.5" />}
            פתיחה
          </button>
        )}
        {blobUrl && (
          <a
            href={blobUrl}
            download={doc.name}
            className="inline-flex items-center gap-1 text-[12px] text-muted px-2 py-1 rounded-lg hover:bg-subtle transition"
          >
            <Download className="size-3.5" />
            שמירה
          </a>
        )}
        {externalUrl && (
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[12px] text-brand px-2 py-1 rounded-lg hover:bg-brand-soft transition"
          >
            <ExternalLink className="size-3.5" />
            פתיחת הקישור
          </a>
        )}
        <button
          type="button"
          onClick={onDelete}
          aria-label={`מחיקת ${doc.name}`}
          className="ms-auto p-1.5 rounded-lg text-faint hover:text-danger hover:bg-danger-soft transition"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </Card>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'shrink-0 px-3 h-8 rounded-lg text-[12.5px] font-medium border transition whitespace-nowrap',
        active
          ? 'bg-brand text-brand-contrast border-transparent'
          : 'bg-surface border-line text-muted hover:bg-subtle'
      )}
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */

type DocPayload = Omit<TripDocument, 'id' | 'tripId' | 'createdAt'>;

function DocumentSheet({
  open,
  onClose,
  doc,
  links,
  onSave,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  doc: TripDocument | null;
  links: {
    hotels: { id: string; name: string }[];
    flights: { id: string; airline: string; flightNumber: string }[];
    cars: { id: string; company: string }[];
    days: { id: string; index: number; title: string }[];
  };
  onSave: (payload: DocPayload) => void;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState(() => toForm(doc));
  const [touched, setTouched] = useState(false);


  const patch = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));
  const valid = form.name.trim().length > 0;

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    const [linkedType, linkedId] = form.link ? form.link.split(':') : ['', ''];
    onSave({
      name: form.name.trim(),
      category: form.category,
      date: form.date || undefined,
      url: form.url.trim() || undefined,
      notes: form.notes.trim() || undefined,
      fileKey: doc?.fileKey,
      mimeType: doc?.mimeType,
      size: doc?.size,
      linkedType: (linkedType || undefined) as DocPayload['linkedType'],
      linkedId: linkedId || undefined,
    });
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={doc ? 'עריכת מסמך' : 'מסמך חדש'}
      description={doc?.fileKey ? undefined : 'אפשר לשמור קישור למסמך שנמצא במקום אחר'}
      footer={
        <div className="flex gap-2">
          {onDelete && (
            <Button
              variant="ghost"
              onClick={onDelete}
              aria-label="מחיקה"
              className="text-danger hover:bg-danger-soft shrink-0"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} className="flex-1">
            ביטול
          </Button>
          <Button onClick={submit} className="flex-1" disabled={touched && !valid}>
            שמירה
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pb-4">
        <TextInput
          label="שם המסמך"
          required
          autoFocus
          value={form.name}
          error={touched && !valid ? 'צריך שם' : undefined}
          onChange={(e) => patch({ name: e.target.value })}
        />

        <Field label="קטגוריה">
          <div className="flex flex-wrap gap-1.5">
            {DOCUMENT_CATEGORIES.map((c) => {
              const meta = DOCUMENT_CATEGORY_META[c];
              const on = form.category === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => patch({ category: c })}
                  aria-pressed={on}
                  className={cn(
                    'inline-flex items-center gap-1 px-2.5 h-8 rounded-lg text-[12.5px] font-medium border transition',
                    on
                      ? 'bg-brand text-brand-contrast border-transparent'
                      : 'border-line text-muted hover:bg-subtle'
                  )}
                >
                  <span aria-hidden>{meta.emoji}</span>
                  {meta.label}
                </button>
              );
            })}
          </div>
        </Field>

        <TextInput
          label="תאריך"
          type="date"
          value={form.date}
          onChange={(e) => patch({ date: e.target.value })}
        />

        {!doc?.fileKey && (
          <TextInput
            label="קישור"
            type="url"
            dir="ltr"
            placeholder="https://"
            value={form.url}
            onChange={(e) => patch({ url: e.target.value })}
          />
        )}

        <Select
          label="שיוך"
          hint="המסמך יוצג גם ליד ההזמנה או היום שאליו הוא שייך"
          value={form.link}
          onChange={(e) => patch({ link: e.target.value })}
        >
          <option value="">ללא שיוך</option>
          {links.flights.length > 0 && (
            <optgroup label="טיסות">
              {links.flights.map((f) => (
                <option key={f.id} value={`flight:${f.id}`}>
                  ✈️ {f.airline} {f.flightNumber}
                </option>
              ))}
            </optgroup>
          )}
          {links.hotels.length > 0 && (
            <optgroup label="מלונות">
              {links.hotels.map((h) => (
                <option key={h.id} value={`hotel:${h.id}`}>
                  🏨 {h.name}
                </option>
              ))}
            </optgroup>
          )}
          {links.cars.length > 0 && (
            <optgroup label="רכב">
              {links.cars.map((c) => (
                <option key={c.id} value={`car:${c.id}`}>
                  🚗 {c.company}
                </option>
              ))}
            </optgroup>
          )}
          {links.days.length > 0 && (
            <optgroup label="ימים">
              {links.days.map((d) => (
                <option key={d.id} value={`day:${d.id}`}>
                  📅 יום {d.index} — {d.title}
                </option>
              ))}
            </optgroup>
          )}
        </Select>

        <TextArea
          label="הערות"
          value={form.notes}
          onChange={(e) => patch({ notes: e.target.value })}
        />

        {doc?.fileKey && (
          <p className="text-[12px] text-muted bg-inset rounded-xl px-3 py-2.5">
            📎 קובץ מצורף
            {doc.size !== undefined ? ` · ${formatFileSize(doc.size)}` : ''} · שמור במכשיר הזה בלבד
          </p>
        )}
      </div>
    </Sheet>
  );
}

function toForm(doc: TripDocument | null) {
  return {
    name: doc?.name ?? '',
    category: doc?.category ?? ('other' as DocumentCategory),
    date: doc?.date ?? todayISO(),
    url: doc?.url ?? '',
    notes: doc?.notes ?? '',
    link: doc?.linkedType && doc.linkedId ? `${doc.linkedType}:${doc.linkedId}` : '',
  };
}

/** A best-effort guess so uploads land in a sensible bucket. */
function guessCategory(filename: string): DocumentCategory {
  const n = filename.toLowerCase();
  if (/(flight|boarding|ticket|טיסה|עלייה)/.test(n)) return 'flight';
  if (/(hotel|booking|reserv|מלון)/.test(n)) return 'hotel';
  if (/(car|rental|hertz|avis|רכב)/.test(n)) return 'car';
  if (/(insur|policy|ביטוח|פוליסה)/.test(n)) return 'insurance';
  if (/(restaurant|מסעדה)/.test(n)) return 'restaurant';
  if (/(ticket|entry|כרטיס)/.test(n)) return 'tickets';
  return 'other';
}
