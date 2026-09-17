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
  | 'buttonGroup'
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
  /** Extra width hint for dense toolbars. */
  className?: string;
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
  /** Controls rendered before the configured fields (e.g. SearchBox + month). */
  leading?: ReactNode;
  /** Optional actions row under the fields (right-aligned, full width). */
  footer?: ReactNode;
  className?: string;
};

const asStringArray = (value: FilterValue): string[] => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value) return [value];
  return [];
};

const fieldShell = (className?: string) =>
  cn('min-w-[10rem] flex-1 basis-[10rem] sm:max-w-xs', className);

/**
 * Compact filter toolbar used across list pages.
 * Prefer putting SearchBox (and month/period) in `leading`.
 */
export function FilterPanel({
  fields,
  values,
  onChange,
  onApply,
  onReset,
  title = 'Filters',
  headerActions,
  leading,
  footer,
  className,
}: FilterPanelProps) {
  const setValue = (key: string, value: FilterValue) => {
    const next = { ...values, [key]: value };
    onChange(next);
    onApply?.(next);
  };

  const fieldNodes = fields.map((field) => {
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
          containerClassName={fieldShell(field.className)}
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
          containerClassName={fieldShell(field.className)}
        />
      );
    }

    if (field.type === 'buttonGroup') {
      const current = String(values[field.key] ?? '');
      const options = [
        ...(field.placeholder
          ? [{ label: field.placeholder, value: '' }]
          : []),
        ...(field.options ?? []),
      ];

      return (
        <div
          key={field.key}
          className={cn(
            'min-w-[12rem] flex-1 basis-[12rem] space-y-1 sm:max-w-none',
            field.className,
          )}
        >
          <p className="text-xs font-medium text-muted-foreground">
            {field.label}
          </p>
          <div
            className="flex flex-wrap gap-1"
            role="group"
            aria-label={field.label}
          >
            {options.map((option) => {
              const selected = current === option.value;
              return (
                <Button
                  key={`${field.key}-${option.value || 'any'}`}
                  type="button"
                  size="sm"
                  variant={selected ? 'primary' : 'outline'}
                  aria-pressed={selected}
                  onClick={() => setValue(field.key, option.value)}
                >
                  {option.label}
                </Button>
              );
            })}
          </div>
        </div>
      );
    }

    if (field.type === 'checkbox') {
      return (
        <Checkbox
          key={field.key}
          label={field.label}
          checked={Boolean(values[field.key])}
          onChange={(event) => setValue(field.key, event.target.checked)}
          containerClassName={fieldShell(field.className)}
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
          containerClassName={fieldShell(field.className)}
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
        containerClassName={fieldShell(field.className)}
      />
    );
  });

  return (
    <div
      className={cn(
        'rounded-lg border border-border/80 bg-card/90 px-2.5 py-2 shadow-sm ring-1 ring-primary/5 backdrop-blur-sm',
        className,
      )}
    >
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-h-8 shrink-0 items-center">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {title}
          </h3>
        </div>

        {leading ? (
          <div className="flex min-w-0 flex-wrap items-end gap-2">
            {leading}
          </div>
        ) : null}

        {fieldNodes}

        {headerActions ? (
          <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
            {headerActions}
          </div>
        ) : null}

        {onReset ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={onReset}
          >
            Reset
          </Button>
        ) : null}
      </div>

      {footer ? (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-2">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/** Distinct locations that are actually used by clients (MasterSheet), for filter dropdowns. */
export const locationOptionsFromClients = (
  clients: {
    locationId?: string | null;
    locationName?: string | null;
  }[] = [],
): SelectOption[] => {
  const byId = new Map<string, string>();
  const byName = new Map<string, string>();

  for (const client of clients) {
    const name = client.locationName?.trim();
    const id = client.locationId?.trim();
    if (id && name) {
      if (!byId.has(id)) byId.set(id, name);
      continue;
    }
    if (name) {
      const key = name.toLowerCase();
      if (!byName.has(key)) byName.set(key, name);
    }
  }

  const named = [...byId.entries()].map(([value, label]) => ({ value, label }));
  if (named.length > 0) {
    return named.sort((left, right) =>
      left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }),
    );
  }

  return [...byName.values()]
    .sort((left, right) =>
      left.localeCompare(right, undefined, { sensitivity: 'base' }),
    )
    .map((label) => ({ value: label, label }));
};

/** Normalize a filter value to a string id list for API query params. */
export const filterIds = (value: FilterValue): string[] => asStringArray(value);
