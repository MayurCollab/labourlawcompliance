import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronRight,
  Download,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/buttons';
import { Badge } from '@/components/common/Badge';
import { PermissionGate } from '@/components/common/PermissionGate';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { FormWrapper } from '@/components/forms/FormWrapper';
import { FilterPanel, filterIds, type FilterValues } from '@/components/forms/FilterPanel';
import { SearchBox } from '@/components/forms/SearchBox';
import { Checkbox } from '@/components/inputs/Checkbox';
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
import { ClientEmployeesPanel } from '@/pages/clients/ClientEmployeesPanel';
import { ClientFormModal } from '@/pages/clients/ClientFormModal';
import { ClientsWhatsAppPreviewModal } from '@/pages/clients/ClientsWhatsAppPreviewModal';
import { SendClientWhatsAppModal } from '@/pages/clients/SendClientWhatsAppModal';
import { SendWhatsAppTemplateModal } from '@/pages/filings/SendWhatsAppTemplateModal';
import { PATHS } from '@/routes/paths';
import { cn } from '@/lib/utils';
import type { Client, ClientPayload, ListClientsParams } from '@/types/client.types';
import type { Filing } from '@/types/filing.types';
import {
  signatoryFormSchema,
  type ClientFormValues,
  type SignatoryFormValues,
} from '@/validations/masters.validation';

const generateStatusBadge = (
  status: 'pending' | 'generated' | 'failed' | undefined,
) => {
  if (status === 'generated') {
    return (
      <Badge variant="success" className="w-fit">
        Generated
      </Badge>
    );
  }
  if (status === 'failed') {
    return (
      <Badge variant="destructive" className="w-fit">
        Failed
      </Badge>
    );
  }
  if (status === 'pending') {
    return (
      <Badge variant="warning" className="w-fit">
        Pending
      </Badge>
    );
  }
  return <span className="text-muted-foreground">—</span>;
};

const formatPtAmount = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : value.toLocaleString('en-IN');

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

const emptyFilters: FilterValues = {
  locationIds: [],
  generateStatus: '',
  recentlyAdded: '',
};

/**
 * Employer client master — create/edit via Drawer.
 */
