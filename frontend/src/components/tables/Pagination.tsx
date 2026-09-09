import { Button } from '@/components/buttons/Button';
import {
  DATA_TABLE_ALL_PAGE_SIZE,
  DATA_TABLE_PAGE_SIZES,
  type DataTablePageSizeOption,
  toPageSizeOption,
} from '@/components/tables/pagination.constants';
import { cn } from '@/lib/utils';

export type PaginationProps = {
  page: number;
  totalPages: number;
  total?: number;
  pageSize?: number;
  /** Controls the page-size select (supports “All”). */
  pageSizeSelection?: DataTablePageSizeOption;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: DataTablePageSizeOption) => void;
  className?: string;
  disabled?: boolean;
};

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  pageSizeSelection,
  onPageChange,
  onPageSizeChange,
  className,
  disabled = false,
}: PaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const canPrev = page > 1;
  const canNext = page < safeTotalPages;

  const selectValue: DataTablePageSizeOption =
    pageSizeSelection ??
    (typeof pageSize === 'number'
      ? toPageSizeOption(pageSize, total)
      : 10);

  const sizeOptions = (() => {
    const options: { label: string; value: string }[] = DATA_TABLE_PAGE_SIZES.map(
      (size) => ({ label: String(size), value: String(size) }),
    );
    options.push({ label: 'All', value: 'all' });

    if (
      typeof selectValue === 'number' &&
      !(DATA_TABLE_PAGE_SIZES as readonly number[]).includes(selectValue) &&
      selectValue < DATA_TABLE_ALL_PAGE_SIZE
    ) {
      options.unshift({ label: String(selectValue), value: String(selectValue) });
    }
    return options;
  })();

  const displayPageSize =
    selectValue === 'all'
      ? 'All'
      : typeof pageSize === 'number'
        ? pageSize
        : selectValue;

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-card/90 px-3 py-2.5 text-sm shadow-sm ring-1 ring-primary/5 backdrop-blur-sm',
        className,
      )}
    >
      <p className="text-muted-foreground" aria-live="polite">
        Page {page} of {safeTotalPages}
        {typeof total === 'number' ? ` · ${total} total` : ''}
        {displayPageSize != null ? ` · ${displayPageSize}/page` : ''}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {onPageSizeChange ? (
          <label className="flex items-center gap-2 text-muted-foreground">
            <span className="whitespace-nowrap">Rows</span>
            <select
              aria-label="Rows per page"
              className="h-8 rounded-md border border-border bg-background px-2 text-foreground outline-none transition-colors hover:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
              disabled={disabled}
              value={String(selectValue)}
              onChange={(event) => {
                const raw = event.target.value;
                if (raw === 'all') {
                  onPageSizeChange('all');
                  return;
                }
                onPageSizeChange(Number(raw) as DataTablePageSizeOption);
              }}
            >
              {sizeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !canPrev}
          aria-label={`Go to page ${page - 1}`}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !canNext}
          aria-label={`Go to page ${page + 1}`}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
