import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';

import { Button } from '@/components/buttons';
import { Input } from '@/components/inputs/Input';
import { PasswordInput } from '@/components/inputs/PasswordInput';
import { FormWrapper } from '@/components/forms/FormWrapper';
import { useRegisterMutation } from '@/hooks/useAuthMutations';
import { PATHS } from '@/routes/paths';
import {
  registerFormSchema,
  type RegisterFormValues,
} from '@/validations/auth.validation';

export function RegisterPage() {
  const registerMutation = useRegisterMutation();
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  if (registeredEmail) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
          <MailCheck className="size-5 text-foreground" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Check your email
          </h1>
          <p className="text-sm text-muted-foreground">
            We sent a verification link to{' '}
            <span className="font-medium text-foreground">{registeredEmail}</span>
            . Open it to activate your account, then sign in.
          </p>
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
        <h1 className="text-xl font-semibold tracking-tight">Create account</h1>
        <p className="text-sm text-muted-foreground">
          Register with your name, email, and a strong password
        </p>
      </div>

      <FormWrapper<RegisterFormValues>
        schema={registerFormSchema}
        guardUnsavedChanges={false}
        defaultValues={{
          name: '',
          email: '',
          password: '',
          confirmPassword: '',
        }}
        onSubmit={(values) => {
          registerMutation.mutate(
            {
              name: values.name,
              email: values.email,
              password: values.password,
            },
            {
              onSuccess: (data) => {
                setRegisteredEmail(values.email);
                // Prefer the server message when present
                if (data?.message) {
                  // toast is optional here — success UI is the primary signal
                }
              },
            },
          );
        }}
      >
        {(form) => (
          <>
            <Input
              label="Name"
              autoComplete="name"
              placeholder="Jane Doe"
              {...form.register('name')}
              error={form.formState.errors.name?.message}
            />
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...form.register('email')}
              error={form.formState.errors.email?.message}
            />
            <PasswordInput
              label="Password"
              autoComplete="new-password"
              placeholder="••••••••"
              hint="At least 8 characters, with upper, lower, and a number"
              {...form.register('password')}
              error={form.formState.errors.password?.message}
            />
            <PasswordInput
              label="Confirm password"
              autoComplete="new-password"
              placeholder="••••••••"
              {...form.register('confirmPassword')}
              error={form.formState.errors.confirmPassword?.message}
            />
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              loading={registerMutation.isPending}
            >
              Create account
            </Button>
          </>
        )}
      </FormWrapper>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
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
