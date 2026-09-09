import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';

import { Button } from '@/components/buttons/Button';
import { cn } from '@/lib/utils';

export type RowActionsMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  /** Accessible name for the trigger. */
  label?: string;
  className?: string;
  menuClassName?: string;
};

/**
 * Portals the dropdown to document.body so AG Grid cell clipping cannot hide it.
 */
export function RowActionsMenu({
  open,
  onOpenChange,
  children,
  label = 'Row actions',
  className,
  menuClassName,
}: RowActionsMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setCoords(null);
      return;
    }

    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuWidth = menuRef.current?.offsetWidth ?? 176;
      const menuHeight = menuRef.current?.offsetHeight ?? 120;
      const gutter = 8;
      let left = rect.right - menuWidth;
      left = Math.max(gutter, Math.min(left, window.innerWidth - menuWidth - gutter));
      let top = rect.bottom + 4;
      if (top + menuHeight > window.innerHeight - gutter) {
        top = Math.max(gutter, rect.top - menuHeight - 4);
      }
      setCoords({ top, left });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      onOpenChange(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <div className={cn('relative flex justify-end', className)}>
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(event) => {
          event.stopPropagation();
          onOpenChange(!open);
        }}
      >
        <MoreHorizontal className="size-4" />
      </Button>
      {open && coords
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              className={cn(
                'fixed z-[80] w-44 rounded-lg border border-border bg-popover p-1 shadow-lg',
                menuClassName,
              )}
              style={{ top: coords.top, left: coords.left }}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export type RowActionItemProps = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  destructive?: boolean;
  className?: string;
};

export function RowActionItem({
  children,
  onClick,
  disabled,
  title,
  destructive,
  className,
}: RowActionItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      title={title}
      className={cn(
        'flex w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50',
        destructive && 'text-destructive',
        className,
      )}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}
