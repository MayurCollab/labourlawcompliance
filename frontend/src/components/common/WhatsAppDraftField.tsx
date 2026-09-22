import { useEffect, useState } from 'react';

import { Input } from '@/components/inputs/Input';
import { cn } from '@/lib/utils';
import { isValidWhatsAppMobile } from '@/utils/whatsappPhone';

export const whatsAppFieldHighlightClassName =
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
 * Empty fields, and invalid mobile numbers, are highlighted so they're easy to
 * spot and fill in — even recipient name, which is optional and simply skipped
 * in the message when left blank, stays highlighted purely as a visual cue,
 * never a block. Values persist on blur / Enter.
 */
export function WhatsAppDraftField({
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
        highlighted && whatsAppFieldHighlightClassName,
      )}
      aria-label={placeholder}
    />
  );
}
