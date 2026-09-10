import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
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

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: 'bottom' | 'top';
};

/**
 * Single-select with type-to-filter. Menu is portaled so it is not clipped
 * by page/table overflow.
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
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
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

  const updateMenuPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 4;
    const viewportPadding = 8;
    const preferredMax = 280;
    const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPadding;
    const spaceAbove = rect.top - gap - viewportPadding;
    const placement =
      spaceBelow < 160 && spaceAbove > spaceBelow ? 'top' : 'bottom';
    const available = placement === 'bottom' ? spaceBelow : spaceAbove;
    const maxHeight = Math.max(140, Math.min(preferredMax, available));
    const top =
      placement === 'bottom'
        ? rect.bottom + gap
        : Math.max(viewportPadding, rect.top - gap - maxHeight);

    setMenuPosition({
      top,
      left: rect.left,
      width: rect.width,
      maxHeight,
      placement,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }
    updateMenuPosition();
    const onReposition = () => updateMenuPosition();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 0);
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const menu =
    open && menuPosition && typeof document !== 'undefined'
      ? createPortal(
          <AnimatePresence>
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: menuPosition.placement === 'bottom' ? -4 : 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: menuPosition.placement === 'bottom' ? -4 : 4 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'fixed',
                top: menuPosition.top,
                left: menuPosition.left,
                width: menuPosition.width,
                maxHeight: menuPosition.maxHeight,
                zIndex: 80,
              }}
              className="flex flex-col overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
            >
              <div className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1.5">
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
                className="min-h-0 flex-1 overflow-y-auto p-1"
              >
                {filtered.length === 0 ? (
                  <p className="px-2 py-2 text-sm text-muted-foreground">
                    {options.length === 0 ? 'No options available' : 'No matches'}
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
          </AnimatePresence>,
          document.body,
        )
      : null;

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
        ref={triggerRef}
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

      {menu}

      {error ? <p className={fieldErrorClassName}>{error}</p> : null}
      {!error && hint ? <p className={fieldHintClassName}>{hint}</p> : null}
    </div>
  );
}
