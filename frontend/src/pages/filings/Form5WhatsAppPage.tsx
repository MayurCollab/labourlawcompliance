import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { filingsApi } from '@/api/filings.api';
import { clientsApi } from '@/api/clients.api';
import { Button } from '@/components/buttons';
import { Badge } from '@/components/common/Badge';
import { PermissionGate } from '@/components/common/PermissionGate';
import { WhatsAppDraftField } from '@/components/common/WhatsAppDraftField';
import { confirmDialog } from '@/components/dialogs/ConfirmDialog';
import { Modal } from '@/components/dialogs/Modal';
import {
  FilterPanel,
  filterIds,
  locationOptionsFromClients,
  type FilterValues,
} from '@/components/forms/FilterPanel';
import { SearchBox } from '@/components/forms/SearchBox';
import { Checkbox } from '@/components/inputs/Checkbox';
import { Input } from '@/components/inputs/Input';
import { Select } from '@/components/inputs/Select';
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
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { filingsQueryKeys, useFilingsQuery } from '@/hooks/useFilings';
import { usePermission } from '@/hooks/usePermission';
import { useWhatsAppTemplatesQuery } from '@/hooks/useWhatsAppTemplates';
import { SendWhatsAppTemplateModal } from '@/pages/filings/SendWhatsAppTemplateModal';
import {
  hasAllCustomValues,
  WhatsAppCustomValueFields,
} from '@/pages/filings/WhatsAppCustomValueFields';
import { PATHS } from '@/routes/paths';
import { cn } from '@/lib/utils';
import type { Filing, ListFilingsParams } from '@/types/filing.types';
import type { WhatsAppCustomValues } from '@/types/whatsappTemplate.types';
import { collectCustomVariables } from '@/utils/whatsappTemplatePreview';
import { isValidWhatsAppMobile } from '@/utils/whatsappPhone';
import { getApiErrorMessage } from '@/utils/apiError';
import { getWhatsAppSkipReason } from '@/utils/whatsappBulkSend';
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

