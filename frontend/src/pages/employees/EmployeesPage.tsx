import { useMemo, useState } from 'react';

import { Badge } from '@/components/common/Badge';
import { SearchBox } from '@/components/forms/SearchBox';
import { Input } from '@/components/inputs/Input';
import { Select } from '@/components/inputs/Select';
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

/**
 * Employee month snapshots from salary ingest. Unmatched PHY_CODE rows stay here.
 */
export function EmployeesPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('');
  const [clientId, setClientId] = useState('');
  const [unmatched, setUnmatched] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<DataTablePageSizeOption>(20);
  const [sort, setSort] = useState<DataTableSort>({
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const optionsQuery = useClientOptionsQuery();

  const params: ListEmployeesParams = {
    page,
    limit: resolveDataTableLimit(pageSize),
    search: search || undefined,
    period: period || undefined,
    clientId: clientId || undefined,
    unmatched:
      unmatched === 'true' ? true : unmatched === 'false' ? false : undefined,
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

  const clientOptions = [
    { label: 'All clients', value: '' },
    ...(optionsQuery.data?.clients ?? []).map((client) => ({
      label: `${client.clientCode} · ${client.companyName}`,
      value: client.id,
    })),
  ];

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
        <Select
          label="Client"
          value={clientId}
          options={clientOptions}
          onChange={(event) => {
            setClientId(event.target.value);
            setPage(1);
          }}
          containerClassName="sm:max-w-xs"
        />
        <Select
          label="Match"
          value={unmatched}
          options={[
            { label: 'All', value: '' },
            { label: 'Matched', value: 'false' },
            { label: 'Unmatched', value: 'true' },
          ]}
          onChange={(event) => {
            setUnmatched(event.target.value);
            setPage(1);
          }}
          containerClassName="sm:max-w-[12rem]"
        />
      </div>

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
        emptyTitle="No employee rows yet"
        emptyDescription="Upload SalarySheet All Employees.xlsx on the Uploads page. Employees match clients by PHY_CODE or Client code (C0039)."
      />
    </div>
  );
}
