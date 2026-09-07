import { cn } from '@/lib/utils';

/** Shared field chrome used by Input, Select, Textarea, Date/Time pickers. */
export const fieldControlClassName = cn(
  'flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm',
  'shadow-xs transition-[color,box-shadow] outline-none',
  'placeholder:text-muted-foreground',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'disabled:cursor-not-allowed disabled:opacity-50',
  'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
);

export const fieldLabelClassName =
  'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70';

export const fieldHintClassName = 'text-xs text-muted-foreground';

export const fieldErrorClassName = 'text-xs text-destructive';
