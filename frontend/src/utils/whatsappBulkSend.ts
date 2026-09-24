import { getApiErrorCode } from '@/utils/apiError';
import { normalizeWhatsAppMobile } from '@/utils/whatsappPhone';

/**
 * Backend refusals that are deliberate holds, not delivery failures — the
 * bulk send lists these as "Skipped" with the reason instead of "Failed".
 */
const SKIP_REASONS: Record<string, string> = {
  WHATSAPP_RECENTLY_SENT:
    'Skipped — this number already got a WhatsApp recently. Sending again so soon can get it blocked by WhatsApp, so wait a while before resending.',
  WHATSAPP_RECIPIENT_SUPPRESSED:
    'Skipped — this contact has opted out of WhatsApp messages. Only send again if they opt back in (remove them from Suppressed contacts on the WhatsApp Sends page).',
};

/** Skip reason for a send the backend deliberately held back, or null for a real failure. */
export const getWhatsAppSkipReason = (error: unknown): string | null => {
  const code = getApiErrorCode(error);
  return code ? (SKIP_REASONS[code] ?? null) : null;
};

export type DuplicatePhoneGroup<T> = { phone: string; items: T[] };

/**
 * Items that share the same (normalized) valid mobile number, in list order —
 * only groups of two or more. The first item of each group is the one sent.
 */
export function findDuplicatePhoneGroups<T>(
  items: T[],
  getPhone: (item: T) => string,
): DuplicatePhoneGroup<T>[] {
  const byPhone = new Map<string, T[]>();
  for (const item of items) {
    const phone = normalizeWhatsAppMobile(getPhone(item));
    if (!phone) continue;
    const group = byPhone.get(phone);
    if (group) group.push(item);
    else byPhone.set(phone, [item]);
  }
  return [...byPhone]
    .filter(([, group]) => group.length > 1)
    .map(([phone, group]) => ({ phone, items: group }));
}

/** Reason shown on a record skipped because an earlier record in the batch has its number. */
export const duplicatePhoneSkipReason = (firstLabel: string) =>
  `Skipped — same mobile number as ${firstLabel} in this send. Only ${firstLabel} gets the message, so the number isn't messaged twice.`;
