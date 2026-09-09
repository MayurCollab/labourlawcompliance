import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

export type LoadingSpinnerProps = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
};

const sizeClass = {
  sm: 'size-4',
  md: 'size-6',
  lg: 'size-8',
} as const;

export function LoadingSpinner({
  size = 'md',
  className,
  label = 'Loading',
}: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn('inline-flex items-center justify-center', className)}
    >
      <Loader2 className={cn('animate-spin text-primary', sizeClass[size])} />
    </div>
  );
}
