import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

import {
  fieldErrorClassName,
  fieldHintClassName,
} from '@/components/inputs/fieldStyles';
import { cn } from '@/lib/utils';

export type SwitchProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'role'
> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
};

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  (
    {
      className,
      label,
      hint,
      error,
      id,
      checked,
      disabled,
      containerClassName,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const switchId = id ?? props.name ?? generatedId;
    const hintId = `${switchId}-hint`;
    const errorId = `${switchId}-error`;
    const describedBy = [
      error ? errorId : null,
      !error && hint ? hintId : null,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={cn('space-y-1', containerClassName)}>
        <label
          htmlFor={switchId}
          className="inline-flex cursor-pointer items-center gap-3 text-sm"
        >
          <span
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors',
              checked ? 'border-primary bg-primary' : 'border-input bg-muted',
              disabled && 'opacity-50',
              className,
            )}
          >
            <input
              ref={ref}
              id={switchId}
              type="checkbox"
              role="switch"
              checked={checked}
              disabled={disabled}
              aria-checked={Boolean(checked)}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={describedBy || undefined}
              className="peer sr-only"
              {...props}
            />
            <span
              aria-hidden
              className={cn(
                'pointer-events-none absolute left-0.5 size-3.5 rounded-full bg-background shadow transition-transform',
                checked && 'translate-x-4',
              )}
            />
          </span>
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

Switch.displayName = 'Switch';
