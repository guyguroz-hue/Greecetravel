import { isSupabaseConfigured } from '@/lib/supabase/client';
import { SupabaseRepository } from './supabase-repository';
import { LocalStorageRepository, MemoryRepository, type TripRepository } from './repository';

/**
 * Which storage the app is talking to right now.
 *
 * `cloud` requires both Supabase credentials and a signed-in user, so a
 * configured deployment still falls back to local storage on the login screen
 * and for anyone who never signs in.
 */
export type StorageMode = 'local' | 'cloud';

const localRepository: TripRepository =
  typeof window === 'undefined' ? new MemoryRepository() : new LocalStorageRepository();

let cloudRepository: SupabaseRepository | null = null;
let mode: StorageMode = 'local';

function ensureCloud(): SupabaseRepository {
  if (!cloudRepository) cloudRepository = new SupabaseRepository();
  return cloudRepository;
}

/** Switched by the auth layer as the session appears and disappears. */
export function setStorageMode(next: StorageMode) {
  mode = next === 'cloud' && isSupabaseConfigured ? 'cloud' : 'local';
}

export function getStorageMode(): StorageMode {
  return mode;
}

export function getRepository(): TripRepository {
  return mode === 'cloud' ? ensureCloud() : localRepository;
}

export function getLocalRepository(): TripRepository {
  return localRepository;
}

/** Cloud-only, for the sync layer; null in local mode. */
export function getCloudRepository(): SupabaseRepository | null {
  return mode === 'cloud' ? ensureCloud() : null;
}

export * from './repository';
export * from './blobs';
