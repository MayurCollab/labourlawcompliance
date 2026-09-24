import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ModuleRegistry,
  AllCommunityModule,
  type CellDoubleClickedEvent,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type ICellRendererParams,
  type IHeaderParams,
  type RowHeightParams,
  type SortDirection as AgSortDirection,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Columns3,
  Maximize2,
  Minimize2,
  StretchHorizontal,
} from 'lucide-react';

import { Button } from '@/components/buttons/Button';
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
  /** Allow stacked content without clipping (Generated file, Role name, etc.). */
  multiline?: boolean;
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

/** `'auto'` = grow with rows (no internal sticky header). */
export type DataTableGridHeight = number | string | 'auto';

export type DataTableColumnSizing = 'fit' | 'content';

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
  /**
   * Cap grid body height so the header stays sticky while rows scroll.
   * Omit on paginated lists to use a default viewport; `'auto'` grows with rows.
   */
  gridMaxHeight?: DataTableGridHeight;
  /** Hide the fit-width / fit-content toolbar button. */
  hideColumnSizing?: boolean;
  /** Show Maximize / Minimize so the table can open full screen (Escape exits). */
  fullscreenTitle?: ReactNode;
  /** Whether `row` currently has its inline detail panel open. */
  isRowExpanded?: (row: T) => boolean;
  /** Content for the full-width detail row shown directly under an expanded row. */
  renderExpandedRow?: (row: T) => ReactNode;
  /** Double-clicking a row (outside the select/actions columns) fires this. */
  onRowDoubleClick?: (row: T) => void;
  /** Height (px) of the expanded detail row. */
  expandedRowHeight?: number;
};

const DEFAULT_STICKY_HEIGHT = 'calc(100dvh - 13rem)';
const DEFAULT_EXPANDED_ROW_HEIGHT = 280;

/** Columns a double-click on should never toggle row expansion (icon actions). */
const DOUBLE_CLICK_IGNORE_COLUMN_IDS = new Set(['select', 'whatsapp', 'actions']);

/**
 * Every row is wrapped so an optional full-width "detail" row can be
 * interleaved right after its parent — AG Grid Community has no built-in
 * Master/Detail (that's Enterprise-only), but its lower-level Full Width Row
 * feature achieves the same effect and stays virtualization-safe. When no
 * caller opts into `renderExpandedRow`, `kind` is always `'row'`, so this is
 * a no-op wrapper for every other consumer of this component.
 */
type RowEntry<T> =
  | { kind: 'row'; row: T; id: string }
  | { kind: 'detail'; row: T; id: string };

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
  /**
   * Reads the current header content fresh on every call (rather than a
   * value baked in when the column definition was built) — see the
   * `columnsRef` comment on DataTable for why.
   */
  getLabel: () => ReactNode;
  columnId: string;
  sortable?: boolean;
  sort?: DataTableSort;
  onSortChange?: (sort: DataTableSort) => void;
};

