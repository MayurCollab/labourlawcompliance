import { forwardRef, type ReactNode, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

import {
  fieldControlClassName,
  fieldErrorClassName,
  fieldHintClassName,
  fieldLabelClassName,
} from '@/components/inputs/fieldStyles';
import { cn } from '@/lib/utils';

export type SelectOption = {
  label: string;
  value: string;
  disabled?: boolean;
};

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  options: SelectOption[];
  placeholder?: string;
  containerClassName?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      hint,
      error,
      options,
      placeholder = 'Select…',
      id,
      containerClassName,
      ...props
    },
    ref,
  ) => {
    const selectId = id ?? props.name;

    return (
      <div className={cn('space-y-1.5', containerClassName)}>
        {label ? (
          <label htmlFor={selectId} className={fieldLabelClassName}>
            {label}
          </label>
        ) : null}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={Boolean(error) || undefined}
            className={cn(
              fieldControlClassName,
              'h-9 appearance-none pr-9',
              className,
            )}
            {...props}
          >
            {placeholder ? (
              <option value="" disabled={props.required}>
                {placeholder}
              </option>
            ) : null}
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        {error ? <p className={fieldErrorClassName}>{error}</p> : null}
        {!error && hint ? <p className={fieldHintClassName}>{hint}</p> : null}
      </div>
    );
  },
);

Select.displayName = 'Select';
