import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/buttons';
import { WhatsAppPreviewText } from '@/components/common/WhatsAppPreviewText';
import { confirmDialog } from '@/components/dialogs/ConfirmDialog';
import { Modal } from '@/components/dialogs/Modal';
import { Checkbox } from '@/components/inputs/Checkbox';
import { Input } from '@/components/inputs/Input';
import { Select } from '@/components/inputs/Select';
import { PERMISSIONS } from '@/constants/permissions';
import {
  useWhatsAppTemplatesQuery,
  useWhatsAppTemplateFieldsQuery,
} from '@/hooks/useWhatsAppTemplates';
import { useSendClientWhatsAppMutation } from '@/hooks/useClients';
import { useEmployeesQuery } from '@/hooks/useEmployees';
import { useFilingsQuery, useGenerateFilingMutation } from '@/hooks/useFilings';
import { useSettingsQuery } from '@/hooks/useMasters';
import { usePermission } from '@/hooks/usePermission';
import {
  hasAllCustomValues,
  WhatsAppCustomValueFields,
} from '@/pages/filings/WhatsAppCustomValueFields';
import type { Client } from '@/types/client.types';
import type { Filing } from '@/types/filing.types';
import type { WhatsAppCustomValues } from '@/types/whatsappTemplate.types';
import {
  buildWhatsAppSourceDataForClient,
  collapseWhatsAppBodyLineBreaks,
  collectCustomVariables,
  resolveWhatsAppPreview,
  templateUsesPeriodFields,
  wrapWithGenericTemplate,
} from '@/utils/whatsappTemplatePreview';

const previousMonth = () => {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

type SendClientWhatsAppModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client;
  /**
   * Fired once a Form 5 template is chosen and its filing is confirmed
   * generated (generating it first if needed) — the caller should close this
   * modal and open the existing Form 5 send modal with this filing/template.
   */
  onHandoffToForm5: (filing: Filing, templateId: string) => void;
};

/**
 * Modal for sending a WhatsApp template directly to a client from the
 * Clients page. Offers two kinds of templates:
 *  - Message templates: resolved and sent right here against the client
 *    record alone — no Form 5 dependency at all.
 *  - Form 5 templates: this modal only resolves/generates the underlying
 *    Filing for the chosen period, then hands off to the existing Form 5
 *    send modal (`SendWhatsAppTemplateModal`) for the actual preview/send —
 *    that logic is not duplicated here.
 */
