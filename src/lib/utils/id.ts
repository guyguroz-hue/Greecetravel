import { customAlphabet } from 'nanoid';

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
const gen = customAlphabet(alphabet, 12);

/** Prefixed ids make the persisted JSON readable while debugging. */
export function newId(prefix: string): string {
  return `${prefix}_${gen()}`;
}
