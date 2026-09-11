import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { filingsApi } from '@/api/filings.api';
import { clientsApi } from '@/api/clients.api';
import { Button } from '@/components/buttons';
import { Badge } from '@/components/common/Badge';
import { PermissionGate } from '@/components/common/PermissionGate';
import { Modal } from '@/components/dialogs/Modal';
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
import {
  useClientOptionsQuery,
  useLocationsQuery,
  useUpdateClientMutation,
} from '@/hooks/useClients';
import {
  filingsQueryKeys,
  useFilingsQuery,
  useSendFilingWhatsAppMutation,
} from '@/hooks/useFilings';
import { usePermission } from '@/hooks/usePermission';
import { PATHS } from '@/routes/paths';
import type { Filing, ListFilingsParams } from '@/types/filing.types';
import { getApiErrorMessage } from '@/utils/apiError';
import { toastError, toastSuccess } from '@/utils/toast';

const previousMonth = () => {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const emptyFilters: FilterValues = {
  locationIds: [],
  clientIds: [],
  recentlyAdded: '',
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN');
};

type MobileNumberFieldProps = {
  clientId: string;
  /** Canonical draft from parent ref (stable across remounts via syncKey). */
  draftValue: string;
  savedValue: string;
  disabled?: boolean;
  showSave?: boolean;
  saving?: boolean;
  onDraftChange: (clientId: string, value: string) => void;
  onSave?: (clientId: string, value: string) => void | Promise<void>;
  compact?: boolean;
};

/**
 * Local-state phone input so AG Grid / parent re-renders do not steal focus
 * after each character. Drafts sync to the parent via callback (ref-backed).
 */
function MobileNumberField({
  clientId,
  draftValue,
  savedValue,
  disabled,
  showSave,
  saving,
  onDraftChange,
  onSave,
  compact,
}: MobileNumberFieldProps) {
  const [value, setValue] = useState(draftValue);
  const dirty = value.trim() !== savedValue.trim();

  useEffect(() => {
    setValue(draftValue);
  }, [clientId, draftValue]);

  return (
    <div className={`flex items-center gap-2 ${compact ? 'min-w-0' : 'min-w-[12rem]'}`}>
      <Input
        value={value}
        disabled={disabled}
        placeholder="10-digit mobile"
        onChange={(event) => {
          const next = event.target.value;
          setValue(next);
          onDraftChange(clientId, next);
        }}
        className="h-8"
      />
      {showSave && onSave ? (
        <PermissionGate permission={PERMISSIONS.CLIENTS_EDIT}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || !dirty || saving}
            loading={saving}
            onClick={() => void onSave(clientId, value.trim())}
          >
            Save
          </Button>
        </PermissionGate>
      ) : null}
    </div>
  );
}

/**
 * List generated Form 5 PDFs, edit client mobile numbers, and send via MSG91 WhatsApp.
 */