export function SendClientWhatsAppModal({
  open,
  onOpenChange,
  client,
  onHandoffToForm5,
}: SendClientWhatsAppModalProps) {
  const { hasPermission } = usePermission();
  const canForm5 =
    hasPermission(PERMISSIONS.FILINGS_GENERATE) &&
    hasPermission(PERMISSIONS.FILINGS_SEND);

  const [templateId, setTemplateId] = useState('');
  const [phone, setPhone] = useState(client.contactNumber ?? '');
  const [savePhone, setSavePhone] = useState(true);
  const [recipientName, setRecipientName] = useState(
    client.recipientName ?? '',
  );
  const [saveRecipientName, setSaveRecipientName] = useState(true);
  const [customValues, setCustomValues] = useState<WhatsAppCustomValues>({});
  const [period, setPeriod] = useState(previousMonth);

  // Always refetch on open — a template edited elsewhere must never show as
  // a stale cached preview here, since what's shown is what gets sent.
  const templatesQuery = useWhatsAppTemplatesQuery(
    {
      isActive: true,
      sortBy: 'label',
      sortOrder: 'asc',
      limit: 100,
    },
    { refetchOnMount: 'always' },
  );

  const fieldsQuery = useWhatsAppTemplateFieldsQuery();
  const settingsQuery = useSettingsQuery({ enabled: open });
  const sendMutation = useSendClientWhatsAppMutation();
  const generateMutation = useGenerateFilingMutation();

  // Message templates are always offered. Form 5 (document) templates are
  // only offered to operators who can actually generate + send one — for
  // everyone else this behaves exactly as the message-only flow always has.
  const templates = useMemo(
    () =>
      (templatesQuery.data?.templates ?? []).filter(
        (item) =>
          item.bodyMode === 'single' ||
          (canForm5 && item.bodyMode === 'positional'),
      ),
    [templatesQuery.data, canForm5],
  );
  const fields = fieldsQuery.data?.fields ?? [];
  const selectedTemplate = templates.find((t) => t.id === templateId);
  const isForm5Template = selectedTemplate?.bodyMode === 'positional';
  const customVariables = collectCustomVariables(selectedTemplate?.variables);
  // A message template can still reference {{Period}}/month/year (e.g. a
  // periodic reminder) even though this flow has no filing to read one
  // from — when it does, the operator picks a period up front.
  const messageNeedsPeriod =
    !isForm5Template && templateUsesPeriodFields(selectedTemplate?.variables);

  const resolvedSignatoryName =
    client.signatoryName || settingsQuery.data?.signatoryName || '';

  const sourceData = buildWhatsAppSourceDataForClient(
    client,
    recipientName,
    resolvedSignatoryName,
    messageNeedsPeriod ? period : undefined,
  );

  // Every message template is 'single' mode — the whole body always
  // collapses into one MSG91 variable and gets wrapped with MSG91's own
  // fixed wording, same as the Form 5 flow's own preview.
  const rawPreviewText = selectedTemplate && !isForm5Template
    ? resolveWhatsAppPreview(
        selectedTemplate.bodyPreview,
        fields,
        sourceData,
        customVariables,
        customValues,
      )
    : '';
  const composedPreviewText = collapseWhatsAppBodyLineBreaks(rawPreviewText);
  const genericTemplate = fieldsQuery.data?.genericTemplate;
  const previewText =
    genericTemplate && composedPreviewText
      ? wrapWithGenericTemplate(composedPreviewText, genericTemplate)
      : composedPreviewText;

  const phoneValid = phone.trim().length > 0;
  const customValid = hasAllCustomValues(customVariables, customValues);
  const periodValid = !messageNeedsPeriod || Boolean(period);
  const canSend =
    Boolean(templateId) && phoneValid && customValid && periodValid;

  // Form 5 sub-flow: resolve whether a filing exists for this client+period,
  // and — only when it isn't generated yet — whether there are any employee
  // records for that period, to decide whether to warn before generating.
  const filingQuery = useFilingsQuery(
    { clientIds: [client.id], period, limit: 1 },
    { enabled: open && isForm5Template },
  );
  const resolvedFiling = filingQuery.data?.filings?.[0] ?? null;
  const needsEmployeeCheck =
    open &&
    isForm5Template &&
    Boolean(resolvedFiling) &&
    resolvedFiling?.generateStatus !== 'generated';
  const employeesQuery = useEmployeesQuery(
    { clientId: client.id, period, limit: 1 },
    { enabled: needsEmployeeCheck },
  );
  const employeeCount = employeesQuery.data?.pagination.total ?? null;

  const handleCustomChange = (token: string, value: string) => {
    setCustomValues((current) => ({ ...current, [token]: value }));
  };

  const handleSend = async () => {
    if (!canSend) return;

    await sendMutation.mutateAsync({
      id: client.id,
      payload: {
        templateId,
        phone: phone.trim(),
        savePhone,
        recipientName: recipientName.trim(),
        saveRecipientName,
        ...(customVariables.length > 0 ? { customValues } : {}),
        ...(messageNeedsPeriod ? { period } : {}),
      },
    });

    onOpenChange(false);
  };

  const handleGenerateAndContinue = async () => {
    if (!resolvedFiling) return;

    if (resolvedFiling.generateStatus === 'generated') {
      onHandoffToForm5(resolvedFiling, templateId);
      onOpenChange(false);
      return;
    }

    if ((employeeCount ?? 0) === 0) {
      const confirmed = await confirmDialog({
        title: 'No employee records yet',
        message: `${client.companyName || client.clientCode} has no employee records for ${period}. Generate Form 5 anyway, without an employee list?`,
        confirmLabel: 'Generate anyway',
      });
      if (!confirmed) return;
    }

    const generated = await generateMutation.mutateAsync({
      id: resolvedFiling.id,
      computeIfNeeded: true,
    });
    onHandoffToForm5(generated, templateId);
    onOpenChange(false);
  };

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setTemplateId('');
      setPhone(client.contactNumber ?? '');
      setRecipientName(client.recipientName ?? '');
      setSavePhone(true);
      setSaveRecipientName(true);
      setCustomValues({});
      setPeriod(previousMonth());
    }
  }, [open, client]);

  // Text typed for one template should not leak into another.
  useEffect(() => {
    setCustomValues({});
  }, [templateId]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Send WhatsApp message"
      description={`${client.clientCode} · ${client.companyName}`}
      className="max-w-2xl"
    >
      <div className="flex flex-col gap-6">
        <div className="space-y-2">
          <Select
            label="Template *"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            placeholder="Select a template…"
            options={templates.map((t) => ({
              value: t.id,
              label: `${t.bodyMode === 'positional' ? 'Form 5' : 'Message'} — ${t.label}`,
            }))}
            disabled={templatesQuery.isLoading}
          />
          {!templateId && (
            <p className="text-sm text-muted-foreground">
              {canForm5
                ? 'Message templates send right away. Form 5 templates generate the document first, then hand off to the Form 5 send screen.'
                : 'Only WhatsApp message templates are shown here — Form 5 templates are sent from the Form 5 WhatsApp page.'}
            </p>
          )}
          {templatesQuery.isError && (
            <p className="text-sm text-destructive">
              Could not load templates. Please try again.
            </p>
          )}
        </div>

        {templateId && isForm5Template && (
          <div className="space-y-3">
            <Input
              label="Period"
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              hint="Month this Form 5 filing belongs to."
            />

            {filingQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">
                Checking Form 5 status…
              </p>
            ) : !resolvedFiling ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                No Form 5 filing exists for {client.clientCode} in {period}.
                This is created automatically when that month&apos;s
                MasterSheet is imported — pick a different period or import
                that month&apos;s sheet first.
              </div>
            ) : resolvedFiling.generateStatus === 'generated' ? (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm">
                Form 5 already generated for {period}
                {resolvedFiling.generatedFile
                  ? ` (${resolvedFiling.generatedFile.filename})`
                  : ''}
                .
              </div>
            ) : (
              <div className="space-y-2">
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  Form 5 not generated yet for {period}.
                </div>
                {employeesQuery.isLoading ? (
                  <p className="text-xs text-muted-foreground">
                    Checking employee records…
                  </p>
                ) : employeeCount === 0 ? (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    No employee records found for {client.clientCode} in{' '}
                    {period} yet. You can still generate — Form 5 will print
                    without an employee list.
                  </p>
                ) : employeeCount != null ? (
                  <p className="text-xs text-muted-foreground">
                    {employeeCount} employee record
                    {employeeCount === 1 ? '' : 's'} found for this period —
                    they&apos;ll be included automatically.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        )}

        {templateId && !isForm5Template && (
          <>
            {messageNeedsPeriod && (
              <Input
                label="Period *"
                type="month"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                hint="This template references a period — pick the month it refers to."
              />
            )}

            <WhatsAppCustomValueFields
              variables={customVariables}
              values={customValues}
              onChange={handleCustomChange}
              disabled={sendMutation.isPending}
            />

            <div className="space-y-4">
              <div className="space-y-2">
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  label="Mobile Number *"
                  placeholder="10-digit mobile"
                  error={phoneValid ? undefined : 'Enter a valid mobile number'}
                />
                <Checkbox
                  checked={savePhone}
                  onChange={(e) => setSavePhone(e.target.checked)}
                  label="Save this number to the client record"
                />
              </div>

              <div className="space-y-2">
                <Input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  label="Recipient Name"
                  placeholder="Mr. Dipen Shah"
                />
                <p className="text-xs text-muted-foreground">
                  Optional — the greeting is skipped in the message when left
                  blank.
                </p>
                <Checkbox
                  checked={saveRecipientName}
                  onChange={(e) => setSaveRecipientName(e.target.checked)}
                  label="Save this name to the client record"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Message Preview</label>
              <div className="rounded-md border bg-muted/30 p-4">
                <div className="whitespace-pre-wrap break-words text-sm">
                  {previewText ? (
                    <WhatsAppPreviewText text={previewText} />
                  ) : (
                    <span className="text-muted-foreground">
                      Preview will appear here...
                    </span>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end gap-3 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          {isForm5Template ? (
            <Button
              type="button"
              onClick={() => void handleGenerateAndContinue()}
              disabled={!resolvedFiling || generateMutation.isPending}
              loading={generateMutation.isPending}
            >
              {resolvedFiling?.generateStatus === 'generated'
                ? 'Continue'
                : 'Generate & continue'}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => void handleSend()}
              disabled={!canSend}
              loading={sendMutation.isPending}
            >
              Send WhatsApp
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
