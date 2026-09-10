import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { filingsApi } from '@/api/filings.api';
import { Button } from '@/components/buttons';
import { Badge } from '@/components/common/Badge';
import { PermissionGate } from '@/components/common/PermissionGate';
import { FilterPanel, filterIds, type FilterValues } from '@/components/forms/FilterPanel';
import { SearchBox } from '@/components/forms/SearchBox';
import { Checkbox } from '@/components/inputs/Checkbox';
import { Input } from '@/components/inputs/Input';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  DataTable,
  resolveDataTableLimit,
  type DataTableColumn,
  type DataTablePageSizeOption,
  type DataTableSort,
} from '@/components/tables';
import { PERMISSIONS } from '@/constants/permissions';
import { useClientOptionsQuery, useLocationsQuery } from '@/hooks/useClients';
import {
  filingsQueryKeys,
  useDownloadFilingMutation,
  useFilingsQuery,
} from '@/hooks/useFilings';
import { BulkGenerateModal } from '@/pages/filings/BulkGenerateModal';
import { FilingComputeDrawer } from '@/pages/filings/FilingComputeDrawer';
import { PATHS } from '@/routes/paths';
import type {
  BulkGeneratePayload,
  Filing,
  ListFilingsParams,
} from '@/types/filing.types';
import { getApiErrorMessage } from '@/utils/apiError';
import {
  canPickDownloadFolder,
  downloadFilesToFolder,
} from '@/utils/folderDownload';
import { toastError, toastSuccess } from '@/utils/toast';

const formatAmount = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : value.toLocaleString('en-IN');

const formatDate = (value: string | null | undefined) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN');
};

