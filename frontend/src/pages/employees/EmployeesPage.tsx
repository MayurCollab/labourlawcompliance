import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/buttons';
import { Badge } from '@/components/common/Badge';
import { PermissionGate } from '@/components/common/PermissionGate';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { FilterPanel, filterIds, type FilterValues } from '@/components/forms/FilterPanel';
import { SearchBox } from '@/components/forms/SearchBox';
import { Input } from '@/components/inputs/Input';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  DataTable,
  DEFAULT_DATA_TABLE_PAGE_SIZE,
  resolveDataTableLimit,
  type DataTableColumn,
  type DataTablePageSizeOption,
  type DataTableSort,
} from '@/components/tables';
import {
  RowActionItem,
  RowActionsMenu,
} from '@/components/tables/RowActionsMenu';
import { PERMISSIONS } from '@/constants/permissions';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePermission } from '@/hooks/usePermission';
import { useClientOptionsQuery } from '@/hooks/useClients';
import {
  useCreateEmployeeMutation,
  useDeleteEmployeeMutation,
  useEmployeesQuery,
  useUpdateEmployeeMutation,
} from '@/hooks/useEmployees';
import { EmployeeFormDrawer } from '@/pages/employees/EmployeeFormDrawer';
import { PATHS } from '@/routes/paths';
import type {
  Employee,
  EmployeePayload,
  ListEmployeesParams,
} from '@/types/employee.types';
import type { EmployeeFormValues } from '@/validations/masters.validation';

const emptyToNull = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const toPayload = (values: EmployeeFormValues): EmployeePayload => ({
  clientId: values.clientId,
  employeeNo: values.employeeNo,
  employeeName: emptyToNull(values.employeeName),
  period: values.period,
  state: emptyToNull(values.state),
  ptGross:
    values.ptGross === undefined || values.ptGross.trim() === ''
      ? null
      : Number(values.ptGross),
});

const formatAmount = (value: number | null) =>
  value === null || value === undefined ? '—' : value.toLocaleString('en-IN');

const emptyFilters: FilterValues = {
  clientIds: [],
  unmatched: '',
};

/**
 * Employee month snapshots from salary ingest. Unmatched PHY_CODE rows stay here.
 */
