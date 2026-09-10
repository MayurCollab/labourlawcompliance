/**
 * Normalize an Indian mobile number for MSG91 WhatsApp `to` fields.
 * Always returns digits starting with country code 91.
 */
export const normalizeWhatsAppPhone = (input) => {
  let digits = String(input ?? '').replace(/\D/g, '');
  if (!digits) {
    return null;
  }

  digits = digits.replace(/^0+/, '');
  if (!digits) {
    return null;
  }

  if (!digits.startsWith('91')) {
    digits = `91${digits}`;
  }

  // 91 + 10-digit mobile
  if (digits.length < 12) {
    return null;
  }

  return digits;
};

/** Ensure MSG91 document header filename ends with .pdf */
export const ensurePdfFilename = (filename) => {
  const raw = String(filename || 'Form5').trim() || 'Form5';
  if (/\.pdf$/i.test(raw)) {
    return raw.replace(/\.pdf$/i, '.pdf');
  }
  const stem = raw.replace(/\.[^.]+$/, '') || 'Form5';
  return `${stem}.pdf`;
};
