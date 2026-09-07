import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

import {
  fieldControlClassName,
  fieldErrorClassName,
  fieldHintClassName,
  fieldLabelClassName,
} from '@/components/inputs/fieldStyles';
import { cn } from '@/lib/utils';

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  leftAddon?: ReactNode;
  rightAddon?: ReactNode;
  containerClassName?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      hint,
      error,
      leftAddon,
      rightAddon,
      id,
      containerClassName,
      disabled,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id ?? props.name ?? generatedId;
    const hintId = `${inputId}-hint`;
    const errorId = `${inputId}-error`;
    const describedBy = [
      error ? errorId : null,
      !error && hint ? hintId : null,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={cn('space-y-1.5', containerClassName)}>
        {label ? (
          <label htmlFor={inputId} className={fieldLabelClassName}>
            {label}
          </label>
        ) : null}
        <div className="relative">
          {leftAddon ? (
            <span
              className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground"
              aria-hidden
            >
              {leftAddon}
            </span>
          ) : null}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={describedBy || undefined}
            className={cn(
              fieldControlClassName,
              'h-9',
              leftAddon && 'pl-9',
              rightAddon && 'pr-9',
              className,
            )}
            {...props}
          />
          {rightAddon ? (
            <span className="absolute inset-y-0 right-0 flex items-center pr-2">
              {rightAddon}
            </span>
          ) : null}
        </div>
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

Input.displayName = 'Input';
