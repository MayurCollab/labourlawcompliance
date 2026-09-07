import { LoadingSpinner } from '@/components/common/LoadingSpinner';

/**
 * Shown while a lazily-loaded route chunk downloads.
 *
 * Announced politely rather than assertively: on a fast connection the chunk
 * arrives in a few hundred milliseconds and interrupting a screen reader for
 * that would be worse than saying nothing.
 */
export function RouteFallback() {
  return (
    <div
      className="flex min-h-[50vh] w-full items-center justify-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-3">
        <LoadingSpinner size="lg" label="Loading page" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}
