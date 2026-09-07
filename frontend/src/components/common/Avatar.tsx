import { cn } from '@/lib/utils';
import { resolveUploadUrl } from '@/utils/uploads';

export type AvatarProps = {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Eager for above-the-fold (navbar); lazy elsewhere. */
  loading?: 'lazy' | 'eager';
};

const sizeClass = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-base',
} as const;

const sizePx = { sm: 32, md: 40, lg: 56 } as const;

const initialsFromName = (name?: string) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
};

export function Avatar({
  src,
  alt,
  name,
  size = 'md',
  className,
  loading = 'lazy',
}: AvatarProps) {
  const resolved = resolveUploadUrl(src);

  if (resolved) {
    return (
      <img
        src={resolved}
        alt={alt ?? name ?? 'Avatar'}
        width={sizePx[size]}
        height={sizePx[size]}
        loading={loading}
        decoding="async"
        className={cn(
          'rounded-full object-cover ring-1 ring-border',
          sizeClass[size],
          className,
        )}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={alt ?? name ?? 'Avatar'}
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground ring-1 ring-border',
        sizeClass[size],
        className,
      )}
    >
      {initialsFromName(name)}
    </span>
  );
}
