import type { ReactNode } from 'react';

import { Button } from '@/components/buttons/Button';
import { Checkbox } from '@/components/inputs/Checkbox';
import { DatePicker } from '@/components/inputs/DatePicker';
import { Input } from '@/components/inputs/Input';
import { MultiSelect } from '@/components/inputs/MultiSelect';
import { Select, type SelectOption } from '@/components/inputs/Select';
import { cn } from '@/lib/utils';

export type FilterFieldType =
  | 'text'
  | 'select'
  | 'multiSelect'
  | 'checkbox'
  | 'date';

export type FilterFieldConfig = {
  key: string;
  label: string;
  type: FilterFieldType;
  placeholder?: string;
  searchPlaceholder?: string;
  options?: SelectOption[];
};

export type FilterValue = string | boolean | string[] | undefined;

export type FilterValues = Record<string, FilterValue>;

export type FilterPanelProps = {
  fields: FilterFieldConfig[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  /** Called on every field change (no separate Apply click). */
  onApply?: (values: FilterValues) => void;
  onReset?: () => void;
  title?: ReactNode;
  /** Optional actions next to Reset (e.g. toggle filters). */
  headerActions?: ReactNode;
  /** Optional actions row under the fields (right-aligned, full width). */
  footer?: ReactNode;
  className?: string;
};

const asStringArray = (value: FilterValue): string[] => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value) return [value];
  return [];
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
  headerActions,
  footer,
  className,
}: FilterPanelProps) {
  const setValue = (key: string, value: FilterValue) => {
    const next = { ...values, [key]: value };
    onChange(next);
    onApply?.(next);
  };

  return (
    <div
      className={cn(
        'space-y-3 rounded-xl border border-border/80 bg-card/90 p-4 shadow-sm ring-1 ring-primary/5 backdrop-blur-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {headerActions || onReset ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {headerActions}
            {onReset ? (
              <Button type="button" variant="ghost" size="sm" onClick={onReset}>
                Reset
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((field) => {
          if (field.type === 'multiSelect') {
            return (
              <MultiSelect
                key={field.key}
                label={field.label}
                options={field.options ?? []}
                placeholder={field.placeholder}
                searchPlaceholder={field.searchPlaceholder ?? 'Search…'}
                value={asStringArray(values[field.key])}
                onChange={(next) => setValue(field.key, next)}
              />
            );
          }

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

      {footer ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/** Normalize a filter value to a string id list for API query params. */
export const filterIds = (value: FilterValue): string[] => asStringArray(value);
