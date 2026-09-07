import { Link } from 'react-router-dom';

import { Button } from '@/components/buttons';
import { Checkbox } from '@/components/inputs/Checkbox';
import { Input } from '@/components/inputs/Input';
import { PasswordInput } from '@/components/inputs/PasswordInput';
import { FormWrapper } from '@/components/forms/FormWrapper';
import { useLoginMutation } from '@/hooks/useAuthMutations';
import { PATHS } from '@/routes/paths';
import {
  loginFormSchema,
  type LoginFormValues,
} from '@/validations/auth.validation';

export function LoginPage() {
  const loginMutation = useLoginMutation();

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in with your email and password
        </p>
      </div>

      <FormWrapper<LoginFormValues>
        schema={loginFormSchema}
        defaultValues={{ email: '', password: '', rememberMe: true }}
        guardUnsavedChanges={false}
        onSubmit={(values) => {
          loginMutation.mutate({
            email: values.email,
            password: values.password,
            rememberMe: values.rememberMe,
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
            <PasswordInput
              label="Password"
              autoComplete="current-password"
              placeholder="••••••••"
              {...form.register('password')}
              error={form.formState.errors.password?.message}
            />
            <div className="flex items-center justify-between gap-3">
              <Checkbox
                label="Remember me"
                checked={form.watch('rememberMe')}
                onChange={(event) =>
                  form.setValue('rememberMe', event.target.checked)
                }
              />
              <Link
                to={PATHS.forgotPassword}
                className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              loading={loginMutation.isPending}
            >
              Sign in
            </Button>
          </>
        )}
      </FormWrapper>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link
          to={PATHS.register}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
