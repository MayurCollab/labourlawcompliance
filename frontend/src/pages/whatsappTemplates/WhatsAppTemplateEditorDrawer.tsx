import { useEffect, useRef, useState } from 'react';
import { ChevronUp, ChevronDown, Trash2, RefreshCw } from 'lucide-react';

import { Button } from '@/components/buttons';
import { Drawer } from '@/components/dialogs/Drawer';
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
  WhatsAppTemplate,
  WhatsAppTemplateField,
} from '@/types/whatsappTemplate.types';
import {
  extractVariablesFromBodyPreview,
  resolveWhatsAppPreview,
} from '@/utils/whatsappTemplatePreview';
import {
  whatsappTemplateFormSchema,
  type WhatsAppTemplateFormValues,
} from '@/validations/whatsappTemplates.validation';

type WhatsAppTemplateEditorDrawerProps = {
  template?: WhatsAppTemplate | null;
  onClose: () => void;
};

export function WhatsAppTemplateEditorDrawer({
  template,
  onClose,
}: WhatsAppTemplateEditorDrawerProps) {
  const mode = template ? 'edit' : 'create';

  return (
    <Drawer
      open
      onOpenChange={(open) => !open && onClose()}
      title={mode === 'create' ? 'Create WhatsApp Template' : 'Edit WhatsApp Template'}
      description={
        mode === 'create'
          ? 'Create a new WhatsApp message template. Templates must be pre-approved in MSG91 before use.'
          : 'Edit the template mapping and preview. The MSG91 template must already be approved.'
      }
      size="xl"
    >
      <EditorBody
        key={template?.id ?? 'new'}
        mode={mode}
        template={template}
        onClose={onClose}
      />
    </Drawer>
  );
}

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
  const [variablesValue, setVariablesValue] = useState(
    template?.variables ?? [],
  );

  const fields = fieldsQuery.data?.fields ?? [];

  // Generate preview with sample data
  const previewText = resolveWhatsAppPreview(
    bodyPreviewValue,
    fields,
    fields.reduce(
      (acc, field) => ({ ...acc, [field.field]: field.sample }),
      {} as Record<string, string>,
    ),
  );

  const handleInsertToken = (field: WhatsAppTemplateField) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = bodyPreviewValue.slice(0, start);
    const after = bodyPreviewValue.slice(end);
    const newValue = before + field.token + after;

    setBodyPreviewValue(newValue);

    // Set cursor after inserted token
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + field.token.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const handleSyncVariables = () => {
    const extracted = extractVariablesFromBodyPreview(bodyPreviewValue, fields);
    setVariablesValue(extracted);
  };

  const handleMoveVariable = (index: number, direction: 'up' | 'down') => {
    const newVariables = [...variablesValue];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newVariables.length) return;
    [newVariables[index], newVariables[swapIndex]] = [
      newVariables[swapIndex],
      newVariables[index],
    ];
    setVariablesValue(newVariables);
  };

  const handleRemoveVariable = (index: number) => {
    setVariablesValue(variablesValue.filter((_, i) => i !== index));
  };

  const handleSubmit = async (values: WhatsAppTemplateFormValues) => {
    const payload = {
      ...values,
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
    setVariablesValue(template?.variables ?? []);
  }, [template]);

  return (
    <FormWrapper<WhatsAppTemplateFormValues>
      schema={whatsappTemplateFormSchema}
      defaultValues={{
        label: template?.label ?? '',
        msg91TemplateName: template?.msg91TemplateName ?? '',
        namespace: template?.namespace ?? '',
        languageCode: template?.languageCode ?? 'en',
        bodyPreview: template?.bodyPreview ?? '',
        variables: template?.variables ?? [],
        isActive: template?.isActive ?? true,
      }}
      onSubmit={handleSubmit}
      mode="onChange"
    >
      {({ formState, watch, setValue }) => {
        // Watch bodyPreview field and sync with local state
        const watchedBodyPreview = watch('bodyPreview');
        useEffect(() => {
          if (watchedBodyPreview !== bodyPreviewValue) {
            setBodyPreviewValue(watchedBodyPreview);
          }
        }, [watchedBodyPreview]);

        // Update form when local variables change
        useEffect(() => {
          setValue('variables', variablesValue);
        }, [variablesValue, setValue]);

        return (
          <div className="flex flex-col gap-6">
            {/* Template Details */}
            <div className="space-y-4">
              <Input name="label" label="Template Name" placeholder="Form 5 Reminder" />
              <Input
                name="msg91TemplateName"
                label="MSG91 Template Name"
                placeholder="labour_law"
              />
              <Input
                name="namespace"
                label="Namespace"
                placeholder="f81e39d2_346b_4801_8a3d_b74b0141f1e2"
              />
              <Input
                name="languageCode"
                label="Language Code"
                placeholder="en"
              />
              <Switch name="isActive" label="Active" />
            </div>

            {/* Split View: Message Editor + Preview */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Left: Message Editor */}
              <div className="flex flex-col gap-3">
                <label className="text-sm font-medium">Message Body</label>

                {/* Placeholder Chips */}
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
                  </div>
                )}

                <Textarea
                  ref={textareaRef}
                  name="bodyPreview"
                  placeholder="Hii {{RecipientName}}, Please find above Form-5 and Salary details..."
                  rows={8}
                  className="font-mono text-sm"
                />

                <div className="text-xs text-muted-foreground">
                  Click the buttons above to insert placeholders at cursor position
                </div>
              </div>

              {/* Right: Live Preview */}
              <div className="flex flex-col gap-3">
                <label className="text-sm font-medium">Live Preview</label>
                <div className="rounded-md border bg-muted/30 p-4">
                  <div className="whitespace-pre-wrap break-words text-sm">
                    {previewText || (
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

            {/* Variables Mapping */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Variable Mapping (body_1, body_2, ...)
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSyncVariables}
                  className="gap-2"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Sync from placeholders
                </Button>
              </div>

              {variablesValue.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                  No variables mapped. Click "Sync from placeholders" or add the message
                  body first.
                </div>
              ) : (
                <div className="space-y-2">
                  {variablesValue.map((variable, index) => {
                    const field = fields.find((f) => f.field === variable.field);
                    return (
                      <div
                        key={index}
                        className="flex items-center gap-3 rounded-md border bg-card p-3"
                      >
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMoveVariable(index, 'up')}
                            disabled={index === 0}
                            className="h-7 w-7 p-0"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMoveVariable(index, 'down')}
                            disabled={index === variablesValue.length - 1}
                            className="h-7 w-7 p-0"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-muted-foreground">
                              body_{index + 1}
                            </span>
                            <span className="text-sm">→</span>
                            <span className="font-medium text-sm">
                              {field?.label ?? variable.field}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {field?.token}
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveVariable(index)}
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {formState.errors.variables && (
                <p className="text-sm text-destructive">
                  {formState.errors.variables.message}
                </p>
              )}
            </div>

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
