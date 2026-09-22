import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { clientsApi } from '@/api/clients.api';
import { Button } from '@/components/buttons';
import { Badge } from '@/components/common/Badge';
import { PermissionGate } from '@/components/common/PermissionGate';
import { WhatsAppDraftField } from '@/components/common/WhatsAppDraftField';
import { confirmDialog } from '@/components/dialogs/ConfirmDialog';
import { Modal } from '@/components/dialogs/Modal';
import { Select } from '@/components/inputs/Select';
import { PERMISSIONS } from '@/constants/permissions';
import { clientsQueryKeys } from '@/hooks/useClients';
import { useWhatsAppTemplatesQuery } from '@/hooks/useWhatsAppTemplates';
import {
  hasAllCustomValues,
  WhatsAppCustomValueFields,
} from '@/pages/filings/WhatsAppCustomValueFields';
import { cn } from '@/lib/utils';
import type { Client } from '@/types/client.types';
import type { WhatsAppCustomValues } from '@/types/whatsappTemplate.types';
import { collectCustomVariables } from '@/utils/whatsappTemplatePreview';
import { isValidWhatsAppMobile } from '@/utils/whatsappPhone';
import { getApiErrorMessage } from '@/utils/apiError';
import { toastError, toastSuccess } from '@/utils/toast';

type BulkRowStatus = 'sent' | 'failed' | 'skipped';
type BulkResultEntry = {
  clientId: string;
  client: Client;
  status: BulkRowStatus;
  message: string;
};

type ClientDraft = { phone: string; recipientName: string };

type ClientsWhatsAppPreviewModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  /** Called after the batch closes with at least one message sent. */
  onSent?: () => void;
};

/**
 * Multi-select WhatsApp send for the Clients page — pick a template, review
 * (and tweak) each recipient's phone/name, then send to everyone selected.
 * Message templates only, same restriction as the single-send modal.
 * Mirrors the Form 5 WhatsApp page's bulk preview/send/resend flow.
 */
