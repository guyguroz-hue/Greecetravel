'use client';

import { requireSupabase } from './client';

/**
 * Uploaded documents in cloud mode. The bucket is private; files are reached
 * through short-lived signed URLs, so a leaked link stops working rather than
 * exposing someone's passport scan forever.
 *
 * The object path starts with the trip id, which is what the bucket policies
 * in the migration match on to decide who may read and write.
 */
export const DOCUMENTS_BUCKET = 'trip-documents';

const SIGNED_URL_TTL_SECONDS = 60 * 10;

export async function uploadDocument(
  tripId: string,
  file: File,
  key: string
): Promise<string> {
  const supabase = requireSupabase();
  const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(-80);
  const path = `${tripId}/${key}-${safeName}`;

  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: true,
  });
  if (error) throw error;

  return path;
}

export async function getDocumentUrl(path: string): Promise<string | null> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.error('[storage] could not sign document url', error);
    return null;
  }
  return data?.signedUrl ?? null;
}

export async function deleteDocument(path: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
  if (error) console.error('[storage] could not delete document', error);
}
