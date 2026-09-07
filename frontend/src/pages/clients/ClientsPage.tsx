import { useMemo, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

import { Button } from '@/components/buttons';
import { Badge } from '@/components/common/Badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/common/Card';
import { PermissionGate } from '@/components/common/PermissionGate';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { FormWrapper } from '@/components/forms/FormWrapper';
import { FilterPanel, type FilterValues } from '@/components/forms/FilterPanel';
import { SearchBox } from '@/components/forms/SearchBox';
import { Input } from '@/components/inputs/Input';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  DataTable,
  type DataTableColumn,
  type DataTableSort,
} from '@/components/tables';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermission } from '@/hooks/usePermission';
import {
  useClientsQuery,
  useCreateClientMutation,
  useDeleteClientMutation,
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
  fundCode: emptyToNull(values.fundCode),
  phyCode: emptyToNull(values.phyCode),
  status: emptyToNull(values.status),
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
  const [filters, setFilters] = useState<FilterValues>({ locationId: '' });
  const [appliedFilters, setAppliedFilters] = useState<FilterValues>({
    locationId: '',
  });
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<DataTableSort>({
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Client | null>(null);
  const [menuClientId, setMenuClientId] = useState<string | null>(null);

  const listParams: ListClientsParams = {
    page,
    limit: 10,
    search: search || undefined,
    locationId:
      typeof appliedFilters.locationId === 'string' && appliedFilters.locationId
        ? appliedFilters.locationId
        : undefined,
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
  const settingsMutation = useUpdateSettingsMutation();

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
      header: 'Client',
      sortable: true,
      cell: (row) => (
        <div className="min-w-0 space-y-0.5">
          <p className="font-medium">{row.clientCode}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.companyName}
          </p>
        </div>
      ),
    },
    {
      id: 'location',
      header: 'Location',
      cell: (row) => row.location?.name ?? '—',
    },
    {
      id: 'rcNumber',
      header: 'Reg No.',
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
      id: 'fundCode',
      header: 'Fund',
      cell: (row) => row.fundCode ?? '—',
    },
    {
      id: 'phyCode',
      header: 'PHY',
      cell: (row) => row.phyCode ?? '—',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) =>
        row.status ? <Badge variant="secondary">{row.status}</Badge> : '—',
    },
    {
      id: 'actions',
      header: '',
      className: 'w-12 text-right',
      cell: (row) => {
        const open = menuClientId === row.id;
        return (
          <div className="relative flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Row actions"
              onClick={() => setMenuClientId(open ? null : row.id)}
            >
              <MoreHorizontal className="size-4" />
            </Button>
            {open ? (
              <div className="absolute right-0 z-20 mt-8 w-36 rounded-lg border border-border bg-popover p-1 shadow-md">
                <PermissionGate permission={PERMISSIONS.CLIENTS_EDIT}>
                  <button
                    type="button"
                    className="flex w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      setMenuClientId(null);
                      setDrawerMode('edit');
                      setEditingClient(row);
                      setDrawerOpen(true);
                    }}
                  >
                    Edit
                  </button>
                </PermissionGate>
                <PermissionGate permission={PERMISSIONS.CLIENTS_DELETE}>
                  <button
                    type="button"
                    className="flex w-full rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-muted"
                    onClick={() => {
                      setMenuClientId(null);
                      setPendingDelete(row);
                    }}
                  >
                    Delete
                  </button>
                </PermissionGate>
              </div>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Employer client master from uploaded sheets. Add or update clients by uploading MasterSheet and Client - Master."
        breadcrumbs={[
          { label: 'Home', href: PATHS.home },
          { label: 'Clients' },
        ]}
      />

      <PermissionGate permission={PERMISSIONS.CLIENTS_EDIT}>
        <Card>
          <CardHeader>
            <CardTitle>Default signatory</CardTitle>
            <CardDescription>
              Used on Form 5 when a client has no signatory of their own. Leave
              empty until you set it.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                <div className="flex flex-wrap items-end gap-3">
                  <Input
                    label="Name"
                    containerClassName="min-w-56 flex-1"
                    {...form.register('signatoryName')}
                    error={form.formState.errors.signatoryName?.message}
                  />
                  <Button type="submit" loading={settingsMutation.isPending}>
                    Save
                  </Button>
                </div>
              )}
            </FormWrapper>
          </CardContent>
        </Card>
      </PermissionGate>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <SearchBox
          value={searchInput}
          onChange={setSearchInput}
          onSubmit={(value) => {
            setPage(1);
            setSearch(value.trim());
          }}
          placeholder="Search code, company, RC…"
          className="lg:max-w-xs"
        />
      </div>

      <FilterPanel
        fields={[
          {
            key: 'locationId',
            label: 'Location',
            type: 'select',
            options: locationOptions,
            placeholder: 'All locations',
          },
        ]}
        values={filters}
        onChange={setFilters}
        onApply={(values) => {
          setPage(1);
          setAppliedFilters(values);
        }}
        onReset={() => {
          setFilters({ locationId: '' });
          setAppliedFilters({ locationId: '' });
          setPage(1);
        }}
      />

      <DataTable
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
        emptyTitle="No clients yet"
        emptyDescription="Upload MasterSheet All Clients.xlsx on the Uploads page. Addresses come from Client - Master.xlsx."
      />

      <ClientFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        mode={drawerMode}
        client={editingClient}
        locations={locationsQuery.data ?? []}
        loading={createMutation.isPending || updateMutation.isPending}
        onSubmit={(values) => {
          const payload = toPayload(values);
          if (drawerMode === 'create') {
            createMutation.mutate(payload, {
              onSuccess: () => setDrawerOpen(false),
            });
            return;
          }
          if (!editingClient) return;
          updateMutation.mutate(
            { id: editingClient.id, payload },
            { onSuccess: () => setDrawerOpen(false) },
          );
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
