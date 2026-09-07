import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { authApi } from '@/api/auth.api';
import { Button } from '@/components/buttons';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/common/Card';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PATHS } from '@/routes/paths';
import { store } from '@/store';
import { clearCredentials } from '@/store/slices/authSlice';
import { getApiErrorMessage } from '@/utils/apiError';
import { clearCsrfToken } from '@/utils/csrf';
import { toastError, toastSuccess } from '@/utils/toast';

export function ActiveSessionsPanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const sessionsQuery = useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: () => authApi.listSessions(),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => authApi.revokeSession(id),
    onSuccess: async () => {
      toastSuccess('Session revoked');
      await queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not revoke session'));
    },
  });

  const logoutAllMutation = useMutation({
    mutationFn: () => authApi.logoutAll(),
    onSuccess: () => {
      toastSuccess('Logged out of all sessions');
      clearCsrfToken();
      store.dispatch(clearCredentials());
      navigate(PATHS.login, { replace: true });
    },
    onError: (error) => {
      toastError(getApiErrorMessage(error, 'Could not log out everywhere'));
    },
  });

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Active sessions</CardTitle>
        <CardDescription>
          Devices with a valid refresh token. Revoke any you do not recognize.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={logoutAllMutation.isPending}
            onClick={() => logoutAllMutation.mutate()}
          >
            Log out everywhere
          </Button>
        </div>

        {sessionsQuery.isLoading ? (
          <div className="flex justify-center py-6">
            <LoadingSpinner />
          </div>
        ) : (sessionsQuery.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No active sessions.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {sessionsQuery.data?.map((session) => (
              <li
                key={session.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 text-sm">
                  <p className="truncate font-medium">
                    {session.userAgent || 'Unknown device'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {session.ip || 'Unknown IP'} · since{' '}
                    {new Date(session.createdAt).toLocaleString()}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  loading={
                    revokeMutation.isPending &&
                    revokeMutation.variables === session.id
                  }
                  onClick={() => revokeMutation.mutate(session.id)}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
