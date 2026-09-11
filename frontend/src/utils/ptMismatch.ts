import type { Filing, FilingPtMismatch } from '@/types/filing.types';

const formatInr = (value: number | null | undefined) =>
  value === null || value === undefined
    ? '—'
    : `₹${value.toLocaleString('en-IN')}`;

export const formatPtMismatchLine = (row: {
  clientCode: string;
  ptAmount?: number | null;
  salaryPtTotal?: number | null;
  salaryEmployeeCount?: number | null;
}) => {
  const count = row.salaryEmployeeCount || 0;
  const employees =
    count > 0 ? ` (${count} employee${count === 1 ? '' : 's'})` : '';
  return `${row.clientCode}: master sheet ${formatInr(row.ptAmount)} vs salary ${formatInr(row.salaryPtTotal)}${employees}`;
};

export const ptMismatchConfirmMessage = (
  mismatches: Array<FilingPtMismatch | Filing>,
) => {
  const lines = mismatches.slice(0, 8).map(formatPtMismatchLine);
  const parts = [
    'P.Tax on the master sheet does not match the salary employee total for:',
    '',
    ...lines,
  ];
  if (mismatches.length > 8) {
    const extra = mismatches.length - 8;
    parts.push(
      `…and ${extra} more client${extra === 1 ? '' : 's'}.`,
    );
  }
  parts.push('', 'You can still generate Form 5.');
  return parts.join('\n');
};
