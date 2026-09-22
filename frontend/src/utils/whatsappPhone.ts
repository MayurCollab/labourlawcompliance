/** Matches MSG91 WhatsApp phone rules: 10-digit mobile, optional 91 / leading zeros. */
export const isValidWhatsAppMobile = (input: string) => {
  let digits = String(input ?? '').replace(/\D/g, '');
  if (!digits) return false;
  digits = digits.replace(/^0+/, '');
  if (!digits) return false;
  if (!digits.startsWith('91')) digits = `91${digits}`;
  return digits.length >= 12;
};
