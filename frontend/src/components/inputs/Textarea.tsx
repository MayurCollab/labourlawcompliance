import { forwardRef, type ReactNode, type TextareaHTMLAttributes } from 'react';

import {
  fieldControlClassName,
  fieldErrorClassName,
  fieldHintClassName,
  fieldLabelClassName,
} from '@/components/inputs/fieldStyles';
import { cn } from '@/lib/utils';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  containerClassName?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      hint,
      error,
      id,
      containerClassName,
      rows = 4,
      ...props
    },
    ref,
  ) => {
    const textareaId = id ?? props.name;

    return (
      <div className={cn('space-y-1.5', containerClassName)}>
        {label ? (
          <label htmlFor={textareaId} className={fieldLabelClassName}>
            {label}
          </label>
        ) : null}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          aria-invalid={Boolean(error) || undefined}
          className={cn(fieldControlClassName, 'min-h-20 resize-y', className)}
          {...props}
        />
        {error ? <p className={fieldErrorClassName}>{error}</p> : null}
        {!error && hint ? <p className={fieldHintClassName}>{hint}</p> : null}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
