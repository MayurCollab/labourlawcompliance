import { Link, useSearchParams } from 'react-router-dom';
import { CircleAlert } from 'lucide-react';

import { Button } from '@/components/buttons';
import { PasswordInput } from '@/components/inputs/PasswordInput';
import { FormWrapper } from '@/components/forms/FormWrapper';
import { useResetPasswordMutation } from '@/hooks/useAuthMutations';
import { PATHS } from '@/routes/paths';
import {
  resetPasswordFormSchema,
  type ResetPasswordFormValues,
} from '@/validations/auth.validation';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token')?.trim() ?? '';
  const resetMutation = useResetPasswordMutation();

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
          <CircleAlert className="size-5 text-destructive" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Invalid reset link</h1>
          <p className="text-sm text-muted-foreground">
            This link is missing a token. Request a new password reset email.
          </p>
        </div>
        <Button
          variant="outline"
          className="w-full"
          render={<Link to={PATHS.forgotPassword} />}
        >
          Request a new link
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Reset password</h1>
        <p className="text-sm text-muted-foreground">
          Choose a new password for your account
        </p>
      </div>

      <FormWrapper<ResetPasswordFormValues>
        schema={resetPasswordFormSchema}
        defaultValues={{ password: '', confirmPassword: '' }}
        guardUnsavedChanges={false}
        onSubmit={(values) => {
          resetMutation.mutate({
            token,
            password: values.password,
          });
        }}
      >
        {(form) => (
          <>
            <PasswordInput
              label="New password"
              autoComplete="new-password"
              placeholder="••••••••"
              hint="At least 8 characters, with upper, lower, and a number"
              {...form.register('password')}
              error={form.formState.errors.password?.message}
            />
            <PasswordInput
              label="Confirm new password"
              autoComplete="new-password"
              placeholder="••••••••"
              {...form.register('confirmPassword')}
              error={form.formState.errors.confirmPassword?.message}
            />
            <Button
              type="submit"
              className="w-full"
              loading={resetMutation.isPending}
            >
              Update password
            </Button>
          </>
        )}
      </FormWrapper>

      <p className="text-center text-sm text-muted-foreground">
        <Link
          to={PATHS.login}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Back to login
        </Link>
      </p>
    </div>
  );
}
