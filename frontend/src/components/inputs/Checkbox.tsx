import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

import {
  fieldErrorClassName,
  fieldHintClassName,
} from '@/components/inputs/fieldStyles';
import { cn } from '@/lib/utils';

export type CheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    { className, label, hint, error, id, containerClassName, ...props },
    ref,
  ) => {
    const generatedId = useId();
    const checkboxId = id ?? props.name ?? generatedId;
    const hintId = `${checkboxId}-hint`;
    const errorId = `${checkboxId}-error`;
    const describedBy = [
      error ? errorId : null,
      !error && hint ? hintId : null,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={cn('space-y-1', containerClassName)}>
        <label
          htmlFor={checkboxId}
          className="flex cursor-pointer items-start gap-2 text-sm"
        >
          <input
            ref={ref}
            id={checkboxId}
            type="checkbox"
            className={cn(
              'mt-0.5 size-4 rounded border-input accent-primary',
              'focus-visible:ring-3 focus-visible:ring-ring/50',
              'disabled:cursor-not-allowed disabled:opacity-50',
              className,
            )}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={describedBy || undefined}
            {...props}
          />
          {label ? <span>{label}</span> : null}
        </label>
        {error ? (
          <p id={errorId} role="alert" className={fieldErrorClassName}>
            {error}
          </p>
        ) : null}
        {!error && hint ? (
          <p id={hintId} className={fieldHintClassName}>
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);

Checkbox.displayName = 'Checkbox';