export function ClientsWhatsAppPreviewModal({
  open,
  onOpenChange,
  clients,
  onSent,
}: ClientsWhatsAppPreviewModalProps) {
  const queryClient = useQueryClient();

  const [templateId, setTemplateId] = useState('');
  const [customValues, setCustomValues] = useState<WhatsAppCustomValues>({});
  const [drafts, setDrafts] = useState<Record<string, ClientDraft>>({});
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<BulkResultEntry[] | null>(null);
  const [resendingIds, setResendingIds] = useState<Set<string>>(new Set());
  const [resendingAll, setResendingAll] = useState(false);
  const [sortMissingFirst, setSortMissingFirst] = useState(false);

  const templatesQuery = useWhatsAppTemplatesQuery(
    { isActive: true, sortBy: 'label', sortOrder: 'asc', limit: 100 },
    { refetchOnMount: 'always' },
  );
  const templates = useMemo(
    () =>
      (templatesQuery.data?.templates ?? []).filter(
        (item) => item.bodyMode === 'single',
      ),
    [templatesQuery.data],
  );
  const selectedTemplate = templates.find((item) => item.id === templateId);
  const customVariables = collectCustomVariables(selectedTemplate?.variables);

  useEffect(() => {
    if (!open) return;
    setTemplateId('');
    setCustomValues({});
    setResults(null);
    setSortMissingFirst(false);
    setDrafts(
      Object.fromEntries(
        clients.map((client) => [
          client.id,
          {
            phone: client.contactNumber ?? '',
            recipientName: client.recipientName ?? '',
          },
        ]),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    setCustomValues({});
  }, [templateId]);

  const draftFor = useCallback(
    (clientId: string): ClientDraft =>
      drafts[clientId] ?? { phone: '', recipientName: '' },
    [drafts],
  );

  const setPhoneDraft = useCallback((clientId: string, value: string) => {
    setDrafts((current) => ({
      ...current,
      [clientId]: { ...(current[clientId] ?? { recipientName: '' }), phone: value },
    }));
  }, []);

  const setRecipientDraft = useCallback((clientId: string, value: string) => {
    setDrafts((current) => ({
      ...current,
      [clientId]: {
        ...(current[clientId] ?? { phone: '' }),
        recipientName: value,
      },
    }));
  }, []);

  const rowState = useCallback(
    (client: Client) => {
      const draft = draftFor(client.id);
      const phone = draft.phone.trim();
      const recipientName = draft.recipientName.trim();
      const invalidPhone = phone.length > 0 && !isValidWhatsAppMobile(phone);
      return {
        phone,
        recipientName,
        missingPhone: !phone,
        missingRecipient: !recipientName,
        invalidPhone,
      };
    },
    [draftFor],
  );

  const missingRecipientCount = clients.filter(
    (client) => rowState(client).missingRecipient,
  ).length;
  const missingPhoneCount = clients.filter((client) => {
    const state = rowState(client);
    return state.missingPhone || state.invalidPhone;
  }).length;

  const previewClients = useMemo(() => {
    if (!sortMissingFirst) return clients;
    return [...clients].sort((a, b) => {
      const aBad = rowState(a).missingPhone || rowState(a).invalidPhone || rowState(a).missingRecipient ? 0 : 1;
      const bBad = rowState(b).missingPhone || rowState(b).invalidPhone || rowState(b).missingRecipient ? 0 : 1;
      return aBad - bBad;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, sortMissingFirst, drafts]);

  const sendOne = useCallback(
    async (client: Client): Promise<BulkResultEntry> => {
      const state = rowState(client);
      if (!state.phone) {
        return {
          clientId: client.id,
          client,
          status: 'skipped',
          message: 'Missing mobile number',
        };
      }
      if (!isValidWhatsAppMobile(state.phone)) {
        return {
          clientId: client.id,
          client,
          status: 'skipped',
          message: 'Invalid mobile number',
        };
      }

      try {
        await clientsApi.sendWhatsApp(client.id, {
          templateId,
          phone: state.phone,
          savePhone: true,
          recipientName: state.recipientName || undefined,
          saveRecipientName: Boolean(state.recipientName),
          ...(customVariables.length > 0 ? { customValues } : {}),
        });
        return { clientId: client.id, client, status: 'sent', message: '' };
      } catch (error) {
        return {
          clientId: client.id,
          client,
          status: 'failed',
          message: getApiErrorMessage(error, 'Send failed'),
        };
      }
    },
    [rowState, templateId, customVariables, customValues],
  );

  const canSend =
    clients.length > 0 &&
    Boolean(templateId) &&
    hasAllCustomValues(customVariables, customValues);

  const runSendAll = async () => {
    setSending(true);
    try {
      const entries: BulkResultEntry[] = [];
      for (const client of clients) {
        entries.push(await sendOne(client));
      }

      void queryClient.invalidateQueries({ queryKey: clientsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-sends'] });

      const sentCount = entries.filter((item) => item.status === 'sent').length;
      const actionable = entries.filter((item) => item.status !== 'sent');

      if (actionable.length === 0) {
        toastSuccess(`Sent WhatsApp for ${sentCount} client(s)`);
        onSent?.();
        onOpenChange(false);
        setResults(null);
      } else if (sentCount > 0) {
        toastSuccess(
          `Sent ${sentCount}. ${actionable.length} need attention — see the list below.`,
        );
        onSent?.();
        setResults(actionable);
      } else {
        toastError('No WhatsApp messages were sent. See the list below.');
        setResults(actionable);
      }
    } finally {
      setSending(false);
    }
  };

  const handleSendAllClick = async () => {
    if (!canSend) return;
    if (missingRecipientCount > 0 || missingPhoneCount > 0) {
      const parts: string[] = [];
      if (missingRecipientCount > 0) {
        parts.push(`${missingRecipientCount} missing a recipient name`);
      }
      if (missingPhoneCount > 0) {
        parts.push(`${missingPhoneCount} missing a valid mobile number`);
      }
      const confirmed = await confirmDialog({
        title: 'Some records are incomplete',
        message: [
          `Out of ${clients.length} selected, ${parts.join(' and ')}.`,
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
    await runSendAll();
  };

  const applyResendResult = useCallback((result: BulkResultEntry) => {
    setResults((current) => {
      if (!current) return current;
      if (result.status === 'sent') {
        return current.filter((item) => item.clientId !== result.clientId);
      }
      return current.map((item) =>
        item.clientId === result.clientId ? result : item,
      );
    });
  }, []);

  const handleResendOne = async (entry: BulkResultEntry) => {
    setResendingIds((prev) => new Set(prev).add(entry.clientId));
    try {
      const result = await sendOne(entry.client);
      applyResendResult(result);
      if (result.status === 'sent') {
        toastSuccess(`Sent to ${result.client.clientCode}`);
        void queryClient.invalidateQueries({ queryKey: clientsQueryKeys.all });
        void queryClient.invalidateQueries({ queryKey: ['whatsapp-sends'] });
        onSent?.();
      } else {
        toastError(`${result.client.clientCode}: ${result.message}`);
      }
    } finally {
      setResendingIds((prev) => {
        const next = new Set(prev);
        next.delete(entry.clientId);
        return next;
      });
    }
  };

  const handleResendAll = async () => {
    if (!results || results.length === 0) return;
    setResendingAll(true);
    const targets = [...results];
    let sent = 0;
    let stillNeedsAttention = 0;
    try {
      for (const entry of targets) {
        setResendingIds((prev) => new Set(prev).add(entry.clientId));
        const result = await sendOne(entry.client);
        applyResendResult(result);
        setResendingIds((prev) => {
          const next = new Set(prev);
          next.delete(entry.clientId);
          return next;
        });
        if (result.status === 'sent') sent += 1;
        else stillNeedsAttention += 1;
      }
    } finally {
      setResendingAll(false);
    }
    if (sent > 0) {
      void queryClient.invalidateQueries({ queryKey: clientsQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['whatsapp-sends'] });
      onSent?.();
    }
    if (stillNeedsAttention === 0) {
      toastSuccess(`Resent ${sent}. All caught up.`);
    } else if (sent > 0) {
      toastSuccess(`Resent ${sent}. ${stillNeedsAttention} still need attention.`);
    } else {
      toastError('Still could not send. Check mobile numbers and try again.');
    }
  };

  const closeModal = () => {
    if (sending || resendingAll) return;
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeModal();
          return;
        }
        onOpenChange(nextOpen);
      }}
      title={results ? 'WhatsApp send results' : 'WhatsApp send preview'}
      description={
        results
          ? 'Fix the mobile number and resend, or resend all once they look right.'
          : 'Pick a message template, review recipient names and mobile numbers, then send. Recipient name is optional and is simply skipped in the message when left blank. Only message templates are shown — Form 5 templates are sent from the Form 5 WhatsApp page.'
      }
      className="max-w-5xl"
      closeOnOverlayClick={!sending && !resendingAll}
      footer={
        results ? (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={resendingAll}
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <PermissionGate permission={PERMISSIONS.CLIENTS_SEND}>
              <Button
                type="button"
                disabled={results.length === 0 || resendingAll}
                loading={resendingAll}
                onClick={() => void handleResendAll()}
              >
                Resend all ({results.length})
              </Button>
            </PermissionGate>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={sending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <PermissionGate permission={PERMISSIONS.CLIENTS_SEND}>
              <Button
                type="button"
                disabled={!canSend || sending}
                loading={sending}
                onClick={() => void handleSendAllClick()}
              >
                Send all ({clients.length})
              </Button>
            </PermissionGate>
          </>
        )
      }
    >
      {results ? (
        <div className="flex flex-col gap-4">
          {results.length === 0 ? (
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
                    <th className="px-2 py-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((entry) => {
                    const resending = resendingIds.has(entry.clientId);
                    return (
                      <tr
                        key={entry.clientId}
                        className="border-b border-border/70 align-middle"
                      >
                        <td className="px-2 py-2">
                          <p className="font-medium">
                            {entry.client.companyName || entry.client.clientCode}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {entry.client.clientCode}
                          </p>
                        </td>
                        <td className="px-2 py-2">
                          <Badge
                            variant={
                              entry.status === 'failed' ? 'destructive' : 'warning'
                            }
                          >
                            {entry.status === 'failed' ? 'Failed' : 'Skipped'}
                          </Badge>
                        </td>
                        <td className="px-2 py-2">
                          <WhatsAppDraftField
                            key={`${entry.clientId}-resend-phone`}
                            clientId={entry.clientId}
                            draftValue={draftFor(entry.clientId).phone}
                            placeholder="10-digit mobile"
                            kind="phone"
                            disabled={resending || resendingAll}
                            onDraftChange={setPhoneDraft}
                            onCommit={() => undefined}
                          />
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
      ) : clients.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No rows selected. Close this dialog and select clients first.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <Select
            label="Template *"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            placeholder="Select a template…"
            options={templates.map((item) => ({
              value: item.id,
              label: item.label,
            }))}
            disabled={templatesQuery.isLoading || sending}
            error={templateId ? undefined : 'Choose the template to send'}
          />

          <WhatsAppCustomValueFields
            variables={customVariables}
            values={customValues}
            onChange={(token, value) =>
              setCustomValues((current) => ({ ...current, [token]: value }))
            }
            disabled={sending}
            hint={`This text is sent to all ${clients.length} selected recipient(s) — it is not customised per client.`}
          />

          {missingRecipientCount > 0 || missingPhoneCount > 0 ? (
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
              Total {clients.length}, missing recipient name{' '}
              {missingRecipientCount}, missing mobile number
              {missingPhoneCount === 1 ? '' : 's'} {missingPhoneCount}.{' '}
              {sortMissingFirst
                ? 'Showing incomplete records first — click to restore the original order.'
                : 'Click to bring incomplete records to the top for easy editing.'}
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Total {clients.length} record{clients.length === 1 ? '' : 's'}{' '}
              selected — all have a mobile number and recipient name.
            </p>
          )}

          <div className="max-h-[50vh] overflow-auto">
            <table className="w-full min-w-[42rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Client</th>
                  <th className="px-2 py-2 font-medium">Mobile number</th>
                  <th className="px-2 py-2 font-medium">
                    Recipient name (optional)
                  </th>
                </tr>
              </thead>
              <tbody>
                {previewClients.map((client) => (
                  <tr
                    key={client.id}
                    className="border-b border-border/70 align-middle"
                  >
                    <td className="px-2 py-2">
                      <p className="font-medium">
                        {client.companyName || client.clientCode}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {client.clientCode}
                      </p>
                    </td>
                    <td className="px-2 py-2">
                      <WhatsAppDraftField
                        key={`${client.id}-preview-phone`}
                        clientId={client.id}
                        draftValue={draftFor(client.id).phone}
                        placeholder="10-digit mobile"
                        kind="phone"
                        disabled={sending}
                        onDraftChange={setPhoneDraft}
                        onCommit={() => undefined}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <WhatsAppDraftField
                        key={`${client.id}-preview-name`}
                        clientId={client.id}
                        draftValue={draftFor(client.id).recipientName}
                        placeholder="Optional — leave blank to skip"
                        disabled={sending}
                        onDraftChange={setRecipientDraft}
                        onCommit={() => undefined}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
