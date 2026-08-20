'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, Check, ChevronDown, ScanLine } from 'lucide-react';
import type { CurrencyCode, ExpenseCategory, Traveler, Trip } from '@/lib/types';
import { isAborted, readReceipt, type OcrProgress } from '@/lib/services/receipt-ocr';
import { storeFile } from '@/lib/services/documents';
import { useTripStore } from '@/lib/store/trip-store';
import { toast } from '@/lib/store/ui-store';
import { formatMoney } from '@/lib/utils/format';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { ExpenseSheet } from './ExpenseSheet';

/**
 * Photograph the bill, confirm, done.
 *
 * The long way round is to remember the number, find the budget screen, open
 * a form and type five fields — which is why expenses go unrecorded on the
 * trip and get reconstructed badly afterwards. Here the photo is the input:
 * recognition runs on the phone, fills the form, and the person is left with
 * one thing to do, which is check that the total is right.
 *
 * It fills a form rather than saving straight to the ledger on purpose. OCR
 * on a creased receipt in bad light is confident and wrong often enough that
 * silent saving would quietly corrupt the budget; a filled form makes a bad
 * read obvious in the half-second before it matters.
 */

/**
 * A phone camera photo is far larger than recognition needs, and size costs
 * seconds of processing on the device. The long edge is capped at a point
 * where receipt print is still crisp.
 */
const MAX_EDGE = 2000;

async function prepareImage(file: File): Promise<Blob> {
  if (typeof createImageBitmap !== 'function') return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // An image the browser cannot decode here may still decode inside the
    // worker, so hand the original over rather than failing now.
    return file;
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.9)
  );
  return blob ?? file;
}

interface Reading {
  amount?: number;
  currency?: CurrencyCode;
  date?: string;
  merchant?: string;
  category?: ExpenseCategory;
  amountSource?: 'total-line' | 'largest';
  text: string;
}

export function ReceiptCapture({
  file,
  trip,
  travelers,
  onDone,
}: {
  /** The photo just taken. Mounted per photo, so state starts clean. */
  file: File;
  trip: Trip;
  travelers: Traveler[];
  onDone: () => void;
}) {
  const addDocument = useTripStore((s) => s.addDocument);
  const [progress, setProgress] = useState<OcrProgress>({ stage: 'loading', ratio: 0 });
  const [reading, setReading] = useState<Reading | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [keepPhoto, setKeepPhoto] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);
  // The downscaled copy: what the engine actually read, and small enough to
  // be worth keeping as the attachment instead of a 4MB camera original.
  const [prepared, setPrepared] = useState<Blob | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    let url: string | null = null;

    // Everything below settles after an await, so no state is set on the way
    // through the effect. The preview URL is created here rather than held in
    // state, so the cleanup that revokes it always matches a creation — an
    // effect that runs twice must not leave the first URL dangling.
    void (async () => {
      try {
        const image = await prepareImage(file);
        if (cancelled) return;
        url = URL.createObjectURL(image);
        setPreview(url);
        setPrepared(image);

        const result = await readReceipt(image, {
          countryCode: trip.countryCode,
          signal: controller.signal,
          onProgress: (p) => {
            if (!cancelled) setProgress(p);
          },
        });
        if (cancelled) return;
        setReading(result);
      } catch (err) {
        if (cancelled || isAborted(err)) return;
        console.error('[receipt] could not read', err);
        setFailed(
          err instanceof Error && /fetch|network|load/i.test(err.message)
            ? 'לא הצלחנו להוריד את מנוע הזיהוי. צריך חיבור לאינטרנט בפעם הראשונה בלבד.'
            : 'לא הצלחנו לקרוא את התמונה.'
        );
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [file, trip.countryCode]);

  /** Keeps the photo alongside the expense, so the bill can be checked later. */
  const savePhoto = async (description: string) => {
    if (!keepPhoto) return;
    const blob = prepared ?? file;
    try {
      const image =
        blob instanceof File ? blob : new File([blob], 'receipt.jpg', { type: 'image/jpeg' });
      const stored = await storeFile(trip.id, image);
      addDocument({
        tripId: trip.id,
        name: `חשבונית · ${description}`.slice(0, 80),
        category: 'restaurant',
        date: reading?.date,
        ...stored,
      });
    } catch (err) {
      // The expense is already saved and is the point; the photo is a bonus.
      console.error('[receipt] could not keep the photo', err);
      toast.show('ההוצאה נשמרה, אבל לא הצלחנו לשמור את הצילום');
    }
  };

  // Read and confirmed enough to fill a form: hand over to the normal expense
  // sheet rather than growing a second one that drifts from it.
  if (reading) {
    const description = reading.merchant?.trim() || 'חשבונית';
    return (
      <ExpenseSheet
        open
        onClose={onDone}
        expense={null}
        trip={trip}
        travelers={travelers}
        title="מהחשבונית"
        banner={<ReadingBanner reading={reading} trip={trip} preview={preview} />}
        extra={
          <label className="flex items-center gap-2.5 py-1 cursor-pointer">
            <input
              type="checkbox"
              checked={keepPhoto}
              onChange={(e) => setKeepPhoto(e.target.checked)}
              className="size-4.5 rounded accent-[var(--brand)]"
            />
            <span className="text-[14px]">לשמור את הצילום במסמכים</span>
          </label>
        }
        onSaved={(_, saved) => void savePhoto(saved.description || description)}
        defaults={{
          description,
          amount: reading.amount !== undefined ? String(reading.amount) : '',
          currency: reading.currency ?? trip.currencies[trip.currencies.length - 1],
          date: reading.date,
          category: reading.category ?? 'food',
          paid: true,
        }}
      />
    );
  }

  return (
    <Sheet
      open
      onClose={onDone}
      title="קורא את החשבונית"
      description={failed ? undefined : 'הזיהוי רץ על המכשיר — התמונה לא נשלחת לשום מקום'}
      size="sm"
      footer={
        <Button variant="secondary" onClick={onDone} className="w-full">
          {failed ? 'סגירה' : 'ביטול'}
        </Button>
      }
    >
      <div className="space-y-4 pb-2">
        {preview && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={preview}
            alt="החשבונית שצולמה"
            className="w-full max-h-52 object-contain rounded-xl bg-inset"
          />
        )}

        {failed ? (
          <div className="rounded-xl bg-warning-soft px-3 py-3 flex gap-2.5">
            <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] leading-relaxed">{failed}</p>
              <p className="text-[12px] text-muted mt-1.5 leading-relaxed">
                אפשר להוסיף את ההוצאה ידנית ממסך התקציב.
              </p>
            </div>
          </div>
        ) : (
          <ProgressLine progress={progress} />
        )}
      </div>
    </Sheet>
  );
}

