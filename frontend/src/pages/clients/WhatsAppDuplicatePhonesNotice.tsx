type DuplicatePhonesNoticeGroup = { phone: string; labels: string[] };

type WhatsAppDuplicatePhonesNoticeProps = {
  groups: DuplicatePhonesNoticeGroup[];
};

/**
 * Pre-send warning listing selected records that share a mobile number.
 * Only the first record per number is sent; the rest are skipped so nobody
 * gets the same message twice.
 */
export function WhatsAppDuplicatePhonesNotice({
  groups,
}: WhatsAppDuplicatePhonesNoticeProps) {
  if (groups.length === 0) return null;
  const skipCount = groups.reduce(
    (sum, group) => sum + group.labels.length - 1,
    0,
  );

  return (
    <div
      role="note"
      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <p className="font-medium">
        {skipCount} record{skipCount === 1 ? '' : 's'} share a mobile number
        with another selected record and will be skipped.
      </p>
      <p className="text-xs opacity-80">
        Only the first record for each number is sent, so the same number
        doesn&apos;t get the message twice. Change the mobile number below if
        a record should go to someone else.
      </p>
      <ul className="mt-2 space-y-1 text-xs">
        {groups.map((group) => (
          <li key={group.phone}>
            <span className="font-medium tabular-nums">+{group.phone}</span>
            {' — '}
            {group.labels[0]} (will be sent) · {group.labels.slice(1).join(', ')}{' '}
            (will be skipped)
          </li>
        ))}
      </ul>
    </div>
  );
}
