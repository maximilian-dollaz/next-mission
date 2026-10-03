/**
 * The phone number is the identity, so parsing it is load-bearing.
 *
 * People paste. They paste `(272) 229-7451`, `272.229.7451`, `+1 272 229
 * 7451`, `tel:+12722297451`, a number with a trailing comma from a
 * spreadsheet. All of that is the same person, and none of it should be
 * their problem — so normalise generously and reject only what cannot be a
 * number at all.
 */

/** The country we assume when someone types a bare national number. */
const DEFAULT_COUNTRY_CODE = '1';

/** E.164: a plus, a non-zero country digit, then 7–14 more. */
export const E164 = /^\+[1-9][0-9]{7,14}$/;

export function isE164(value: string): boolean {
  return E164.test(value);
}

/**
 * Best-effort E.164. Returns null when the input cannot be a phone number,
 * so the caller can say so once rather than guessing.
 */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;

  // `tel:` and `sms:` hrefs, and the odd unicode plus.
  const cleaned = String(raw)
    .trim()
    .replace(/^(tel|sms|callto):/i, '')
    .replace(/[＋﹢]/g, '+');

  // Note whether the user told us the country themselves. A leading `+`
  // anywhere in the original is the signal; after stripping we lose it.
  const explicitCountry = cleaned.trimStart().startsWith('+') || cleaned.startsWith('00');

  let digits = cleaned.replace(/\D/g, '');
  if (!digits) return null;

  // 00 is the international prefix in much of the world.
  if (cleaned.startsWith('00')) digits = digits.replace(/^00/, '');

  // US/Canada trunk prefix: 1 + 10 digits.
  if (!explicitCountry && digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // A bare national number. Assume the default country.
  if (!explicitCountry && digits.length === 10) {
    return `+${DEFAULT_COUNTRY_CODE}${digits}`;
  }

  const candidate = `+${digits}`;
  return E164.test(candidate) ? candidate : null;
}

/**
 * For display. North American numbers get the shape people recognise;
 * every other country keeps its plain E.164, because guessing a foreign
 * grouping wrongly looks worse than not grouping at all.
 */
export function formatForHumans(e164: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `+1 (${m[1]}) ${m[2]}-${m[3]}` : e164;
}