function SortHeader({
  getLabel,
  columnId,
  sortable,
  sort,
  onSortChange,
}: SortHeaderProps) {
  const label = getLabel();

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
  hideColumnSizing = false,
  fullscreenTitle,
  isRowExpanded,
  renderExpandedRow,
  onRowDoubleClick,
  expandedRowHeight = DEFAULT_EXPANDED_ROW_HEIGHT,
}: DataTableProps<T>) {
  const gridApiRef = useRef<GridApi<RowEntry<T>> | null>(null);
  /**
   * Callers rarely memoize `columns` — a `cell`/`header` closing over fresh
   * local state (e.g. a row-selection Set) is a brand new array every
   * render. Rebuilding `columnDefs` on that churn forces AG Grid to tear
   * down and recreate every cell/header renderer — the "whole grid
   * flickers on checkbox click" symptom. Cell/header renderers below read
   * the live column through this ref instead, so `columnDefs` itself only
   * needs to change when a column's actual shape changes (see
   * `columnSignature`), and `refreshCells`/`refreshHeader` (in the effect
   * further down) repaint content in place without that rebuild.
   */
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const [columnSizing, setColumnSizing] =
    useState<DataTableColumnSizing>('fit');
  const [maximized, setMaximized] = useState(false);
  const inFullscreen = Boolean(fullscreenTitle) && maximized;
  const activeGridMaxHeight = inFullscreen ? '100%' : gridMaxHeight;

  const useAutoHeight =
    activeGridMaxHeight === 'auto' ||
    (activeGridMaxHeight == null && pagination == null);

  const resolvedHeight: number | string | undefined = useAutoHeight
    ? undefined
    : activeGridMaxHeight == null
      ? DEFAULT_STICKY_HEIGHT
      : activeGridMaxHeight;

  const fillParentHeight = !useAutoHeight && activeGridMaxHeight === '100%';
  const stickyViewport = !useAutoHeight && activeGridMaxHeight == null;

  // Structural fingerprint of `columns` — everything that should force a
  // real column-def rebuild (id/order, static sizing, sortability, a plain
  // string header). Deliberately excludes `cell`/non-string `header`
  // (closures), which are read live through `columnsRef` instead, so a
  // caller re-creating those every render doesn't count as a "real" change.
  const columnSignature = columns
    .map((column) =>
      [
        column.id,
        typeof column.header === 'string' ? column.header : '',
        column.sortable ? '1' : '0',
        column.className ?? '',
        column.headerClassName ?? '',
        column.width ?? '',
        column.minWidth ?? '',
        column.maxWidth ?? '',
        column.multiline ? '1' : '0',
      ].join('\u0001'),
    )
    .join('\u0002');

  const columnDefs = useMemo<ColDef<RowEntry<T>>[]>(
    () =>
      columns.map((column) => {
        const columnId = column.id;
        const canSort = Boolean(column.sortable && onSortChange);
        const sortDir: AgSortDirection | undefined =
          sort?.sortBy === columnId ? sort.sortOrder : undefined;

        const isActions = columnId === 'actions';
        const isSelect = columnId === 'select';
        const defaultMinWidth = isActions ? 168 : isSelect ? 52 : 96;
        const defaultWidth = isActions ? 180 : isSelect ? 56 : undefined;
        const fixedWidth = Boolean(isActions || isSelect || column.width);

        const def: ColDef<RowEntry<T>> = {
          colId: columnId,
          headerName: typeof column.header === 'string' ? column.header : columnId,
          sortable: false,
          suppressHeaderMenuButton: true,
          suppressMovable: true,
          resizable: true,
          // Fit-width mode stretches; fit-content clears flex via applyColumnSizing.
          flex: fixedWidth ? 0 : columnSizing === 'fit' ? 1 : 0,
          minWidth: column.minWidth ?? defaultMinWidth,
          maxWidth: column.maxWidth,
          width: column.width ?? defaultWidth,
          sort: sortDir,
          wrapText: Boolean(column.multiline),
          autoHeight: Boolean(column.multiline),
          headerClass: cn(column.headerClassName),
          cellClass: cn(
            column.className,
            isActions && 'llc-ag-actions-cell',
            column.multiline && 'llc-ag-cell-multiline',
          ),
          headerComponent: SortHeader,
          headerComponentParams: {
            getLabel: () =>
              columnsRef.current.find((c) => c.id === columnId)?.header ??
              columnId,
            columnId,
            sortable: canSort,
            sort,
            onSortChange,
          },
          cellRenderer: (params: ICellRendererParams<RowEntry<T>>) => {
            if (!params.data || params.data.kind === 'detail') return null;
            const row = params.data.row;
            const liveColumn = columnsRef.current.find((c) => c.id === columnId);
            if (liveColumn?.cell) return liveColumn.cell(row);
            return getValue(row, liveColumn?.accessorKey);
          },
          comparator: () => 0,
        };

        return def;
      }),
    // Intentionally not depending on `columns` (or `sort`'s object identity
    // beyond its own fields) — see columnSignature above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columnSignature, columnSizing, onSortChange, sort],
  );

  // Column defs are now stable across a `columns` reference change (see
  // above) — but content that genuinely depends on that render (e.g. a
  // checkbox's `checked`) still needs repainting. `force: true` re-invokes
  // cell/header renderers in place without AG Grid tearing down the grid,
  // which is what actually eliminates the flicker.
  useEffect(() => {
    const api = gridApiRef.current;
    if (!api || (typeof api.isDestroyed === 'function' && api.isDestroyed())) {
      return;
    }
    api.refreshCells({ force: true });
    api.refreshHeader();
  }, [columns]);

  const applyColumnSizing = useCallback(
    (api: GridApi<RowEntry<T>> | null | undefined, mode: DataTableColumnSizing) => {
      if (!api || (typeof api.isDestroyed === 'function' && api.isDestroyed())) {
        return;
      }

      if (mode === 'content') {
        api.autoSizeAllColumns({ skipHeader: false });
        return;
      }

      api.sizeColumnsToFit({
        defaultMinWidth: 72,
      });
    },
    [],
  );

  const rowEntries = useMemo<RowEntry<T>[]>(() => {
    const out: RowEntry<T>[] = [];
    for (const row of data) {
      const id = rowKey(row);
      out.push({ kind: 'row', row, id });
      if (renderExpandedRow && isRowExpanded?.(row)) {
        out.push({ kind: 'detail', row, id: `${id}__detail` });
      }
    }
    return out;
  }, [data, rowKey, renderExpandedRow, isRowExpanded]);

  const getRowId = useCallback(
    (params: { data: RowEntry<T> }) => params.data.id,
    [],
  );

  const onGridReady = useCallback(
    (event: GridReadyEvent<RowEntry<T>>) => {
      gridApiRef.current = event.api;
      applyColumnSizing(event.api, columnSizing);
    },
    [applyColumnSizing, columnSizing],
  );

  const onCellDoubleClicked = useCallback(
    (event: CellDoubleClickedEvent<RowEntry<T>>) => {
      if (!onRowDoubleClick) return;
      if (!event.data || event.data.kind !== 'row') return;
      const colId = event.column?.getColId?.();
      if (colId && DOUBLE_CLICK_IGNORE_COLUMN_IDS.has(colId)) return;
      onRowDoubleClick(event.data.row);
    },
    [onRowDoubleClick],
  );

  const isFullWidthRow = useCallback(
    (params: { rowNode: { data?: RowEntry<T> } }) =>
      params.rowNode.data?.kind === 'detail',
    [],
  );

  const fullWidthCellRenderer = useCallback(
    (params: ICellRendererParams<RowEntry<T>>) => {
      if (!params.data || params.data.kind !== 'detail' || !renderExpandedRow) {
        return null;
      }
      return (
        <div className="llc-ag-detail-row h-full">
          {renderExpandedRow(params.data.row)}
        </div>
      );
    },
    [renderExpandedRow],
  );

  const getRowHeight = useCallback(
    (params: RowHeightParams<RowEntry<T>>) =>
      params.data?.kind === 'detail' ? expandedRowHeight : undefined,
    [expandedRowHeight],
  );

  /** Highlights the parent row that owns the currently-open detail panel. */
  const getRowClass = useCallback(
    (params: { data?: RowEntry<T> }) =>
      params.data?.kind === 'row' && isRowExpanded?.(params.data.row)
        ? 'llc-ag-row-expanded'
        : undefined,
    [isRowExpanded],
  );

  useEffect(() => {
    applyColumnSizing(gridApiRef.current, columnSizing);
    // columnSignature (not `columns`) — resizing only needs to rerun when a
    // column's shape actually changes, not every render of the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyColumnSizing, columnSizing, columnSignature, data]);

  useEffect(() => {
    if (!inFullscreen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMaximized(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [inFullscreen]);

  const resolvedPageSize =
    pageSizeSelection ??
    (pagination
      ? toPageSizeOption(pagination.limit, pagination.total)
      : undefined);

  const loadingLabels = columns.map((column) =>
    typeof column.header === 'string' ? column.header : column.id,
  );

  const sizingToggle =
    !hideColumnSizing && !loading ? (
      <>
        <Button
          type="button"
          size="sm"
          variant={columnSizing === 'fit' ? 'primary' : 'outline'}
          aria-pressed={columnSizing === 'fit'}
          leftIcon={<StretchHorizontal className="size-3.5" />}
          onClick={() => setColumnSizing('fit')}
        >
          Fit width
        </Button>
        <Button
          type="button"
          size="sm"
          variant={columnSizing === 'content' ? 'primary' : 'outline'}
          aria-pressed={columnSizing === 'content'}
          leftIcon={<Columns3 className="size-3.5" />}
          onClick={() => setColumnSizing('content')}
        >
          Fit content
        </Button>
      </>
    ) : null;

  const fullscreenToggle =
    fullscreenTitle && !inFullscreen ? (
      <Button
        type="button"
        size="sm"
        variant="outline"
        leftIcon={<Maximize2 className="size-3.5" />}
        onClick={() => setMaximized(true)}
      >
        Maximize
      </Button>
    ) : null;

  const toolbar =
    sizingToggle || fullscreenToggle ? (
      <>
        {sizingToggle}
        {fullscreenToggle}
      </>
    ) : null;

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
        trailing={toolbar}
      />
    ) : null;

  const table = (
    <div
      className={cn(
        'flex min-h-0 flex-col gap-2',
        (fillParentHeight || stickyViewport) && 'h-full',
        inFullscreen && 'h-full',
        className,
      )}
    >
      {paginationBar ? (
        <div className="shrink-0">{paginationBar}</div>
      ) : toolbar ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 rounded-xl border border-border/80 bg-card/90 px-3 py-2 shadow-sm ring-1 ring-primary/5 backdrop-blur-sm">
          {toolbar}
        </div>
      ) : null}

      <div
        className={cn(
          'llc-ag-grid-shell min-h-0',
          !useAutoHeight && 'llc-ag-grid-shell--scroll',
          (fillParentHeight || stickyViewport || inFullscreen) && 'flex-1',
        )}
        style={
          resolvedHeight != null
            ? { height: resolvedHeight, maxHeight: resolvedHeight }
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
            className={cn('llc-ag-grid', onRowDoubleClick && 'llc-ag-grid--expandable')}
            style={{
              width: '100%',
              height: useAutoHeight ? undefined : '100%',
              minHeight: data.length === 0 ? 220 : undefined,
            }}
          >
            <AgGridReact<RowEntry<T>>
              theme={appAgGridTheme}
              containerStyle={{
                width: '100%',
                height: useAutoHeight ? undefined : '100%',
              }}
              rowData={rowEntries}
              columnDefs={columnDefs}
              getRowId={getRowId}
              domLayout={useAutoHeight ? 'autoHeight' : 'normal'}
              animateRows
              suppressCellFocus
              suppressDragLeaveHidesColumns
              suppressColumnVirtualisation
              suppressRowVirtualisation={useAutoHeight}
              enableCellTextSelection
              ensureDomOrder
              headerHeight={34}
              rowHeight={40}
              getRowHeight={renderExpandedRow ? getRowHeight : undefined}
              getRowClass={renderExpandedRow ? getRowClass : undefined}
              isFullWidthRow={renderExpandedRow ? isFullWidthRow : undefined}
              fullWidthCellRenderer={
                renderExpandedRow ? fullWidthCellRenderer : undefined
              }
              onCellDoubleClicked={
                onRowDoubleClick ? onCellDoubleClicked : undefined
              }
              onGridReady={onGridReady}
              onFirstDataRendered={(event) => {
                applyColumnSizing(event.api, columnSizing);
              }}
              onGridSizeChanged={(event) => {
                if (columnSizing === 'fit') {
                  applyColumnSizing(event.api, 'fit');
                }
              }}
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

  if (inFullscreen && typeof document !== 'undefined') {
    return createPortal(
      <div
        className="fixed inset-0 z-50 flex flex-col bg-background"
        role="dialog"
        aria-modal="true"
        aria-label={
          typeof fullscreenTitle === 'string'
            ? `${fullscreenTitle} full screen`
            : 'Table full screen'
        }
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">{fullscreenTitle}</h3>
            <p className="text-xs text-muted-foreground">
              Press Escape to exit full screen
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon={<Minimize2 className="size-4" />}
            onClick={() => setMaximized(false)}
          >
            Minimize
          </Button>
        </div>
        <div className="min-h-0 flex-1 p-3">{table}</div>
      </div>,
      document.body,
    );
  }

  return table;
}