const previousMonth = () => {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const emptyFilters: FilterValues = {
  locationIds: [],
  clientIds: [],
  generateStatus: '',
};

/**
 * Month workspace: filter a full month, generate selected or all matching,
 * skip rows with no template. Payment fields stay on the same row.
 */
export function FilingsPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState(previousMonth);
  const [filters, setFilters] = useState<FilterValues>(emptyFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<FilterValues>(emptyFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<DataTablePageSizeOption>(50);
  const [sort, setSort] = useState<DataTableSort>({
    sortBy: 'clientCode',
    sortOrder: 'asc',
  });
  const [selected, setSelected] = useState<Filing | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPayload, setBulkPayload] = useState<BulkGeneratePayload | null>(
    null,
  );
  const [bulkDownloading, setBulkDownloading] = useState(false);

  const queryClient = useQueryClient();
  const locationsQuery = useLocationsQuery();
  const clientsQuery = useClientOptionsQuery();
  const downloadMutation = useDownloadFilingMutation();

  const startBulk = (payload: BulkGeneratePayload) => {
    setBulkPayload(payload);
    setBulkOpen(true);
  };

  const downloadableFromRows = (list: Filing[]) =>
    list.filter((row) => Boolean(row.generatedFile?.filename));

  const runMultiDownload = async (
    items: { id: string; filename: string }[],
  ) => {
    if (!items.length) {
      toastError('No generated Form 5 files to download');
      return;
    }
    try {
      const result = await downloadFilesToFolder(
        items.map((item) => ({
          id: item.id,
          filename: item.filename,
          getBlob: async () => {
            const file = await filingsApi.fetchDownloadBlob(item.id, {
              filename: item.filename,
            });
            return file.blob;
          },
        })),
      );
      toastSuccess(
        result.mode === 'folder'
          ? `Saved ${result.saved} file(s) to the selected folder`
          : `Downloaded ZIP with ${result.saved} file(s)`,
      );
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        toastError('Folder selection cancelled');
      } else {
        toastError(getApiErrorMessage(err, 'Could not download Form 5 files'));
      }
    }
  };

  const downloadSelectedGenerated = async () => {
    setBulkDownloading(true);
    try {
      await runMultiDownload(
        selectedDownloadable.map((row) => ({
          id: row.id,
          filename:
            row.generatedFile?.filename || `${row.clientCode}_Form5.pdf`,
        })),
      );
    } finally {
      setBulkDownloading(false);
    }
  };

  const downloadAllGeneratedForFilters = async () => {
    if (!period) {
      toastError('Pick a month first');
      return;
    }
    setBulkDownloading(true);
    try {
      const collected: { id: string; filename: string }[] = [];
      let page = 1;
      let totalPages = 1;
      while (page <= totalPages) {
        const result = await filingsApi.list({
          page,
          limit: 200,
          search: search || undefined,
          period,
          locationIds: locationIds.length ? locationIds : undefined,
          clientIds: clientIds.length ? clientIds : undefined,
          generateStatus: 'generated',
          sortBy: 'clientCode',
          sortOrder: 'asc',
        });
        totalPages = result.pagination.totalPages;
        for (const row of result.filings) {
          if (row.generatedFile?.filename) {
            collected.push({
              id: row.id,
              filename: row.generatedFile.filename,
            });
          }
        }
        page += 1;
      }
      await runMultiDownload(collected);
    } catch (err) {
      toastError(
        getApiErrorMessage(err, 'Could not load generated Form 5 files'),
      );
    } finally {
      setBulkDownloading(false);
    }
  };

  const locationIds = filterIds(appliedFilters.locationIds);
  const clientIds = filterIds(appliedFilters.clientIds);
  const statusValue = appliedFilters.generateStatus;
  const generateStatus =
    statusValue === 'pending' ||
    statusValue === 'generated' ||
    statusValue === 'failed'
      ? statusValue
      : undefined;

  const params: ListFilingsParams = {
    page,
    limit: resolveDataTableLimit(pageSize),
    search: search || undefined,
    period: period || undefined,
    locationIds: locationIds.length ? locationIds : undefined,
    clientIds: clientIds.length ? clientIds : undefined,
    generateStatus,
    sortBy: sort.sortBy as ListFilingsParams['sortBy'],
    sortOrder: sort.sortOrder,
  };

  const filingsQuery = useFilingsQuery(params);
  const rows = filingsQuery.data?.filings ?? [];
  const selectedDownloadable = useMemo(
    () => downloadableFromRows(rows.filter((row) => selectedIds.has(row.id))),
    [rows, selectedIds],
  );
  const pageIds = rows.map((row) => row.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));

  const locationOptions = (locationsQuery.data ?? []).map((location) => ({
    label: location.name,
    value: location.id,
  }));
  const clientOptions = (clientsQuery.data?.clients ?? []).map((client) => ({
    label: `${client.clientCode} · ${client.companyName}`,
    value: client.id,
  }));

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const columns: DataTableColumn<Filing>[] = useMemo(
    () => [
      {
        id: 'select',
        header: (
          <Checkbox
            aria-label="Select all on this page"
            checked={allPageSelected}
            onChange={togglePage}
            ref={(element) => {
              if (element) {
                element.indeterminate = somePageSelected && !allPageSelected;
              }
            }}
          />
        ),
        className: 'w-10',
        cell: (row) => (
          <Checkbox
            aria-label={`Select ${row.clientCode}`}
            checked={selectedIds.has(row.id)}
            onChange={() => toggleRow(row.id)}
          />
        ),
      },
      {
        id: 'clientCode',
        header: 'Client',
        sortable: true,
        cell: (row) => <span className="font-medium">{row.clientCode}</span>,
      },
      {
        id: 'company',
        header: 'Company',
        cell: (row) => row.client?.companyName ?? '—',
      },
      {
        id: 'location',
        header: 'Location',
        cell: (row) => row.client?.location?.name ?? '—',
      },
      {
        id: 'period',
        header: 'Period',
        sortable: true,
        cell: (row) => row.periodLabel || row.period,
      },
      {
        id: 'ptAmount',
        header: 'P.Tax',
        cell: (row) => formatAmount(row.ptAmount),
      },
      {
        id: 'challanNo',
        header: 'Challan',
        cell: (row) => row.challanNo || '—',
      },
      {
        id: 'sentDate',
        header: 'Sent',
        cell: (row) => formatDate(row.sentDate),
      },
      {
        id: 'totalA',
        header: 'Total A',
        cell: (row) => formatAmount(row.computation?.totalA),
      },
      {
        id: 'generateStatus',
        header: 'File',
        cell: (row) =>
          !row.hasTemplate ? (
            <Badge variant="warning">No template</Badge>
          ) : row.generateStatus === 'generated' ? (
            <Badge variant="success">Generated</Badge>
          ) : row.generateStatus === 'failed' ? (
            <Badge variant="warning">Failed</Badge>
          ) : row.computation ? (
            <Badge variant="secondary">Ready</Badge>
          ) : (
            <Badge variant="secondary">Not computed</Badge>
          ),
      },
      {
        id: 'actions',
        header: '',
        className: 'text-right',
        width: 260,
        minWidth: 220,
        cell: (row) => (
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelected(row)}
            >
              Review
            </Button>
            <PermissionGate permission={PERMISSIONS.FILINGS_VIEW}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!row.generatedFile || downloadMutation.isPending}
                onClick={() =>
                  void downloadMutation.mutateAsync({
                    id: row.id,
                    filename: row.generatedFile?.filename,
                  })
                }
              >
                {row.generatedFile?.mimetype?.includes('pdf')
                  ? 'Download PDF'
                  : row.generatedFile?.mimetype?.includes('sheet') ||
                      row.generatedFile?.filename?.endsWith('.xlsx')
                    ? 'Download Excel'
                    : 'Download'}
              </Button>
            </PermissionGate>
          </div>
        ),
      },
    ],
    [
      allPageSelected,
      somePageSelected,
      selectedIds,
      rows,
      downloadMutation.isPending,
    ],
  );

  const busy = bulkOpen || bulkDownloading;
  const matchingTotal = filingsQuery.data?.pagination.total ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Form 5"
        description="Process a month from this list: open Review for template, manual fields, and PDF generate. Bulk actions still work for the whole month."
        breadcrumbs={[
          { label: 'Home', href: PATHS.home },
          { label: 'Form 5' },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <SearchBox
          value={searchInput}
          onChange={setSearchInput}
          onSubmit={() => {
            setSearch(searchInput.trim());
            setPage(1);
            setSelectedIds(new Set());
          }}
          placeholder="Search client code"
          className="sm:max-w-xs"
        />
        <Input
          label="Month"
          type="month"
          value={period}
          onChange={(event) => {
            setPeriod(event.target.value);
            setPage(1);
            setSelectedIds(new Set());
          }}
          containerClassName="sm:max-w-[12rem]"
        />
      </div>

      <FilterPanel
        title="Workspace filters"
        fields={[
          {
            key: 'locationIds',
            label: 'Location',
            type: 'multiSelect',
            options: locationOptions,
            placeholder: 'All locations',
            searchPlaceholder: 'Search locations…',
          },
          {
            key: 'clientIds',
            label: 'Client',
            type: 'multiSelect',
            options: clientOptions,
            placeholder: 'All clients',
            searchPlaceholder: 'Search clients…',
          },
          {
            key: 'generateStatus',
            label: 'Generate status',
            type: 'select',
            options: [
              { label: 'Pending', value: 'pending' },
              { label: 'Generated', value: 'generated' },
              { label: 'Failed', value: 'failed' },
            ],
            placeholder: 'Any status',
          },
        ]}
        values={filters}
        onChange={setFilters}
        onApply={(values) => {
          setAppliedFilters(values);
          setPage(1);
          setSelectedIds(new Set());
        }}
        onReset={() => {
          setFilters(emptyFilters);
          setAppliedFilters(emptyFilters);
          setPage(1);
          setSelectedIds(new Set());
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          {selectedIds.size} selected
          {period ? ` · ${matchingTotal} in ${period}` : ''}.
        </p>
        <PermissionGate permission={PERMISSIONS.FILINGS_GENERATE}>
          <Button
            type="button"
            disabled={selectedIds.size === 0 || busy}
            onClick={() => startBulk({ ids: [...selectedIds] })}
          >
            Generate selected
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!period || matchingTotal === 0 || busy}
            onClick={() =>
              startBulk({
                period,
                locationIds: locationIds.length ? locationIds : undefined,
                clientIds: clientIds.length ? clientIds : undefined,
                generateStatus,
                search: search || undefined,
              })
            }
          >
            Generate this month
          </Button>
        </PermissionGate>
        <PermissionGate permission={PERMISSIONS.FILINGS_VIEW}>
          <Button
            type="button"
            variant="outline"
            disabled={selectedDownloadable.length === 0 || busy}
            loading={bulkDownloading}
            onClick={() => void downloadSelectedGenerated()}
          >
            {canPickDownloadFolder()
              ? `Choose folder (${selectedDownloadable.length})`
              : `Download ZIP (${selectedDownloadable.length})`}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!period || busy}
            loading={bulkDownloading}
            onClick={() => void downloadAllGeneratedForFilters()}
          >
            Download all generated
              {canPickDownloadFolder() ? '' : ' (ZIP)'}
          </Button>
        </PermissionGate>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        rowKey={(row) => row.id}
        loading={filingsQuery.isLoading}
        sort={sort}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
        }}
        pagination={filingsQuery.data?.pagination}
        onPageChange={(nextPage) => {
          setPage(nextPage);
        }}
        pageSizeSelection={pageSize}
        onPageSizeChange={(size) => {
          setPage(1);
          setPageSize(size);
        }}
        emptyTitle="No filings for these filters"
        emptyDescription="Pick a month (and optional location / client). Import a MasterSheet if the month is empty."
        className="min-w-0"
      />

      <FilingComputeDrawer
        open={Boolean(selected)}
        filing={
          selected
            ? (rows.find((row) => row.id === selected.id) ?? selected)
            : null
        }
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />

      <BulkGenerateModal
        open={bulkOpen}
        payload={bulkPayload}
        onOpenChange={(open) => {
          setBulkOpen(open);
          if (!open) setBulkPayload(null);
        }}
        onFinished={() => {
          setSelectedIds(new Set());
          void queryClient.invalidateQueries({
            queryKey: filingsQueryKeys.all,
          });
        }}
      />
    </div>
  );
}
