import { useMemo, useState } from 'react';

import { Button } from '@/components/buttons';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PermissionGate } from '@/components/common/PermissionGate';
import { Checkbox } from '@/components/inputs/Checkbox';
import { Select } from '@/components/inputs/Select';
import { PageHeader } from '@/components/layout/PageHeader';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermission } from '@/hooks/usePermission';
import { useGroupedPermissionsQuery } from '@/hooks/usePermissions';
import {
  useRolesQuery,
  useUpdateRolePermissionsMutation,
} from '@/hooks/useRoles';
import { PATHS } from '@/routes/paths';
import type { Permission } from '@/types/role.types';

function permissionIdsFromRole(
  permissions: Array<string | Permission> | undefined,
): string[] {
  return (permissions ?? []).map((permission) =>
    typeof permission === 'string' ? permission : permission.id,
  );
}

/**
 * Role ↔ permission mapping — pick a role, toggle permissions grouped by
 * module (accordion sections), save via PATCH /roles/:id/permissions.
 */
export function RolePermissionsPage() {
  const { hasPermission } = usePermission();
  const canEdit = hasPermission(PERMISSIONS.ROLES_EDIT);
  const canViewPermissions = hasPermission(PERMISSIONS.PERMISSIONS_VIEW);

  const rolesQuery = useRolesQuery();
  const groupedQuery = useGroupedPermissionsQuery({
    enabled: canViewPermissions,
  });
  const saveMutation = useUpdateRolePermissionsMutation();

  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [draftPermissionIds, setDraftPermissionIds] = useState<string[] | null>(
    null,
  );
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});

  const selectedRole = useMemo(
    () => (rolesQuery.data ?? []).find((role) => role.id === selectedRoleId),
    [rolesQuery.data, selectedRoleId],
  );

  const selectedPermissionIds =
    draftPermissionIds ?? permissionIdsFromRole(selectedRole?.permissions);

  const modules = useMemo(
    () => Object.entries(groupedQuery.data ?? {}),
    [groupedQuery.data],
  );

  const selectRole = (roleId: string) => {
    setSelectedRoleId(roleId);
    setDraftPermissionIds(null);
  };

  const togglePermission = (permission: Permission, checked: boolean) => {
    if (!canEdit) return;
    setDraftPermissionIds((current) => {
      const base = current ?? selectedPermissionIds;
      if (checked) {
        return base.includes(permission.id)
          ? base
          : [...base, permission.id];
      }
      return base.filter((id) => id !== permission.id);
    });
  };

  const toggleModule = (_moduleName: string, permissions: Permission[]) => {
    if (!canEdit) return;
    const ids = permissions.map((permission) => permission.id);
    const allSelected = ids.every((id) => selectedPermissionIds.includes(id));
    setDraftPermissionIds((current) => {
      const base = current ?? selectedPermissionIds;
      if (allSelected) {
        return base.filter((id) => !ids.includes(id));
      }
      return [...new Set([...base, ...ids])];
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Permissions"
        description="Assign capabilities to a role, grouped by module."
        breadcrumbs={[
          { label: 'Home', href: PATHS.home },
          { label: 'Permissions' },
        ]}
        actions={
          <PermissionGate permission={PERMISSIONS.ROLES_EDIT}>
            <Button
              disabled={!selectedRoleId || saveMutation.isPending}
              loading={saveMutation.isPending}
              onClick={() => {
                if (!selectedRoleId) return;
                saveMutation.mutate(
                  {
                    id: selectedRoleId,
                    permissions: selectedPermissionIds,
                  },
                  {
                    onSuccess: () => setDraftPermissionIds(null),
                  },
                );
              }}
            >
              Save permissions
            </Button>
          </PermissionGate>
        }
      />

      <div className="max-w-sm">
        <Select
          label="Role"
          placeholder="Select a role"
          options={(rolesQuery.data ?? []).map((role) => ({
            label: role.name,
            value: role.id,
          }))}
          value={selectedRoleId}
          onChange={(event) => selectRole(event.target.value)}
        />
      </div>

      {!selectedRoleId ? (
        <p className="text-sm text-muted-foreground">
          Select a role to view and edit its permissions.
        </p>
      ) : !canViewPermissions ? (
        <p className="text-sm text-muted-foreground">
          You need the <code>permissions.view</code> permission to load the
          permission catalog.
        </p>
      ) : groupedQuery.isLoading ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="space-y-3">
          {modules.map(([moduleName, permissions], index) => {
            const open = openModules[moduleName] ?? index === 0;
            const selectedCount = permissions.filter((permission) =>
              selectedPermissionIds.includes(permission.id),
            ).length;

            return (
              <div
                key={moduleName}
                className="overflow-hidden rounded-xl border border-border"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 bg-muted/40 px-4 py-3 text-left"
                  onClick={() =>
                    setOpenModules((current) => ({
                      ...current,
                      [moduleName]: !open,
                    }))
                  }
                >
                  <div>
                    <p className="text-sm font-semibold capitalize">
                      {moduleName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedCount}/{permissions.length} selected
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {open ? 'Hide' : 'Show'}
                  </span>
                </button>

                {open ? (
                  <div className="space-y-3 p-4">
                    <PermissionGate permission={PERMISSIONS.ROLES_EDIT}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => toggleModule(moduleName, permissions)}
                      >
                        {selectedCount === permissions.length
                          ? 'Clear module'
                          : 'Select all in module'}
                      </Button>
                    </PermissionGate>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {permissions.map((permission) => (
                        <Checkbox
                          key={permission.id}
                          label={
                            <span>
                              <span className="font-medium">
                                {permission.name}
                              </span>
                              {permission.description ? (
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                  {permission.description}
                                </span>
                              ) : null}
                            </span>
                          }
                          checked={selectedPermissionIds.includes(
                            permission.id,
                          )}
                          disabled={!canEdit}
                          onChange={(event) =>
                            togglePermission(permission, event.target.checked)
                          }
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