export function EmployeesPage() {
  const { hasPermission } = usePermission();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('');
  const [filters, setFilters] = useState<FilterValues>(emptyFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<FilterValues>(emptyFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<DataTablePageSizeOption>(
    DEFAULT_DATA_TABLE_PAGE_SIZE,
  );
  const [sort, setSort] = useState<DataTableSort>({
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] = useState<Employee | null>(null);
  const [menuEmployeeId, setMenuEmployeeId] = useState<string | null>(null);

  const debouncedSearchInput = useDebouncedValue(searchInput);
  useEffect(() => {
    setSearch(debouncedSearchInput.trim());
    setPage(1);
  }, [debouncedSearchInput]);

  const optionsQuery = useClientOptionsQuery({
    enabled: hasPermission(PERMISSIONS.EMPLOYEES_VIEW),
  });
  const createMutation = useCreateEmployeeMutation();
  const updateMutation = useUpdateEmployeeMutation();
  const deleteMutation = useDeleteEmployeeMutation();
  const clientIds = filterIds(appliedFilters.clientIds);
  const unmatchedValue =
    typeof appliedFilters.unmatched === 'string'
      ? appliedFilters.unmatched
      : '';

  const params: ListEmployeesParams = {
    page,
    limit: resolveDataTableLimit(pageSize),
    search: search || undefined,
    period: period || undefined,
    clientIds: clientIds.length ? clientIds : undefined,
    unmatched:
      unmatchedValue === 'true'
        ? true
        : unmatchedValue === 'false'
          ? false
          : undefined,
    sortBy: sort.sortBy as ListEmployeesParams['sortBy'],
    sortOrder: sort.sortOrder,
  };

  const employeesQuery = useEmployeesQuery(params);

  const columns: DataTableColumn<Employee>[] = useMemo(
    () => [
      {
        id: 'employeeNo',
        header: 'EMPNO',
        sortable: true,
        cell: (row) => <span className="font-medium">{row.employeeNo}</span>,
      },
      {
        id: 'employeeName',
        header: 'Name',
        cell: (row) => row.employeeName || '—',
      },
      {
        id: 'phyCode',
        header: 'PHY',
        sortable: true,
        cell: (row) => row.phyCode,
      },
      {
        id: 'clientCode',
        header: 'Client',
        cell: (row) => row.clientCode || '—',
      },
      {
        id: 'locationName',
        header: 'Location',
        cell: (row) => row.locationName || row.client?.location?.name || '—',
      },
      {
        id: 'period',
        header: 'Period',
        sortable: true,
        cell: (row) => row.periodLabel || row.period,
      },
      {
        id: 'ptGross',
        header: 'PT GROSS',
        cell: (row) => formatAmount(row.ptGross),
      },
      {
        id: 'pTax',
        header: 'P_TAX',
        cell: (row) => formatAmount(row.pTax),
      },
      {
        id: 'unmatched',
        header: 'Match',
        cell: (row) =>
          row.unmatched ? (
            <Badge variant="warning" title={row.unmatchedReason || undefined}>
              Unmatched
            </Badge>
          ) : (
            <Badge variant="success">Matched</Badge>
          ),
      },
      {
        id: 'actions',
        header: '',
        className: 'text-right',
        width: 72,
        minWidth: 72,
        maxWidth: 72,
        cell: (row) => {
          const open = menuEmployeeId === row.id;
          return (
            <RowActionsMenu
              open={open}
              onOpenChange={(next) => setMenuEmployeeId(next ? row.id : null)}
            >
              <PermissionGate permission={PERMISSIONS.EMPLOYEES_EDIT}>
                <RowActionItem
                  onClick={() => {
                    setMenuEmployeeId(null);
                    setDrawerMode('edit');
                    setEditingEmployee(row);
                    setDrawerOpen(true);
                  }}
                >
                  Edit
                </RowActionItem>
              </PermissionGate>
              <PermissionGate permission={PERMISSIONS.EMPLOYEES_DELETE}>
                <RowActionItem
                  destructive
                  onClick={() => {
                    setMenuEmployeeId(null);
                    setPendingDelete(row);
                  }}
                >
                  Delete
                </RowActionItem>
              </PermissionGate>
            </RowActionsMenu>
          );
        },
      },
    ],
    [menuEmployeeId],
  );

  const clientOptions = (optionsQuery.data?.clients ?? []).map((client) => ({
    label: `${client.clientCode} · ${client.companyName}`,
    value: client.id,
  }));

  return (
    <div className="space-y-3">
      <PageHeader
        title="Employees"
        description="Month snapshots from salary workbooks. Rows that could not be tied to a client stay unmatched until PHY_CODE is on a Client."
        breadcrumbs={[
          { label: 'Home', href: PATHS.home },
          { label: 'Employees' },
        ]}
        actions={
          <PermissionGate permission={PERMISSIONS.EMPLOYEES_CREATE}>
            <Button
              size="sm"
              leftIcon={<Plus className="size-4" />}
              onClick={() => {
                setDrawerMode('create');
                setEditingEmployee(null);
                setDrawerOpen(true);
              }}
            >
              Add employee
            </Button>
          </PermissionGate>
        }
      />

      <FilterPanel
        leading={
          <>
            <SearchBox
              value={searchInput}
              onChange={setSearchInput}
              onSubmit={() => {
                setSearch(searchInput.trim());
                setPage(1);
              }}
              placeholder="Search EMPNO or name"
              className="w-[16rem] max-w-full"
            />
            <Input
              label="Period"
              type="month"
              value={period}
              onChange={(event) => {
                setPeriod(event.target.value);
                setPage(1);
              }}
              containerClassName="w-[11rem]"
            />
          </>
        }
        fields={[
          {
            key: 'clientIds',
            label: 'Client',
            type: 'multiSelect',
            options: clientOptions,
            placeholder: 'All clients',
            searchPlaceholder: 'Search clients…',
          },
          {
            key: 'unmatched',
            label: 'Match',
            type: 'select',
            options: [
              { label: 'Matched', value: 'false' },
              { label: 'Unmatched', value: 'true' },
            ],
            placeholder: 'All',
          },
        ]}
        values={filters}
        onChange={setFilters}
        onApply={(values) => {
          setAppliedFilters(values);
          setPage(1);
        }}
        onReset={() => {
          setFilters(emptyFilters);
          setAppliedFilters(emptyFilters);
          setSearchInput('');
          setSearch('');
          setPage(1);
        }}
      />

      <DataTable
        columns={columns}
        data={employeesQuery.data?.employees ?? []}
        rowKey={(row) => row.id}
        loading={employeesQuery.isLoading}
        sort={sort}
        onSortChange={(next) => {
          setSort(next);
          setPage(1);
        }}
        pagination={employeesQuery.data?.pagination}
        onPageChange={setPage}
        pageSizeSelection={pageSize}
        onPageSizeChange={(size) => {
          setPage(1);
          setPageSize(size);
        }}
        emptyTitle="No employees"
        emptyDescription="Upload a salary workbook to populate this list."
        fullscreenTitle="Employees"
      />

      <EmployeeFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        mode={drawerMode}
        employee={editingEmployee}
        clientOptions={clientOptions}
        loading={createMutation.isPending || updateMutation.isPending}
        onSubmit={(values, matchedEmployeeId) => {
          const payload = toPayload(values);
          const targetId =
            drawerMode === 'edit' ? editingEmployee?.id : matchedEmployeeId;
          if (targetId) {
            updateMutation.mutate(
              { id: targetId, payload },
              { onSuccess: () => setDrawerOpen(false) },
            );
            return;
          }
          createMutation.mutate(payload, {
            onSuccess: () => setDrawerOpen(false),
          });
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete employee row?"
        message={
          pendingDelete
            ? `Soft-delete ${pendingDelete.employeeNo} (${pendingDelete.period})? It will no longer appear in the list.`
            : ''
        }
        confirmLabel="Delete"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteMutation.mutate(pendingDelete.id, {
            onSuccess: () => setPendingDelete(null),
          });
        }}
      />
    </div>
  );
}
