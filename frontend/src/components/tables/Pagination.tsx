import { Button } from '@/components/buttons/Button';
import { cn } from '@/lib/utils';

export type PaginationProps = {
  page: number;
  totalPages: number;
  total?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  className?: string;
  disabled?: boolean;
};

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  className,
  disabled = false,
}: PaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const canPrev = page > 1;
  const canNext = page < safeTotalPages;

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 text-sm',
        className,
      )}
    >
      <p className="text-muted-foreground" aria-live="polite">
        Page {page} of {safeTotalPages}
        {typeof total === 'number' ? ` · ${total} total` : ''}
        {typeof pageSize === 'number' ? ` · ${pageSize}/page` : ''}
      </p>
      <div className="flex items-center gap-2">
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
