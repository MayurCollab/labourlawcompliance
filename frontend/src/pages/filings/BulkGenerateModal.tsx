import { useEffect, useMemo, useRef, useState } from 'react';

import { filingsApi } from '@/api/filings.api';
import { Button } from '@/components/buttons';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/dialogs/Modal';
import type {
  BulkGeneratePayload,
  BulkGenerateProgressEvent,
  BulkGenerateReport,
  BulkGenerateRow,
} from '@/types/filing.types';
import { getApiErrorMessage } from '@/utils/apiError';
import { estimateRemainingMs, formatEta } from '@/utils/formatEta';
import {
  canPickDownloadFolder,
  downloadFilesToFolder,
} from '@/utils/folderDownload';
import { toastError, toastSuccess } from '@/utils/toast';

type BulkGenerateModalProps = {
  open: boolean;
  payload: BulkGeneratePayload | null;
  onOpenChange: (open: boolean) => void;
  onFinished?: (report: BulkGenerateReport) => void;
};

const emptyProgress = (total = 0): BulkGenerateProgressEvent => ({
  phase: 'generate',
  processed: 0,
  total,
  generated: 0,
  skipped: 0,
  failed: 0,
  current: null,
  lastResult: null,
});

/**
 * Live bulk Form 5 generation + multi-file download into a chosen folder.
 */
