import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { filingsApi } from '@/api/filings.api';
import { clientsApi } from '@/api/clients.api';
import { Button } from '@/components/buttons';
import { Badge } from '@/components/common/Badge';
import { PermissionGate } from '@/components/common/PermissionGate';
import { Modal } from '@/components/dialogs/Modal';
import { FilterPanel, filterIds, locationOptionsFromClients, type FilterValues } from '@/components/forms/FilterPanel';
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
import { useClientOptionsQuery } from '@/hooks/useClients';
import {
  filingsQueryKeys,
  useFilingsQuery,
  useSendFilingWhatsAppMutation,
} from '@/hooks/useFilings';
import { usePermission } from '@/hooks/usePermission';
import { PATHS } from '@/routes/paths';
import { cn } from '@/lib/utils';
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

/** Matches MSG91 WhatsApp phone rules: 10-digit mobile, optional 91 / leading zeros. */
const isValidWhatsAppMobile = (input: string) => {
  let digits = String(input ?? '').replace(/\D/g, '');
  if (!digits) return false;
  digits = digits.replace(/^0+/, '');
  if (!digits) return false;
  if (!digits.startsWith('91')) digits = `91${digits}`;
  return digits.length >= 12;
};

const fieldHighlightClassName =
  'border-amber-500 bg-amber-50 ring-2 ring-amber-400/70 placeholder:text-amber-800/80 dark:bg-amber-950/50 dark:placeholder:text-amber-200/70';

type WhatsAppDraftFieldProps = {
  clientId: string;
  draftValue: string;
  placeholder: string;
  kind?: 'phone' | 'text';
  disabled?: boolean;
  onDraftChange: (clientId: string, value: string) => void;
  onCommit: (clientId: string) => void;
};

/**
 * Compact local-state input so grid remounts do not steal focus after each character.
 * Empty fields, and invalid mobile numbers, are highlighted. Values persist on pause / blur.
 */
