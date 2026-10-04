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

/** The name that shows up in the caller's phone. The company is the product. */
export const CONTACT_NAME = 'Habibi';
export const CONTACT_ORG = 'Next Mission';

export const VCARD_FILENAME = `${CONTACT_NAME}.vcf`;

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
      // N is Family;Given;Middle;Prefix;Suffix — a single name goes first.
      `N:;${CONTACT_NAME};;;`,
      `FN:${CONTACT_NAME}`,
      `ORG:${CONTACT_ORG}`,
      `TEL;TYPE=CELL:${number}`,
      `NOTE:${esc('It is in your moments of decision that your destiny is shaped.')}`,
      'END:VCARD',
    ].join(CRLF) + CRLF
  );
}

/**
 * Headers for the download.
 *
 * iOS Safari renders a contact card with an Add button; Android Chrome
 * downloads the file and the user opens it.
 *
 * DEFAULTS TO `inline`. Tested on a real iPhone: `attachment` sends the file
 * to Files and the contact is never offered, which reads to the user as
 * "Add to Contacts did nothing". `?inline=0` forces the old behaviour.
 */
export function vcardHeaders(_inline = true): Record<string, string> {
  // NO Content-Disposition. This is deliberate and hard-won.
  //
  // iOS Safari shows the Add-Contact sheet for a text/vcard response reached
  // by a direct tap. `attachment` sends it to Files and nothing appears;
  // `inline; filename=...` is also unreliable across versions. Omitting the
  // header entirely is the configuration that works. Do not add one back.
  return {
    'Content-Type': 'text/vcard; charset=utf-8',
    'Cache-Control': 'no-store',
  };
}


/** Name and number only — the smallest card iOS can refuse to save. */
export function vcardMinimal(number: string = AGENT_NUMBER): string {
  return (
    [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `N:;${CONTACT_NAME};;;`,
      `FN:${CONTACT_NAME}`,
      `TEL;TYPE=CELL:${number}`,
      'END:VCARD',
    ].join(CRLF) + CRLF
  );
}
