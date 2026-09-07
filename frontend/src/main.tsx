import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import App from './App';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { OfflineBanner } from '@/components/common/OfflineBanner';
import { ConfirmDialogHost } from '@/components/dialogs/ConfirmDialog';
import { ThemeProvider } from '@/context/ThemeProvider';
import { initErrorTracking } from '@/lib/errorTracking';
import { queryClient } from '@/lib/queryClient';
import { store } from '@/store';
import './styles/index.css';

// Before render, so a crash during the first paint is still reported
initErrorTracking();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          {/* Outside the boundary: the banner must survive a render crash */}
          <OfflineBanner />
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
          <ConfirmDialogHost />
          <Toaster
            position="top-right"
            toastOptions={{
              className: 'text-sm',
              duration: 4000,
            }}
          />
        </ThemeProvider>
      </QueryClientProvider>
    </Provider>
  </StrictMode>,
);
