import { useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, WifiOff } from 'lucide-react';

import { Button } from '@/components/buttons/Button';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import {
  getApiReachable,
  reportApiReachable,
  subscribeToApiReachability,
} from '@/lib/networkStatus';

/**
 * Fixed banner shown when the browser is offline or the API stopped
 * answering. Retry refetches everything React Query is currently holding, so
 * the user gets back to a working screen without a full reload (which would
 * lose their place and any in-progress form state).
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const apiReachable = useSyncExternalStore(
    subscribeToApiReachability,
    getApiReachable,
    () => true,
  );
  const queryClient = useQueryClient();
  const [retrying, setRetrying] = useState(false);

  const degraded = !online || !apiReachable;

  if (!degraded) return null;

  const handleRetry = async () => {
    setRetrying(true);
    try {
      // Optimistically clear the flag; a still-failing request re-sets it
      reportApiReachable(true);
      await queryClient.refetchQueries({ type: 'active' });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 border-b border-amber-500/40 bg-amber-100 px-4 py-2 text-sm text-amber-950 shadow-sm dark:bg-amber-950 dark:text-amber-100"
    >
      <WifiOff className="size-4 shrink-0" aria-hidden />
      <span>
        {online
          ? "Can't reach the server. Your changes may not be saved."
          : "You're offline. Some data may be out of date."}
      </span>
      <Button
        size="sm"
        variant="outline"
        loading={retrying}
        onClick={handleRetry}
        leftIcon={<RefreshCw className="size-3.5" aria-hidden />}
      >
        Retry
      </Button>
    </div>
  );
}
