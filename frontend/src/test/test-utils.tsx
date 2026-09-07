import { configureStore } from '@reduxjs/toolkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { Provider } from 'react-redux';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import authReducer from '@/store/slices/authSlice';

type Options = {
  route?: string;
};

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

export function createTestStore() {
  return configureStore({
    reducer: { auth: authReducer },
  });
}

/**
 * Uses a data router (createMemoryRouter) so hooks like useBlocker —
 * used by FormWrapper's unsaved-changes guard — work in tests.
 */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/' }: Options = {},
) {
  const store = createTestStore();
  const queryClient = createTestQueryClient();

  const router = createMemoryRouter(
    [{ path: '*', element: ui }],
    { initialEntries: [route] },
  );

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </Provider>
  );

  return {
    store,
    queryClient,
    ...render(<RouterProvider router={router} />, { wrapper: Wrapper }),
  };
}
