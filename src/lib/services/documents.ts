'use client';

import { getBlob, putBlob } from '@/lib/db/blobs';
import { getStorageMode } from '@/lib/db';
import { deleteDocument as deleteRemote, getDocumentUrl, uploadDocument } from '@/lib/supabase/storage';
import { newId } from '@/lib/utils/id';

/**
 * A document's `fileKey` points at whichever store holds the bytes:
 *
 *  - local mode → an IndexedDB key, e.g. `blob_a1b2c3`
 *  - cloud mode → an object path, e.g. `trip_greece_2026/blob_a1b2-ticket.pdf`
 *
 * The slash is the discriminator, which also means a trip uploaded to the
 * cloud can still open the files that stayed on the device.
 */
export function isRemoteKey(fileKey: string | undefined): boolean {
  return !!fileKey && fileKey.includes('/');
}

export interface StoredFile {
  fileKey: string;
  mimeType: string;
  size: number;
}

export async function storeFile(tripId: string, file: File): Promise<StoredFile> {
  const key = newId('blob');
  const common = {
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
  };

  if (getStorageMode() === 'cloud') {
    const path = await uploadDocument(tripId, file, key);
    return { fileKey: path, ...common };
  }

  await putBlob(key, file);
  return { fileKey: key, ...common };
}

/**
 * Resolves a document to something the browser can open in a new tab.
 * Returns null when the bytes are simply not on this device — which is what
 * happens for a file a family member uploaded before cloud mode was on.
 */
export async function resolveFileUrl(fileKey: string): Promise<string | null> {
  if (isRemoteKey(fileKey)) return getDocumentUrl(fileKey);

  const blob = await getBlob(fileKey);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

export async function removeStoredFile(fileKey: string): Promise<void> {
  if (isRemoteKey(fileKey)) await deleteRemote(fileKey);
  // Local blobs are cleaned up by the store's delayed sweep, which gives undo
  // a window to bring the document back.
}
