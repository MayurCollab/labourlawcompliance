import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/buttons';
import { Badge } from '@/components/common/Badge';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { FilterPanel, filterIds, type FilterValues } from '@/components/forms/FilterPanel';
import { SearchBox } from '@/components/forms/SearchBox';
import { Input } from '@/components/inputs/Input';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  DataTable,
  DEFAULT_DATA_TABLE_PAGE_SIZE,
  resolveDataTableLimit,
  type DataTableColumn,
  type DataTablePageSizeOption,
  type DataTableSort,
} from '@/components/tables';
import { PERMISSIONS } from '@/constants/permissions';
import { useClientOptionsQuery, useLocationsQuery } from '@/hooks/useClients';
import { usePermission } from '@/hooks/usePermission';
import {
  useDeleteWhatsAppSendMutation,
  useRefreshWhatsAppSendsMutation,
  useWhatsAppSendsQuery,
} from '@/hooks/useWhatsAppSends';
import { PATHS } from '@/routes/paths';
import type {
  ListWhatsAppSendsParams,
  WhatsAppSend,
  WhatsAppSendStatus,
} from '@/types/whatsappSend.types';

const emptyFilters: FilterValues = {
  locationIds: [],
  clientIds: [],
  status: '',
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const statusBadgeVariant = (
  status: WhatsAppSendStatus,
): 'default' | 'secondary' | 'success' | 'warning' | 'destructive' => {
  switch (status) {
    case 'read':
      return 'success';
    case 'delivered':
      return 'default';
    case 'sent':
    case 'accepted':
      return 'secondary';
    case 'failed':
      return 'destructive';
    default:
      return 'secondary';
  }
};

const STATUS_LABELS: Record<WhatsAppSendStatus, string> = {
  accepted: 'Accepted',
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
  failed: 'Failed',
};

/**
 * History of Form 5 WhatsApp sends with delivery / read timestamps.
 */
export function WhatsAppSendsPage() {
  const { hasPermission } = usePermission();
  const canDelete = hasPermission(PERMISSIONS.FILINGS_SEND);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('');
  const [filters, setFilters] = useState<FilterValues>(emptyFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<FilterValues>(emptyFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<DataTablePageSizeOption>(
    DEFAULT_DATA_TABLE_PAGE_SIZE,
  );
  const [sort, setSort] = useState<DataTableSort>({
    sortBy: 'sentAt',
    sortOrder: 'desc',
  });
  const [pendingDelete, setPendingDelete] = useState<WhatsAppSend | null>(null);

  const optionsQuery = useClientOptionsQuery();
  const locationsQuery = useLocationsQuery();
  const locationIds = filterIds(appliedFilters.locationIds);
  const clientIds = filterIds(appliedFilters.clientIds);
  const statusValue =
    typeof appliedFilters.status === 'string' && appliedFilters.status
      ? (appliedFilters.status as WhatsAppSendStatus)
      : undefined;

  const params: ListWhatsAppSendsParams = {
    page,
    limit: resolveDataTableLimit(pageSize),
    search: search || undefined,
    period: period || undefined,
    locationIds: locationIds.length ? locationIds : undefined,
    clientIds: clientIds.length ? clientIds : undefined,
    status: statusValue,
    sortBy: sort.sortBy as ListWhatsAppSendsParams['sortBy'],
    sortOrder: sort.sortOrder,
  };

  const sendsQuery = useWhatsAppSendsQuery(params);
  const refreshMutation = useRefreshWhatsAppSendsMutation();
  const deleteMutation = useDeleteWhatsAppSendMutation();

  const columns: DataTableColumn<WhatsAppSend>[] = useMemo(
    () => {
      const cols: DataTableColumn<WhatsAppSend>[] = [
        {
          id: 'sentAt',
          header: 'Sent at',
          sortable: true,
          cell: (row) => formatDateTime(row.sentAt),
        },
        {
          id: 'clientCode',
          header: 'Client',
          sortable: true,
          cell: (row) => (
            <div className="min-w-0">
              <div className="font-medium">
                {row.clientCode || row.client?.clientCode || '—'}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {row.companyName || row.client?.companyName || '—'}
              </div>
            </div>
          ),
        },
        {
          id: 'location',
          header: 'Location',
          cell: (row) => row.client?.location?.name || '—',
        },
        {
          id: 'phone',
          header: 'Phone',
          sortable: true,
          cell: (row) => row.phone,
        },
        {
          id: 'period',
          header: 'Period',
          sortable: true,
          cell: (row) => row.periodLabel || row.period || '—',
        },
        {
          id: 'status',
          header: 'Status',
          sortable: true,
          cell: (row) => (
            <Badge
              variant={statusBadgeVariant(row.status)}
              title={row.errorMessage || undefined}
            >
              {STATUS_LABELS[row.status] || row.status}
            </Badge>
          ),
        },
        {
          id: 'deliveredAt',
          header: 'Delivered at',
          cell: (row) => formatDateTime(row.deliveredAt),
        },
        {
          id: 'readAt',
          header: 'Read at',
          cell: (row) => formatDateTime(row.readAt),
        },
        {
          id: 'filename',
          header: 'File',
          cell: (row) => (
            <span className="max-w-[12rem] truncate block" title={row.filename || undefined}>
              {row.filename || '—'}
            </span>
          ),
        },
        {
          id: 'actor',
          header: 'Sent by',
          cell: (row) =>
            row.actor?.name || row.actor?.email || '—',
        },
      ];

      if (canDelete) {
        cols.push({
          id: 'actions',
          header: '',
          className: 'text-right',
          width: 108,
          minWidth: 108,
          maxWidth: 120,
          cell: (row) => (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setPendingDelete(row)}
              >
                Delete
              </Button>
            </div>
          ),
        });
      }

      return cols;
    },
    [canDelete],
  );

  const clientOptions = (optionsQuery.data?.clients ?? []).map((client) => ({
    label: `${client.clientCode} · ${client.companyName}`,
    value: client.id,
  }));
  const clientLocationNames = new Set(
    (optionsQuery.data?.clients ?? [])
      .map((client) => client.locationName?.trim().toLowerCase())
      .filter((name): name is string => Boolean(name)),
  );
  const locationOptions = (locationsQuery.data ?? [])
    .filter((location) =>
      clientLocationNames.has(location.name.trim().toLowerCase()),
    )
    .map((location) => ({
      label: location.name,
      value: location.id,
    }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="WhatsApp sends"
        description="Delivery history for Form 5 WhatsApp messages — accepted, delivered, read, and failed."
        breadcrumbs={[
          { label: 'Home', href: PATHS.home },
          { label: 'Form 5 WhatsApp', href: PATHS.form5Whatsapp },
          { label: 'Sends' },
        ]}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <SearchBox
          value={searchInput}
          onChange={setSearchInput}
          onSubmit={() => {
            setSearch(searchInput.trim());
            setPage(1);
          }}
          placeholder="Search phone, client, file…"
          className="sm:max-w-xs"
        />
        <Input
          label="Period"
          type="month"
          value={period}
          onChange={(event) => {
            setPeriod(event.target.value);
            setPage(1);
          }}
          containerClassName="sm:max-w-[12rem]"
        />
      </div>

      <FilterPanel
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
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { label: 'Accepted', value: 'accepted' },
              { label: 'Sent', value: 'sent' },
              { label: 'Delivered', value: 'delivered' },
              { label: 'Read', value: 'read' },
              { label: 'Failed', value: 'failed' },
            ],
            placeholder: 'All statuses',
          },
        ]}
        values={filters}
        onChange={setFilters}
        onApply={(values) => {
          setAppliedFilters(values);
          setPage(1);
        }}
        onReset={() => {
          setFilters(emptyFilters);
          setAppliedFilters(emptyFilters);
          setPage(1);
        }}
        footer={
          <Button
            type="button"
            size="sm"
            variant="outline"
            leftIcon={<RefreshCw className="size-4" />}
            loading={refreshMutation.isPending}
            disabled={refreshMutation.isPending}
            onClick={() => refreshMutation.mutate()}
          >
            Refresh status
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={sendsQuery.data?.sends ?? []}
        rowKey={(row) => row.id}
        loading={sendsQuery.isLoading}
        sort={sort}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
        }}
        pagination={sendsQuery.data?.pagination}
        onPageChange={setPage}
        pageSizeSelection={pageSize}
        onPageSizeChange={(size) => {
          setPage(1);
          setPageSize(size);
        }}
        emptyTitle="No WhatsApp sends"
        emptyDescription="Send a Form 5 from the WhatsApp page to see delivery status here."
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete WhatsApp send?"
        message={
          pendingDelete
            ? `Delete the send to ${pendingDelete.phone}${
                pendingDelete.clientCode || pendingDelete.client?.clientCode
                  ? ` (${pendingDelete.clientCode || pendingDelete.client?.clientCode})`
                  : ''
              }? This only removes the history row, not the WhatsApp message.`
            : ''
        }
        confirmLabel="Delete"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteMutation.mutate(pendingDelete.id, {
            onSuccess: () => setPendingDelete(null),
          });
        }}
      />
    </div>
  );
}
