'use client';

import { parseReceipt, hasTotalKeyword, countMoneyTokens, type ReceiptFields } from './receipt-parse';
import { prepareReceiptImage } from './image-prep';
import {
  candidateLanguages,
  GOOD_ENOUGH,
  RECEIPT_LANGUAGES,
  scoreReading,
  TOO_POOR,
} from './receipt-langs';

/**
 * Reading a receipt photo, on the device.
 *
 * Recognition runs in a web worker through Tesseract — the photo never leaves
 * the phone, there is no API key, no account and no card on file. The cost is
 * a one-time download of the engine and language data, and accuracy that is
 * good on printed digits and patchy on words.
 *
 * Three things stand between the camera and the parser, and all three exist
 * because the naive version of this was unusable:
 *
 *  1. The photo is normalised first (see `image-prep`). Handed a raw photo,
 *     the engine reads something different every time the light moves.
 *  2. The language is decided by trying and scoring rather than assumed from
 *     the destination (see `receipt-langs`). Reading Hebrew with Greek data
 *     does not degrade gracefully; it produces confident nonsense.
 *  3. A reading that scores too poorly is reported as a failure instead of
 *     being handed on. A wrong total that looks plausible is worse than an
 *     empty field, because it gets confirmed without being read.
 *
 * Everything is behind `ReceiptReader`, so a cloud model can be dropped in
 * later by implementing one method.
 */

export type OcrStage = 'preparing' | 'loading' | 'reading' | 'done';

export interface OcrProgress {
  stage: OcrStage;
  /** 0–1 within the current stage, when the engine reports it. */
  ratio: number;
  /** Which language this pass is trying, so the UI can say so. */
  language?: string;
  /** 1-based, out of `passes`, when more than one language is being tried. */
  pass?: number;
  passes?: number;
}

export interface ReadOptions {
  countryCode?: string;
  locale?: string;
  /** True while the trip is running; puts the destination's language first. */
  away?: boolean;
  /** Overrides detection entirely — what the "read it as…" buttons pass. */
  forceLanguage?: string;
  signal?: AbortSignal;
  onProgress?: (p: OcrProgress) => void;
}

export interface RawReading {
  text: string;
  /** Tesseract's own mean confidence, 0–100. */
  confidence: number;
  /** The winning language key, e.g. `heb`. */
  language: string;
  /** Our own 0–1 judgement of the reading. */
  score: number;
}

export interface ReceiptReader {
  readonly id: string;
  read(image: Blob, opts?: ReadOptions): Promise<RawReading>;
}

class AbortedError extends Error {
  constructor() {
    super('aborted');
    this.name = 'AbortedError';
  }
}

export function isAborted(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortedError';
}

/**
 * The language that worked last time, so the second receipt of a holiday does
 * not pay for detection again. Cleared when the person forces a language, and
 * naturally gone on reload — it is a shortcut, never a decision.
 */
let lastGoodLanguage: string | null = null;

export function rememberedLanguage(): string | null {
  return lastGoodLanguage;
}

export function forgetLanguage() {
  lastGoodLanguage = null;
}

export const tesseractReader: ReceiptReader = {
  id: 'tesseract',
  async read(image, opts = {}) {
    const { signal, onProgress } = opts;
    const stop = () => {
      if (signal?.aborted) throw new AbortedError();
    };
    stop();

    // Imported here rather than at the top so the engine is fetched the first
    // time somebody photographs a receipt, and never for anyone who does not.
    const { createWorker } = await import('tesseract.js');
    stop();

    let candidates = candidateLanguages({
      countryCode: opts.countryCode,
      locale: opts.locale,
      away: opts.away,
      forced: opts.forceLanguage,
    });
    // A language already proven on this device goes first — but the others
    // stay behind it, because the next receipt may well be from elsewhere.
    if (!opts.forceLanguage && lastGoodLanguage) {
      candidates = [lastGoodLanguage, ...candidates.filter((c) => c !== lastGoodLanguage)];
    }

    let best: RawReading | null = null;

    for (let i = 0; i < candidates.length; i++) {
      stop();
      const key = candidates[i];
      const lang = RECEIPT_LANGUAGES[key];
      if (!lang) continue;

      onProgress?.({
        stage: 'loading',
        ratio: 0,
        language: key,
        pass: i + 1,
        passes: candidates.length,
      });

      const worker = await createWorker(lang.code, 1, {
        logger: (m: { status?: string; progress?: number }) => {
          const ratio = typeof m.progress === 'number' ? m.progress : 0;
          onProgress?.({
            stage: m.status === 'recognizing text' ? 'reading' : 'loading',
            ratio,
            language: key,
            pass: i + 1,
            passes: candidates.length,
          });
        },
      });

      try {
        stop();
        const { data } = await worker.recognize(image);
        const text = data.text ?? '';
        const confidence = typeof data.confidence === 'number' ? data.confidence : 0;
        const { score } = scoreReading(
          text,
          confidence,
          key,
          hasTotalKeyword(text),
          countMoneyTokens(text)
        );

        if (!best || score > best.score) best = { text, confidence, language: key, score };
        // Convincing enough that trying another language would only cost the
        // person another download and another wait.
        if (score >= GOOD_ENOUGH) break;
      } finally {
        // Frees the worker thread and its several megabytes of WASM heap. A
        // failed read must not leak one, or a few retries exhaust the tab.
        await worker.terminate().catch(() => {});
      }
    }

    if (!best) throw new Error('no language could be tried');
    onProgress?.({ stage: 'done', ratio: 1, language: best.language });
    if (best.score >= GOOD_ENOUGH) lastGoodLanguage = best.language;
    return best;
  },
};

let reader: ReceiptReader = tesseractReader;

/** Swaps the engine — used by tests, and by whatever replaces Tesseract. */
export function setReceiptReader(next: ReceiptReader) {
  reader = next;
}

export function getReceiptReader(): ReceiptReader {
  return reader;
}

/**
 * A seam for automated tests, and only for them.
 *
 * Recognition needs a WASM engine and a photograph of a real receipt, neither
 * of which a browser test can supply, so a test swaps in a reader that returns
 * known text and exercises everything downstream of it. The guard is a
 * compile-time constant, so this block is stripped from production builds
 * rather than shipped as a way to replace the engine at runtime.
 */
if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__setReceiptReader = setReceiptReader;
}

export interface ReceiptReading extends ReceiptFields {
  /** The unedited OCR output, shown on request so a bad read is explainable. */
  text: string;
  language: string;
  score: number;
  confidence: number;
  /**
   * True when the reading was too poor to trust. The fields are still
   * returned so they can be shown as "this is what it saw", but the UI must
   * not put them in the form.
   */
  unreliable: boolean;
}

/** Photo in, a draft expense out. */
export async function readReceipt(image: Blob, opts: ReadOptions = {}): Promise<ReceiptReading> {
  opts.onProgress?.({ stage: 'preparing', ratio: 0 });
  const prepared = await prepareReceiptImage(image);
  if (opts.signal?.aborted) throw new AbortedError();

  const raw = await reader.read(prepared.blob, opts);
  const unreliable = raw.score < TOO_POOR;

  return {
    // Guessing at the total is only permitted when the reading convinced us it
    // read this receipt at all. A pass that never found the word for "total"
    // has no business nominating the largest number it happens to see.
    ...parseReceipt(raw.text, {
      confidence: raw.confidence,
      guessAllowed: raw.score >= GOOD_ENOUGH,
    }),
    text: raw.text,
    language: raw.language,
    score: raw.score,
    confidence: raw.confidence,
    unreliable,
  };
}
