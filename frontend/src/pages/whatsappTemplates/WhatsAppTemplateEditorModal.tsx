import { useEffect, useMemo, useRef, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Lock, X, Type } from 'lucide-react';

import { Button } from '@/components/buttons';
import { WhatsAppPreviewText } from '@/components/common/WhatsAppPreviewText';
import { Modal } from '@/components/dialogs/Modal';
import { FormWrapper } from '@/components/forms/FormWrapper';
import { Input } from '@/components/inputs/Input';
import { Switch } from '@/components/inputs/Switch';
import { Textarea } from '@/components/inputs/Textarea';
import {
  useCreateWhatsAppTemplateMutation,
  useUpdateWhatsAppTemplateMutation,
  useWhatsAppTemplateFieldsQuery,
} from '@/hooks/useWhatsAppTemplates';
import type {
  WhatsAppSourceData,
  WhatsAppTemplate,
  WhatsAppTemplateField,
  WhatsAppTemplateVariable,
} from '@/types/whatsappTemplate.types';
import {
  collapseWhatsAppBodyLineBreaks,
  collectCustomVariables,
  deriveTemplateVariables,
  nextCustomToken,
  resolveWhatsAppPreview,
  wrapWithGenericTemplate,
} from '@/utils/whatsappTemplatePreview';
import {
  whatsappTemplateFormSchema,
  type WhatsAppTemplateFormValues,
} from '@/validations/whatsappTemplates.validation';

type WhatsAppTemplateEditorModalProps = {
  template?: WhatsAppTemplate | null;
  onClose: () => void;
};

