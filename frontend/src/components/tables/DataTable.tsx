import {
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import {
  ModuleRegistry,
  AllCommunityModule,
  type ColDef,
  type ICellRendererParams,
  type IHeaderParams,
  type SortDirection as AgSortDirection,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

import { EmptyState } from '@/components/common/EmptyState';
import { appAgGridTheme } from '@/components/tables/agGridTheme';
import { DataTableLoading } from '@/components/tables/DataTableLoading';
import { Pagination } from '@/components/tables/Pagination';
import type { DataTablePageSizeOption } from '@/components/tables/pagination.constants';
import { toPageSizeOption } from '@/components/tables/pagination.constants';
import { cn } from '@/lib/utils';

ModuleRegistry.registerModules([AllCommunityModule]);

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
  width?: number;
  minWidth?: number;
  maxWidth?: number;
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
  onPageSizeChange?: (size: DataTablePageSizeOption) => void;
  /** Explicit page-size select value (use when limit is the “All” sentinel). */
  pageSizeSelection?: DataTablePageSizeOption;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
  /** Cap the grid body height so the table can shrink; pagination stays outside. */
  gridMaxHeight?: number | string;
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

type SortHeaderProps = IHeaderParams & {
  label: ReactNode;
  columnId: string;
  sortable?: boolean;
  sort?: DataTableSort;
  onSortChange?: (sort: DataTableSort) => void;
};

function SortHeader({
  label,
  columnId,
  sortable,
  sort,
  onSortChange,
}: SortHeaderProps) {
  if (!sortable || !onSortChange) {
    return <span className="truncate">{label}</span>;
  }

  const isSorted = sort?.sortBy === columnId;
  const toggleSort = () => {
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
    <button
      type="button"
      className="llc-ag-sort-button"
      aria-label={
        typeof label === 'string' ? `Sort by ${label}` : `Sort by ${columnId}`
      }
      onClick={toggleSort}
    >
      <span className="truncate">{label}</span>
      {isSorted ? (
        sort.sortOrder === 'asc' ? (
          <ArrowUp className="llc-ag-sort-icon is-active" aria-hidden />
        ) : (
          <ArrowDown className="llc-ag-sort-icon is-active" aria-hidden />
        )
      ) : (
        <ArrowUpDown className="llc-ag-sort-icon" aria-hidden />
      )}
    </button>
  );
}

function NoRowsOverlay({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return <EmptyState title={title} description={description} />;
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading = false,
  sort,
  onSortChange,
  pagination,
  onPageChange,
  onPageSizeChange,
  pageSizeSelection,
  emptyTitle = 'No results',
  emptyDescription = 'Try adjusting filters or create a new record.',
  className,
  gridMaxHeight,
}: DataTableProps<T>) {
  const columnDefs = useMemo<ColDef<T>[]>(
    () =>
      columns.map((column) => {
        const canSort = Boolean(column.sortable && onSortChange);
        const sortDir: AgSortDirection | undefined =
          sort?.sortBy === column.id ? sort.sortOrder : undefined;

        const isActions = column.id === 'actions';
        const isSelect = column.id === 'select';
        const defaultMinWidth = isActions ? 168 : isSelect ? 52 : 120;
        const defaultWidth = isActions ? 180 : isSelect ? 56 : undefined;

        const def: ColDef<T> = {
          colId: column.id,
          headerName: typeof column.header === 'string' ? column.header : column.id,
          sortable: false,
          suppressHeaderMenuButton: true,
          suppressMovable: true,
          resizable: true,
          flex: isActions || isSelect || column.width ? 0 : 1,
          minWidth: column.minWidth ?? defaultMinWidth,
          maxWidth: column.maxWidth,
          width: column.width ?? defaultWidth,
          sort: sortDir,
          headerClass: cn(column.headerClassName),
          cellClass: cn(
            column.className,
            isActions && 'llc-ag-actions-cell',
          ),
          headerComponent: SortHeader,
          headerComponentParams: {
            label: column.header,
            columnId: column.id,
            sortable: canSort,
            sort,
            onSortChange,
          },
          cellRenderer: (params: ICellRendererParams<T>) => {
            if (!params.data) return null;
            if (column.cell) return column.cell(params.data);
            return getValue(params.data, column.accessorKey);
          },
          comparator: () => 0,
        };

        if (column.accessorKey) {
          def.field = column.accessorKey as unknown as ColDef<T>['field'];
        }

        return def;
      }),
    [columns, onSortChange, sort],
  );

  const getRowId = useCallback(
    (params: { data: T }) => rowKey(params.data),
    [rowKey],
  );

  const resolvedPageSize =
    pageSizeSelection ??
    (pagination
      ? toPageSizeOption(pagination.limit, pagination.total)
      : undefined);

  const loadingLabels = columns.map((column) =>
    typeof column.header === 'string' ? column.header : column.id,
  );

  const paginationBar =
    pagination && onPageChange ? (
      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        pageSize={pagination.limit}
        pageSizeSelection={resolvedPageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        disabled={loading}
      />
    ) : null;

  return (
    <div className={cn('space-y-4', className)}>
      {paginationBar}

      <div
        className="llc-ag-grid-shell"
        style={
          gridMaxHeight != null
            ? { maxHeight: gridMaxHeight, overflow: 'auto' }
            : undefined
        }
      >
        {loading ? (
          <DataTableLoading
            columnCount={columns.length}
            columnLabels={loadingLabels}
            rowCount={7}
          />
        ) : (
          <div
            className="llc-ag-grid"
            style={{
              width: '100%',
              minHeight: data.length === 0 ? 220 : undefined,
            }}
          >
            <AgGridReact<T>
              theme={appAgGridTheme}
              rowData={data}
              columnDefs={columnDefs}
              getRowId={getRowId}
              domLayout="autoHeight"
              animateRows
              suppressCellFocus
              suppressDragLeaveHidesColumns
              suppressColumnVirtualisation
              suppressRowVirtualisation
              enableCellTextSelection
              ensureDomOrder
              headerHeight={44}
              rowHeight={48}
              noRowsOverlayComponent={NoRowsOverlay}
              noRowsOverlayComponentParams={{
                title: emptyTitle,
                description: emptyDescription,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
