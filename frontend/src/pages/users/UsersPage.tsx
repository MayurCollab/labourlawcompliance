import { useMemo, useState } from 'react';
import { MoreHorizontal, Plus } from 'lucide-react';

import { Button } from '@/components/buttons';
import { Avatar } from '@/components/common/Avatar';
import { Badge } from '@/components/common/Badge';
import { PermissionGate } from '@/components/common/PermissionGate';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { FilterPanel, type FilterValues } from '@/components/forms/FilterPanel';
import { SearchBox } from '@/components/forms/SearchBox';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  DataTable,
  type DataTableColumn,
  type DataTableSort,
} from '@/components/tables';
import { PERMISSIONS } from '@/constants/permissions';
import { useAuth } from '@/hooks/useAuth';
import { usePermission } from '@/hooks/usePermission';
import { useRolesQuery } from '@/hooks/useRoles';
import {
  useCreateUserMutation,
  useDeleteUserMutation,
  useSetUserStatusMutation,
  useUpdateUserMutation,
  useUsersQuery,
} from '@/hooks/useUsers';
import { UserFormDrawer } from '@/pages/users/UserFormDrawer';
import { PATHS } from '@/routes/paths';
import type { User } from '@/types/auth.types';
import type { ListUsersParams } from '@/types/user.types';
import { resolveUploadUrl } from '@/utils/uploads';

type PendingStatus = { user: User; nextActive: boolean } | null;
type PendingDelete = User | null;

/**
 * Users admin list — create/edit via Drawer (keeps the table in context).
 */
