import { LocalStorageRepository, MemoryRepository, type TripRepository } from './repository';

/**
 * Swap this single line to move the app onto a real backend:
 *
 *   export const repository = new SupabaseRepository(client);
 */
export const repository: TripRepository =
  typeof window === 'undefined' ? new MemoryRepository() : new LocalStorageRepository();

export * from './repository';
export * from './blobs';
