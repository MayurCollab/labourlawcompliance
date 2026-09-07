import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/buttons/Button';
import { captureException } from '@/lib/errorTracking';

type ErrorBoundaryProps = {
  children: ReactNode;
  /** Rendered instead of the default screen. Receives the thrown error. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

/**
 * Catches render/lifecycle errors anywhere below it so a single bad component
 * shows a recoverable screen instead of unmounting the app into a blank page.
 *
 * Still a class component: React has no hook equivalent of
 * `getDerivedStateFromError`.
 *
 * Note this does NOT catch errors in event handlers, async callbacks or
 * outside React — those go to the global handlers wired up in errorTracking.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureException(error, {
      componentStack: info.componentStack ?? undefined,
    });
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (!error) return children;
    if (fallback) return fallback(error, this.reset);

    return (
      <div
        role="alert"
        className="flex min-h-[60vh] w-full items-center justify-center p-6"
      >
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-6 text-destructive" aria-hidden />
          </div>

          <h1 className="text-lg font-semibold text-foreground">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This screen ran into an unexpected error. Your data is safe — try
            again, and if it keeps happening, reload the page.
          </p>

          {import.meta.env.DEV && (
            <pre className="mt-4 max-h-40 overflow-auto rounded-md bg-muted p-3 text-left text-xs text-muted-foreground">
              {error.message}
            </pre>
          )}

          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={this.reset}>Try again</Button>
            <Button
              variant="outline"
              onClick={() => window.location.assign('/')}
            >
              Go home
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
