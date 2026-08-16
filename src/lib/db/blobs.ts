import { openDB, type IDBPDatabase } from 'idb';

/**
 * Uploaded documents (boarding passes, hotel confirmations, PDFs) live in
 * IndexedDB rather than in the main JSON document — localStorage tops out at
 * a few megabytes and a single PDF would blow the whole trip away.
 */

const DB_NAME = 'mtp-files';
const STORE = 'blobs';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('blob store unavailable on the server'));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      },
    });
  }
  return dbPromise;
}

export async function putBlob(key: string, blob: Blob): Promise<void> {
  const db = await getDb();
  await db.put(STORE, blob, key);
}

export async function getBlob(key: string): Promise<Blob | undefined> {
  try {
    const db = await getDb();
    return (await db.get(STORE, key)) as Blob | undefined;
  } catch {
    return undefined;
  }
}

export async function deleteBlob(key: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete(STORE, key);
  } catch {
    /* the document row is gone either way */
  }
}

export async function clearBlobs(): Promise<void> {
  try {
    const db = await getDb();
    await db.clear(STORE);
  } catch {
    /* nothing to clear */
  }
}

/**
 * Object URLs are revoked when the caller is done with them; this keeps a
 * registry so a component can hand back everything it created on unmount.
 */
export function createObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export function revokeObjectUrl(url: string): void {
  try {
    URL.revokeObjectURL(url);
  } catch {
    /* already revoked */
  }
}