export function Form5WhatsAppPage() {
  const { hasPermission } = usePermission();
  const queryClient = useQueryClient();
  const canEditClient = hasPermission(PERMISSIONS.CLIENTS_EDIT);
  const canSend = hasPermission(PERMISSIONS.FILINGS_SEND);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState(previousMonth);
  const [filters, setFilters] = useState<FilterValues>(emptyFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<FilterValues>(emptyFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<DataTablePageSizeOption>(
    DEFAULT_DATA_TABLE_PAGE_SIZE,
  );
  const [sort, setSort] = useState<DataTableSort>({
    sortBy: 'clientCode',
    sortOrder: 'asc',
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [savingClientId, setSavingClientId] = useState<string | null>(null);
  const [savingAllPhones, setSavingAllPhones] = useState(false);
  const [sendingFilingId, setSendingFilingId] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  /** Bumps when drafts should remount inputs (after save / external sync). */
  const [phoneSyncKey, setPhoneSyncKey] = useState(0);

  const phoneDraftsRef = useRef<Record<string, string>>({});

  const locationIds = filterIds(appliedFilters.locationIds);
  const clientIds = filterIds(appliedFilters.clientIds);
  const recentlyAdded = appliedFilters.recentlyAdded === 'lastSheet';

  const params: ListFilingsParams = {
    page,
    limit: resolveDataTableLimit(pageSize),
    search: search || undefined,
    period: period || undefined,
    locationIds: locationIds.length ? locationIds : undefined,
    clientIds: clientIds.length ? clientIds : undefined,
    recentlyAdded: recentlyAdded || undefined,
    generateStatus: 'generated',
    sortBy: sort.sortBy as ListFilingsParams['sortBy'],
    sortOrder: sort.sortOrder,
  };

  const filingsQuery = useFilingsQuery(params, {
    enabled: hasPermission(PERMISSIONS.FILINGS_VIEW),
  });
  const locationsQuery = useLocationsQuery({
    enabled: hasPermission(PERMISSIONS.FILINGS_VIEW),
  });
  const clientsQuery = useClientOptionsQuery({
    enabled: hasPermission(PERMISSIONS.FILINGS_VIEW),
  });
  const updateClientMutation = useUpdateClientMutation();
  const sendWhatsAppMutation = useSendFilingWhatsAppMutation();

  const rows = filingsQuery.data?.filings ?? [];

  useEffect(() => {
    for (const row of rows) {
      const key = row.client?.id;
      if (!key) continue;
      if (phoneDraftsRef.current[key] === undefined) {
        phoneDraftsRef.current[key] = row.client?.contactNumber ?? '';
      }
    }
  }, [rows]);

  const getDraftPhone = useCallback((clientKey: string, fallback = '') => {
    return phoneDraftsRef.current[clientKey] ?? fallback;
  }, []);

  const handleDraftChange = useCallback((clientKey: string, value: string) => {
    phoneDraftsRef.current[clientKey] = value;
  }, []);

  const handleSavePhone = useCallback(
    async (clientKey: string, value: string) => {
      if (!canEditClient) return;
      setSavingClientId(clientKey);
      try {
        await updateClientMutation.mutateAsync({
          id: clientKey,
          payload: { contactNumber: value || null },
        });
        phoneDraftsRef.current[clientKey] = value;
        setPhoneSyncKey((key) => key + 1);
      } finally {
        setSavingClientId(null);
      }
    },
    [canEditClient, updateClientMutation],
  );

  const collectDirtyPhones = useCallback(
    (list: Filing[]) => {
      const byClient = new Map<
        string,
        { phone: string; saved: string; clientCode: string }
      >();
      for (const row of list) {
        const clientKey = row.client?.id;
        if (!clientKey || byClient.has(clientKey)) continue;
        const saved = row.client?.contactNumber ?? '';
        const phone = getDraftPhone(clientKey, saved).trim();
        if (phone === saved.trim()) continue;
        byClient.set(clientKey, {
          phone,
          saved,
          clientCode: row.clientCode,
        });
      }
      return [...byClient.entries()];
    },
    [getDraftPhone],
  );

  const handleSaveAllPhones = async (list: Filing[] = rows) => {
    if (!canEditClient) return;
    const dirty = collectDirtyPhones(list);
    if (dirty.length === 0) {
      toastSuccess('No mobile number changes to save');
      return;
    }

    setSavingAllPhones(true);
    let savedCount = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      for (const [clientKey, item] of dirty) {
        try {
          await clientsApi.update(clientKey, {
            contactNumber: item.phone || null,
          });
          phoneDraftsRef.current[clientKey] = item.phone;
          savedCount += 1;
        } catch (error) {
          failed += 1;
          errors.push(
            `${item.clientCode}: ${getApiErrorMessage(error, 'Save failed')}`,
          );
        }
      }

      void queryClient.invalidateQueries({ queryKey: ['clients'] });
      void queryClient.invalidateQueries({ queryKey: filingsQueryKeys.all });
      setPhoneSyncKey((key) => key + 1);

      if (failed === 0) {
        toastSuccess(`Saved ${savedCount} mobile number(s)`);
      } else if (savedCount > 0) {
        toastSuccess(`Saved ${savedCount}. Failed ${failed}.`);
        toastError(errors.slice(0, 3).join(' · '));
      } else {
        toastError(errors[0] || 'Could not save mobile numbers');
      }
    } finally {
      setSavingAllPhones(false);
    }
  };

  const handleSend = async (row: Filing) => {
    if (!canSend) return;
    const clientKey = row.client?.id;
    const phone = (
      clientKey
        ? getDraftPhone(clientKey, row.client?.contactNumber ?? '')
        : ''
    ).trim();
    setSendingFilingId(row.id);
    try {
      await sendWhatsAppMutation.mutateAsync({
        id: row.id,
        payload: {
          phone: phone || undefined,
          savePhone: Boolean(phone && clientKey),
        },
      });
      if (clientKey && phone) {
        phoneDraftsRef.current[clientKey] = phone;
        setPhoneSyncKey((key) => key + 1);
      }
    } finally {
      setSendingFilingId(null);
    }
  };

  const pageIds = rows.map((row) => row.id);
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

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.has(row.id)),
    [rows, selectedIds],
  );

  const locationOptions = (locationsQuery.data ?? []).map((location) => ({
    label: location.name,
    value: location.id,
  }));
  const clientOptions = (clientsQuery.data?.clients ?? []).map((client) => ({
    label: `${client.clientCode} · ${client.companyName}`,
    value: client.id,
  }));

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
        width: 52,
        minWidth: 52,
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
        id: 'period',
        header: 'Period',
        sortable: true,
        cell: (row) => row.periodLabel || row.period,
      },
      {
        id: 'file',
        header: 'Generated file',
        cell: (row) => (
          <div className="min-w-0 space-y-0.5">
            <p
              className="truncate text-sm"
              title={row.generatedFile?.filename ?? ''}
            >
              {row.generatedFile?.filename ?? '—'}
            </p>
            <Badge variant="success">Generated</Badge>
          </div>
        ),
      },
      {
        id: 'sentDate',
        header: 'Last sent',
        cell: (row) => (
          <div className="space-y-0.5">
            <p>{formatDate(row.sentDate)}</p>
            <p className="text-xs text-muted-foreground">
              {row.mailStatus || '—'}
            </p>
          </div>
        ),
      },
      {
        id: 'phone',
        header: 'Mobile number',
        width: 260,
        minWidth: 220,
        cell: (row) => {
          const clientKey = row.client?.id;
          if (!clientKey) return '—';
          const saved = row.client?.contactNumber ?? '';
          return (
            <MobileNumberField
              key={`${clientKey}-${phoneSyncKey}`}
              clientId={clientKey}
              draftValue={getDraftPhone(clientKey, saved)}
              savedValue={saved}
              disabled={!canEditClient}
              showSave
              saving={savingClientId === clientKey}
              onDraftChange={handleDraftChange}
              onSave={handleSavePhone}
            />
          );
        },
      },
      {
        id: 'actions',
        header: '',
        className: 'text-right',
        width: 160,
        minWidth: 140,
        cell: (row) => (
          <PermissionGate permission={PERMISSIONS.FILINGS_SEND}>
            <Button
              type="button"
              size="sm"
              disabled={
                !row.generatedFile ||
                sendingFilingId === row.id ||
                bulkSending ||
                sendWhatsAppMutation.isPending
              }
              loading={sendingFilingId === row.id}
              onClick={() => void handleSend(row)}
            >
              Send WhatsApp
            </Button>
          </PermissionGate>
        ),
      },
    ],
    [
      allPageSelected,
      somePageSelected,
      selectedIds,
      canEditClient,
      phoneSyncKey,
      savingClientId,
      sendingFilingId,
      bulkSending,
      sendWhatsAppMutation.isPending,
      getDraftPhone,
      handleDraftChange,
      handleSavePhone,
    ],
  );

  const handleBulkSend = async () => {
    if (!canSend || selectedRows.length === 0) return;
    setBulkSending(true);
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      // Persist any edited numbers first, then send each selected filing.
      const dirty = collectDirtyPhones(selectedRows);
      for (const [clientKey, item] of dirty) {
        try {
          await clientsApi.update(clientKey, {
            contactNumber: item.phone || null,
          });
          phoneDraftsRef.current[clientKey] = item.phone;
        } catch (error) {
          failed += 1;
          errors.push(
            `${item.clientCode}: ${getApiErrorMessage(error, 'Save failed')}`,
          );
        }
      }

      for (const row of selectedRows) {
        const clientKey = row.client?.id;
        const phone = (
          clientKey
            ? getDraftPhone(clientKey, row.client?.contactNumber ?? '')
            : ''
        ).trim();

        try {
          await filingsApi.sendWhatsApp(row.id, {
            phone: phone || undefined,
            savePhone: Boolean(phone && clientKey),
          });
          if (clientKey && phone) {
            phoneDraftsRef.current[clientKey] = phone;
          }
          sent += 1;
        } catch (error) {
          failed += 1;
          errors.push(
            `${row.clientCode}: ${getApiErrorMessage(error, 'Send failed')}`,
          );
        }
      }

      void queryClient.invalidateQueries({ queryKey: filingsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['clients'] });
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-sends'] });
      setPhoneSyncKey((key) => key + 1);

      if (failed === 0) {
        toastSuccess(`Saved & sent WhatsApp for ${sent} client(s)`);
        setPreviewOpen(false);
        setSelectedIds(new Set());
      } else if (sent > 0) {
        toastSuccess(`Sent ${sent}. Failed ${failed}.`);
        toastError(errors.slice(0, 3).join(' · '));
      } else {
        toastError(errors[0] || 'Could not save & send WhatsApp messages');
      }
    } finally {
      setBulkSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Form 5 WhatsApp"
        description="Send generated Form 5 PDFs on WhatsApp using your approved MSG91 template. Numbers are stored on the client master."
        breadcrumbs={[
          { label: 'Home', href: PATHS.home },
          { label: 'Form 5', href: PATHS.form5 },
          { label: 'WhatsApp' },
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
        title="Filters"
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
        headerActions={
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
              setSelectedIds(new Set());
            }}
          >
            Recently added
          </Button>
        }
        footer={
          <>
            <PermissionGate permission={PERMISSIONS.CLIENTS_EDIT}>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={rows.length === 0 || savingAllPhones || bulkSending}
                loading={savingAllPhones}
                onClick={() => void handleSaveAllPhones(rows)}
              >
                Save all
              </Button>
            </PermissionGate>
            <Button
              type="button"
              size="sm"
              disabled={selectedIds.size === 0 || bulkSending}
              onClick={() => setPreviewOpen(true)}
            >
              Preview ({selectedIds.size})
            </Button>
          </>
        }
      />

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
        emptyTitle="No generated Form 5 files"
        emptyDescription="Generate Form 5 PDFs on the Form 5 page first, then return here to send them on WhatsApp."
        className="min-w-0"
      />

      <Modal
        open={previewOpen}
        onOpenChange={(open) => {
          if (!bulkSending) setPreviewOpen(open);
        }}
        title="WhatsApp send preview"
        description="Review clients and mobile numbers, then save changes and send all selected messages."
        className="max-w-3xl"
        closeOnOverlayClick={!bulkSending}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={bulkSending}
              onClick={() => setPreviewOpen(false)}
            >
              Cancel
            </Button>
            <PermissionGate permission={PERMISSIONS.FILINGS_SEND}>
              <Button
                type="button"
                disabled={selectedRows.length === 0 || bulkSending}
                loading={bulkSending}
                onClick={() => void handleBulkSend()}
              >
                Save & send all ({selectedRows.length})
              </Button>
            </PermissionGate>
          </>
        }
      >
        {selectedRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No rows selected. Close this dialog and select filings first.
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Client</th>
                  <th className="px-2 py-2 font-medium">Month</th>
                  <th className="px-2 py-2 font-medium">Mobile number</th>
                </tr>
              </thead>
              <tbody>
                {selectedRows.map((row) => {
                  const clientKey = row.client?.id;
                  const saved = row.client?.contactNumber ?? '';
                  const company =
                    row.client?.companyName || row.clientCode || '—';
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-border/70 align-middle"
                    >
                      <td className="px-2 py-2">
                        <p className="font-medium">{company}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.clientCode}
                        </p>
                      </td>
                      <td className="px-2 py-2">
                        {row.periodLabel || row.period}
                      </td>
                      <td className="px-2 py-2">
                        {clientKey ? (
                          <MobileNumberField
                            key={`${clientKey}-preview-${phoneSyncKey}`}
                            clientId={clientKey}
                            draftValue={getDraftPhone(clientKey, saved)}
                            savedValue={saved}
                            disabled={!canEditClient || bulkSending}
                            showSave={canEditClient}
                            saving={savingClientId === clientKey}
                            onDraftChange={handleDraftChange}
                            onSave={handleSavePhone}
                            compact
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
