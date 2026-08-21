/**
 * Which language a receipt is written in, decided before anything is read out
 * of it.
 *
 * The first version of this picked the language from the trip's destination,
 * which is wrong in the most ordinary case there is: you photograph a receipt
 * at home. A Hebrew bill handed to an engine loaded with English and Greek
 * does not come back as poor Hebrew — it comes back as confident nonsense,
 * Latin and Greek letters shaped vaguely like the strokes on the page. Every
 * Hebrew keyword downstream then fails to match, the total is never found,
 * and the parser falls through to guessing. Wrong language is not a small
 * accuracy loss; it invalidates the whole read.
 *
 * There is no cheap way to look at a photograph and know its script — the one
 * Tesseract ships needs its legacy engine and another download. So the
 * language is found by trying: recognise with the most likely candidate,
 * score how much the result looks like real writing in that language, and try
 * the next one only if the first is unconvincing. Usually that is one pass.
 *
 * Ordering the candidates well is what keeps it to one pass, and the trip
 * itself says a lot. On the days you are away, receipts are in the local
 * language; every other day of the year they are in yours.
 */

export interface ReceiptLanguage {
  /** Tesseract language codes, always combined with English for the digits. */
  code: string;
  /** What to call it in the UI. */
  label: string;
  /** Unicode script test, used to tell a real reading from noise. */
  script?: RegExp;
}

export const RECEIPT_LANGUAGES: Record<string, ReceiptLanguage> = {
  heb: { code: 'heb+eng', label: 'עברית', script: /\p{Script=Hebrew}/u },
  ell: { code: 'ell+eng', label: 'יוונית', script: /\p{Script=Greek}/u },
  eng: { code: 'eng', label: 'אנגלית' },
  rus: { code: 'rus+eng', label: 'רוסית', script: /\p{Script=Cyrillic}/u },
  ara: { code: 'ara+eng', label: 'ערבית', script: /\p{Script=Arabic}/u },
  tha: { code: 'tha+eng', label: 'תאית', script: /\p{Script=Thai}/u },
  jpn: { code: 'jpn+eng', label: 'יפנית', script: /\p{Script=Han}|\p{Script=Hiragana}/u },
  tur: { code: 'tur+eng', label: 'טורקית' },
  ita: { code: 'ita+eng', label: 'איטלקית' },
  spa: { code: 'spa+eng', label: 'ספרדית' },
  fra: { code: 'fra+eng', label: 'צרפתית' },
  deu: { code: 'deu+eng', label: 'גרמנית' },
};

/** The language of the receipts handed to you in a given country. */
const COUNTRY_LANGUAGE: Record<string, string> = {
  IL: 'heb',
  GR: 'ell',
  CY: 'ell',
  RU: 'rus',
  TR: 'tur',
  TH: 'tha',
  JP: 'jpn',
  IT: 'ita',
  ES: 'spa',
  AR: 'spa',
  MX: 'spa',
  FR: 'fra',
  BE: 'fra',
  DE: 'deu',
  AT: 'deu',
  CH: 'deu',
  AE: 'ara',
  EG: 'ara',
  MA: 'ara',
  JO: 'ara',
};

export function languageForCountry(countryCode?: string): string | undefined {
  return countryCode ? COUNTRY_LANGUAGE[countryCode.toUpperCase()] : undefined;
}

/** The language of the device, when it is one we have data for. */
export function languageForLocale(locale?: string): string | undefined {
  const tag = (locale ?? '').toLowerCase();
  if (tag.startsWith('he') || tag.startsWith('iw')) return 'heb';
  if (tag.startsWith('el')) return 'ell';
  if (tag.startsWith('ru')) return 'rus';
  if (tag.startsWith('ar')) return 'ara';
  return undefined;
}

/**
 * The candidates to try, best first.
 *
 * `away` decides the order: while the trip is running the destination's
 * language leads, and the rest of the year the phone's does. English is
 * always last and always present, because it is the fallback that reads the
 * digits even when every word is missed.
 */
