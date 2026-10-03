/**
 * The vCard. This is the whole onboarding: one tap and Next Mission is a
 * contact on your phone, which is the only install step there is.
 *
 * vCard 3.0, not 4.0 — 3.0 is what iOS and Android Contacts both import
 * without argument. CRLF line endings, because RFC 2426 says so and some
 * importers are strict about it.
 */

import { optional } from '../env.js';

/** The agent's number. One number, shared by every caller. */
export const AGENT_NUMBER = optional('AGENT_PHONE_NUMBER', '+12722297451');

export const VCARD_FILENAME = 'Next Mission.vcf';

const CRLF = '\r\n';

/** Escape the four characters vCard 3.0 treats as structural. */
function esc(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

export function vcard(number: string = AGENT_NUMBER): string {
  return (
    [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:Mission;Next;;;',
      'FN:Next Mission',
      'ORG:Next Mission',
      `TEL;TYPE=CELL,VOICE:${number}`,
      `NOTE:${esc('Call to think something through. It already knows you — your number is your login.')}`,
      'END:VCARD',
    ].join(CRLF) + CRLF
  );
}

/**
 * Headers for the download.
 *
 * iOS Safari renders a contact card with an Add button; Android Chrome
 * downloads the file and the user opens it. `inline` exists because which
 * disposition iOS prefers has changed across versions — it is a flag to
 * test with on a real phone, not a second code path.
 */
export function vcardHeaders(inline = false): Record<string, string> {
  return {
    'Content-Type': 'text/vcard; charset=utf-8',
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${VCARD_FILENAME}"`,
    'Cache-Control': 'public, max-age=300',
  };
}
