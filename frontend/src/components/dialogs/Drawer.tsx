import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

import { Button } from '@/components/buttons/Button';
import { cn } from '@/lib/utils';

export type DrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  side?: 'left' | 'right';
  className?: string;
};

export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  side = 'right',
  className,
}: DrawerProps) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onOpenChange]);

  if (typeof document === 'undefined') return null;

  const fromX = side === 'right' ? 24 : -24;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex">
          <motion.button
            type="button"
            aria-label="Close drawer overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50"
            onClick={() => onOpenChange(false)}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, x: fromX }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: fromX }}
            transition={{ duration: 0.2 }}
            className={cn(
              'relative z-10 flex h-full w-full max-w-md flex-col border-border bg-card text-card-foreground shadow-xl',
              side === 'right' ? 'ml-auto border-l' : 'mr-auto border-r',
              className,
            )}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div className="space-y-1">
                {title ? (
                  <h2 className="text-base font-semibold tracking-tight">
                    {title}
                  </h2>
                ) : null}
                {description ? (
                  <p className="text-sm text-muted-foreground">{description}</p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Close"
                onClick={() => onOpenChange(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto px-5 py-4">{children}</div>
            {footer ? (
              <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
                {footer}
              </div>
            ) : null}
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
