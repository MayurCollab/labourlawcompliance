import {
  createContext,
  forwardRef,
  useContext,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

import {
  fieldErrorClassName,
  fieldHintClassName,
  fieldLabelClassName,
} from '@/components/inputs/fieldStyles';
import { cn } from '@/lib/utils';

type RadioGroupContextValue = {
  name: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
};

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

export type RadioGroupProps = {
  name: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
};

export function RadioGroup({
  name,
  value,
  onChange,
  label,
  hint,
  error,
  disabled,
  className,
  children,
}: RadioGroupProps) {
  return (
    <fieldset className={cn('space-y-2', className)} disabled={disabled}>
      {label ? <legend className={fieldLabelClassName}>{label}</legend> : null}
      <RadioGroupContext.Provider value={{ name, value, onChange, disabled }}>
        <div className="space-y-2">{children}</div>
      </RadioGroupContext.Provider>
      {error ? <p className={fieldErrorClassName}>{error}</p> : null}
      {!error && hint ? <p className={fieldHintClassName}>{hint}</p> : null}
    </fieldset>
  );
}

export type RadioProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'name'
> & {
  label?: ReactNode;
  value: string;
};

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ className, label, value, id, disabled, onChange, ...props }, ref) => {
    const group = useContext(RadioGroupContext);
    const radioId = id ?? `${group?.name ?? 'radio'}-${value}`;
    const checked =
      group?.value !== undefined ? group.value === value : props.checked;

    return (
      <label
        htmlFor={radioId}
        className="flex cursor-pointer items-center gap-2 text-sm"
      >
        <input
          ref={ref}
          id={radioId}
          type="radio"
          name={group?.name}
          value={value}
          checked={checked}
          disabled={disabled || group?.disabled}
          onChange={(event) => {
            group?.onChange?.(value);
            onChange?.(event);
          }}
          className={cn(
            'size-4 accent-primary focus-visible:ring-3 focus-visible:ring-ring/50',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
          {...props}
        />
        {label ? <span>{label}</span> : null}
      </label>
    );
  },
);

Radio.displayName = 'Radio';
