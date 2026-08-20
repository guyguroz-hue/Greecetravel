'use client';

import { parseReceipt, type ReceiptFields } from './receipt-parse';

/**
 * Reading a receipt photo, on the device.
 *
 * Recognition runs in a web worker in the browser through Tesseract — the
 * photo never leaves the phone, there is no API key, no account and no card
 * on file. The cost is a one-time download of the engine and the language
 * data (roughly 12MB), cached by the browser afterwards, and accuracy that is
 * good on printed digits and patchy on words. The parser downstream is built
 * around exactly that trade: it leans on the numbers and treats every word as
 * a hint that might be wrong.
 *
 * Everything is behind `ReceiptReader`, so a cloud model can be dropped in
 * later by implementing one method — the capture flow and the parser do not
 * change.
 */

export type OcrStage = 'loading' | 'reading' | 'done';

export interface OcrProgress {
  stage: OcrStage;
  /** 0–1 within the current stage, when the engine reports it. */
  ratio: number;
}

export interface ReceiptReader {
  readonly id: string;
  read(
    image: Blob,
    opts?: { countryCode?: string; signal?: AbortSignal; onProgress?: (p: OcrProgress) => void }
  ): Promise<string>;
}

/**
 * Tesseract language data for a country, on top of English.
 *
 * English alone reads Latin digits everywhere, which is most of what a
 * receipt is worth. A second language is only added where the alphabet is
 * different enough that the shop's name and the word for "total" would
 * otherwise come back as noise — each one is another few MB to download.
 */
const COUNTRY_LANG: Record<string, string> = {
  GR: 'ell',
  IL: 'heb',
  CY: 'ell',
  RU: 'rus',
  BG: 'bul',
  RS: 'srp',
  UA: 'ukr',
  TH: 'tha',
  JP: 'jpn',
  CN: 'chi_sim',
  KR: 'kor',
  AE: 'ara',
  EG: 'ara',
  MA: 'ara',
  JO: 'ara',
  IN: 'hin',
  GE: 'kat',
  AM: 'hye',
};

export function languagesFor(countryCode?: string): string {
  const extra = countryCode ? COUNTRY_LANG[countryCode.toUpperCase()] : undefined;
  return extra ? `eng+${extra}` : 'eng';
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

export const tesseractReader: ReceiptReader = {
  id: 'tesseract',
  async read(image, opts = {}) {
    const { countryCode, signal, onProgress } = opts;
    if (signal?.aborted) throw new AbortedError();

    // Imported here rather than at the top so the engine is fetched the first
    // time somebody photographs a receipt, and never for anyone who does not.
    const { createWorker } = await import('tesseract.js');
    if (signal?.aborted) throw new AbortedError();

    onProgress?.({ stage: 'loading', ratio: 0 });

    const worker = await createWorker(languagesFor(countryCode), 1, {
      logger: (m: { status?: string; progress?: number }) => {
        const ratio = typeof m.progress === 'number' ? m.progress : 0;
        if (m.status === 'recognizing text') onProgress?.({ stage: 'reading', ratio });
        else onProgress?.({ stage: 'loading', ratio });
      },
    });

    try {
      if (signal?.aborted) throw new AbortedError();
      const { data } = await worker.recognize(image);
      onProgress?.({ stage: 'done', ratio: 1 });
      return data.text ?? '';
    } finally {
      // Frees the worker thread and its several megabytes of WASM heap. A
      // failed read must not leak one, or a few retries exhaust the tab.
      await worker.terminate().catch(() => {});
    }
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
 * Recognition needs a 12MB WASM engine and a photograph of a real receipt,
 * neither of which a browser test can supply, so a test swaps in a reader
 * that returns known text and exercises everything downstream of it. The
 * guard is a compile-time constant, so this block is stripped from production
 * builds rather than shipped as a way to replace the engine at runtime.
 */
if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__setReceiptReader = setReceiptReader;
}

export interface ReceiptReading extends ReceiptFields {
  /** The unedited OCR output, shown on request so a bad read is explainable. */
  text: string;
}

/** Photo in, a draft expense out. */
export async function readReceipt(
  image: Blob,
  opts: { countryCode?: string; signal?: AbortSignal; onProgress?: (p: OcrProgress) => void } = {}
): Promise<ReceiptReading> {
  const text = await reader.read(image, opts);
  return { ...parseReceipt(text), text };
}
