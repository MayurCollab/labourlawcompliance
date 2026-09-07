import { lazy, Suspense, type ComponentType } from 'react';
import {
  createBrowserRouter,
  createRoutesFromElements,
  Outlet,
  Route,
} from 'react-router-dom';

import { GuestRoute } from '@/components/common/GuestRoute';
import { PermissionRoute } from '@/components/common/PermissionRoute';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { RouteFallback } from '@/components/common/RouteFallback';
import { PERMISSIONS } from '@/constants/permissions';
import { AppLayout } from '@/layouts/AppLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { PATHS } from '@/routes/paths';

/*
 * Every page is a separate chunk. Layouts, route guards and the design-system
 * primitives stay in the entry bundle because they're needed to render the
 * first frame of any route — code-splitting those would only add a waterfall.
 *
 * Pages use named exports, so each import is mapped to a default here rather
 * than changing 13 files' public API.
 */
const lazyPage = <T extends Record<string, unknown>>(
  loader: () => Promise<T>,
  name: keyof T,
) =>
  lazy(() =>
    loader().then((mod) => ({
      default: mod[name] as ComponentType,
    })),
  );

const LoginPage = lazyPage(
  () => import('@/pages/auth/LoginPage'),
  'LoginPage',
);
const RegisterPage = lazyPage(
  () => import('@/pages/auth/RegisterPage'),
  'RegisterPage',
);
const ForgotPasswordPage = lazyPage(
  () => import('@/pages/auth/ForgotPasswordPage'),
  'ForgotPasswordPage',
);
const ResetPasswordPage = lazyPage(
  () => import('@/pages/auth/ResetPasswordPage'),
  'ResetPasswordPage',
);
const VerifyEmailPage = lazyPage(
  () => import('@/pages/auth/VerifyEmailPage'),
  'VerifyEmailPage',
);
const ChangePasswordPage = lazyPage(
  () => import('@/pages/auth/ChangePasswordPage'),
  'ChangePasswordPage',
);
const ComponentsGalleryPage = lazyPage(
  () => import('@/pages/dev/ComponentsGalleryPage'),
  'ComponentsGalleryPage',
);
const ForbiddenPage = lazyPage(
  () => import('@/pages/ForbiddenPage'),
  'ForbiddenPage',
);
const HomePage = lazyPage(() => import('@/pages/HomePage'), 'HomePage');
const ClientsPage = lazyPage(
  () => import('@/pages/clients/ClientsPage'),
  'ClientsPage',
);
const PtSlabsPage = lazyPage(
  () => import('@/pages/ptSlabs/PtSlabsPage'),
  'PtSlabsPage',
);
const UploadsPage = lazyPage(
  () => import('@/pages/uploads/UploadsPage'),
  'UploadsPage',
);
const EmployeesPage = lazyPage(
  () => import('@/pages/employees/EmployeesPage'),
  'EmployeesPage',
);
const FilingsPage = lazyPage(
  () => import('@/pages/filings/FilingsPage'),
  'FilingsPage',
);
const TemplatesPage = lazyPage(
  () => import('@/pages/templates/TemplatesPage'),
  'TemplatesPage',
);
const NotFoundPage = lazyPage(
  () => import('@/pages/NotFoundPage'),
  'NotFoundPage',
);
const RolePermissionsPage = lazyPage(
  () => import('@/pages/permissions/RolePermissionsPage'),
  'RolePermissionsPage',
);
const RolesPage = lazyPage(() => import('@/pages/roles/RolesPage'), 'RolesPage');
const UsersPage = lazyPage(() => import('@/pages/users/UsersPage'), 'UsersPage');

/** Holds the Suspense boundary that every lazily-loaded page falls back to. */
function RootLayout() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Outlet />
    </Suspense>
  );
}

/**
 * Public vs protected route split.
 * Admin modules nest under PermissionRoute as the reference pattern.
 *
 * Built with createBrowserRouter (a "data router") rather than
 * <BrowserRouter>: useBlocker — which powers the unsaved-changes guard on
 * forms — is only available on data routers.
 */
export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<RootLayout />}>
      {/* Public auth shell (guests only) */}
        <Route element={<GuestRoute />}>
          <Route element={<AuthLayout />}>
            <Route path={PATHS.login} element={<LoginPage />} />
            <Route path={PATHS.register} element={<RegisterPage />} />
            <Route
              path={PATHS.forgotPassword}
              element={<ForgotPasswordPage />}
            />
            <Route path={PATHS.resetPassword} element={<ResetPasswordPage />} />
          </Route>
        </Route>

        {/* Verify email is public even when a session exists */}
        <Route element={<AuthLayout />}>
          <Route path={PATHS.verifyEmail} element={<VerifyEmailPage />} />
        </Route>

        {/* Internal component gallery — not in the real nav */}
        <Route path={PATHS.devComponents} element={<ComponentsGalleryPage />} />

        {/* Protected app shell */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route
              path={PATHS.changePassword}
              element={<ChangePasswordPage />}
            />
            <Route path={PATHS.forbidden} element={<ForbiddenPage />} />

            <Route
              element={
                <PermissionRoute permission={PERMISSIONS.CLIENTS_VIEW} />
              }
            >
              <Route path={PATHS.clients} element={<ClientsPage />} />
              <Route path={PATHS.ptSlabs} element={<PtSlabsPage />} />
            </Route>

            <Route
              element={
                <PermissionRoute permission={PERMISSIONS.UPLOADS_VIEW} />
              }
            >
              <Route path={PATHS.uploads} element={<UploadsPage />} />
            </Route>

            <Route
              element={
                <PermissionRoute permission={PERMISSIONS.EMPLOYEES_VIEW} />
              }
            >
              <Route path={PATHS.employees} element={<EmployeesPage />} />
            </Route>

            <Route
              element={
                <PermissionRoute permission={PERMISSIONS.FILINGS_VIEW} />
              }
            >
              <Route path={PATHS.form5} element={<FilingsPage />} />
            </Route>

            <Route
              element={
                <PermissionRoute permission={PERMISSIONS.TEMPLATES_VIEW} />
              }
            >
              <Route path={PATHS.templates} element={<TemplatesPage />} />
            </Route>

            <Route
              element={<PermissionRoute permission={PERMISSIONS.USERS_VIEW} />}
            >
              <Route path={PATHS.users} element={<UsersPage />} />
            </Route>

            <Route
              element={<PermissionRoute permission={PERMISSIONS.ROLES_VIEW} />}
            >
              <Route path={PATHS.roles} element={<RolesPage />} />
              <Route
                path={PATHS.permissions}
                element={<RolePermissionsPage />}
              />
            </Route>
          </Route>
        </Route>

      <Route path={PATHS.notFound} element={<NotFoundPage />} />
    </Route>,
  ),
);
