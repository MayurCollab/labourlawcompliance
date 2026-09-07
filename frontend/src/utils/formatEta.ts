/** Human-readable ETA from remaining milliseconds. */
export function formatEta(remainingMs: number): string {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return 'Almost done…';
  }

  const totalSeconds = Math.ceil(remainingMs / 1000);
  if (totalSeconds < 60) {
    return `~${totalSeconds} sec left`;
  }

  const minutes = Math.ceil(totalSeconds / 60);
  if (minutes === 1) {
    return '~1 min left';
  }
  if (minutes < 60) {
    return `~${minutes} min left`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return hours === 1 ? '~1 hr left' : `~${hours} hr left`;
  }
  return `~${hours} hr ${mins} min left`;
}

/** Estimate remaining ms from elapsed time and processed/total counts. */
export function estimateRemainingMs(
  processed: number,
  total: number,
  elapsedMs: number,
): number | null {
  if (processed < 3 || total <= 0 || elapsedMs <= 0 || processed >= total) {
    return null;
  }

  const rate = processed / elapsedMs;
  const remaining = total - processed;
  return remaining / rate;
}