export function candidateLanguages(opts: {
  countryCode?: string;
  locale?: string;
  away?: boolean;
  /** A language the person chose by hand, which always wins. */
  forced?: string;
}): string[] {
  if (opts.forced) return [opts.forced];

  const local = languageForCountry(opts.countryCode);
  const home = languageForLocale(opts.locale) ?? 'heb';
  const ordered = opts.away ? [local, home] : [home, local];

  const out: string[] = [];
  for (const key of [...ordered, 'eng']) {
    if (key && RECEIPT_LANGUAGES[key] && !out.includes(key)) out.push(key);
  }
  return out;
}

/** Is `today` inside the trip? Decides whose language leads. */
export function isAway(today: string, startDate?: string, endDate?: string): boolean {
  if (!startDate || !endDate) return false;
  return today >= startDate && today <= endDate;
}

export interface ReadingScore {
  /** 0–1. How much this looks like a real reading rather than noise. */
  score: number;
  /** Characters in the language's own script, as a share of all letters. */
  scriptShare: number;
}

/**
 * How much a pass looks like it read the right language.
 *
 * The tempting signal is the script: if Greek data produced Greek letters,
 * surely it read Greek. It did not. Tesseract loaded with Greek returns Greek
 * letters for *anything* you show it, including a Hebrew bill — it has no
 * other alphabet to answer in. Script share therefore separates a Greek read
 * from an English one and tells you nothing at all about whether the paper
 * was Greek. Neither does confidence, which measures how sure the engine is
 * of the letters it chose, not whether they mean anything.
 *
 * The signal that does discriminate is the receipt naming its own total. A
 * till receipt in any language prints a word for "total"; a page of noise
 * shaped like letters does not, and cannot, because the words are not there
 * to be misread into. So a pass that found no total word is capped below the
 * bar for stopping — not rejected, since a real total line can itself be
 * misread, but never trusted enough to skip trying the other languages.
 *
 * Digits carry the same kind of weight for the same reason: a receipt is
 * mostly numbers, and reading the wrong alphabet turns digits into letters.
 */
export function scoreReading(
  text: string,
  confidence: number,
  language: string,
  hasKeyword: boolean,
  moneyCount: number
): ReadingScore {
  const lang = RECEIPT_LANGUAGES[language];
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  const inScript = lang?.script ? (text.match(new RegExp(lang.script, 'gu'))?.length ?? 0) : letters;
  const scriptShare = letters === 0 ? 0 : inScript / letters;

  const digits = text.match(/\d/gu)?.length ?? 0;
  const digitTerm = Math.min(1, digits / 12);

  // English has no script of its own to check — Latin letters appear in every
  // pass — so it is judged on its numbers and confidence and starts at a
  // deliberate disadvantage. It is the fallback, not the favourite.
  const scriptTerm = lang?.script ? scriptShare : 0.45;
  const confidenceTerm = Math.min(1, Math.max(0, confidence / 100));

  const raw =
    0.35 * scriptTerm +
    0.3 * confidenceTerm +
    0.2 * digitTerm +
    (hasKeyword ? 0.2 : 0) +
    Math.min(0.1, moneyCount * 0.02);

  // Without its own total word, a reading has produced letters but not
  // meaning. It stays a candidate and may still win on comparison; it just
  // cannot end the search on its own.
  const ceiling = hasKeyword ? 1 : NO_KEYWORD_CEILING;

  return { score: Math.min(ceiling, raw), scriptShare };
}

/**
 * Deliberately below `GOOD_ENOUGH`: a pass with no total word never stops the
 * search, however confident and however fluent-looking its output.
 */
const NO_KEYWORD_CEILING = 0.55;

/**
 * Good enough to stop trying other languages.
 *
 * Set where a correct pass on a mediocre photo lands, but a pass in the wrong
 * script does not: the script term alone caps a wrong-language reading at
 * roughly 0.45, so anything above 0.6 has genuinely read something.
 */
export const GOOD_ENOUGH = 0.6;

/**
 * Below this nothing downstream should be trusted enough to fill a form.
 *
 * A reading this poor is not "approximately right" — it is a different
 * document. Offering its numbers as a draft is worse than offering nothing,
 * because a plausible wrong total gets confirmed without being checked.
 */
export const TOO_POOR = 0.38;
