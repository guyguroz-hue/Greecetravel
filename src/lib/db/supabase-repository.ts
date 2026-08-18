'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import { requireSupabase } from '@/lib/supabase/client';
import {
  activityMapper,
  carMapper,
  checklistMapper,
  dayMapper,
  documentMapper,
  expenseMapper,
  flightMapper,
  hotelMapper,
  placeMapper,
  travelerMapper,
  tripMapper,
  type Mapper,
  type Row,
} from '@/lib/supabase/mappers';
import { EMPTY_DATA, type TripData } from '@/lib/types';
import { diffCollection, isEmptyDiff } from './diff';
import type { TripRepository } from './repository';

/**
 * Collections in dependency order. Upserts run top to bottom so a parent row
 * always exists before its children; deletes run bottom to top for the same
 * reason.
 */
type CollectionKey = Exclude<keyof TripData, 'shares'>;

/**
 * Each collection has a differently-typed mapper, but this file only ever
 * needs "something with an id" — so they are erased to one shape at the table
 * boundary rather than threading a dozen generics through the sync logic.
 */
interface AnyMapper {
  table: string;
  toRow: (entity: never) => Row;
  fromRow: (row: Row) => { id: string };
}

const erase = <T>(m: Mapper<T>): AnyMapper => m as unknown as AnyMapper;

interface Collection {
  key: CollectionKey;
  mapper: AnyMapper;
}

const COLLECTIONS: Collection[] = [
  { key: 'trips', mapper: erase(tripMapper) },
  { key: 'travelers', mapper: erase(travelerMapper) },
  { key: 'days', mapper: erase(dayMapper) },
  { key: 'hotels', mapper: erase(hotelMapper) },
  { key: 'flights', mapper: erase(flightMapper) },
  { key: 'cars', mapper: erase(carMapper) },
  { key: 'places', mapper: erase(placeMapper) },
  // activities reference days, so they follow them
  { key: 'activities', mapper: erase(activityMapper) },
  { key: 'expenses', mapper: erase(expenseMapper) },
  { key: 'documents', mapper: erase(documentMapper) },
  { key: 'checklists', mapper: erase(checklistMapper) },
];

const CACHE_KEY = 'mtp:cloud-cache:v1';

/**
 * Trips live in Postgres and are shared between members.
 *
 * Two properties matter more than anything else here:
 *
 *  - **It still works on a mountain road with no signal.** Every successful
 *    read is cached locally and every write is applied locally first. If the
 *    network write fails, the last *synced* snapshot is left untouched, so
 *    the next successful save replays everything that accumulated since.
 *
 *  - **It writes rows, not documents.** Ticking one checklist box sends one
 *    UPDATE, not the whole trip.
 */
export class SupabaseRepository implements TripRepository {
  readonly id = 'supabase';
  readonly seedsDemoWhenEmpty = false;

  /** The last state known to match the server. */
  private synced: TripData | null = null;
  private pendingError: string | null = null;

  private get client(): SupabaseClient {
    return requireSupabase();
  }

  async load(): Promise<TripData | null> {
    const { data: auth } = await this.client.auth.getUser();
    if (!auth.user) return null;

    try {
      const data = await this.fetchAll();
      this.synced = clone(data);
      this.pendingError = null;
      writeCache(data);
      return data;
    } catch (err) {
      console.error('[supabase] load failed, falling back to the local cache', err);
      const cached = readCache();
      if (cached) {
        // Deliberately do NOT set `synced`: the cache may contain writes the
        // server never received, and they must be replayed on the next save.
        return cached;
      }
      throw err;
    }
  }

  async save(data: TripData): Promise<void> {
    // Local first, so the UI and a refresh are correct even while offline.
    writeCache(data);

    const base = this.synced;
    if (!base) {
      // No confirmed baseline yet (first save after an offline start). Pull
      // what the server has so the diff is against reality rather than guesses.
      try {
        const remote = await this.fetchAll();
        this.synced = clone(remote);
      } catch (err) {
        // Returning here used to report success to the caller while nothing
        // had been written — the one outcome a save must never produce.
        this.pendingError = describe(err);
        throw err;
      }
    }

    try {
      await this.push(this.synced!, data);
      this.synced = clone(data);
      this.pendingError = null;
    } catch (err) {
      // Keep the old baseline; the next save will retry the whole backlog.
      this.pendingError = describe(err);
      throw err;
    }
  }

