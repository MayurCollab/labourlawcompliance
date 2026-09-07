import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

import {
  fieldErrorClassName,
  fieldHintClassName,
  fieldLabelClassName,
} from '@/components/inputs/fieldStyles';
import type { SelectOption } from '@/components/inputs/Select';
import { cn } from '@/lib/utils';

export type SearchableSelectProps = {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  containerClassName?: string;
  id?: string;
};

/**
 * Single-select with type-to-filter, matching MultiSelect chrome.
 */
export function SearchableSelect({
  label,
  hint,
  error,
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  disabled = false,
  clearable = false,
  containerClassName,
  id,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(needle),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 0);
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={cn('relative space-y-1.5', containerClassName)}
    >
      {label ? (
        <label htmlFor={id} className={fieldLabelClassName}>
          {label}
        </label>
      ) : null}

      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={Boolean(error) || undefined}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 text-left text-sm',
          'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-destructive',
        )}
      >
        <span
          className={cn(
            'min-w-0 flex-1 truncate',
            !selected && 'text-muted-foreground',
          )}
        >
          {selected?.label ?? placeholder}
        </span>
        {clearable && selected ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="Clear selection"
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              onChange('');
              setOpen(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                onChange('');
                setOpen(false);
              }
            }}
          >
            <X className="size-3.5" />
          </span>
        ) : null}
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-md"
          >
            <div className="flex items-center gap-2 border-b border-border px-2 py-1.5">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                aria-label={searchPlaceholder}
              />
            </div>
            <div
              role="listbox"
              className="max-h-56 overflow-auto p-1"
            >
              {filtered.length === 0 ? (
                <p className="px-2 py-2 text-sm text-muted-foreground">
                  No matches
                </p>
              ) : (
                filtered.map((option) => {
                  const isSelected = option.value === value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={option.disabled}
                      onClick={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                        'hover:bg-muted disabled:opacity-50',
                        isSelected && 'bg-muted',
                      )}
                    >
                      <Check
                        className={cn(
                          'size-4 shrink-0',
                          isSelected ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <span className="truncate text-left">{option.label}</span>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {error ? <p className={fieldErrorClassName}>{error}</p> : null}
      {!error && hint ? <p className={fieldHintClassName}>{hint}</p> : null}
    </div>
  );
}
