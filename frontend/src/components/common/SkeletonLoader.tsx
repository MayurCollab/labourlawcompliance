import { cn } from '@/lib/utils';

type SkeletonProps = {
  className?: string;
};

function Bone({ className }: SkeletonProps) {
  return (
    <div
      className={cn('llc-skeleton-bone', className)}
      aria-hidden
    />
  );
}

export function SkeletonText({ className }: SkeletonProps) {
  return <Bone className={cn('h-4 w-full', className)} />;
}

export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'space-y-3 rounded-xl border border-border p-4',
        className,
      )}
    >
      <Bone className="h-5 w-1/3" />
      <Bone className="h-4 w-full" />
      <Bone className="h-4 w-5/6" />
      <Bone className="h-24 w-full" />
    </div>
  );
}

export function SkeletonTableRow({
  columns = 4,
  className,
}: SkeletonProps & { columns?: number }) {
  return (
    <div
      className={cn(
        'grid gap-3 border-b border-border px-4 py-3',
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: columns }).map((_, index) => (
        <Bone key={index} className="h-4 w-full" />
      ))}
    </div>
  );
}

export const SkeletonLoader = {
  Text: SkeletonText,
  Card: SkeletonCard,
  TableRow: SkeletonTableRow,
};
