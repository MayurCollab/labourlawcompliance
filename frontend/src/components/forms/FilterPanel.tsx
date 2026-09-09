import type { ReactNode } from 'react';

import { Button } from '@/components/buttons/Button';
import { Checkbox } from '@/components/inputs/Checkbox';
import { DatePicker } from '@/components/inputs/DatePicker';
import { Input } from '@/components/inputs/Input';
import { Select, type SelectOption } from '@/components/inputs/Select';
import { cn } from '@/lib/utils';

export type FilterFieldType = 'text' | 'select' | 'checkbox' | 'date';

export type FilterFieldConfig = {
  key: string;
  label: string;
  type: FilterFieldType;
  placeholder?: string;
  options?: SelectOption[];
};

export type FilterValues = Record<string, string | boolean | undefined>;

export type FilterPanelProps = {
  fields: FilterFieldConfig[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  /** Called on every field change (no separate Apply click). */
  onApply?: (values: FilterValues) => void;
  onReset?: () => void;
  title?: ReactNode;
  className?: string;
};

/**
 * Generic filter panel driven by a field config array.
 * Changes apply immediately when `onApply` is provided.
 */
export function FilterPanel({
  fields,
  values,
  onChange,
  onApply,
  onReset,
  title = 'Filters',
  className,
}: FilterPanelProps) {
  const setValue = (key: string, value: string | boolean | undefined) => {
    const next = { ...values, [key]: value };
    onChange(next);
    onApply?.(next);
  };

  return (
    <div
      className={cn(
        'space-y-4 rounded-xl border border-border/80 bg-card/90 p-4 shadow-sm ring-1 ring-primary/5 backdrop-blur-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {onReset ? (
          <Button type="button" variant="ghost" size="sm" onClick={onReset}>
            Reset
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((field) => {
          if (field.type === 'select') {
            return (
              <Select
                key={field.key}
                label={field.label}
                options={field.options ?? []}
                placeholder={field.placeholder}
                value={String(values[field.key] ?? '')}
                onChange={(event) => setValue(field.key, event.target.value)}
              />
            );
          }

          if (field.type === 'checkbox') {
            return (
              <Checkbox
                key={field.key}
                label={field.label}
                checked={Boolean(values[field.key])}
                onChange={(event) => setValue(field.key, event.target.checked)}
              />
            );
          }

          if (field.type === 'date') {
            return (
              <DatePicker
                key={field.key}
                label={field.label}
                value={String(values[field.key] ?? '')}
                onChange={(event) => setValue(field.key, event.target.value)}
              />
            );
          }

          return (
            <Input
              key={field.key}
              label={field.label}
              placeholder={field.placeholder}
              value={String(values[field.key] ?? '')}
              onChange={(event) => setValue(field.key, event.target.value)}
            />
          );
        })}
      </div>
    </div>
  );
}