  async clear(): Promise<void> {
    // Only the local mirror. Removing someone's shared trips because they
    // tapped "clear" on one device would be a genuinely destructive surprise.
    this.synced = null;
    if (typeof window !== 'undefined') window.localStorage.removeItem(CACHE_KEY);
  }

  get lastError(): string | null {
    return this.pendingError;
  }

  /** Forces the next save to re-derive its baseline from the server. */
  invalidate(): void {
    this.synced = null;
  }

  /* ---------------------------------------------------------------- */

  private async fetchAll(): Promise<TripData> {
    const { data: tripRows, error } = await this.client.from('trips').select('*');
    if (error) throw error;

    const trips = (tripRows ?? []).map((r) => tripMapper.fromRow(r));
    if (trips.length === 0) return { ...EMPTY_DATA };

    const tripIds = trips.map((t) => t.id);
    const result: TripData = { ...EMPTY_DATA, trips };

    // One round trip per table, all in parallel.
    await Promise.all(
      COLLECTIONS.filter((c) => c.key !== 'trips').map(async ({ key, mapper }) => {
        const { data: rows, error: err } = await this.client
          .from(mapper.table)
          .select('*')
          .in('trip_id', tripIds);
        if (err) throw err;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (result as any)[key] = (rows ?? []).map((r) => mapper.fromRow(r));
      })
    );

    return result;
  }

  private async push(before: TripData, after: TripData): Promise<void> {
    const diffs = COLLECTIONS.map(({ key, mapper }) => ({
      key,
      mapper,
      diff: diffCollection(
        (before[key] ?? []) as { id: string }[],
        (after[key] ?? []) as { id: string }[]
      ),
    })).filter((d) => !isEmptyDiff(d.diff));

    if (diffs.length === 0) return;

    // Upserts parent-first.
    for (const { mapper, diff } of diffs) {
      if (diff.upserts.length === 0) continue;
      const rows = diff.upserts.map((item) => mapper.toRow(item as never));
      const { error } = await this.client.from(mapper.table).upsert(rows, {
        onConflict: 'id',
      });
      // Which table refused the write is most of the diagnosis, and the bare
      // PostgREST message never mentions it.
      if (error) throw tableError(mapper.table, error);
    }

    // Deletes child-first, so foreign keys never block a removal.
    for (const { mapper, diff } of [...diffs].reverse()) {
      if (diff.deleteIds.length === 0) continue;
      const { error } = await this.client
        .from(mapper.table)
        .delete()
        .in('id', diff.deleteIds);
      if (error) throw tableError(mapper.table, error);
    }
  }
}

/* ------------------------------------------------------------------ */

function clone(data: TripData): TripData {
  return JSON.parse(JSON.stringify(data)) as TripData;
}

function describe(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const e = err as { message?: string; code?: string; details?: string };
    return [e.code, e.message, e.details].filter(Boolean).join(' · ');
  }
  return String(err);
}

/**
 * Names the table on a failed write and turns the two failures worth telling
 * apart into instructions. Everything else is passed through verbatim rather
 * than flattened into "something went wrong".
 */
function tableError(table: string, error: { message: string; code?: string }): Error {
  const code = error.code;
  let hint = '';
  if (code === '42501' || /row-level security/i.test(error.message)) {
    hint = ' — אין הרשאת כתיבה לטבלה הזו. אם זה טיול משותף, ייתכן שההרשאה שלך היא צפייה בלבד.';
  } else if (code === '42P01') {
    hint = ' — הטבלה לא קיימת. צריך להריץ את 0001_init.sql ב-SQL Editor.';
  }
  const wrapped = new Error(`${table}: ${describe(error)}${hint}`);
  wrapped.cause = error;
  return wrapped;
}

function writeCache(data: TripData) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('[supabase] could not cache trip data locally', err);
  }
}

function readCache(): TripData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return { ...EMPTY_DATA, ...(JSON.parse(raw) as Partial<TripData>) };
  } catch {
    return null;
  }
}
