import { useEffect, useState } from 'react';

import { Button } from '@/components/buttons';
import { WhatsAppPreviewText } from '@/components/common/WhatsAppPreviewText';
import { Modal } from '@/components/dialogs/Modal';
import { Checkbox } from '@/components/inputs/Checkbox';
import { Input } from '@/components/inputs/Input';
import { Select } from '@/components/inputs/Select';
import {
  useWhatsAppTemplatesQuery,
  useWhatsAppTemplateFieldsQuery,
} from '@/hooks/useWhatsAppTemplates';
import { useSendFilingWhatsAppMutation } from '@/hooks/useFilings';
import { useSettingsQuery } from '@/hooks/useMasters';
import {
  hasAllCustomValues,
  WhatsAppCustomValueFields,
} from '@/pages/filings/WhatsAppCustomValueFields';
import type { Filing } from '@/types/filing.types';
import type { WhatsAppCustomValues } from '@/types/whatsappTemplate.types';
import {
  buildWhatsAppSourceData,
  collapseWhatsAppBodyLineBreaks,
  collectCustomVariables,
  resolveWhatsAppPreview,
  wrapWithGenericTemplate,
} from '@/utils/whatsappTemplatePreview';

type SendWhatsAppTemplateModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filing: Filing;
  /** Called after a successful send, so the page can refresh its contact drafts. */
  onSent?: () => void;
  /** Pre-selects a template (e.g. handed off from the Clients page, where the
   *  template was already chosen before this modal opened) instead of making
   *  the user pick it again. */
  initialTemplateId?: string;
};

/**
 * Modal for sending a single Form 5 on WhatsApp (Flow A).
 * User selects a template, fills in any text the template leaves to the sender,
 * reviews the live preview, and confirms phone/recipient.
 */
export function SendWhatsAppTemplateModal({
  open,
  onOpenChange,
  filing,
  onSent,
  initialTemplateId,
}: SendWhatsAppTemplateModalProps) {
  const [templateId, setTemplateId] = useState(initialTemplateId ?? '');
  const [phone, setPhone] = useState(filing.client?.contactNumber ?? '');
  const [savePhone, setSavePhone] = useState(true);
  const [recipientName, setRecipientName] = useState(
    filing.client?.recipientName ?? '',
  );
  const [saveRecipientName, setSaveRecipientName] = useState(true);
  const [customValues, setCustomValues] = useState<WhatsAppCustomValues>({});

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
  const sendMutation = useSendFilingWhatsAppMutation();

  const templates = templatesQuery.data?.templates ?? [];
  const fields = fieldsQuery.data?.fields ?? [];
  const selectedTemplate = templates.find((t) => t.id === templateId);
  const customVariables = collectCustomVariables(selectedTemplate?.variables);

  // Same override -> client -> org-default chain the Form 5 PDF itself uses
  // — otherwise the preview shows blank for a client relying on the org-wide
  // default signatory, even though the PDF being sent prints it correctly.
  const resolvedSignatoryName =
    filing.generateOverrides?.signatoryName ||
    filing.client?.signatoryName ||
    settingsQuery.data?.signatoryName ||
    '';

  // Build source data for preview
  const sourceData = buildWhatsAppSourceData(
    filing,
    recipientName,
    resolvedSignatoryName,
  );

  // Generate preview text. A 'single' mode template sends its whole message
  // as one MSG91 variable, and MSG91 rejects line breaks inside it — collapse
  // them here too so the preview shows exactly what gets delivered. MSG91
  // also wraps that variable with its own fixed wording on its side (never
  // something we send), so the preview adds it too — otherwise the operator
  // would see an already-complete-looking message and be tempted to type
  // "Hii"/"Thank you" into it themselves, doubling it up.
  const rawPreviewText = selectedTemplate
    ? resolveWhatsAppPreview(
        selectedTemplate.bodyPreview,
        fields,
        sourceData,
        customVariables,
        customValues,
      )
    : '';
  const isSingleMode = selectedTemplate?.bodyMode === 'single';
  const composedPreviewText = isSingleMode
    ? collapseWhatsAppBodyLineBreaks(rawPreviewText)
    : rawPreviewText;
  const genericTemplate = fieldsQuery.data?.genericTemplate;
  const previewText =
    isSingleMode && genericTemplate && composedPreviewText
      ? wrapWithGenericTemplate(composedPreviewText, genericTemplate)
      : composedPreviewText;

  // Validation — recipient name is optional; when left blank the greeting
  // is skipped in the message rather than blocking the send.
  const phoneValid = phone.trim().length > 0;
  const customValid = hasAllCustomValues(customVariables, customValues);
  const canSend = Boolean(templateId) && phoneValid && customValid;

  const handleCustomChange = (token: string, value: string) => {
    setCustomValues((current) => ({ ...current, [token]: value }));
  };

  const handleSend = async () => {
    if (!canSend) return;

    await sendMutation.mutateAsync({
      id: filing.id,
      payload: {
        templateId,
        phone: phone.trim(),
        savePhone,
        recipientName: recipientName.trim(),
        saveRecipientName,
        ...(customVariables.length > 0 ? { customValues } : {}),
      },
    });

    onSent?.();
    onOpenChange(false);
  };

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setTemplateId(initialTemplateId ?? '');
      setPhone(filing.client?.contactNumber ?? '');
      setRecipientName(filing.client?.recipientName ?? '');
      setSavePhone(true);
      setSaveRecipientName(true);
      setCustomValues({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filing]);

  // Text typed for one template should not leak into another.
  useEffect(() => {
    setCustomValues({});
  }, [templateId]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Send Form 5 on WhatsApp"
      description={`${filing.clientCode} · ${filing.periodLabel || filing.period}`}
      className="max-w-2xl"
    >
      <div className="flex flex-col gap-6">
        {/* Template Selection */}
        <div className="space-y-2">
          <Select
            label="Template *"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            placeholder="Select a template…"
            options={templates.map((t) => ({ value: t.id, label: t.label }))}
            disabled={templatesQuery.isLoading}
          />
          {!templateId && (
            <p className="text-sm text-muted-foreground">
              Select a template to see the message preview
            </p>
          )}
          {templatesQuery.isError && (
            <p className="text-sm text-destructive">
              Could not load templates. Please try again.
            </p>
          )}
        </div>

        {templateId && (
          <>
            {/* Text this template leaves to the sender */}
            <WhatsAppCustomValueFields
              variables={customVariables}
              values={customValues}
              onChange={handleCustomChange}
              disabled={sendMutation.isPending}
            />

            {/* Contact Details */}
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

            {/* Message Preview */}
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
              <p className="text-xs text-muted-foreground">
                This preview uses the actual data from this filing
              </p>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSend()}
            disabled={!canSend}
            loading={sendMutation.isPending}
          >
            Send WhatsApp
          </Button>
        </div>
      </div>
    </Modal>
  );
}