export function WhatsAppTemplateEditorModal({
  template,
  onClose,
}: WhatsAppTemplateEditorModalProps) {
  const mode = template ? 'edit' : 'create';
  // The seeded template's wording and variable order are what MSG91 approved
  // — nothing about it can change from here, so it only ever previews.
  const locked = Boolean(template?.isSeeded);

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={
        locked
          ? template?.label
          : mode === 'create'
            ? 'Create WhatsApp Template'
            : 'Edit WhatsApp Template'
      }
      description={
        locked
          ? 'This template is fixed by the WhatsApp service provider — view only.'
          : 'Name it, then compose the message below — pick from your data or add your own text.'
      }
      className="max-w-5xl"
    >
      {locked && template ? (
        <LockedTemplatePreview template={template} onClose={onClose} />
      ) : (
        <EditorBody
          key={template?.id ?? 'new'}
          mode={mode}
          template={template}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

/**
 * Read-only view for a template MSG91 already approved. Its wording and the
 * order of its variables are fixed on the provider's side — editing them
 * here would just drift from what MSG91 actually sends, so this only shows
 * what the template does, it never changes it.
 */
function LockedTemplatePreview({
  template,
  onClose,
}: {
  template: WhatsAppTemplate;
  onClose: () => void;
}) {
  const fieldsQuery = useWhatsAppTemplateFieldsQuery();
  const fields = fieldsQuery.data?.fields ?? [];

  const sampleData = fields.reduce(
    (acc, field) => ({ ...acc, [field.field]: field.sample }),
    {} as WhatsAppSourceData,
  );

  const customVariables = collectCustomVariables(template.variables);
  const previewText = resolveWhatsAppPreview(
    template.bodyPreview,
    fields,
    sampleData,
    customVariables,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
        <Lock className="mt-0.5 size-4 shrink-0" />
        <p>
          This template is not editable because its wording and variable
          order are fixed in the WhatsApp service provider (MSG91). Changing
          them here would no longer match what MSG91 actually sends.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Message Body</label>
          <div className="rounded-md border bg-muted/30 p-4">
            <div className="whitespace-pre-wrap break-words font-mono text-sm">
              {template.bodyPreview}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Live Preview</label>
          <div className="rounded-md border bg-muted/30 p-4">
            <div className="whitespace-pre-wrap break-words text-sm">
              <WhatsAppPreviewText text={previewText} />
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Sample values used for preview
          </div>
        </div>
      </div>

      <div className="flex justify-end border-t pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

/**
 * Pushes the locally-edited body and variables into the form so validation and
 * submit see them. A component rather than an effect inside the render prop,
 * so the hooks belong to a stable owner.
 */
function SyncToForm({
  form,
  bodyPreview,
  variables,
}: {
  form: UseFormReturn<WhatsAppTemplateFormValues>;
  bodyPreview: string;
  variables: WhatsAppTemplateVariable[];
}) {
  const { setValue } = form;

  useEffect(() => {
    setValue('bodyPreview', bodyPreview, { shouldValidate: true });
  }, [bodyPreview, setValue]);

  useEffect(() => {
    setValue('variables', variables, { shouldValidate: true });
  }, [variables, setValue]);

  return null;
}

/** Label the operator gave each custom token, before their edits, from a template being edited. */
const initialCustomLabels = (
  variables: WhatsAppTemplateVariable[] | undefined,
): Record<string, string> => {
  const labels: Record<string, string> = {};
  for (const variable of variables ?? []) {
    if (variable.type === 'custom') labels[variable.token] = variable.label;
  }
  return labels;
};

function EditorBody({
  mode,
  template,
  onClose,
}: {
  mode: 'create' | 'edit';
  template?: WhatsAppTemplate | null;
  onClose: () => void;
}) {
  const fieldsQuery = useWhatsAppTemplateFieldsQuery();
  const createMutation = useCreateWhatsAppTemplateMutation();
  const updateMutation = useUpdateWhatsAppTemplateMutation();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [bodyPreviewValue, setBodyPreviewValue] = useState(
    template?.bodyPreview ?? '',
  );
  // Only custom-text labels are state — everything else (which variables
  // exist, their order) is derived from the body text itself below.
  const [customLabels, setCustomLabels] = useState<Record<string, string>>(
    () => initialCustomLabels(template?.variables),
  );

  const fields = fieldsQuery.data?.fields ?? [];
  const genericTemplate = fieldsQuery.data?.genericTemplate;

  const variablesValue = useMemo(
    () => deriveTemplateVariables(bodyPreviewValue, fields, customLabels),
    [bodyPreviewValue, fields, customLabels],
  );
  const customVariables = collectCustomVariables(variablesValue);

  const sampleData = fields.reduce(
    (acc, field) => ({ ...acc, [field.field]: field.sample }),
    {} as WhatsAppSourceData,
  );

  // Preview with sample data; custom variables show a bracketed hint, since
  // their real value is only typed at send time. Every template made through
  // this form is 'single' mode (the whole message becomes one MSG91
  // variable), so line breaks are collapsed here too — MSG91 rejects them,
  // and the preview should show exactly what gets delivered. MSG91 wraps the
  // composed body with its own fixed wording ("Hii "/",\n\nThank you") on its
  // side — never something the operator types — so the preview adds it too,
  // otherwise the live preview would look complete without it and the
  // operator would be tempted to type it themselves, doubling it up.
  const composedBody = collapseWhatsAppBodyLineBreaks(
    resolveWhatsAppPreview(bodyPreviewValue, fields, sampleData, customVariables),
  );
  const previewText =
    genericTemplate && composedBody
      ? wrapWithGenericTemplate(composedBody, genericTemplate)
      : composedBody;

  /** Insert text at the cursor and leave the caret just after it. */
  const insertAtCursor = (token: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue =
      bodyPreviewValue.slice(0, start) + token + bodyPreviewValue.slice(end);

    setBodyPreviewValue(newValue);

    setTimeout(() => {
      textarea.focus();
      const newPosition = start + token.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const handleInsertToken = (field: WhatsAppTemplateField) => {
    insertAtCursor(field.token);
  };

  /**
   * Adds a placeholder whose value the operator types when sending. It fills
   * a slot in the one approved MSG91 template — it never changes what was
   * approved there.
   */
  const handleInsertCustom = () => {
    const token = nextCustomToken(bodyPreviewValue);
    insertAtCursor(token);
    setCustomLabels((current) => ({ ...current, [token]: '' }));
  };

  const handleCustomLabelChange = (token: string, label: string) => {
    setCustomLabels((current) => ({ ...current, [token]: label }));
  };

  /** Removing a custom variable just means its token is no longer in the text. */
  const handleRemoveCustom = (token: string) => {
    setBodyPreviewValue((current) => current.split(token).join(''));
    setCustomLabels((current) => {
      const next = { ...current };
      delete next[token];
      return next;
    });
  };

  const handleSubmit = async (values: WhatsAppTemplateFormValues) => {
    const payload = {
      ...values,
      bodyPreview: bodyPreviewValue,
      variables: variablesValue,
    };

    if (mode === 'create') {
      await createMutation.mutateAsync(payload);
    } else if (template) {
      await updateMutation.mutateAsync({ id: template.id, payload });
    }

    onClose();
  };

  // Sync local state when template changes
  useEffect(() => {
    setBodyPreviewValue(template?.bodyPreview ?? '');
    setCustomLabels(initialCustomLabels(template?.variables));
  }, [template]);

  return (
    <FormWrapper<WhatsAppTemplateFormValues>
      schema={whatsappTemplateFormSchema}
      defaultValues={{
        label: template?.label ?? '',
        bodyPreview: template?.bodyPreview ?? '',
        variables: template?.variables ?? [],
        isActive: template?.isActive ?? true,
      }}
      onSubmit={handleSubmit}
    >
      {(form) => {
        const { formState, register, watch } = form;
        // Switch draws its track/thumb from a `checked` prop it renders
        // itself — register() alone only wires onChange (checkboxes stay
        // uncontrolled otherwise), so the toggle never visually moved.
        const isActive = watch('isActive');

        return (
          <div className="flex flex-col gap-6">
            {/* The body and variables live in local state so placeholder
                insertion can drive the caret; mirror them into the form. */}
            <SyncToForm
              form={form}
              bodyPreview={bodyPreviewValue}
              variables={variablesValue}
            />

            {/* Template Details */}
            <div className="space-y-4">
              <Input
                label="Template Name"
                placeholder="Challan reminder"
                hint="Shown when picking a template to send."
                {...register('label')}
                error={formState.errors.label?.message}
              />
              <Switch
                label="Active"
                checked={Boolean(isActive)}
                {...register('isActive')}
              />
            </div>

            {/* Message Editor + Live Preview, side by side */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-3">
                <label className="text-sm font-medium">Message Body</label>

                {fieldsQuery.isLoading ? (
                  <div className="text-sm text-muted-foreground">
                    Loading fields...
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {fields.map((field) => (
                      <Button
                        key={field.field}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleInsertToken(field)}
                        className="text-xs"
                      >
                        + {field.label}
                      </Button>
                    ))}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleInsertCustom}
                      leftIcon={<Type className="size-3.5" />}
                      className="text-xs"
                    >
                      Custom text
                    </Button>
                  </div>
                )}

                {genericTemplate ? (
                  <div className="rounded-md border border-dashed bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
                    WhatsApp adds{' '}
                    <span className="font-mono">
                      “{genericTemplate.prefix} ”
                    </span>{' '}
                    before this automatically — don't type it yourself.
                  </div>
                ) : null}

                <Textarea
                  ref={textareaRef}
                  value={bodyPreviewValue}
                  onChange={(event) => setBodyPreviewValue(event.target.value)}
                  placeholder="{{RecipientName}}, please send the challan for..."
                  rows={8}
                  className="font-mono text-sm"
                  error={formState.errors.bodyPreview?.message}
                />

                {genericTemplate ? (
                  <div className="rounded-md border border-dashed bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
                    ...and{' '}
                    <span className="whitespace-pre-wrap font-mono">
                      “{genericTemplate.suffix}”
                    </span>{' '}
                    after it — also automatic.
                  </div>
                ) : null}

                <div className="text-xs text-muted-foreground">
                  Click the buttons above to insert placeholders at the
                  cursor, or just type your own words around them. Line
                  breaks are sent as a single space — WhatsApp's provider
                  doesn't accept them inside this message.
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <label className="text-sm font-medium">Live Preview</label>
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
                <div className="text-xs text-muted-foreground">
                  Sample values used for preview
                </div>
              </div>
            </div>

            {/* Text filled in when sending — only shown when the body uses it */}
            {customVariables.length > 0 && (
              <div className="flex flex-col gap-3">
                <label className="text-sm font-medium">
                  Text filled in when sending
                </label>
                <div className="space-y-2">
                  {customVariables.map((variable) => (
                    <div
                      key={variable.token}
                      className="flex items-center gap-3 rounded-md border bg-card p-3"
                    >
                      <Input
                        value={variable.label}
                        onChange={(event) =>
                          handleCustomLabelChange(
                            variable.token,
                            event.target.value,
                          )
                        }
                        placeholder="Message text"
                        aria-label={`Label for ${variable.token}`}
                        error={
                          variable.label.trim()
                            ? undefined
                            : 'Give this input a name'
                        }
                        containerClassName="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveCustom(variable.token)}
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        aria-label={`Remove ${variable.token}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {formState.errors.variables && (
              <p className="text-sm text-destructive">
                {formState.errors.variables.message}
              </p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 border-t pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={createMutation.isPending || updateMutation.isPending}
              >
                {mode === 'create' ? 'Create Template' : 'Save Changes'}
              </Button>
            </div>
          </div>
        );
      }}
    </FormWrapper>
  );
}
