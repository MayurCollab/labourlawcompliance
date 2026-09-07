import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/buttons';
import { Badge } from '@/components/common/Badge';
import { PermissionGate } from '@/components/common/PermissionGate';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { Modal } from '@/components/dialogs/Modal';
import { FormWrapper } from '@/components/forms/FormWrapper';
import { Input } from '@/components/inputs/Input';
import { Textarea } from '@/components/inputs/Textarea';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/tables';
import { PERMISSIONS } from '@/constants/permissions';
import {
  useCreateRoleMutation,
  useDeleteRoleMutation,
  useRolesQuery,
  useUpdateRoleMutation,
} from '@/hooks/useRoles';
import { PATHS } from '@/routes/paths';
import type { Role } from '@/types/role.types';
import {
  roleFormSchema,
  type RoleFormValues,
} from '@/validations/roles.validation';

/**
 * Roles admin — create/edit via Modal; system roles cannot be deleted.
 */
export function RolesPage() {
  const rolesQuery = useRolesQuery();
  const createMutation = useCreateRoleMutation();
  const updateMutation = useUpdateRoleMutation();
  const deleteMutation = useDeleteRoleMutation();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Role | null>(null);

  const columns: DataTableColumn<Role>[] = useMemo(
    () => [
      {
        id: 'name',
        header: 'Role',
        cell: (row) => (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{row.name}</span>
              {row.isSystemRole ? (
                <Badge variant="secondary">System</Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {row.description || 'No description'}
            </p>
          </div>
        ),
      },
      {
        id: 'permissions',
        header: 'Permissions',
        cell: (row) =>
          Array.isArray(row.permissions) ? `${row.permissions.length}` : '0',
      },
      {
        id: 'actions',
        header: '',
        className: 'text-right',
        cell: (row) => (
          <div className="flex justify-end gap-2">
            <PermissionGate permission={PERMISSIONS.ROLES_EDIT}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingRole(row);
                  setModalOpen(true);
                }}
              >
                Edit
              </Button>
            </PermissionGate>
            <PermissionGate permission={PERMISSIONS.ROLES_DELETE}>
              <span
                title={
                  row.isSystemRole
                    ? 'System roles cannot be deleted'
                    : undefined
                }
              >
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={row.isSystemRole}
                  onClick={() => setPendingDelete(row)}
                >
                  Delete
                </Button>
              </span>
            </PermissionGate>
          </div>
        ),
      },
    ],
    [],
  );

  const isEditing = Boolean(editingRole);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles"
        description="Define roles and protect system roles from deletion."
        breadcrumbs={[
          { label: 'Home', href: PATHS.home },
          { label: 'Roles' },
        ]}
        actions={
          <PermissionGate permission={PERMISSIONS.ROLES_CREATE}>
            <Button
              leftIcon={<Plus className="size-4" />}
              onClick={() => {
                setEditingRole(null);
                setModalOpen(true);
              }}
            >
              Add role
            </Button>
          </PermissionGate>
        }
      />

      <DataTable
        columns={columns}
        data={rolesQuery.data ?? []}
        rowKey={(row) => row.id}
        loading={rolesQuery.isLoading}
        emptyTitle="No roles yet"
        emptyDescription="Create a role to start assigning permissions."
      />

      <Modal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditingRole(null);
        }}
        title={isEditing ? 'Edit role' : 'Create role'}
        description={
          isEditing && editingRole?.isSystemRole
            ? 'System roles can update description but not their name.'
            : 'Give the role a clear name and optional description.'
        }
      >
        <FormWrapper<RoleFormValues>
          key={editingRole?.id ?? 'create'}
          schema={roleFormSchema}
          defaultValues={{
            name: editingRole?.name ?? '',
            description: editingRole?.description ?? '',
          }}
          onSubmit={(values) => {
            if (editingRole) {
              updateMutation.mutate(
                {
                  id: editingRole.id,
                  payload: {
                    name: editingRole.isSystemRole ? undefined : values.name,
                    description: values.description,
                  },
                },
                {
                  onSuccess: () => {
                    setModalOpen(false);
                    setEditingRole(null);
                  },
                },
              );
              return;
            }
            createMutation.mutate(
              {
                name: values.name,
                description: values.description,
              },
              {
                onSuccess: () => {
                  setModalOpen(false);
                },
              },
            );
          }}
        >
          {(form) => (
            <>
              <Input
                label="Name"
                disabled={Boolean(editingRole?.isSystemRole)}
                {...form.register('name')}
                error={form.formState.errors.name?.message}
              />
              <Textarea
                label="Description"
                {...form.register('description')}
                error={form.formState.errors.description?.message}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={createMutation.isPending || updateMutation.isPending}
                >
                  {isEditing ? 'Save' : 'Create'}
                </Button>
              </div>
            </>
          )}
        </FormWrapper>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete role?"
        message={
          pendingDelete
            ? `Delete “${pendingDelete.name}”? Users must be unassigned first.`
            : ''
        }
        confirmLabel="Delete"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteMutation.mutate(pendingDelete.id);
        }}
      />
    </div>
  );
}
