import { useMemo, useState } from 'react';

import { Badge } from '@/components/common/Badge';
import { FilterPanel, filterIds, type FilterValues } from '@/components/forms/FilterPanel';
import { SearchBox } from '@/components/forms/SearchBox';
import { Input } from '@/components/inputs/Input';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  DataTable,
  resolveDataTableLimit,
  type DataTableColumn,
  type DataTablePageSizeOption,
  type DataTableSort,
} from '@/components/tables';
import { useClientOptionsQuery } from '@/hooks/useClients';
import { useEmployeesQuery } from '@/hooks/useEmployees';
import { PATHS } from '@/routes/paths';
import type { Employee, ListEmployeesParams } from '@/types/employee.types';

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
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('');
  const [filters, setFilters] = useState<FilterValues>(emptyFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<FilterValues>(emptyFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<DataTablePageSizeOption>(20);
  const [sort, setSort] = useState<DataTableSort>({
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const optionsQuery = useClientOptionsQuery();
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
    ],
    [],
  );

  const clientOptions = (optionsQuery.data?.clients ?? []).map((client) => ({
    label: `${client.clientCode} · ${client.companyName}`,
    value: client.id,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Employees"
        description="Month snapshots from salary workbooks. Rows that could not be tied to a client stay unmatched until PHY_CODE is on a Client."
        breadcrumbs={[
          { label: 'Home', href: PATHS.home },
          { label: 'Employees' },
        ]}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <SearchBox
          value={searchInput}
          onChange={setSearchInput}
          onSubmit={() => {
            setSearch(searchInput.trim());
            setPage(1);
          }}
          placeholder="Search EMPNO or name"
          className="sm:max-w-xs"
        />
        <Input
          label="Period"
          type="month"
          value={period}
          onChange={(event) => {
            setPeriod(event.target.value);
            setPage(1);
          }}
          containerClassName="sm:max-w-[12rem]"
        />
      </div>

      <FilterPanel
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
      />
    </div>
  );
}
