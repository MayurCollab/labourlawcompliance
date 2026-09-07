import { useCallback, useEffect } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router-dom';

export type UnsavedChangesGuardOptions = {
  /** Whether there are edits worth warning about. */
  when: boolean;
  /**
   * Shown in the in-app confirm. The browser's own beforeunload dialog uses a
   * fixed message that no site can override.
   */
  message?: string;
};

const DEFAULT_MESSAGE =
  'You have unsaved changes. Leave this page and discard them?';

/**
 * Warns before losing in-progress edits, covering both ways out:
 *
 *   - client-side navigation (React Router `useBlocker`)
 *   - closing/reloading the tab (`beforeunload`)
 *
 * `window.confirm` is deliberate here rather than the app's ConfirmDialog:
 * the router blocker resolves synchronously, and a promise-based dialog would
 * let the navigation through before the user answered.
 */
export const useUnsavedChangesGuard = ({
  when,
  message = DEFAULT_MESSAGE,
}: UnsavedChangesGuardOptions) => {
  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) =>
        when && currentLocation.pathname !== nextLocation.pathname,
      [when],
    ),
  );

  useEffect(() => {
    if (blocker.state !== 'blocked') return;

    if (window.confirm(message)) {
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [blocker, message]);

  useBeforeUnload(
    useCallback(
      (event: BeforeUnloadEvent) => {
        if (!when) return;
        event.preventDefault();
        // Legacy browsers need returnValue set to trigger the prompt
        event.returnValue = '';
      },
      [when],
    ),
  );

  return blocker.state === 'blocked';
};
