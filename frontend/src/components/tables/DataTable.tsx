import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { SkeletonTableRow } from '@/components/common/SkeletonLoader';
import { Pagination } from '@/components/tables/Pagination';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc';

export type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  /** Dot-path into the row, or a custom cell renderer. */
  accessorKey?: keyof T & string;
  cell?: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
};

export type DataTableSort = {
  sortBy: string;
  sortOrder: SortDirection;
};

export type DataTablePagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  sort?: DataTableSort;
  onSortChange?: (sort: DataTableSort) => void;
  pagination?: DataTablePagination;
  onPageChange?: (page: number) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
};

const getValue = <T,>(row: T, key?: string): ReactNode => {
  if (!key) return null;
  const value = (row as Record<string, unknown>)[key];
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '—';
};

export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading = false,
  sort,
  onSortChange,
  pagination,
  onPageChange,
  emptyTitle = 'No results',
  emptyDescription = 'Try adjusting filters or create a new record.',
  className,
}: DataTableProps<T>) {
  const toggleSort = (columnId: string) => {
    if (!onSortChange) return;
    if (sort?.sortBy === columnId) {
      onSortChange({
        sortBy: columnId,
        sortOrder: sort.sortOrder === 'asc' ? 'desc' : 'asc',
      });
      return;
    }
    onSortChange({ sortBy: columnId, sortOrder: 'asc' });
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="bg-muted/50">
              <tr>
                {columns.map((column) => {
                  const isSorted = sort?.sortBy === column.id;
                  return (
                    <th
                      key={column.id}
                      aria-sort={
                        column.sortable
                          ? isSorted
                            ? sort.sortOrder === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                          : undefined
                      }
                      className={cn(
                        'px-4 py-3 text-left font-medium text-muted-foreground',
                        column.headerClassName,
                      )}
                    >
                      {column.sortable && onSortChange ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-foreground"
                          aria-label={
                            typeof column.header === 'string'
                              ? `Sort by ${column.header}`
                              : `Sort by ${column.id}`
                          }
                          onClick={() => toggleSort(column.id)}
                        >
                          {column.header}
                          {isSorted ? (
                            sort.sortOrder === 'asc' ? (
                              <ArrowUp className="size-3.5" aria-hidden />
                            ) : (
                              <ArrowDown className="size-3.5" aria-hidden />
                            )
                          ) : (
                            <ArrowUpDown
                              className="size-3.5 opacity-50"
                              aria-hidden
                            />
                          )}
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="p-0">
                    <div className="space-y-0">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <SkeletonTableRow
                          key={index}
                          columns={columns.length}
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="p-6">
                    <EmptyState
                      title={emptyTitle}
                      description={emptyDescription}
                    />
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr
                    key={rowKey(row)}
                    className="border-t border-border hover:bg-muted/30"
                  >
                    {columns.map((column) => (
                      <td
                        key={column.id}
                        className={cn('px-4 py-3 align-middle', column.className)}
                      >
                        {column.cell
                          ? column.cell(row)
                          : getValue(row, column.accessorKey)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {loading ? (
          <div className="flex items-center justify-center border-t border-border py-2">
            <LoadingSpinner size="sm" />
          </div>
        ) : null}
      </div>

      {pagination && onPageChange ? (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          pageSize={pagination.limit}
          onPageChange={onPageChange}
          disabled={loading}
        />
      ) : null}
    </div>
  );
}
