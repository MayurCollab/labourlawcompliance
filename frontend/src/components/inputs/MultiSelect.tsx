import { useMemo, useState, type ReactNode } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

import { Button } from '@/components/buttons/Button';
import {
  fieldErrorClassName,
  fieldHintClassName,
  fieldLabelClassName,
} from '@/components/inputs/fieldStyles';
import type { SelectOption } from '@/components/inputs/Select';
import { cn } from '@/lib/utils';

export type MultiSelectProps = {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  options: SelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  containerClassName?: string;
};

export function MultiSelect({
  label,
  hint,
  error,
  options,
  value,
  onChange,
  placeholder = 'Select…',
  disabled = false,
  containerClassName,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => options.filter((option) => value.includes(option.value)),
    [options, value],
  );

  const toggle = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((item) => item !== optionValue));
      return;
    }
    onChange([...value, optionValue]);
  };

  return (
    <div className={cn('relative space-y-1.5', containerClassName)}>
      {label ? <p className={fieldLabelClassName}>{label}</p> : null}

      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-invalid={Boolean(error) || undefined}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex min-h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-1.5 text-left text-sm',
          'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-destructive',
        )}
      >
        <div className="flex flex-1 flex-wrap gap-1">
          {selected.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            selected.map((option) => (
              <span
                key={option.value}
                className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs"
              >
                {option.label}
                <span
                  role="button"
                  tabIndex={0}
                  className="rounded hover:bg-background"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggle(option.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      event.stopPropagation();
                      toggle(option.value);
                    }
                  }}
                >
                  <X className="size-3" />
                </span>
              </span>
            ))
          )}
        </div>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-popover p-1 shadow-md"
          >
            {options.map((option) => {
              const isSelected = value.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={option.disabled}
                  onClick={() => toggle(option.value)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                    'hover:bg-muted disabled:opacity-50',
                    isSelected && 'bg-muted',
                  )}
                >
                  <Check
                    className={cn(
                      'size-4',
                      isSelected ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {option.label}
                </button>
              );
            })}
            <div className="border-t border-border p-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setOpen(false)}
              >
                Done
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {error ? <p className={fieldErrorClassName}>{error}</p> : null}
      {!error && hint ? <p className={fieldHintClassName}>{hint}</p> : null}
    </div>
  );
}
