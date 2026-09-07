import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';

import { Button } from '@/components/buttons';
import { Input } from '@/components/inputs/Input';
import { FormWrapper } from '@/components/forms/FormWrapper';
import { useForgotPasswordMutation } from '@/hooks/useAuthMutations';
import { PATHS } from '@/routes/paths';
import {
  forgotPasswordFormSchema,
  type ForgotPasswordFormValues,
} from '@/validations/auth.validation';

const NEUTRAL_MESSAGE =
  "If an account exists for that email, we've sent a password reset link. Check your inbox and spam folder.";

export function ForgotPasswordPage() {
  const forgotMutation = useForgotPasswordMutation();
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
          <Mail className="size-5" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Check your inbox</h1>
          <p className="text-sm text-muted-foreground">{NEUTRAL_MESSAGE}</p>
        </div>
        <Button variant="outline" className="w-full" render={<Link to={PATHS.login} />}>
          Back to login
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Forgot password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send a reset link if an account exists
        </p>
      </div>

      <FormWrapper<ForgotPasswordFormValues>
        schema={forgotPasswordFormSchema}
        defaultValues={{ email: '' }}
        guardUnsavedChanges={false}
        onSubmit={(values) => {
          forgotMutation.mutate(values, {
            onSuccess: () => setSubmitted(true),
          });
        }}
      >
        {(form) => (
          <>
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...form.register('email')}
              error={form.formState.errors.email?.message}
            />
            <Button
              type="submit"
              className="w-full"
              loading={forgotMutation.isPending}
            >
              Send reset link
            </Button>
          </>
        )}
      </FormWrapper>

      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{' '}
        <Link
          to={PATHS.login}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
