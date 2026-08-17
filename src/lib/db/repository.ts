import { EMPTY_DATA, type TripData } from '@/lib/types';

/**
 * The single seam between the app and its storage.
 *
 * The app only ever talks to a `TripRepository`. Two implementations exist:
 * `LocalStorageRepository` (everything stays in the browser) and
 * `SupabaseRepository` (shared trips in Postgres). Nothing above this
 * interface knows which one is in use.
 */
export interface TripRepository {
  readonly id: string;
  /**
   * Whether an empty result means "first run, show the demo trip". True for
   * local storage; false for an account that genuinely has no trips yet.
   */
  readonly seedsDemoWhenEmpty?: boolean;
  load(): Promise<TripData | null>;
  save(data: TripData): Promise<void>;
  clear(): Promise<void>;
}

const STORAGE_KEY = 'mtp:data:v1';

export class LocalStorageRepository implements TripRepository {
  readonly id = 'localStorage';
  readonly seedsDemoWhenEmpty = true;

  async load(): Promise<TripData | null> {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<TripData>;
      // Merge over EMPTY_DATA so a payload written by an older version that
      // lacked a collection still loads instead of crashing on `.map`.
      return { ...EMPTY_DATA, ...parsed };
    } catch (err) {
      console.error('[repository] failed to load, starting fresh', err);
      return null;
    }
  }

  async save(data: TripData): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      // Quota exceeded is the realistic failure here — large files belong in
      // the blob store, not in this document.
      console.error('[repository] failed to save', err);
      throw err;
    }
  }

  async clear(): Promise<void> {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

/** In-memory stand-in used during SSR and in tests. */
export class MemoryRepository implements TripRepository {
  readonly id = 'memory';
  readonly seedsDemoWhenEmpty = true;
  private data: TripData | null = null;

  async load() {
    return this.data;
  }
  async save(data: TripData) {
    this.data = data;
  }
  async clear() {
    this.data = null;
  }
}