function ProgressLine({ progress }: { progress: OcrProgress }) {
  const label =
    progress.stage === 'loading'
      ? 'מכין את מנוע הזיהוי…'
      : progress.stage === 'reading'
        ? 'קורא את הטקסט…'
        : 'כמעט מוכן…';

  return (
    <div>
      <div className="flex items-center gap-2 text-[13px] text-muted">
        <ScanLine className="size-4 text-accent animate-pulse" />
        {label}
      </div>
      <div className="mt-2.5 h-1.5 rounded-full bg-inset overflow-hidden">
        <div
          className="h-full bg-accent transition-[width] duration-300"
          style={{ width: `${Math.round(Math.max(0.04, progress.ratio) * 100)}%` }}
        />
      </div>
      <p className="text-[11.5px] text-faint mt-2 leading-relaxed">
        בפעם הראשונה יורד מנוע הזיהוי (כ-12MB). אחר כך הוא נשמר במכשיר והקריאה מהירה.
      </p>
    </div>
  );
}

/** What was read, and how sure we are of it. */
function ReadingBanner({
  reading,
  trip,
  preview,
}: {
  reading: Reading;
  trip: Trip;
  preview: string | null;
}) {
  const [open, setOpen] = useState(false);
  const found = reading.amount !== undefined;

  return (
    <div className="rounded-xl bg-inset px-3 py-3 space-y-2.5">
      <div className="flex items-start gap-2.5">
        {preview && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={preview}
            alt="החשבונית"
            className="size-14 rounded-lg object-cover shrink-0 border border-line"
          />
        )}
        <div className="min-w-0 flex-1">
          {found ? (
            <p className="flex items-center gap-1.5 text-[13px]">
              <Check className="size-4 text-success shrink-0" />
              זיהינו{' '}
              <strong className="font-semibold ltr-nums">
                {formatMoney(reading.amount!, reading.currency ?? trip.baseCurrency)}
              </strong>
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-[13px]">
              <AlertTriangle className="size-4 text-warning shrink-0" />
              לא הצלחנו לזהות את הסכום
            </p>
          )}
          <p className="text-[11.5px] text-muted mt-1 leading-relaxed">
            {found && reading.amountSource === 'largest'
              ? 'לא נמצאה שורת ״סה״כ״ ברורה, אז לקחנו את הסכום הגדול בחשבונית — כדאי לוודא.'
              : found
                ? 'כדאי להשוות לחשבונית לפני שמירה.'
                : 'אפשר להקליד אותו למטה; שאר הפרטים כבר מולאו.'}
          </p>
        </div>
      </div>

      {reading.text.trim() && (
        <div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 text-[12px] text-muted hover:text-ink transition"
          >
            <ChevronDown className={`size-3.5 transition ${open ? 'rotate-180' : ''}`} />
            מה שנקרא מהתמונה
          </button>
          {open && (
            <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-surface border border-line p-2 text-[11px] leading-relaxed whitespace-pre-wrap">
              {reading.text.trim()}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The camera button itself, and the hidden input behind it.
 *
 * The input is mounted permanently and clicked straight from the tap, because
 * opening a file picker is only allowed inside a real user gesture — routing
 * it through state and an effect gets it blocked by the browser.
 */
export function useReceiptCapture() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      capture="environment"
      className="hidden"
      aria-hidden
      tabIndex={-1}
      onChange={(e) => {
        const picked = e.target.files?.[0] ?? null;
        // Cleared so photographing the same receipt twice still fires change.
        e.target.value = '';
        if (picked) setFile(picked);
      }}
    />
  );

  return {
    input,
    file,
    open: () => inputRef.current?.click(),
    close: () => setFile(null),
  };
}

export { Camera as ReceiptIcon };
