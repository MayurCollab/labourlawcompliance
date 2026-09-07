import { Button } from '@/components/buttons';
import { PasswordInput } from '@/components/inputs/PasswordInput';
import { FormWrapper } from '@/components/forms/FormWrapper';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/common/Card';
import { useChangePasswordMutation } from '@/hooks/useAuthMutations';
import { ActiveSessionsPanel } from '@/pages/auth/ActiveSessionsPanel';
import { PATHS } from '@/routes/paths';
import {
  changePasswordFormSchema,
  type ChangePasswordFormValues,
} from '@/validations/auth.validation';

/**
 * Authenticated change-password page (not a modal) under the account area.
 * Linked from the Navbar user menu.
 */
export function ChangePasswordPage() {
  const changePasswordMutation = useChangePasswordMutation();

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title="Change password"
        description="Update your password. You’ll stay signed in with a fresh session."
        breadcrumbs={[
          { label: 'Home', href: PATHS.home },
          { label: 'Change password' },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Enter your current password, then choose a new one that meets the
            complexity rules.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormWrapper<ChangePasswordFormValues>
            schema={changePasswordFormSchema}
            defaultValues={{
              currentPassword: '',
              newPassword: '',
              confirmPassword: '',
            }}
            onSubmit={(values, form) => {
              changePasswordMutation.mutate(
                {
                  currentPassword: values.currentPassword,
                  newPassword: values.newPassword,
                },
                {
                  onSuccess: () => form.reset(),
                },
              );
            }}
          >
            {(form) => (
              <>
                <PasswordInput
                  label="Current password"
                  autoComplete="current-password"
                  {...form.register('currentPassword')}
                  error={form.formState.errors.currentPassword?.message}
                />
                <PasswordInput
                  label="New password"
                  autoComplete="new-password"
                  hint="At least 8 characters, with upper, lower, and a number"
                  {...form.register('newPassword')}
                  error={form.formState.errors.newPassword?.message}
                />
                <PasswordInput
                  label="Confirm new password"
                  autoComplete="new-password"
                  {...form.register('confirmPassword')}
                  error={form.formState.errors.confirmPassword?.message}
                />
                <Button
                  type="submit"
                  loading={changePasswordMutation.isPending}
                >
                  Save new password
                </Button>
              </>
            )}
          </FormWrapper>
        </CardContent>
      </Card>

      <ActiveSessionsPanel />
    </div>
  );
}
