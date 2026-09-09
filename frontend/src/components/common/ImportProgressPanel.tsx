import { useEffect, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';
import type { ImportProgressEvent } from '@/types/uploads.types';
import { estimateRemainingMs, formatEta } from '@/utils/formatEta';

type ImportProgressPanelProps = {
  progress: ImportProgressEvent;
  /** Wall-clock start of the import (survives navigating away and back). */
  startedAt?: number;
  fileName?: string;
  className?: string;
};

export function ImportProgressPanel({
  progress,
  startedAt: startedAtProp,
  fileName,
  className,
}: ImportProgressPanelProps) {
  const [startedAt] = useState(() => startedAtProp ?? Date.now());
  const [now, setNow] = useState(() => Date.now());
  const effectiveStartedAt = startedAtProp ?? startedAt;

  useEffect(() => {
    if (progress.phase === 'rematch' || progress.processed >= progress.total) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 500);

    return () => window.clearInterval(timer);
  }, [progress.phase, progress.processed, progress.total]);

  const percent =
    progress.total > 0
      ? Math.min(
          100,
          Math.round((progress.processed / progress.total) * 100),
        )
      : 0;

  const remaining = Math.max(0, progress.total - progress.processed);
  const elapsedMs = now - effectiveStartedAt;
  const etaMs = estimateRemainingMs(
    progress.processed,
    progress.total,
    elapsedMs,
  );

  const phaseLabel = useMemo(() => {
    if (progress.phase === 'rematch') {
      return 'Matching employees to clients…';
    }
    if (progress.processed >= progress.total && progress.total > 0) {
      return 'Finishing up…';
    }
    return 'Saving rows to database…';
  }, [progress.phase, progress.processed, progress.total]);

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-muted/40 p-4 space-y-3',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{phaseLabel}</p>
          {fileName ? (
            <p className="text-sm text-muted-foreground">{fileName}</p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            {progress.processed.toLocaleString()} of{' '}
            {progress.total.toLocaleString()} rows done
            {remaining > 0 && progress.phase === 'import'
              ? ` · ${remaining.toLocaleString()} left`
              : ''}
            {etaMs !== null && progress.phase === 'import'
              ? ` · ${formatEta(etaMs)}`
              : ''}
          </p>
        </div>
        <p className="text-sm font-semibold tabular-nums">{percent}%</p>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full bg-primary transition-[width] duration-300 ease-out',
            progress.phase === 'rematch' && 'animate-pulse',
          )}
          style={{
            width:
              progress.phase === 'rematch'
                ? '100%'
                : `${Math.max(percent, progress.processed > 0 ? 2 : 0)}%`,
          }}
        />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          New: <strong className="text-foreground">{progress.inserted}</strong>
        </span>
        <span>
          Updated:{' '}
          <strong className="text-foreground">{progress.updated}</strong>
        </span>
        <span>
          Unchanged:{' '}
          <strong className="text-foreground">{progress.unchanged}</strong>
        </span>
        {progress.skipped > 0 ? (
          <span>
            Skipped:{' '}
            <strong className="text-foreground">{progress.skipped}</strong>
          </span>
        ) : null}
        {progress.unmatched > 0 ? (
          <span>
            Unmatched:{' '}
            <strong className="text-foreground">{progress.unmatched}</strong>
          </span>
        ) : null}
      </div>
    </div>
  );
}
