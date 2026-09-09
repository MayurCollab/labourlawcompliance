import type {
  ImportProgressEvent,
  ImportUploadResult,
  UploadKind,
} from '@/types/uploads.types';

export type ImportSessionStatus = 'running' | 'completed' | 'failed';

export type ImportSession = {
  uploadId: string;
  kind: UploadKind;
  fileName: string;
  progress: ImportProgressEvent;
  startedAt: number;
  status: ImportSessionStatus;
  result: ImportUploadResult | null;
  error: string | null;
};

type Listener = () => void;

let session: ImportSession | null = null;
const listeners = new Set<Listener>();

const emit = () => {
  for (const listener of listeners) listener();
};

export const importProgressStore = {
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getSnapshot: () => session,

  start: (input: {
    uploadId: string;
    kind: UploadKind;
    fileName: string;
    total: number;
  }) => {
    session = {
      uploadId: input.uploadId,
      kind: input.kind,
      fileName: input.fileName,
      startedAt: Date.now(),
      status: 'running',
      result: null,
      error: null,
      progress: {
        phase: 'import',
        processed: 0,
        total: input.total,
        inserted: 0,
        updated: 0,
        unchanged: 0,
        skipped: 0,
        unmatched: 0,
      },
    };
    emit();
  },

  setProgress: (progress: ImportProgressEvent) => {
    if (!session || session.status !== 'running') return;
    session = { ...session, progress };
    emit();
  },

  complete: (result: ImportUploadResult) => {
    if (!session) return;
    session = {
      ...session,
      status: 'completed',
      result,
      progress: {
        ...session.progress,
        phase: session.progress.phase,
        processed: session.progress.total,
      },
    };
    emit();
  },

  fail: (message: string) => {
    if (!session) return;
    session = {
      ...session,
      status: 'failed',
      error: message,
    };
    emit();
  },

  clear: () => {
    if (!session) return;
    session = null;
    emit();
  },
};
