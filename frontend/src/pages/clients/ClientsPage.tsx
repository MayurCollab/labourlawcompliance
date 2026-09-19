import { useEffect, useMemo, useState } from 'react';
import { Download, Plus } from 'lucide-react';

import { Button } from '@/components/buttons';
import { PermissionGate } from '@/components/common/PermissionGate';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { FormWrapper } from '@/components/forms/FormWrapper';
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
import {
  RowActionItem,
  RowActionsMenu,
} from '@/components/tables/RowActionsMenu';
import { PERMISSIONS } from '@/constants/permissions';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePermission } from '@/hooks/usePermission';
import {
  useClientsQuery,
  useCreateClientMutation,
  useDeleteClientMutation,
  useExportClientsMutation,
  useLocationsQuery,
  useUpdateClientMutation,
} from '@/hooks/useClients';
import {
  useSettingsQuery,
  useUpdateSettingsMutation,
} from '@/hooks/useMasters';
import { ClientFormDrawer } from '@/pages/clients/ClientFormDrawer';
import { PATHS } from '@/routes/paths';
import type { Client, ClientPayload, ListClientsParams } from '@/types/client.types';
import {
  signatoryFormSchema,
  type ClientFormValues,
  type SignatoryFormValues,
} from '@/validations/masters.validation';

const emptyToNull = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const toPayload = (values: ClientFormValues): ClientPayload => ({
  clientCode: values.clientCode,
  companyName: values.companyName,
  locationName: values.locationName,
  draftName: emptyToNull(values.draftName),
  authorityName: emptyToNull(values.authorityName),
  address: emptyToNull(values.address),
  rcNumber: emptyToNull(values.rcNumber),
  contactNumber: emptyToNull(values.contactNumber),
  recipientName: emptyToNull(values.recipientName),
  signatoryName: emptyToNull(values.signatoryName),
  includeEmployeesOnForm5: values.includeEmployeesOnForm5 !== false,
});

/**
 * Employer client master — create/edit via Drawer.
 */
