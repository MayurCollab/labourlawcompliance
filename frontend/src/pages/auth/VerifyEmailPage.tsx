import { useEffect, useRef, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CircleAlert, CircleCheck } from 'lucide-react';

import { Button } from '@/components/buttons';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useVerifyEmailMutation } from '@/hooks/useAuthMutations';
import { PATHS } from '@/routes/paths';
import { getApiErrorMessage } from '@/utils/apiError';

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token')?.trim() ?? '';
  const verifyMutation = useVerifyEmailMutation();
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    verifyMutation.mutate({ token });
    // Intentionally run once per token on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) {
    return (
      <StatusCard
        icon={<CircleAlert className="size-5 text-destructive" />}
        title="Missing verification token"
        description="This link is incomplete. Request a new verification email or register again."
        action={
          <Button
            variant="outline"
            className="w-full"
            render={<Link to={PATHS.login} />}
          >
            Go to login
          </Button>
        }
      />
    );
  }

  if (verifyMutation.isPending) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <LoadingSpinner />
        <p className="text-sm text-muted-foreground">Verifying your email…</p>
      </div>
    );
  }

  if (verifyMutation.isSuccess) {
    return (
      <StatusCard
        icon={<CircleCheck className="size-5 text-emerald-600" />}
        title="Email verified"
        description={
          verifyMutation.data.message ||
          'Your account is active. You can sign in now.'
        }
        action={
          <Button className="w-full" render={<Link to={PATHS.login} />}>
            Continue to login
          </Button>
        }
      />
    );
  }

  return (
    <StatusCard
      icon={<CircleAlert className="size-5 text-destructive" />}
      title="Verification failed"
      description={getApiErrorMessage(
        verifyMutation.error,
        'This verification link is invalid or has expired.',
      )}
      action={
        <Button
          variant="outline"
          className="w-full"
          render={<Link to={PATHS.login} />}
        >
          Back to login
        </Button>
      }
    />
  );
}

function StatusCard({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
        {icon}
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