function WhatsAppDraftField({
  clientId,
  draftValue,
  placeholder,
  kind = 'text',
  disabled,
  onDraftChange,
  onCommit,
}: WhatsAppDraftFieldProps) {
  const [value, setValue] = useState(draftValue);
  const trimmed = value.trim();
  const missing = !trimmed;
  const invalidPhone =
    kind === 'phone' && trimmed.length > 0 && !isValidWhatsAppMobile(trimmed);
  const highlighted = missing || invalidPhone;

  useEffect(() => {
    setValue(draftValue);
  }, [clientId, draftValue]);

  return (
    <Input
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      title={
        invalidPhone
          ? 'This does not look like a valid 10-digit mobile number'
          : missing
            ? 'This field is empty'
            : undefined
      }
      onChange={(event) => {
        const next = event.target.value;
        setValue(next);
        onDraftChange(clientId, next);
      }}
      onBlur={() => onCommit(clientId)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          (event.target as HTMLInputElement).blur();
        }
      }}
      containerClassName="space-y-0"
      className={cn(
        'h-7 w-32 max-w-full px-2 py-0 text-xs',
        highlighted && fieldHighlightClassName,
      )}
      aria-label={placeholder}
    />
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
  const [sendingFilingId, setSendingFilingId] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  /** Bumps when drafts should remount inputs (after send / external sync). */
  const [contactSyncKey, setContactSyncKey] = useState(0);

  const phoneDraftsRef = useRef<Record<string, string>>({});
  const recipientDraftsRef = useRef<Record<string, string>>({});
  const persistedPhoneRef = useRef<Record<string, string>>({});
  const persistedNameRef = useRef<Record<string, string>>({});
  const persistTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );
  const persistQueueRef = useRef<Record<string, Promise<void>>>({});

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
  const clientsQuery = useClientOptionsQuery({
    enabled: hasPermission(PERMISSIONS.FILINGS_VIEW),
  });
  const sendWhatsAppMutation = useSendFilingWhatsAppMutation();

  const rows = filingsQuery.data?.filings ?? [];

  useEffect(() => {
    for (const row of rows) {
      const key = row.client?.id;
      if (!key) continue;
      const serverPhone = row.client?.contactNumber ?? '';
      const serverName = row.client?.recipientName ?? '';
      if (phoneDraftsRef.current[key] === undefined) {
        phoneDraftsRef.current[key] = serverPhone;
      }
      if (recipientDraftsRef.current[key] === undefined) {
        recipientDraftsRef.current[key] = serverName;
      }
      if (persistedPhoneRef.current[key] === undefined) {
        persistedPhoneRef.current[key] = serverPhone;
      }
      if (persistedNameRef.current[key] === undefined) {
        persistedNameRef.current[key] = serverName;
      }
    }
  }, [rows]);

  const getDraftPhone = useCallback((clientKey: string, fallback = '') => {
    return phoneDraftsRef.current[clientKey] ?? fallback;
  }, []);

  const getDraftRecipient = useCallback((clientKey: string, fallback = '') => {
    return recipientDraftsRef.current[clientKey] ?? fallback;
  }, []);

  const persistClientContacts = useCallback(
    async (clientKey: string) => {
      if (!canEditClient) return;
      const phone = (phoneDraftsRef.current[clientKey] ?? '').trim();
      const recipientName = (recipientDraftsRef.current[clientKey] ?? '').trim();
      const savedPhone = (persistedPhoneRef.current[clientKey] ?? '').trim();
      const savedName = (persistedNameRef.current[clientKey] ?? '').trim();
      const payload: {
        contactNumber?: string | null;
        recipientName?: string | null;
      } = {};
      if (phone !== savedPhone) payload.contactNumber = phone || null;
      if (recipientName !== savedName) {
        payload.recipientName = recipientName || null;
      }
      if (Object.keys(payload).length === 0) return;

      try {
        await clientsApi.update(clientKey, payload);
        if (payload.contactNumber !== undefined) {
          persistedPhoneRef.current[clientKey] = phone;
          phoneDraftsRef.current[clientKey] = phone;
        }
        if (payload.recipientName !== undefined) {
          persistedNameRef.current[clientKey] = recipientName;
          recipientDraftsRef.current[clientKey] = recipientName;
        }
        void queryClient.invalidateQueries({ queryKey: ['clients'] });
      } catch (error) {
        toastError(getApiErrorMessage(error, 'Could not save contact'));
      }
    },
    [canEditClient, queryClient],
  );

  const persistClientContactsRef = useRef(persistClientContacts);
  persistClientContactsRef.current = persistClientContacts;

  const queuePersist = useCallback((clientKey: string) => {
    const previous = persistQueueRef.current[clientKey] ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(() => persistClientContactsRef.current(clientKey));
    persistQueueRef.current[clientKey] = next;
    return next;
  }, []);

  const schedulePersist = useCallback(
    (clientKey: string) => {
      if (!canEditClient) return;
      const timers = persistTimersRef.current;
      if (timers[clientKey]) clearTimeout(timers[clientKey]);
      timers[clientKey] = setTimeout(() => {
        delete persistTimersRef.current[clientKey];
        void queuePersist(clientKey);
      }, 500);
    },
    [canEditClient, queuePersist],
  );

  const commitPersist = useCallback(
    (clientKey: string) => {
      if (!canEditClient) return;
      if (persistTimersRef.current[clientKey]) {
        clearTimeout(persistTimersRef.current[clientKey]);
        delete persistTimersRef.current[clientKey];
      }
      void queuePersist(clientKey);
    },
    [canEditClient, queuePersist],
  );

  useEffect(() => {
    return () => {
      for (const [clientKey, timer] of Object.entries(persistTimersRef.current)) {
        clearTimeout(timer);
        void persistClientContactsRef.current(clientKey);
      }
    };
  }, []);

  const handlePhoneDraftChange = useCallback(
    (clientKey: string, value: string) => {
      phoneDraftsRef.current[clientKey] = value;
      schedulePersist(clientKey);
    },
    [schedulePersist],
  );

  const handleRecipientDraftChange = useCallback(
    (clientKey: string, value: string) => {
      recipientDraftsRef.current[clientKey] = value;
      schedulePersist(clientKey);
    },
    [schedulePersist],
  );

  const collectDirtyContacts = useCallback(
    (list: Filing[]) => {
      const byClient = new Map<
        string,
        {
          payload: {
            contactNumber?: string | null;
            recipientName?: string | null;
          };
          clientCode: string;
        }
      >();
      for (const row of list) {
        const clientKey = row.client?.id;
        if (!clientKey || byClient.has(clientKey)) continue;
        const savedPhone =
          persistedPhoneRef.current[clientKey] ??
          row.client?.contactNumber ??
          '';
        const savedName =
          persistedNameRef.current[clientKey] ??
          row.client?.recipientName ??
          '';
        const phone = getDraftPhone(clientKey, savedPhone).trim();
        const recipientName = getDraftRecipient(clientKey, savedName).trim();
        const payload: {
          contactNumber?: string | null;
          recipientName?: string | null;
        } = {};
        if (phone !== savedPhone.trim()) payload.contactNumber = phone || null;
        if (recipientName !== savedName.trim()) {
          payload.recipientName = recipientName || null;
        }
        if (Object.keys(payload).length === 0) continue;
        byClient.set(clientKey, {
          payload,
          clientCode: row.clientCode,
        });
      }
      return [...byClient.entries()];
    },
    [getDraftPhone, getDraftRecipient],
  );

  const rowContactState = useCallback(
    (row: Filing) => {
      const clientKey = row.client?.id;
      const savedPhone = row.client?.contactNumber ?? '';
      const savedName = row.client?.recipientName ?? '';
      const phone = (
        clientKey ? getDraftPhone(clientKey, savedPhone) : ''
      ).trim();
      const recipientName = (
        clientKey ? getDraftRecipient(clientKey, savedName) : ''
      ).trim();
      return {
        clientKey,
        savedPhone,
        savedName,
        phone,
        recipientName,
        missingPhone: !phone,
        missingRecipient: !recipientName,
        incomplete: !phone || !recipientName,
      };
    },
    [getDraftPhone, getDraftRecipient],
  );

  const handleSend = async (row: Filing) => {
    if (!canSend) return;
    const contact = rowContactState(row);
    if (contact.incomplete) {
      toastError('Add a recipient name and mobile number before sending.');
      return;
    }
    if (contact.clientKey) {
      commitPersist(contact.clientKey);
      await persistQueueRef.current[contact.clientKey];
    }
    setSendingFilingId(row.id);
    try {
      await sendWhatsAppMutation.mutateAsync({
        id: row.id,
        payload: {
          phone: contact.phone || undefined,
          savePhone: Boolean(contact.phone && contact.clientKey),
          recipientName: contact.recipientName || undefined,
          saveRecipientName: Boolean(contact.recipientName && contact.clientKey),
        },
      });
      if (contact.clientKey) {
        phoneDraftsRef.current[contact.clientKey] = contact.phone;
        recipientDraftsRef.current[contact.clientKey] = contact.recipientName;
        persistedPhoneRef.current[contact.clientKey] = contact.phone;
        persistedNameRef.current[contact.clientKey] = contact.recipientName;
        setContactSyncKey((key) => key + 1);
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

  const incompleteCount = useMemo(
    () =>
      rows.filter((row) => {
        const contact = rowContactState(row);
        const invalidPhone =
          contact.phone.length > 0 && !isValidWhatsAppMobile(contact.phone);
        return contact.incomplete || invalidPhone;
      }).length,
    [rows, rowContactState, contactSyncKey],
  );

  const locationOptions = locationOptionsFromClients(
    clientsQuery.data?.clients,
  );
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
        width: 148,
        minWidth: 136,
        cell: (row) => {
          const contact = rowContactState(row);
          if (!contact.clientKey) return '—';
          return (
            <WhatsAppDraftField
              key={`${contact.clientKey}-phone-${contactSyncKey}`}
              clientId={contact.clientKey}
              draftValue={getDraftPhone(contact.clientKey, contact.savedPhone)}
              placeholder="10-digit mobile"
              kind="phone"
              disabled={!canEditClient}
              onDraftChange={handlePhoneDraftChange}
              onCommit={commitPersist}
            />
          );
        },
      },
      {
        id: 'recipientName',
        header: 'Recipient name',
        width: 148,
        minWidth: 136,
        cell: (row) => {
          const contact = rowContactState(row);
          if (!contact.clientKey) return '—';
          return (
            <WhatsAppDraftField
              key={`${contact.clientKey}-name-${contactSyncKey}`}
              clientId={contact.clientKey}
              draftValue={getDraftRecipient(
                contact.clientKey,
                contact.savedName,
              )}
              placeholder="Person who receives this"
              disabled={!canEditClient}
              onDraftChange={handleRecipientDraftChange}
              onCommit={commitPersist}
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
      contactSyncKey,
      sendingFilingId,
      bulkSending,
      sendWhatsAppMutation.isPending,
      getDraftPhone,
      getDraftRecipient,
      handlePhoneDraftChange,
      handleRecipientDraftChange,
      commitPersist,
      rowContactState,
    ],
  );

  const handleBulkSend = async () => {
    if (!canSend || selectedRows.length === 0) return;
    setBulkSending(true);
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      const pendingClients = new Set<string>();
      for (const row of selectedRows) {
        const clientKey = row.client?.id;
        if (clientKey) pendingClients.add(clientKey);
      }
      await Promise.all(
        [...pendingClients].map((clientKey) => {
          commitPersist(clientKey);
          return persistQueueRef.current[clientKey] ?? Promise.resolve();
        }),
      );

      // Persist any remaining dirty drafts, then send each selected filing.
      const dirty = collectDirtyContacts(selectedRows);
      for (const [clientKey, item] of dirty) {
        try {
          await clientsApi.update(clientKey, item.payload);
          if (item.payload.contactNumber !== undefined) {
            phoneDraftsRef.current[clientKey] = item.payload.contactNumber ?? '';
            persistedPhoneRef.current[clientKey] =
              item.payload.contactNumber ?? '';
          }
          if (item.payload.recipientName !== undefined) {
            recipientDraftsRef.current[clientKey] =
              item.payload.recipientName ?? '';
            persistedNameRef.current[clientKey] =
              item.payload.recipientName ?? '';
          }
        } catch (error) {
          failed += 1;
          errors.push(
            `${item.clientCode}: ${getApiErrorMessage(error, 'Save failed')}`,
          );
        }
      }

      for (const row of selectedRows) {
        const contact = rowContactState(row);
        if (contact.incomplete) {
          failed += 1;
          errors.push(
            `${row.clientCode}: Add a recipient name and mobile number`,
          );
          continue;
        }

        try {
          await filingsApi.sendWhatsApp(row.id, {
            phone: contact.phone || undefined,
            savePhone: Boolean(contact.phone && contact.clientKey),
            recipientName: contact.recipientName || undefined,
            saveRecipientName: Boolean(
              contact.recipientName && contact.clientKey,
            ),
          });
          if (contact.clientKey) {
            phoneDraftsRef.current[contact.clientKey] = contact.phone;
            recipientDraftsRef.current[contact.clientKey] =
              contact.recipientName;
            persistedPhoneRef.current[contact.clientKey] = contact.phone;
            persistedNameRef.current[contact.clientKey] = contact.recipientName;
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
      setContactSyncKey((key) => key + 1);

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
        description="Send generated Form 5 PDFs on WhatsApp using your approved MSG91 template. Recipient name and mobile number are stored on the client master."
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
                setSelectedIds(new Set());
              }}
            >
              Recently added
            </Button>
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

      {incompleteCount > 0 ? (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
        >
          {incompleteCount} client{incompleteCount === 1 ? '' : 's'} on this
          page {incompleteCount === 1 ? 'is' : 'are'} missing a recipient name
          or a valid mobile number. Highlighted fields need to be filled before
          send.
        </div>
      ) : null}

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
          if (!bulkSending) {
            setPreviewOpen(open);
            if (!open) setContactSyncKey((key) => key + 1);
          }
        }}
        title="WhatsApp send preview"
        description="Review recipient names and mobile numbers, then send all selected messages. Empty fields are highlighted and saved as you type."
        className="max-w-5xl"
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
                Send all ({selectedRows.length})
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
            <table className="w-full min-w-[48rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Client</th>
                  <th className="px-2 py-2 font-medium">Month</th>
                  <th className="px-2 py-2 font-medium">Mobile number</th>
                  <th className="px-2 py-2 font-medium">Recipient name</th>
                </tr>
              </thead>
              <tbody>
                {selectedRows.map((row) => {
                  const contact = rowContactState(row);
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
                        {contact.clientKey ? (
                          <WhatsAppDraftField
                            key={`${contact.clientKey}-preview-phone-${contactSyncKey}`}
                            clientId={contact.clientKey}
                            draftValue={getDraftPhone(
                              contact.clientKey,
                              contact.savedPhone,
                            )}
                            placeholder="10-digit mobile"
                            kind="phone"
                            disabled={!canEditClient || bulkSending}
                            onDraftChange={handlePhoneDraftChange}
                            onCommit={commitPersist}
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {contact.clientKey ? (
                          <WhatsAppDraftField
                            key={`${contact.clientKey}-preview-name-${contactSyncKey}`}
                            clientId={contact.clientKey}
                            draftValue={getDraftRecipient(
                              contact.clientKey,
                              contact.savedName,
                            )}
                            placeholder="Person who receives this"
                            disabled={!canEditClient || bulkSending}
                            onDraftChange={handleRecipientDraftChange}
                            onCommit={commitPersist}
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
