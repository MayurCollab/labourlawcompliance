import { useState } from 'react';

import { Button } from '@/components/buttons';
import { Drawer } from '@/components/dialogs/Drawer';
import { FormWrapper } from '@/components/forms/FormWrapper';
import { Checkbox } from '@/components/inputs/Checkbox';
import { ImageUpload } from '@/components/inputs/ImageUpload';
import { Input } from '@/components/inputs/Input';
import { PasswordInput } from '@/components/inputs/PasswordInput';
import { Select } from '@/components/inputs/Select';
import type { User } from '@/types/auth.types';
import type { Role } from '@/types/role.types';
import { resolveUploadUrl } from '@/utils/uploads';
import {
  createUserFormSchema,
  updateUserFormSchema,
  type CreateUserFormValues,
  type UpdateUserFormValues,
} from '@/validations/users.validation';

type UserFormDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  user?: User | null;
  roles: Role[];
  loading?: boolean;
  onCreate: (values: CreateUserFormValues, avatar: File | null) => void;
  onUpdate: (values: UpdateUserFormValues, avatar: File | null) => void;
};

type UserFormBodyProps = {
  mode: 'create' | 'edit';
  user?: User | null;
  roles: Role[];
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (values: CreateUserFormValues, avatar: File | null) => void;
  onUpdate: (values: UpdateUserFormValues, avatar: File | null) => void;
};

function UserFormBody({
  mode,
  user,
  roles,
  loading,
  onOpenChange,
  onCreate,
  onUpdate,
}: UserFormBodyProps) {
  const [avatar, setAvatar] = useState<File | string | null>(() =>
    user?.avatar ? (resolveUploadUrl(user.avatar) ?? null) : null,
  );

  const roleOptions = roles.map((role) => ({
    label: role.name,
    value: role.id,
  }));

  if (mode === 'create') {
    return (
      <FormWrapper<CreateUserFormValues>
        schema={createUserFormSchema}
        defaultValues={{
          name: '',
          email: '',
          password: '',
          phone: '',
          role: '',
          isActive: true,
        }}
        onSubmit={(values) => {
          onCreate(values, avatar instanceof File ? avatar : null);
        }}
      >
        {(form) => (
          <>
            <ImageUpload
              label="Profile picture"
              value={avatar}
              onChange={setAvatar}
            />
            <Input
              label="Name"
              {...form.register('name')}
              error={form.formState.errors.name?.message}
            />
            <Input
              label="Email"
              type="email"
              {...form.register('email')}
              error={form.formState.errors.email?.message}
            />
            <PasswordInput
              label="Password"
              autoComplete="new-password"
              {...form.register('password')}
              error={form.formState.errors.password?.message}
            />
            <Input
              label="Phone"
              {...form.register('phone')}
              error={form.formState.errors.phone?.message}
            />
            <Select
              label="Role"
              options={roleOptions}
              placeholder="Select a role"
              value={form.watch('role') ?? ''}
              onChange={(event) => form.setValue('role', event.target.value)}
            />
            <Checkbox
              label="Active"
              checked={Boolean(form.watch('isActive'))}
              onChange={(event) =>
                form.setValue('isActive', event.target.checked)
              }
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={loading}>
                Create user
              </Button>
            </div>
          </>
        )}
      </FormWrapper>
    );
  }

  return (
    <FormWrapper<UpdateUserFormValues>
      schema={updateUserFormSchema}
      defaultValues={{
        name: user?.name ?? '',
        email: user?.email ?? '',
        phone: user?.phone ?? '',
        role: user?.role?.id ?? '',
      }}
      onSubmit={(values) => {
        onUpdate(values, avatar instanceof File ? avatar : null);
      }}
    >
      {(form) => (
        <>
          <ImageUpload
            label="Profile picture"
            value={avatar}
            onChange={setAvatar}
          />
          <Input
            label="Name"
            {...form.register('name')}
            error={form.formState.errors.name?.message}
          />
          <Input
            label="Email"
            type="email"
            {...form.register('email')}
            error={form.formState.errors.email?.message}
          />
          <Input
            label="Phone"
            {...form.register('phone')}
            error={form.formState.errors.phone?.message}
          />
          <Select
            label="Role"
            options={roleOptions}
            placeholder="Select a role"
            value={form.watch('role') ?? ''}
            onChange={(event) => form.setValue('role', event.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Save changes
            </Button>
          </div>
        </>
      )}
    </FormWrapper>
  );
}

export function UserFormDrawer({
  open,
  onOpenChange,
  mode,
  user,
  roles,
  loading = false,
  onCreate,
  onUpdate,
}: UserFormDrawerProps) {
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={mode === 'create' ? 'Create user' : 'Edit user'}
      description={
        mode === 'create'
          ? 'Admin-created accounts are verified and ready to sign in.'
          : 'Update profile details, role, and optional avatar.'
      }
    >
      {open ? (
        <UserFormBody
          key={`${mode}-${user?.id ?? 'new'}`}
          mode={mode}
          user={user}
          roles={roles}
          loading={loading}
          onOpenChange={onOpenChange}
          onCreate={onCreate}
          onUpdate={onUpdate}
        />
      ) : null}
    </Drawer>
  );
}