export function BulkGenerateModal({
  open,
  payload,
  onOpenChange,
  onFinished,
}: BulkGenerateModalProps) {
  const [progress, setProgress] =
    useState<BulkGenerateProgressEvent>(emptyProgress());
  const [report, setReport] = useState<BulkGenerateReport | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{
    processed: number;
    total: number;
    currentFilename: string | null;
  } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const runKeyRef = useRef<string | null>(null);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  useEffect(() => {
    if (!open || !payload) return;

    const runKey = JSON.stringify(payload);
    if (runKeyRef.current === runKey) return;
    runKeyRef.current = runKey;

    let cancelled = false;
    setRunning(true);
    setError(null);
    setReport(null);
    setDownloadProgress(null);
    setDownloading(false);
    setStartedAt(Date.now());
    setProgress(emptyProgress(payload.ids?.length ?? 0));

    const run = async () => {
      try {
        const result = await filingsApi.bulkGenerateWithProgress(
          payload,
          (event) => {
            if (!cancelled) setProgress(event);
          },
        );
        if (cancelled) return;
        setReport(result);
        setProgress({
          phase: 'generate',
          processed: result.generated + result.skipped + result.failed,
          total: result.generated + result.skipped + result.failed,
          generated: result.generated,
          skipped: result.skipped,
          failed: result.failed,
          current: null,
          lastResult: null,
        });
        onFinishedRef.current?.(result);
        toastSuccess(
          `Generated ${result.generated}. Skipped ${result.skipped}. Failed ${result.failed}.`,
        );
      } catch (err) {
        if (!cancelled) {
          setError(getApiErrorMessage(err, 'Could not bulk generate Form 5'));
          toastError(getApiErrorMessage(err, 'Could not bulk generate Form 5'));
        }
      } finally {
        if (!cancelled) setRunning(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [open, payload]);

  useEffect(() => {
    if (open) return;
    runKeyRef.current = null;
    setProgress(emptyProgress());
    setReport(null);
    setRunning(false);
    setError(null);
    setDownloadProgress(null);
    setDownloading(false);
  }, [open]);

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [running]);

  const generatedRows = useMemo(
    () =>
      (report?.results ?? []).filter(
        (row): row is BulkGenerateRow & { filename: string } =>
          row.outcome === 'generated' && Boolean(row.filename),
      ),
    [report],
  );

  const percent =
    progress.total > 0
      ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
      : 0;

  const etaMs = estimateRemainingMs(
    progress.processed,
    progress.total,
    now - startedAt,
  );

  const downloadPercent =
    downloadProgress && downloadProgress.total > 0
      ? Math.min(
          100,
          Math.round(
            (downloadProgress.processed / downloadProgress.total) * 100,
          ),
        )
      : 0;

  const handleDownloadAll = async () => {
    if (!generatedRows.length) return;
    setDownloading(true);
    setDownloadProgress({
      processed: 0,
      total: generatedRows.length,
      currentFilename: null,
    });

    try {
      const result = await downloadFilesToFolder(
        generatedRows.map((row) => ({
          id: row.id,
          filename: row.filename || `${row.clientCode || row.id}_Form5.pdf`,
          getBlob: async () => {
            const file = await filingsApi.fetchDownloadBlob(row.id, {
              filename: row.filename,
            });
            return file.blob;
          },
        })),
        setDownloadProgress,
      );

      toastSuccess(
        result.mode === 'folder'
          ? `Saved ${result.saved} file(s) to the selected folder`
          : `Started ${result.saved} download(s)`,
      );
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        toastError('Folder selection cancelled');
      } else {
        toastError(getApiErrorMessage(err, 'Could not download Form 5 files'));
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (running || downloading) return;
        onOpenChange(next);
      }}
      closeOnOverlayClick={!running && !downloading}
      title="Bulk Form 5 generate"
      description={
        running
          ? 'Generating PDFs… keep this window open until it finishes.'
          : report
            ? 'Generation finished. Download the PDFs below.'
            : error
              ? 'Generation stopped with an error.'
              : 'Preparing…'
      }
      className="max-w-xl"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          {generatedRows.length > 0 ? (
            <Button
              type="button"
              loading={downloading}
              disabled={running || downloading}
              onClick={() => void handleDownloadAll()}
            >
              {canPickDownloadFolder()
                ? `Choose folder & download (${generatedRows.length})`
                : `Download all (${generatedRows.length})`}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={running || downloading}
            onClick={() => onOpenChange(false)}
          >
            {running ? 'Working…' : 'Close'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">
                {running
                  ? 'Generating Form 5 PDFs…'
                  : report
                    ? 'Generation complete'
                    : error
                      ? 'Generation failed'
                      : 'Starting…'}
              </p>
              <p className="text-sm text-muted-foreground">
                {progress.processed.toLocaleString()} of{' '}
                {Math.max(progress.total, progress.processed).toLocaleString()}{' '}
                done
                {progress.total > progress.processed
                  ? ` · ${(progress.total - progress.processed).toLocaleString()} left`
                  : ''}
                {running && etaMs !== null ? ` · ${formatEta(etaMs)}` : ''}
              </p>
            </div>
            <p className="text-sm font-semibold tabular-nums">{percent}%</p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
              style={{
                width: `${Math.max(percent, progress.processed > 0 ? 2 : 0)}%`,
              }}
            />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              Generated:{' '}
              <strong className="text-foreground">{progress.generated}</strong>
            </span>
            <span>
              Skipped:{' '}
              <strong className="text-foreground">{progress.skipped}</strong>
            </span>
            <span>
              Failed:{' '}
              <strong className="text-foreground">{progress.failed}</strong>
            </span>
          </div>
          {progress.lastResult ? (
            <p className="text-xs text-muted-foreground">
              Last:{' '}
              <strong className="text-foreground">
                {progress.lastResult.clientCode || progress.lastResult.id}
              </strong>{' '}
              · {progress.lastResult.outcome}
              {progress.lastResult.reason
                ? ` (${progress.lastResult.reason})`
                : ''}
            </p>
          ) : null}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {report ? (
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
            {report.results.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="truncate font-medium">
                  {row.clientCode || row.id}
                </span>
                <Badge
                  variant={
                    row.outcome === 'generated'
                      ? 'success'
                      : row.outcome === 'skipped'
                        ? 'secondary'
                        : 'warning'
                  }
                >
                  {row.outcome}
                </Badge>
              </div>
            ))}
          </div>
        ) : null}

        {downloadProgress ? (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex justify-between gap-2 text-sm">
              <span>
                {downloading ? 'Saving files…' : 'Download finished'}
                {downloadProgress.currentFilename
                  ? ` · ${downloadProgress.currentFilename}`
                  : ''}
              </span>
              <span className="tabular-nums font-medium">
                {downloadProgress.processed}/{downloadProgress.total} ·{' '}
                {downloadPercent}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                style={{ width: `${downloadPercent}%` }}
              />
            </div>
            {!canPickDownloadFolder() ? (
              <p className="text-xs text-muted-foreground">
                This browser cannot pick a folder. Files download one by one
                instead.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
