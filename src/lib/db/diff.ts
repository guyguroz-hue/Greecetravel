export interface CollectionDiff<T> {
  upserts: T[];
  deleteIds: string[];
}

/**
 * Compares two snapshots of one collection and reports the minimum work
 * needed to make the remote match.
 *
 * The store hands the repository whole documents, which keeps every mutation
 * in the app simple. Turning that back into row-level writes here means a
 * keystroke costs one small UPDATE instead of rewriting the trip.
 */
export function diffCollection<T extends { id: string }>(
  previous: T[],
  next: T[]
): CollectionDiff<T> {
  const before = new Map(previous.map((item) => [item.id, item]));
  const upserts: T[] = [];

  for (const item of next) {
    const old = before.get(item.id);
    // Stable key order comes from both objects being built by the same code
    // paths, so a string compare is a sound (and cheap) equality test.
    if (!old || JSON.stringify(old) !== JSON.stringify(item)) upserts.push(item);
    before.delete(item.id);
  }

  return { upserts, deleteIds: [...before.keys()] };
}

export function isEmptyDiff<T>(diff: CollectionDiff<T>): boolean {
  return diff.upserts.length === 0 && diff.deleteIds.length === 0;
}
