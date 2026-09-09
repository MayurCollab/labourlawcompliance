import type { ReactNode } from 'react';

import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { cn } from '@/lib/utils';

export type DataTableLoadingProps = {
  columnCount?: number;
  columnLabels?: ReactNode[];
  rowCount?: number;
  label?: string;
  className?: string;
};

/**
 * Full-table shimmer used while AG Grid data is fetching.
 * Replaces the faint default AG Grid loading overlay.
 */
export function DataTableLoading({
  columnCount = 5,
  columnLabels,
  rowCount = 7,
  label = 'Loading records…',
  className,
}: DataTableLoadingProps) {
  const cols = Math.max(columnCount, columnLabels?.length ?? 0, 1);

  return (
    <div
      className={cn('llc-ag-loading', className)}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
    >
      <div
        className="llc-ag-loading__header"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: cols }).map((_, index) => {
          const labelNode = columnLabels?.[index];
          if (typeof labelNode === 'string' && labelNode.trim()) {
            return (
              <span
                key={index}
                className="truncate text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase"
              >
                {labelNode}
              </span>
            );
          }
          return <div key={index} className="llc-skeleton-bone h-3 w-16 max-w-full" />;
        })}
      </div>

      {Array.from({ length: rowCount }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="llc-ag-loading__row"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((__, colIndex) => (
            <div
              key={colIndex}
              className={cn(
                'llc-skeleton-bone h-4 max-w-full',
                colIndex === 0 ? 'w-[85%]' : colIndex === cols - 1 ? 'w-12 justify-self-end' : 'w-[70%]',
              )}
              style={{ animationDelay: `${(rowIndex * cols + colIndex) * 40}ms` }}
            />
          ))}
        </div>
      ))}

      <div className="llc-ag-loading__footer">
        <LoadingSpinner size="md" className="text-primary" />
        <p className="llc-ag-loading__label">{label}</p>
      </div>
    </div>
  );
}
