import { useEffect, useState } from 'react';

import { Button } from '@/components/buttons';
import { Modal } from '@/components/dialogs/Modal';
import { Checkbox } from '@/components/inputs/Checkbox';
import { Input } from '@/components/inputs/Input';
import { Select } from '@/components/inputs/Select';
import {
  useWhatsAppTemplatesQuery,
  useWhatsAppTemplateFieldsQuery,
} from '@/hooks/useWhatsAppTemplates';
import { useSendFilingWhatsAppMutation } from '@/hooks/useFilings';
import type { Filing } from '@/types/filing.types';
import {
  buildWhatsAppSourceData,
  resolveWhatsAppPreview,
} from '@/utils/whatsappTemplatePreview';

type SendWhatsAppTemplateModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filing: Filing;
};

/**
 * Modal for sending a single Form 5 on WhatsApp (Flow A).
 * User selects a template, reviews live preview, and confirms phone/recipient.
 */
export function SendWhatsAppTemplateModal({
  open,
  onOpenChange,
  filing,
}: SendWhatsAppTemplateModalProps) {
  const [templateId, setTemplateId] = useState('');
  const [phone, setPhone] = useState(filing.client?.contactNumber ?? '');
  const [savePhone, setSavePhone] = useState(true);
  const [recipientName, setRecipientName] = useState(
    filing.client?.recipientName ?? '',
  );
  const [saveRecipientName, setSaveRecipientName] = useState(true);

  const templatesQuery = useWhatsAppTemplatesQuery({
    isActive: true,
    sortBy: 'label',
    sortOrder: 'asc',
    limit: 100,
  });

  const fieldsQuery = useWhatsAppTemplateFieldsQuery();
  const sendMutation = useSendFilingWhatsAppMutation();

  const templates = templatesQuery.data?.templates ?? [];
  const fields = fieldsQuery.data?.fields ?? [];
  const selectedTemplate = templates.find((t) => t.id === templateId);

  // Build source data for preview
  const sourceData = buildWhatsAppSourceData(filing, recipientName);

  // Generate preview text
  const previewText = selectedTemplate
    ? resolveWhatsAppPreview(selectedTemplate.bodyPreview, fields, sourceData)
    : '';

  // Validation
  const phoneValid = phone.trim().length > 0;
  const recipientValid = recipientName.trim().length > 0;
  const canSend = templateId && phoneValid && recipientValid;

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
      },
    });

    onOpenChange(false);
  };

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setTemplateId('');
      setPhone(filing.client?.contactNumber ?? '');
      setRecipientName(filing.client?.recipientName ?? '');
      setSavePhone(true);
      setSaveRecipientName(true);
    }
  }, [open, filing]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Send Form 5 on WhatsApp"
      description={`${filing.clientCode} · ${filing.periodLabel || filing.period}`}
      size="lg"
    >
      <div className="flex flex-col gap-6">
        {/* Template Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Template *</label>
          <Select
            value={templateId}
            onValueChange={setTemplateId}
            options={[
              { value: '', label: 'Select a template...', disabled: true },
              ...templates.map((t) => ({
                value: t.id,
                label: t.label,
              })),
            ]}
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

        {/* Contact Details */}
        {templateId && (
          <>
            <div className="space-y-4">
              <div className="space-y-2">
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  label="Mobile Number *"
                  placeholder="10-digit mobile"
                  error={!phoneValid && phone.length > 0}
                />
                <Checkbox
                  checked={savePhone}
                  onCheckedChange={setSavePhone}
                  label="Save this number to the client record"
                />
              </div>

              <div className="space-y-2">
                <Input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  label="Recipient Name *"
                  placeholder="Mr. Sharma"
                  error={!recipientValid && recipientName.length > 0}
                />
                <Checkbox
                  checked={saveRecipientName}
                  onCheckedChange={setSaveRecipientName}
                  label="Save this name to the client record"
                />
              </div>
            </div>

            {/* Message Preview */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Message Preview</label>
              <div className="rounded-md border bg-muted/30 p-4">
                <div className="whitespace-pre-wrap break-words text-sm">
                  {previewText || (
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

            {/* Validation Messages */}
            {!canSend && (
              <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                {!phoneValid && 'Please enter a valid mobile number. '}
                {!recipientValid && 'Please enter a recipient name. '}
              </div>
            )}
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
            onClick={handleSend}
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