export function ClientsPage() {
  const { hasPermission } = usePermission();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterValues>({ locationIds: [] });
  const [appliedFilters, setAppliedFilters] = useState<FilterValues>({
    locationIds: [],
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<DataTablePageSizeOption>(
    DEFAULT_DATA_TABLE_PAGE_SIZE,
  );
  const [sort, setSort] = useState<DataTableSort>({
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Client | null>(null);
  const [menuClientId, setMenuClientId] = useState<string | null>(null);

  const debouncedSearchInput = useDebouncedValue(searchInput);
  useEffect(() => {
    setSearch(debouncedSearchInput.trim());
    setPage(1);
  }, [debouncedSearchInput]);

  const listParams: ListClientsParams = {
    page,
    limit: resolveDataTableLimit(pageSize),
    search: search || undefined,
    locationIds: (() => {
      const ids = filterIds(appliedFilters.locationIds);
      return ids.length ? ids : undefined;
    })(),
    sortBy: sort.sortBy as ListClientsParams['sortBy'],
    sortOrder: sort.sortOrder,
  };

  const clientsQuery = useClientsQuery(listParams);
  const locationsQuery = useLocationsQuery({
    enabled: hasPermission(PERMISSIONS.CLIENTS_VIEW),
  });
  const settingsQuery = useSettingsQuery({
    enabled: hasPermission(PERMISSIONS.CLIENTS_VIEW),
  });
  const createMutation = useCreateClientMutation();
  const updateMutation = useUpdateClientMutation();
  const deleteMutation = useDeleteClientMutation();
  const exportMutation = useExportClientsMutation();
  const settingsMutation = useUpdateSettingsMutation();

  const exportParams = {
    search: search || undefined,
    locationIds: listParams.locationIds,
    sortBy: listParams.sortBy,
    sortOrder: listParams.sortOrder,
  };

  const locationOptions = useMemo(
    () =>
      (locationsQuery.data ?? []).map((location) => ({
        label: location.name,
        value: location.id,
      })),
    [locationsQuery.data],
  );

  const columns: DataTableColumn<Client>[] = [
    {
      id: 'clientCode',
      header: 'Client ID',
      sortable: true,
      cell: (row) => (
        <span className="font-medium">{row.clientCode}</span>
      ),
    },
    {
      id: 'companyName',
      header: 'Client name',
      sortable: true,
      cell: (row) => row.companyName || '—',
    },
    {
      id: 'location',
      header: 'Location',
      cell: (row) => row.location?.name ?? '—',
    },
    {
      id: 'rcNumber',
      header: 'Reg. no.',
      cell: (row) => row.rcNumber ?? '—',
    },
    {
      id: 'address',
      header: 'Address',
      cell: (row) => (
        <span className="block max-w-[16rem] truncate" title={row.address ?? ''}>
          {row.address ?? '—'}
        </span>
      ),
    },
    {
      id: 'contactNumber',
      header: 'Contact',
      cell: (row) => row.contactNumber ?? '—',
    },
    {
      id: 'recipientName',
      header: 'Contact name',
      cell: (row) => row.recipientName ?? '—',
    },
    {
      id: 'actions',
      header: '',
      className: 'text-right',
      width: 72,
      minWidth: 72,
      maxWidth: 72,
      cell: (row) => {
        const open = menuClientId === row.id;
        return (
          <RowActionsMenu
            open={open}
            onOpenChange={(next) => setMenuClientId(next ? row.id : null)}
          >
            <PermissionGate permission={PERMISSIONS.CLIENTS_EDIT}>
              <RowActionItem
                onClick={() => {
                  setMenuClientId(null);
                  setDrawerMode('edit');
                  setEditingClient(row);
                  setDrawerOpen(true);
                }}
              >
                Edit
              </RowActionItem>
            </PermissionGate>
            <PermissionGate permission={PERMISSIONS.CLIENTS_DELETE}>
              <RowActionItem
                destructive
                onClick={() => {
                  setMenuClientId(null);
                  setPendingDelete(row);
                }}
              >
                Delete
              </RowActionItem>
            </PermissionGate>
          </RowActionsMenu>
        );
      },
    },
  ];

  return (
    <div className="flex h-[calc(100dvh-3.5rem-1.5rem)] flex-col gap-2.5">
      <PageHeader
        className="shrink-0"
        title="Clients"
        description="Employer client master from uploaded sheets."
        breadcrumbs={[
          { label: 'Home', href: PATHS.home },
          { label: 'Clients' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Download className="size-4" />}
              loading={exportMutation.isPending}
              onClick={() => {
                void exportMutation.mutateAsync(exportParams);
              }}
            >
              Download Excel
            </Button>
            <PermissionGate permission={PERMISSIONS.CLIENTS_CREATE}>
              <Button
                size="sm"
                leftIcon={<Plus className="size-4" />}
                onClick={() => {
                  setDrawerMode('create');
                  setEditingClient(null);
                  setDrawerOpen(true);
                }}
              >
                Add client
              </Button>
            </PermissionGate>
          </div>
        }
      />

      <PermissionGate permission={PERMISSIONS.CLIENTS_EDIT}>
        <FormWrapper<SignatoryFormValues>
          key={settingsQuery.data?.signatoryName ?? 'empty'}
          schema={signatoryFormSchema}
          defaultValues={{
            signatoryName: settingsQuery.data?.signatoryName ?? '',
          }}
          guardUnsavedChanges={false}
          onSubmit={(values) => {
            settingsMutation.mutate({
              signatoryName: values.signatoryName,
            });
          }}
        >
          {(form) => (
            <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-border/80 bg-card/90 px-2.5 py-1.5 shadow-sm ring-1 ring-primary/5">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Default signatory
              </span>
              <Input
                aria-label="Default signatory"
                placeholder="Name used on Form 5 when client has none"
                containerClassName="min-w-48 flex-1 sm:max-w-sm"
                className="h-8 py-1.5"
                {...form.register('signatoryName')}
                error={form.formState.errors.signatoryName?.message}
              />
              <Button
                type="submit"
                size="sm"
                loading={settingsMutation.isPending}
              >
                Save
              </Button>
            </div>
          )}
        </FormWrapper>
      </PermissionGate>

      <FilterPanel
        className="shrink-0"
        leading={
          <SearchBox
            value={searchInput}
            onChange={setSearchInput}
            onSubmit={(value) => {
              setPage(1);
              setSearch(value.trim());
            }}
            placeholder="Search code, company, RC, contact name…"
            className="w-[16rem] max-w-full"
          />
        }
        fields={[
          {
            key: 'locationIds',
            label: 'Location',
            type: 'multiSelect',
            options: locationOptions,
            placeholder: 'All locations',
            searchPlaceholder: 'Search locations…',
          },
        ]}
        values={filters}
        onChange={setFilters}
        onApply={(values) => {
          setPage(1);
          setAppliedFilters(values);
        }}
        onReset={() => {
          setFilters({ locationIds: [] });
          setAppliedFilters({ locationIds: [] });
          setSearchInput('');
          setSearch('');
          setPage(1);
        }}
      />

      <div className="min-h-0 flex-1">
        <DataTable
          className="h-full"
          gridMaxHeight="100%"
          columns={columns}
          data={clientsQuery.data?.clients ?? []}
          rowKey={(row) => row.id}
          loading={clientsQuery.isLoading}
          sort={sort}
          onSortChange={(next) => {
            setPage(1);
            setSort(next);
          }}
          pagination={
            clientsQuery.data
              ? {
                  page: clientsQuery.data.pagination.page,
                  limit: clientsQuery.data.pagination.limit,
                  total: clientsQuery.data.pagination.total,
                  totalPages: clientsQuery.data.pagination.totalPages,
                }
              : undefined
          }
          onPageChange={setPage}
          pageSizeSelection={pageSize}
          onPageSizeChange={(size) => {
            setPage(1);
            setPageSize(size);
          }}
          emptyTitle="No clients yet"
          emptyDescription="Upload MasterSheet All Clients.xlsx on the Uploads page. Addresses come from Client - Master.xlsx."
          fullscreenTitle="Clients"
        />
      </div>

      <ClientFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        mode={drawerMode}
        client={editingClient}
        locations={locationsQuery.data ?? []}
        loading={createMutation.isPending || updateMutation.isPending}
        onSubmit={(values, matchedClientId) => {
          const payload = toPayload(values);
          const targetId =
            drawerMode === 'edit' ? editingClient?.id : matchedClientId;
          if (targetId) {
            updateMutation.mutate(
              { id: targetId, payload },
              { onSuccess: () => setDrawerOpen(false) },
            );
            return;
          }
          createMutation.mutate(payload, {
            onSuccess: () => setDrawerOpen(false),
          });
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete client?"
        message={
          pendingDelete
            ? `Soft-delete ${pendingDelete.clientCode} (${pendingDelete.companyName})? They will no longer appear in the list.`
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
