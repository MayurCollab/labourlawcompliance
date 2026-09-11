export const DATA_TABLE_PAGE_SIZES = [10, 25, 50, 100] as const;

/** Default rows-per-page for every AG Grid / DataTable. */
export const DEFAULT_DATA_TABLE_PAGE_SIZE = 10;

/** Sent to the API when the user picks “All” (backend max is 10_000). */
export const DATA_TABLE_ALL_PAGE_SIZE = 10_000;

/** Standard sizes plus “all”, or any numeric limit (e.g. legacy defaults). */
export type DataTablePageSizeOption = number | 'all';

export function resolveDataTableLimit(
  size: DataTablePageSizeOption,
  total?: number,
): number {
  if (size !== 'all') return size;
  if (typeof total === 'number' && total > 0) {
    return Math.min(Math.max(total, 1), DATA_TABLE_ALL_PAGE_SIZE);
  }
  return DATA_TABLE_ALL_PAGE_SIZE;
}

export function toPageSizeOption(
  limit: number,
  total?: number,
): DataTablePageSizeOption {
  if (
    limit >= DATA_TABLE_ALL_PAGE_SIZE ||
    (typeof total === 'number' && total > 0 && limit >= total && limit > 100)
  ) {
    return 'all';
  }
  return limit;
}