export function UsersPage() {
  const { user: currentUser } = useAuth();
  const { hasPermission } = usePermission();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<FilterValues>({
    role: '',
    isActive: '',
  });
  const [appliedFilters, setAppliedFilters] = useState<FilterValues>({
    role: '',
    isActive: '',
  });
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<DataTableSort>({
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [pendingStatus, setPendingStatus] = useState<PendingStatus>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [menuUserId, setMenuUserId] = useState<string | null>(null);

  const listParams: ListUsersParams = {
    page,
    limit: 10,
    search: search || undefined,
    role: typeof appliedFilters.role === 'string' && appliedFilters.role
      ? appliedFilters.role
      : undefined,
    isActive:
      appliedFilters.isActive === 'true'
        ? true
        : appliedFilters.isActive === 'false'
          ? false
          : undefined,
    sortBy: sort.sortBy as ListUsersParams['sortBy'],
    sortOrder: sort.sortOrder,
  };

  const usersQuery = useUsersQuery(listParams);
  const rolesQuery = useRolesQuery({
    enabled: hasPermission(PERMISSIONS.ROLES_VIEW),
  });
  const createMutation = useCreateUserMutation();
  const updateMutation = useUpdateUserMutation();
  const statusMutation = useSetUserStatusMutation();
  const deleteMutation = useDeleteUserMutation();

  const roleOptions = useMemo(
    () =>
      (rolesQuery.data ?? []).map((role) => ({
        label: role.name,
        value: role.id,
      })),
    [rolesQuery.data],
  );

  const columns: DataTableColumn<User>[] = [
    {
      id: 'name',
      header: 'User',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <Avatar
            name={row.name}
            src={resolveUploadUrl(row.avatar)}
            size="sm"
          />
          <div className="min-w-0">
            <p className="truncate font-medium">{row.name}</p>
            <p className="truncate text-xs text-muted-foreground">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'role',
      header: 'Role',
      cell: (row) => row.role?.name ?? '—',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <Badge variant={row.isActive ? 'success' : 'secondary'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      id: 'createdAt',
      header: 'Created',
      sortable: true,
      cell: (row) => new Date(row.createdAt).toLocaleDateString(),
    },
    {
      id: 'actions',
      header: '',
      className: 'w-12 text-right',
      cell: (row) => {
        const isSelf = row.id === currentUser?.id;
        const open = menuUserId === row.id;
        return (
          <div className="relative flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Row actions"
              onClick={() => setMenuUserId(open ? null : row.id)}
            >
              <MoreHorizontal className="size-4" />
            </Button>
            {open ? (
              <div className="absolute right-0 z-20 mt-8 w-44 rounded-lg border border-border bg-popover p-1 shadow-md">
                <PermissionGate permission={PERMISSIONS.USERS_EDIT}>
                  <button
                    type="button"
                    className="flex w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      setMenuUserId(null);
                      setDrawerMode('edit');
                      setEditingUser(row);
                      setDrawerOpen(true);
                    }}
                  >
                    Edit
                  </button>
                </PermissionGate>
                <PermissionGate permission={PERMISSIONS.USERS_EDIT}>
                  <button
                    type="button"
                    className="flex w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                    disabled={isSelf}
                    title={
                      isSelf
                        ? 'You cannot change your own status'
                        : undefined
                    }
                    onClick={() => {
                      setMenuUserId(null);
                      setPendingStatus({
                        user: row,
                        nextActive: !row.isActive,
                      });
                    }}
                  >
                    {row.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </PermissionGate>
                <PermissionGate permission={PERMISSIONS.USERS_DELETE}>
                  <button
                    type="button"
                    className="flex w-full rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-muted disabled:opacity-50"
                    disabled={isSelf}
                    title={
                      isSelf ? 'You cannot delete your own account' : undefined
                    }
                    onClick={() => {
                      setMenuUserId(null);
                      setPendingDelete(row);
                    }}
                  >
                    Delete
                  </button>
                </PermissionGate>
              </div>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage accounts, roles, and activation status."
        breadcrumbs={[
          { label: 'Home', href: PATHS.home },
          { label: 'Users' },
        ]}
        actions={
          <PermissionGate permission={PERMISSIONS.USERS_CREATE}>
            <Button
              leftIcon={<Plus className="size-4" />}
              onClick={() => {
                setDrawerMode('create');
                setEditingUser(null);
                setDrawerOpen(true);
              }}
            >
              Add user
            </Button>
          </PermissionGate>
        }
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <SearchBox
          value={searchInput}
          onChange={setSearchInput}
          onSubmit={(value) => {
            setPage(1);
            setSearch(value.trim());
          }}
          placeholder="Search name or email…"
          className="lg:max-w-xs"
        />
      </div>

      <FilterPanel
        fields={[
          {
            key: 'role',
            label: 'Role',
            type: 'select',
            options: roleOptions,
            placeholder: 'All roles',
          },
          {
            key: 'isActive',
            label: 'Status',
            type: 'select',
            options: [
              { label: 'Active', value: 'true' },
              { label: 'Inactive', value: 'false' },
            ],
            placeholder: 'All statuses',
          },
        ]}
        values={filters}
        onChange={setFilters}
        onApply={(values) => {
          setPage(1);
          setAppliedFilters(values);
        }}
        onReset={() => {
          setFilters({ role: '', isActive: '' });
          setAppliedFilters({ role: '', isActive: '' });
          setPage(1);
        }}
      />

      <DataTable
        columns={columns}
        data={usersQuery.data?.users ?? []}
        rowKey={(row) => row.id}
        loading={usersQuery.isLoading}
        sort={sort}
        onSortChange={(next) => {
          setPage(1);
          setSort(next);
        }}
        pagination={
          usersQuery.data
            ? {
                page: usersQuery.data.pagination.page,
                limit: usersQuery.data.pagination.limit,
                total: usersQuery.data.pagination.total,
                totalPages: usersQuery.data.pagination.totalPages,
              }
            : undefined
        }
        onPageChange={setPage}
        emptyTitle="No users found"
        emptyDescription="Try adjusting search or filters, or create a new user."
      />

      <UserFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        mode={drawerMode}
        user={editingUser}
        roles={rolesQuery.data ?? []}
        loading={createMutation.isPending || updateMutation.isPending}
        onCreate={(values, avatar) => {
          createMutation.mutate(
            {
              payload: {
                name: values.name,
                email: values.email,
                password: values.password,
                phone: values.phone || null,
                role: values.role || undefined,
                isActive: values.isActive ?? true,
              },
              avatar,
            },
            { onSuccess: () => setDrawerOpen(false) },
          );
        }}
        onUpdate={(values, avatar) => {
          if (!editingUser) return;
          updateMutation.mutate(
            {
              id: editingUser.id,
              payload: {
                name: values.name,
                email: values.email,
                phone: values.phone || null,
                role: values.role || null,
              },
              avatar,
            },
            { onSuccess: () => setDrawerOpen(false) },
          );
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingStatus)}
        onOpenChange={(open) => {
          if (!open) setPendingStatus(null);
        }}
        title={
          pendingStatus?.nextActive ? 'Activate user?' : 'Deactivate user?'
        }
        message={
          pendingStatus
            ? `Are you sure you want to ${pendingStatus.nextActive ? 'activate' : 'deactivate'} ${pendingStatus.user.name}?`
            : ''
        }
        confirmLabel={pendingStatus?.nextActive ? 'Activate' : 'Deactivate'}
        danger={!pendingStatus?.nextActive}
        loading={statusMutation.isPending}
        onConfirm={() => {
          if (!pendingStatus) return;
          statusMutation.mutate({
            id: pendingStatus.user.id,
            isActive: pendingStatus.nextActive,
          });
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete user?"
        message={
          pendingDelete
            ? `Soft-delete ${pendingDelete.name}? They will no longer appear in the list.`
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
