import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';

import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/buttons';
import { Input } from '@/components/inputs/Input';
import { useEmployeesQuery } from '@/hooks/useEmployees';
import { cn } from '@/lib/utils';
import { PATHS } from '@/routes/paths';
import type { Client } from '@/types/client.types';

type ClientEmployeesPanelProps = {
  client: Client;
  onClose: () => void;
};

const formatAmount = (value: number | null) =>
  value === null || value === undefined ? '—' : value.toLocaleString('en-IN');

/**
 * Inline detail panel shown directly under a client row (double-click to
 * expand — see DataTable's `renderExpandedRow`) listing that client's
 * salary-sheet employee-month records.
 */
export function ClientEmployeesPanel({
  client,
  onClose,
}: ClientEmployeesPanelProps) {
  const [period, setPeriod] = useState('');

  const employeesQuery = useEmployeesQuery({
    clientId: client.id,
    period: period || undefined,
    limit: 50,
    sortBy: 'period',
    sortOrder: 'desc',
  });

  const employees = employeesQuery.data?.employees ?? [];
  const total = employeesQuery.data?.pagination.total ?? 0;

  return (
    <div className="flex h-full flex-col gap-2 border-y border-border/80 bg-muted/20 px-4 py-3">
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <p className="text-sm font-medium">
          {client.companyName || client.clientCode}{' '}
          <span className="font-normal text-muted-foreground">
            · Employees
            {total ? ` (${total})` : ''}
          </span>
        </p>
        <Input
          aria-label="Filter by period"
          type="month"
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
          placeholder="All periods"
          containerClassName="w-[10rem]"
          className="h-7 py-1 text-xs"
        />
        <Link
          to={PATHS.employees}
          className="text-xs font-medium text-primary hover:underline"
        >
          View in Employees module
        </Link>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="ml-auto"
          title="Close"
          aria-label="Close employees panel"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div
        className={cn(
          'min-h-0 flex-1 overflow-y-auto rounded-md border border-border/70 bg-background transition-opacity duration-150',
          employeesQuery.isFetching && 'opacity-60',
        )}
      >
        {employeesQuery.isLoading ? (
          <p className="p-3 text-sm text-muted-foreground">Loading…</p>
        ) : employees.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">
            No employee records for this client{period ? ` in ${period}` : ''}
            yet.
          </p>
        ) : (
          <table className="w-full min-w-[42rem] border-collapse text-xs">
            <thead className="sticky top-0 bg-muted/60">
              <tr className="text-left text-muted-foreground">
                <th className="px-2 py-1.5 font-medium">EMPNO</th>
                <th className="px-2 py-1.5 font-medium">Name</th>
                <th className="px-2 py-1.5 font-medium">Period</th>
                <th className="px-2 py-1.5 font-medium">PT GROSS</th>
                <th className="px-2 py-1.5 font-medium">P_TAX</th>
                <th className="px-2 py-1.5 font-medium">Match</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id} className="border-t border-border/60">
                  <td className="px-2 py-1.5 font-medium">
                    {employee.employeeNo}
                  </td>
                  <td className="px-2 py-1.5">
                    {employee.employeeName || '—'}
                  </td>
                  <td className="px-2 py-1.5">
                    {employee.periodLabel || employee.period}
                  </td>
                  <td className="px-2 py-1.5">
                    {formatAmount(employee.ptGross)}
                  </td>
                  <td className="px-2 py-1.5">{formatAmount(employee.pTax)}</td>
                  <td className="px-2 py-1.5">
                    {employee.unmatched ? (
                      <Badge
                        variant="warning"
                        title={employee.unmatchedReason || undefined}
                      >
                        Unmatched
                      </Badge>
                    ) : (
                      <Badge variant="success">Matched</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
