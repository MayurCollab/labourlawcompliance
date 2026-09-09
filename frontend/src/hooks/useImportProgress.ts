import { useSyncExternalStore } from 'react';

import {
  importProgressStore,
  type ImportSession,
} from '@/stores/importProgressStore';

export const useImportProgress = (): ImportSession | null =>
  useSyncExternalStore(
    importProgressStore.subscribe,
    importProgressStore.getSnapshot,
    () => null,
  );