export function ClientsPage() {
  const { hasPermission } = usePermission();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterValues>(emptyFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<FilterValues>(emptyFilters);
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendModalClient, setSendModalClient] = useState<Client | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [form5Handoff, setForm5Handoff] = useState<{
    filing: Filing;
    templateId: string;
  } | null>(null);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(
    null,
  );
  const canViewEmployees = hasPermission(PERMISSIONS.EMPLOYEES_VIEW);

  const debouncedSearchInput = useDebouncedValue(searchInput);
  useEffect(() => {
    setSearch(debouncedSearchInput.trim());
    setPage(1);
  }, [debouncedSearchInput]);

  const recentlyAdded = appliedFilters.recentlyAdded === 'lastSheet';
  const statusValue = appliedFilters.generateStatus;
  const generateStatus =
    statusValue === 'pending' ||
    statusValue === 'generated' ||
    statusValue === 'failed'
      ? statusValue
      : undefined;

  const listParams: ListClientsParams = {
    page,
    limit: resolveDataTableLimit(pageSize),
    search: search || undefined,
    locationIds: (() => {
      const ids = filterIds(appliedFilters.locationIds);
      return ids.length ? ids : undefined;
    })(),
    generateStatus,
    recentlyAdded: recentlyAdded || undefined,
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

  const clients = clientsQuery.data?.clients ?? [];
  const pageIds = clients.map((client) => client.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));

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

  // Only rows loaded on the current page can be resolved back to full
  // Client records — selections on other pages stay checked but drop out of
  // the preview once you navigate away, same as the Form 5 WhatsApp page.
  const selectedClients = clients.filter((client) => selectedIds.has(client.id));

  const columns: DataTableColumn<Client>[] = [
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
      width: 44,
      minWidth: 44,
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
      header: 'Client ID',
      sortable: true,
      cell: (row) => (
        <span className="inline-flex items-center gap-1 font-medium">
          {canViewEmployees && (
            <ChevronRight
              className={cn(
                'size-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
                row.id === expandedClientId && 'rotate-90 text-primary',
              )}
              aria-hidden
            />
          )}
          {row.clientCode}
        </span>
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
      id: 'form5Status',
      header: 'Form 5 status',
      width: 120,
      minWidth: 110,
      cell: (row) => generateStatusBadge(row.latestFiling?.generateStatus),
    },
    {
      id: 'ptAmount',
      header: 'P.Tax Amount',
      width: 120,
      minWidth: 110,
      cell: (row) => (
        <span className="tabular-nums">
          {formatPtAmount(row.latestFiling?.ptAmount)}
        </span>
      ),
    },
    {
      id: 'whatsapp',
      header: '',
      className: 'text-right',
      width: 52,
      minWidth: 52,
      maxWidth: 52,
      cell: (row) => (
        <PermissionGate permission={PERMISSIONS.CLIENTS_SEND}>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            title="Send WhatsApp"
            aria-label={`Send WhatsApp to ${row.clientCode}`}
            onClick={() => setSendModalClient(row)}
          >
            <MessageCircle className="size-4" />
          </Button>
        </PermissionGate>
      ),
    },
    {
      id: 'actions',
      header: '',
      className: 'text-right',
      width: 84,
      minWidth: 84,
      maxWidth: 84,
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <PermissionGate permission={PERMISSIONS.CLIENTS_EDIT}>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              title="Edit"
              aria-label={`Edit ${row.clientCode}`}
              onClick={() => {
                setDrawerMode('edit');
                setEditingClient(row);
                setDrawerOpen(true);
              }}
            >
              <Pencil className="size-4" />
            </Button>
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.CLIENTS_DELETE}>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              title="Delete"
              aria-label={`Delete ${row.clientCode}`}
              className="text-destructive hover:text-destructive"
              onClick={() => setPendingDelete(row)}
            >
              <Trash2 className="size-4" />
            </Button>
          </PermissionGate>
        </div>
      ),
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
          {
            key: 'generateStatus',
            label: 'Form 5 status',
            type: 'buttonGroup',
            options: [
              { label: 'Pending', value: 'pending' },
              { label: 'Generated', value: 'generated' },
              { label: 'Failed', value: 'failed' },
            ],
            placeholder: 'Any',
          },
        ]}
        values={filters}
        onChange={setFilters}
        onApply={(values) => {
          setPage(1);
          setAppliedFilters(values);
        }}
        onReset={() => {
          setFilters(emptyFilters);
          setAppliedFilters(emptyFilters);
          setSearchInput('');
          setSearch('');
          setPage(1);
        }}
        headerActions={
          <>
            <Button
              type="button"
              size="sm"
              variant={recentlyAdded ? 'primary' : 'outline'}
              aria-pressed={recentlyAdded}
              onClick={() => {
                const next = {
                  ...filters,
                  recentlyAdded: recentlyAdded ? '' : 'lastSheet',
                };
                setFilters(next);
                setAppliedFilters(next);
                setPage(1);
              }}
            >
              Recently added
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              title="Refresh"
              aria-label="Refresh"
              onClick={() => void clientsQuery.refetch()}
            >
              <RefreshCw
                className={cn(
                  'size-4',
                  clientsQuery.isFetching && 'animate-spin',
                )}
              />
            </Button>
          </>
        }
      />

      <AnimatePresence initial={false}>
        {selectedIds.size > 0 ? (
          <motion.div
            key="selection-toolbar"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="shrink-0 overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-2 pb-3">
              <p className="text-sm text-muted-foreground">
                {selectedIds.size} selected.
              </p>
              <PermissionGate permission={PERMISSIONS.CLIENTS_SEND}>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  leftIcon={<MessageCircle className="size-4" />}
                  onClick={() => setPreviewOpen(true)}
                >
                  Preview ({selectedIds.size})
                </Button>
              </PermissionGate>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear selection
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="min-h-0 flex-1">
        <DataTable
          className="h-full"
          gridMaxHeight="100%"
          columns={columns}
          data={clients}
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
          isRowExpanded={
            canViewEmployees
              ? (row) => row.id === expandedClientId
              : undefined
          }
          onRowDoubleClick={
            canViewEmployees
              ? (row) =>
                  setExpandedClientId((current) =>
                    current === row.id ? null : row.id,
                  )
              : undefined
          }
          renderExpandedRow={
            canViewEmployees
              ? (row) => (
                  <ClientEmployeesPanel
                    client={row}
                    onClose={() => setExpandedClientId(null)}
                  />
                )
              : undefined
          }
        />
      </div>

      <ClientFormModal
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

      {sendModalClient ? (
        <SendClientWhatsAppModal
          open={Boolean(sendModalClient)}
          onOpenChange={(open) => {
            if (!open) setSendModalClient(null);
          }}
          client={sendModalClient}
          onHandoffToForm5={(filing, templateId) => {
            setSendModalClient(null);
            setForm5Handoff({ filing, templateId });
          }}
        />
      ) : null}

      {form5Handoff ? (
        <SendWhatsAppTemplateModal
          open={Boolean(form5Handoff)}
          onOpenChange={(open) => {
            if (!open) setForm5Handoff(null);
          }}
          filing={form5Handoff.filing}
          initialTemplateId={form5Handoff.templateId}
          onSent={() => {
            setForm5Handoff(null);
            void clientsQuery.refetch();
          }}
        />
      ) : null}

      <ClientsWhatsAppPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        clients={selectedClients}
        onSent={() => setSelectedIds(new Set())}
      />
    </div>
  );
}