/** Outcome of one filing's WhatsApp send attempt, tracked for the post-send results list. */
type BulkRowStatus = 'sent' | 'failed' | 'skipped';
type BulkResultEntry = {
  filingId: string;
  row: Filing;
  status: BulkRowStatus;
  message: string;
};

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
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sendingFilingId, setSendingFilingId] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  /** Failed/skipped rows from the last bulk send, shown so they can be fixed and resent.
   *  Null while composing a send; an array (possibly empty) once a batch has completed. */
  const [bulkResults, setBulkResults] = useState<BulkResultEntry[] | null>(
    null,
  );
  const [resendingIds, setResendingIds] = useState<Set<string>>(new Set());
  const [resendingAll, setResendingAll] = useState(false);
  /** Row whose single-send modal is open (Flow A). */
  const [sendModalFiling, setSendModalFiling] = useState<Filing | null>(null);
  /** Template + custom text chosen for the bulk send (Flow B). */
  const [bulkTemplateId, setBulkTemplateId] = useState('');
  const [bulkCustomValues, setBulkCustomValues] =
    useState<WhatsAppCustomValues>({});
  /** Bumps when drafts should remount inputs (after send / external sync). */
  const [contactSyncKey, setContactSyncKey] = useState(0);

  const debouncedSearchInput = useDebouncedValue(searchInput);
  useEffect(() => {
    setSearch(debouncedSearchInput.trim());
    setPage(1);
    setSelectedIds(new Set());
  }, [debouncedSearchInput]);

  const phoneDraftsRef = useRef<Record<string, string>>({});
  const recipientDraftsRef = useRef<Record<string, string>>({});
  const persistedPhoneRef = useRef<Record<string, string>>({});
  const persistedNameRef = useRef<Record<string, string>>({});
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
  const templatesQuery = useWhatsAppTemplatesQuery({
    isActive: true,
    sortBy: 'label',
    sortOrder: 'asc',
    limit: 100,
  });

  const templates = templatesQuery.data?.templates ?? [];
  const bulkTemplate = templates.find((item) => item.id === bulkTemplateId);
  const bulkCustomVariables = collectCustomVariables(bulkTemplate?.variables);

  // This query stays mounted for the page's whole lifetime, so it won't
  // naturally refetch just because the preview modal opens later — force one
  // so a template edited elsewhere never shows here as a stale cached body.
  useEffect(() => {
    if (previewOpen) {
      void templatesQuery.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewOpen]);

  // Text typed for one template should not carry over to another.
  useEffect(() => {
    setBulkCustomValues({});
  }, [bulkTemplateId]);

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
      const recipientName = (
        recipientDraftsRef.current[clientKey] ?? ''
      ).trim();
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

  /**
   * Saves only fire on blur/Enter (see WhatsAppDraftField), never while the
   * field still has focus. An earlier debounced "save as you pause typing"
   * design could fire mid-number — e.g. after the area code, before the rest
   * — sending a half-typed value as its own write. Committing only the
   * final value keeps what's saved always complete, and halves write volume.
   */
  const commitPersist = useCallback(
    (clientKey: string) => {
      if (!canEditClient) return;
      void queuePersist(clientKey);
    },
    [canEditClient, queuePersist],
  );

  // Flush anything still unsaved (e.g. focus lost by unmounting rather than
  // a blur event) so navigating away never silently drops an edit.
  useEffect(() => {
    return () => {
      const dirtyKeys = new Set([
        ...Object.keys(phoneDraftsRef.current),
        ...Object.keys(recipientDraftsRef.current),
      ]);
      for (const clientKey of dirtyKeys) {
        void persistClientContactsRef.current(clientKey);
      }
    };
  }, []);

  const handlePhoneDraftChange = useCallback((clientKey: string, value: string) => {
    phoneDraftsRef.current[clientKey] = value;
  }, []);

  const handleRecipientDraftChange = useCallback(
    (clientKey: string, value: string) => {
      recipientDraftsRef.current[clientKey] = value;
    },
    [],
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
        // Recipient name is optional — a blank one is just skipped in the
        // message text — so it never blocks sending, only the mobile number does.
        missingRecipient: !recipientName,
        incomplete: !phone,
      };
    },
    [getDraftPhone, getDraftRecipient],
  );

  const incompleteRows = useMemo(
    () =>
      rows.filter((row) => {
        const contact = rowContactState(row);
        const invalidPhone =
          contact.phone.length > 0 && !isValidWhatsAppMobile(contact.phone);
        return contact.incomplete || invalidPhone;
      }),
    [rows, rowContactState, contactSyncKey],
  );
  const incompleteCount = incompleteRows.length;
  const displayRows = incompleteOnly ? incompleteRows : rows;

  useEffect(() => {
    setIncompleteOnly(false);
  }, [
    page,
    pageSize,
    search,
    period,
    appliedFilters,
    sort.sortBy,
    sort.sortOrder,
  ]);

  const pageIds = displayRows.map((row) => row.id);

  /**
   * Opens the single-send modal, where the operator picks the template and
   * fills in any text it leaves to the sender. Contact drafts are flushed
   * first so the modal opens with what is actually stored on the client.
   */
  const handleSend = async (row: Filing) => {
    if (!canSend) return;
    const contact = rowContactState(row);
    if (
      contact.incomplete ||
      (contact.phone.length > 0 && !isValidWhatsAppMobile(contact.phone))
    ) {
      toastError('Add a valid mobile number before sending.');
      return;
    }
    setSendingFilingId(row.id);
    try {
      if (contact.clientKey) {
        commitPersist(contact.clientKey);
        await persistQueueRef.current[contact.clientKey];
      }
      // `row` still carries whatever the last query response had — the modal
      // must open with what was actually just typed/saved, not that stale
      // client.contactNumber, or it can send to a half-entered number.
      setSendModalFiling({
        ...row,
        client: row.client
          ? {
              ...row.client,
              contactNumber: contact.phone,
              recipientName: contact.recipientName,
            }
          : row.client,
      });
    } finally {
      setSendingFilingId(null);
    }
  };

  /** After a single send lands, re-read contacts so drafts match the server. */
  const handleSingleSent = () => {
    void queryClient.invalidateQueries({ queryKey: ['clients'] });
    setContactSyncKey((key) => key + 1);
  };

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
    () => displayRows.filter((row) => selectedIds.has(row.id)),
    [displayRows, selectedIds],
  );

  /** Selected rows missing a recipient name, or a valid mobile number — used
   *  for the "Total N, missing recipient name X, missing mobile numbers Y"
   *  summary in the send preview, and to bring those rows to the top when
   *  the summary is clicked. */
  const selectedMissingIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of selectedRows) {
      const contact = rowContactState(row);
      const invalidPhone = !contact.phone || !isValidWhatsAppMobile(contact.phone);
      if (contact.missingRecipient || invalidPhone) ids.add(row.id);
    }
    return ids;
  }, [selectedRows, rowContactState]);

  const missingRecipientCount = useMemo(
    () =>
      selectedRows.filter((row) => rowContactState(row).missingRecipient)
        .length,
    [selectedRows, rowContactState],
  );

  const missingPhoneInSelection = useMemo(
    () =>
      selectedRows.filter((row) => {
        const contact = rowContactState(row);
        return !contact.phone || !isValidWhatsAppMobile(contact.phone);
      }).length,
    [selectedRows, rowContactState],
  );
  /** Toggled by clicking the summary line — brings incomplete rows to the top. */
  const [sortMissingFirst, setSortMissingFirst] = useState(false);

  useEffect(() => {
    if (previewOpen) setSortMissingFirst(false);
  }, [previewOpen]);

  const previewRows = useMemo(() => {
    if (!sortMissingFirst) return selectedRows;
    return [...selectedRows].sort((a, b) => {
      const aMissing = selectedMissingIds.has(a.id) ? 0 : 1;
      const bMissing = selectedMissingIds.has(b.id) ? 0 : 1;
      return aMissing - bMissing;
    });
  }, [selectedRows, sortMissingFirst, selectedMissingIds]);

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
        minWidth: 180,
        multiline: true,
        cell: (row) => (
          <div className="flex min-w-0 flex-col gap-0.5 py-0.5">
            <p
              className="truncate text-sm leading-tight"
              title={row.generatedFile?.filename ?? ''}
            >
              {row.generatedFile?.filename ?? '—'}
            </p>
            <Badge
              variant="success"
              className="w-fit px-1.5 py-0 text-[0.65rem] leading-4"
            >
              Generated
            </Badge>
          </div>
        ),
      },
      {
        id: 'sentDate',
        header: 'Last sent',
        minWidth: 120,
        multiline: true,
        cell: (row) => (
          <div className="min-w-0 py-0.5 leading-tight">
            <p className="truncate text-sm">{formatDate(row.sentDate)}</p>
            <p
              className="truncate text-[0.7rem] text-muted-foreground"
              title={row.mailStatus || undefined}
            >
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
        header: 'Recipient name (optional)',
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
              placeholder="Optional — leave blank to skip"
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
                Boolean(sendModalFiling)
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
      sendModalFiling,
      getDraftPhone,
      getDraftRecipient,
      handlePhoneDraftChange,
      handleRecipientDraftChange,
      commitPersist,
      rowContactState,
    ],
  );

  /**
   * Send (or resend) WhatsApp for one filing, using whatever phone/recipient
   * drafts are currently held for its client. Mobile number is required — a
   * missing or invalid one is skipped without calling the API; recipient
   * name is optional and, left blank, is simply skipped in the message.
   */
  const sendOneFilingWhatsApp = useCallback(
    async (row: Filing): Promise<BulkResultEntry> => {
      const contact = rowContactState(row);
      if (!contact.phone) {
        return {
          filingId: row.id,
          row,
          status: 'skipped',
          message: 'Missing mobile number',
        };
      }
      if (!isValidWhatsAppMobile(contact.phone)) {
        return {
          filingId: row.id,
          row,
          status: 'skipped',
          message: 'Invalid mobile number',
        };
      }

      try {
        await filingsApi.sendWhatsApp(row.id, {
          templateId: bulkTemplateId,
          phone: contact.phone,
          savePhone: Boolean(contact.clientKey),
          recipientName: contact.recipientName || undefined,
          saveRecipientName: Boolean(
            contact.recipientName && contact.clientKey,
          ),
          // One set of custom text for the whole batch — every recipient in
          // this send gets the same wording.
          ...(bulkCustomVariables.length > 0
            ? { customValues: bulkCustomValues }
            : {}),
        });
        if (contact.clientKey) {
          phoneDraftsRef.current[contact.clientKey] = contact.phone;
          recipientDraftsRef.current[contact.clientKey] =
            contact.recipientName;
          persistedPhoneRef.current[contact.clientKey] = contact.phone;
          persistedNameRef.current[contact.clientKey] = contact.recipientName;
        }
        return { filingId: row.id, row, status: 'sent', message: '' };
      } catch (error) {
        const skipReason = getWhatsAppSkipReason(error);
        return {
          filingId: row.id,
          row,
          status: skipReason ? 'skipped' : 'failed',
          message: skipReason ?? getApiErrorMessage(error, 'Send failed'),
        };
      }
    },
    [rowContactState, bulkTemplateId, bulkCustomVariables, bulkCustomValues],
  );

  const handleBulkSend = async () => {
    if (!canSend || selectedRows.length === 0) return;
    if (!bulkTemplateId) {
      toastError('Choose a template before sending.');
      return;
    }
    if (!hasAllCustomValues(bulkCustomVariables, bulkCustomValues)) {
      toastError('Fill in the message text before sending.');
      return;
    }
    setBulkSending(true);

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
      const saveErrors: string[] = [];
      for (const [clientKey, item] of dirty) {
        try {
          await clientsApi.update(clientKey, item.payload);
          if (item.payload.contactNumber !== undefined) {
            phoneDraftsRef.current[clientKey] =
              item.payload.contactNumber ?? '';
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
          saveErrors.push(
            `${item.clientCode}: ${getApiErrorMessage(error, 'Save failed')}`,
          );
        }
      }

      const results: BulkResultEntry[] = [];
      for (const row of selectedRows) {
        results.push(await sendOneFilingWhatsApp(row));
      }

      void queryClient.invalidateQueries({ queryKey: filingsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['clients'] });
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-sends'] });
      setContactSyncKey((key) => key + 1);

      const sentCount = results.filter((item) => item.status === 'sent')
        .length;
      const actionable = results.filter((item) => item.status !== 'sent');

      if (saveErrors.length > 0) {
        toastError(saveErrors.slice(0, 3).join(' · '));
      }

      if (actionable.length === 0) {
        toastSuccess(`Saved & sent WhatsApp for ${sentCount} client(s)`);
        setPreviewOpen(false);
        setSelectedIds(new Set());
        setBulkResults(null);
      } else if (sentCount > 0) {
        toastSuccess(
          `Sent ${sentCount}. ${actionable.length} need attention — see the list below.`,
        );
        setBulkResults(actionable);
      } else {
        toastError('No WhatsApp messages were sent. See the list below.');
        setBulkResults(actionable);
      }
    } finally {
      setBulkSending(false);
    }
  };

  /**
   * Warn before sending a batch that has rows missing a recipient name or a
   * valid mobile number — those with a missing/invalid number are skipped
   * from the send entirely, and those with no name just go out without one.
   */
  const handleSendAllClick = async () => {
    if (missingRecipientCount > 0 || missingPhoneInSelection > 0) {
      const parts: string[] = [];
      if (missingRecipientCount > 0) {
        parts.push(
          `${missingRecipientCount} missing a recipient name`,
        );
      }
      if (missingPhoneInSelection > 0) {
        parts.push(
          `${missingPhoneInSelection} missing a valid mobile number`,
        );
      }
      const confirmed = await confirmDialog({
        title: 'Some records are incomplete',
        message: [
          `Out of ${selectedRows.length} selected, ${parts.join(' and ')}.`,
          '',
          'Rows with no valid mobile number will be skipped — nothing is sent to them.',
          'Rows missing a recipient name will still be sent, just without a name in the greeting.',
          '',
          'Send anyway?',
        ].join('\n'),
        confirmLabel: 'Send anyway',
      });
      if (!confirmed) return;
    }
    await handleBulkSend();
  };

  /** Re-persist whatever's currently drafted for this row's client, then resend. */
  const resendEntry = useCallback(
    async (entry: BulkResultEntry): Promise<BulkResultEntry> => {
      const clientKey = entry.row.client?.id;
      if (clientKey) {
        commitPersist(clientKey);
        await (persistQueueRef.current[clientKey] ?? Promise.resolve());
      }
      return sendOneFilingWhatsApp(entry.row);
    },
    [commitPersist, sendOneFilingWhatsApp],
  );

  /** Drop a resent-and-sent row from the results list; otherwise update its status/message. */
  const applyResendResult = useCallback((result: BulkResultEntry) => {
    setBulkResults((current) => {
      if (!current) return current;
      if (result.status === 'sent') {
        return current.filter((item) => item.filingId !== result.filingId);
      }
      return current.map((item) =>
        item.filingId === result.filingId ? result : item,
      );
    });
  }, []);

  const handleResendOne = async (entry: BulkResultEntry) => {
    setResendingIds((prev) => new Set(prev).add(entry.filingId));
    try {
      const result = await resendEntry(entry);
      applyResendResult(result);
      if (result.status === 'sent') {
        toastSuccess(`Sent to ${result.row.clientCode}`);
        void queryClient.invalidateQueries({ queryKey: filingsQueryKeys.all });
        void queryClient.invalidateQueries({ queryKey: ['clients'] });
        void queryClient.invalidateQueries({ queryKey: ['whatsapp-sends'] });
        setContactSyncKey((key) => key + 1);
      } else {
        toastError(`${result.row.clientCode}: ${result.message}`);
      }
    } finally {
      setResendingIds((prev) => {
        const next = new Set(prev);
        next.delete(entry.filingId);
        return next;
      });
    }
  };

  const handleResendAll = async () => {
    if (!bulkResults || bulkResults.length === 0) return;
    setResendingAll(true);
    const targets = [...bulkResults];
    let sent = 0;
    let stillNeedsAttention = 0;
    try {
      for (const entry of targets) {
        setResendingIds((prev) => new Set(prev).add(entry.filingId));
        const result = await resendEntry(entry);
        applyResendResult(result);
        setResendingIds((prev) => {
          const next = new Set(prev);
          next.delete(entry.filingId);
          return next;
        });
        if (result.status === 'sent') sent += 1;
        else stillNeedsAttention += 1;
      }
    } finally {
      setResendingAll(false);
    }
    if (sent > 0) {
      void queryClient.invalidateQueries({ queryKey: filingsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['clients'] });
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-sends'] });
      setContactSyncKey((key) => key + 1);
    }
    if (stillNeedsAttention === 0) {
      toastSuccess(`Resent ${sent}. All caught up.`);
    } else if (sent > 0) {
      toastSuccess(`Resent ${sent}. ${stillNeedsAttention} still need attention.`);
    } else {
      toastError('Still could not send. Check mobile numbers and try again.');
    }
  };

  /** Closing the preview after a batch: keep unresolved rows selected for later, forget the rest. */
  const closeBulkResultsAndPreview = () => {
    if (bulkResults) {
      setSelectedIds(new Set(bulkResults.map((entry) => entry.filingId)));
    }
    setBulkResults(null);
    setPreviewOpen(false);
    setContactSyncKey((key) => key + 1);
  };

  return (
    <div className="space-y-3">
      <PageHeader
        title="Form 5 WhatsApp"
        description="Send generated Form 5 PDFs on WhatsApp using your approved MSG91 template. Mobile number is required; recipient name is optional and is simply skipped in the message when left blank. Both are stored on the client master."
        breadcrumbs={[
          { label: 'Home', href: PATHS.home },
          { label: 'Form 5', href: PATHS.form5 },
          { label: 'WhatsApp' },
        ]}
      />

      <FilterPanel
        title="Filters"
        leading={
          <>
            <SearchBox
              value={searchInput}
              onChange={setSearchInput}
              onSubmit={() => {
                setSearch(searchInput.trim());
                setPage(1);
                setSelectedIds(new Set());
              }}
              placeholder="Search client code"
              className="w-[16rem] max-w-full"
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
              containerClassName="w-[11rem]"
            />
          </>
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
          setSearchInput('');
          setSearch('');
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
        <button
          type="button"
          role="status"
          aria-pressed={incompleteOnly}
          onClick={() => setIncompleteOnly((value) => !value)}
          className={cn(
            'w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors',
            'border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100',
            'dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60',
            incompleteOnly && 'ring-2 ring-amber-400/70',
          )}
        >
          {incompleteOnly ? (
            <>
              Showing {incompleteCount} client
              {incompleteCount === 1 ? '' : 's'} missing a valid mobile number
              on this page. Click again to show all rows.
            </>
          ) : (
            <>
              {incompleteCount} client{incompleteCount === 1 ? '' : 's'} on this
              page {incompleteCount === 1 ? 'is' : 'are'} missing a valid
              mobile number. Click to show only these records. Highlighted
              fields need to be filled before send — recipient name is
              optional and is simply skipped in the message when left blank.
            </>
          )}
        </button>
      ) : null}

      <DataTable
        columns={columns}
        data={displayRows}
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
        fullscreenTitle="Form 5 WhatsApp"
      />

      <Modal
        open={previewOpen}
        onOpenChange={(open) => {
          if (bulkSending || resendingAll) return;
          if (!open) {
            closeBulkResultsAndPreview();
            return;
          }
          setPreviewOpen(open);
        }}
        title={bulkResults ? 'WhatsApp send results' : 'WhatsApp send preview'}
        description={
          bulkResults
            ? 'Fix the mobile number and resend, or resend all once they look right.'
            : 'Pick a template, review recipient names and mobile numbers, then send all selected messages. Empty fields are highlighted and saved as you type. Recipient name is optional and is simply skipped in the message when left blank.'
        }
        className="max-w-5xl"
        closeOnOverlayClick={!bulkSending && !resendingAll}
        footer={
          bulkResults ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={resendingAll}
                onClick={closeBulkResultsAndPreview}
              >
                Close
              </Button>
              <PermissionGate permission={PERMISSIONS.FILINGS_SEND}>
                <Button
                  type="button"
                  disabled={bulkResults.length === 0 || resendingAll}
                  loading={resendingAll}
                  onClick={() => void handleResendAll()}
                >
                  Resend all ({bulkResults.length})
                </Button>
              </PermissionGate>
            </>
          ) : (
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
                  disabled={
                    selectedRows.length === 0 ||
                    bulkSending ||
                    !bulkTemplateId ||
                    !hasAllCustomValues(bulkCustomVariables, bulkCustomValues)
                  }
                  loading={bulkSending}
                  onClick={() => void handleSendAllClick()}
                >
                  Send all ({selectedRows.length})
                </Button>
              </PermissionGate>
            </>
          )
        }
      >
        {bulkResults ? (
          <div className="flex flex-col gap-4">
            {bulkResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                All caught up — every recipient in this batch has been sent.
              </p>
            ) : (
              <div className="max-h-[55vh] overflow-auto">
                <table className="w-full min-w-3xl border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="px-2 py-2 font-medium">Client</th>
                      <th className="px-2 py-2 font-medium">Status</th>
                      <th className="px-2 py-2 font-medium">Mobile number</th>
                      <th className="px-2 py-2 font-medium">Reason</th>
                      <th className="px-2 py-2 font-medium text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkResults.map((entry) => {
                      const contact = rowContactState(entry.row);
                      const company =
                        entry.row.client?.companyName ||
                        entry.row.clientCode ||
                        '—';
                      const resending = resendingIds.has(entry.filingId);
                      return (
                        <tr
                          key={entry.filingId}
                          className="border-b border-border/70 align-middle"
                        >
                          <td className="px-2 py-2">
                            <p className="font-medium">{company}</p>
                            <p className="text-xs text-muted-foreground">
                              {entry.row.clientCode}
                            </p>
                          </td>
                          <td className="px-2 py-2">
                            <Badge
                              variant={
                                entry.status === 'failed'
                                  ? 'destructive'
                                  : 'warning'
                              }
                            >
                              {entry.status === 'failed' ? 'Failed' : 'Skipped'}
                            </Badge>
                          </td>
                          <td className="px-2 py-2">
                            {contact.clientKey ? (
                              <WhatsAppDraftField
                                key={`${contact.clientKey}-resend-phone-${contactSyncKey}`}
                                clientId={contact.clientKey}
                                draftValue={getDraftPhone(
                                  contact.clientKey,
                                  contact.savedPhone,
                                )}
                                placeholder="10-digit mobile"
                                kind="phone"
                                disabled={
                                  !canEditClient || resending || resendingAll
                                }
                                onDraftChange={handlePhoneDraftChange}
                                onCommit={commitPersist}
                              />
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="max-w-[14rem] px-2 py-2 text-xs text-muted-foreground">
                            {entry.message}
                          </td>
                          <td className="px-2 py-2 text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              loading={resending}
                              disabled={resendingAll}
                              onClick={() => void handleResendOne(entry)}
                            >
                              Resend
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : selectedRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No rows selected. Close this dialog and select filings first.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <Select
              label="Template *"
              value={bulkTemplateId}
              onChange={(event) => setBulkTemplateId(event.target.value)}
              placeholder="Select a template…"
              options={templates.map((item) => ({
                value: item.id,
                label: item.label,
              }))}
              disabled={templatesQuery.isLoading || bulkSending}
              error={bulkTemplateId ? undefined : 'Choose the template to send'}
            />

            <WhatsAppCustomValueFields
              variables={bulkCustomVariables}
              values={bulkCustomValues}
              onChange={(token, value) =>
                setBulkCustomValues((current) => ({
                  ...current,
                  [token]: value,
                }))
              }
              disabled={bulkSending}
              hint={`This text is sent to all ${selectedRows.length} selected recipient(s) — it is not customised per client.`}
            />

            {missingRecipientCount > 0 || missingPhoneInSelection > 0 ? (
              <button
                type="button"
                aria-pressed={sortMissingFirst}
                onClick={() => setSortMissingFirst((value) => !value)}
                className={cn(
                  'w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                  'border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100',
                  'dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60',
                  sortMissingFirst && 'ring-2 ring-amber-400/70',
                )}
              >
                Total {selectedRows.length}, missing recipient name{' '}
                {missingRecipientCount}, missing mobile number
                {missingPhoneInSelection === 1 ? '' : 's'}{' '}
                {missingPhoneInSelection}.{' '}
                {sortMissingFirst
                  ? 'Showing incomplete records first — click to restore the original order.'
                  : 'Click to bring incomplete records to the top for easy editing.'}
              </button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Total {selectedRows.length} record
                {selectedRows.length === 1 ? '' : 's'} selected — all have a
                mobile number and recipient name.
              </p>
            )}

            <div className="max-h-[50vh] overflow-auto">
              <table className="w-full min-w-[48rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Client</th>
                    <th className="px-2 py-2 font-medium">Month</th>
                    <th className="px-2 py-2 font-medium">Mobile number</th>
                    <th className="px-2 py-2 font-medium">
                      Recipient name (optional)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => {
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
                              placeholder="Optional — leave blank to skip"
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
          </div>
        )}
      </Modal>

      {sendModalFiling && (
        <SendWhatsAppTemplateModal
          open
          onOpenChange={(open) => {
            if (!open) setSendModalFiling(null);
          }}
          filing={sendModalFiling}
          onSent={handleSingleSent}
        />
      )}
    </div>
  );
}
