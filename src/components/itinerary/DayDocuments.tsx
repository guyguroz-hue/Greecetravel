'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, Eye, Paperclip } from 'lucide-react';
import {
  DOCUMENT_CATEGORY_META,
  type Activity,
  type Day,
  type Flight,
  type Hotel,
  type TripDocument,
} from '@/lib/types';
import { resolveFileUrl } from '@/lib/services/documents';
import { toast } from '@/lib/store/ui-store';
import { safeExternalUrl } from '@/lib/utils/format';
import { Spinner } from '@/components/ui/Feedback';

/**
 * Surfaces the paperwork you actually need on a given day: anything pinned to
 * the day itself, to the hotel you sleep at, to a flight on that date, or to
 * one of the day's own activities.
 */
export function documentsForDay(
  day: Day,
  documents: TripDocument[],
  hotel: Hotel | undefined,
  flights: Flight[],
  activities: Activity[]
): TripDocument[] {
  const flightIds = new Set(flights.filter((f) => f.date === day.date).map((f) => f.id));
  const activityIds = new Set(activities.filter((a) => a.dayId === day.id).map((a) => a.id));
  return documents.filter((d) => {
    if (!d.linkedId) return false;
    if (d.linkedType === 'day') return d.linkedId === day.id;
    if (d.linkedType === 'hotel') return !!hotel && d.linkedId === hotel.id;
    if (d.linkedType === 'flight') return flightIds.has(d.linkedId);
    if (d.linkedType === 'activity') return activityIds.has(d.linkedId);
    return false;
  });
}

export function DayDocuments({ documents }: { documents: TripDocument[] }) {
  if (documents.length === 0) return null;
  return (
    <div className="mt-3 pt-3 border-t border-line">
      <p className="text-[11.5px] text-muted mb-1.5">מסמכים ליום הזה</p>
      <div className="flex flex-wrap gap-1.5">
        {documents.map((doc) => (
          <DocumentChip key={doc.id} doc={doc} />
        ))}
      </div>
    </div>
  );
}

function DocumentChip({ doc }: { doc: TripDocument }) {
  const [loading, setLoading] = useState(false);
  const meta = DOCUMENT_CATEGORY_META[doc.category];
  const externalUrl = useMemo(() => safeExternalUrl(doc.url), [doc.url]);

  const open = async () => {
    if (externalUrl) {
      window.open(externalUrl, '_blank', 'noopener');
      return;
    }
    if (!doc.fileKey) {
      toast.show('למסמך הזה אין קובץ או קישור מצורף');
      return;
    }
    setLoading(true);
    const url = await resolveFileUrl(doc.fileKey);
    setLoading(false);
    if (!url) {
      toast.error('לא הצלחנו לפתוח את הקובץ');
      return;
    }
    window.open(url, '_blank', 'noopener');
  };

  return (
    <button
      type="button"
      onClick={() => void open()}
      className="inline-flex items-center gap-1.5 max-w-full px-2.5 h-8 rounded-lg bg-inset border border-line text-[12px] hover:border-brand hover:text-brand transition"
    >
      <span aria-hidden>{meta.emoji}</span>
      <span className="truncate">{doc.name}</span>
      {loading ? (
        <Spinner className="size-3" />
      ) : externalUrl ? (
        <ExternalLink className="size-3 shrink-0 text-faint" />
      ) : doc.fileKey ? (
        <Eye className="size-3 shrink-0 text-faint" />
      ) : (
        <Paperclip className="size-3 shrink-0 text-faint" />
      )}
    </button>
  );
}
