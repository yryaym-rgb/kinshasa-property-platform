/**
 * DRC mobile number helpers (+243). Numbers are handled as the 9 national
 * digits (e.g. "812345678") and formatted for display as "812 345 678".
 */

export const DRC_DIAL_CODE = '+243';
export const DRC_NATIONAL_LENGTH = 9;

export type DRCOperator = 'orange' | 'vodacom' | 'airtel' | 'africell';

/** Two-digit national prefixes allocated by the ARPTC to each operator. */
const OPERATOR_PREFIXES: Record<string, DRCOperator> = {
  '80': 'orange',
  '84': 'orange',
  '85': 'orange',
  '89': 'orange',
  '81': 'vodacom',
  '82': 'vodacom',
  '83': 'vodacom',
  '97': 'airtel',
  '98': 'airtel',
  '99': 'airtel',
  '90': 'africell',
  '91': 'africell',
};

export const OPERATOR_COLORS: Record<DRCOperator, string> = {
  orange: '#ff7900',
  vodacom: '#e60000',
  airtel: '#ed1c24',
  africell: '#0072ce',
};

/**
 * Reduces any user input to at most 9 national digits: strips formatting,
 * the +243 dial code, and a leading trunk zero.
 */
export function toNationalDigits(input: string): string {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('243')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, DRC_NATIONAL_LENGTH);
}

/** "812345678" → "812 345 678" (groups of three, partial input allowed). */
export function formatNationalDigits(digits: string): string {
  return digits.replace(/(\d{3})(?=\d)/g, '$1 ');
}

export function detectOperator(digits: string): DRCOperator | null {
  if (digits.length < 2) return null;
  return OPERATOR_PREFIXES[digits.slice(0, 2)] ?? null;
}

/** Nine digits starting with a mobile prefix (8x or 9x). */
export function isValidDRCMobile(digits: string): boolean {
  return /^[89]\d{8}$/.test(digits);
}

export function toE164(digits: string): string {
  return `${DRC_DIAL_CODE}${digits}`;
}

/** "+243812345678" → "+243 812 345 678" for display. */
export function formatE164ForDisplay(e164: string): string {
  const digits = toNationalDigits(e164);
  return `${DRC_DIAL_CODE} ${formatNationalDigits(digits)}`;
}

/** Hides the middle of a number: "+243 81• ••• •78". */
export function maskPhone(e164: string): string {
  const digits = toNationalDigits(e164);
  if (digits.length < DRC_NATIONAL_LENGTH) return formatE164ForDisplay(e164);
  return `${DRC_DIAL_CODE} ${digits.slice(0, 2)}• ••• •${digits.slice(7)}`;
}
