import { Input } from '@/components/inputs/Input';
import type {
  WhatsAppCustomValues,
  WhatsAppCustomVariable,
} from '@/types/whatsappTemplate.types';

type WhatsAppCustomValueFieldsProps = {
  variables: WhatsAppCustomVariable[];
  values: WhatsAppCustomValues;
  onChange: (token: string, value: string) => void;
  disabled?: boolean;
  /** Shown once under the inputs — e.g. to say the text goes to every recipient. */
  hint?: string;
};

/** True when every custom variable has text — nothing may be sent empty. */
export const hasAllCustomValues = (
  variables: WhatsAppCustomVariable[],
  values: WhatsAppCustomValues,
): boolean =>
  variables.every(
    (variable) => (values[variable.token] ?? '').trim().length > 0,
  );

/**
 * Inputs for a template's custom variables — the text the operator composes
 * for this send. Shared by the single-send modal and the bulk preview.
 */
export function WhatsAppCustomValueFields({
  variables,
  values,
  onChange,
  disabled,
  hint,
}: WhatsAppCustomValueFieldsProps) {
  if (variables.length === 0) return null;

  return (
    <div className="space-y-3">
      {variables.map((variable) => {
        const value = values[variable.token] ?? '';
        return (
          <Input
            key={variable.token}
            label={`${variable.label || 'Custom text'} *`}
            value={value}
            onChange={(event) => onChange(variable.token, event.target.value)}
            placeholder="Type the text for this message"
            disabled={disabled}
            error={value.trim() ? undefined : 'This text is required'}
          />
        );
      })}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
