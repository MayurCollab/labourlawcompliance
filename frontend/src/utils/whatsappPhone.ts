/**
 * Canonical MSG91 form of a WhatsApp mobile (digits, leading zeros stripped,
 * `91` prefixed), or null when it isn't a usable number. Two inputs that
 * normalize to the same value reach the same WhatsApp account.
 */
export const normalizeWhatsAppMobile = (input: string): string | null => {
  let digits = String(input ?? '').replace(/\D/g, '');
  if (!digits) return null;
  digits = digits.replace(/^0+/, '');
  if (!digits) return null;
  if (!digits.startsWith('91')) digits = `91${digits}`;
  return digits.length >= 12 ? digits : null;
};

/** Matches MSG91 WhatsApp phone rules: 10-digit mobile, optional 91 / leading zeros. */
export const isValidWhatsAppMobile = (input: string) =>
  normalizeWhatsAppMobile(input) !== null;
