import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/common/Card';
import { PageHeader } from '@/components/layout/PageHeader';
import { APP_NAME } from '@/constants/app';
import { PERMISSIONS } from '@/constants/permissions';
import { useClientsQuery } from '@/hooks/useClients';
import { useEmployeesQuery } from '@/hooks/useEmployees';
import { useFilingsQuery } from '@/hooks/useFilings';
import { usePermission } from '@/hooks/usePermission';

const currentPeriod = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Operations dashboard. Client and this-month filing counts are live.
 */
export function HomePage() {
  const { hasPermission } = usePermission();
  const clientsQuery = useClientsQuery(
    { page: 1, limit: 1 },
    { enabled: hasPermission(PERMISSIONS.CLIENTS_VIEW) },
  );
  const filingsQuery = useFilingsQuery(
    { page: 1, limit: 1, period: currentPeriod() },
    { enabled: hasPermission(PERMISSIONS.FILINGS_VIEW) },
  );
  const pendingGenerateQuery = useFilingsQuery(
    {
      page: 1,
      limit: 1,
      period: currentPeriod(),
      generateStatus: 'pending',
    },
    { enabled: hasPermission(PERMISSIONS.FILINGS_VIEW) },
  );
  const unmatchedQuery = useEmployeesQuery(
    { page: 1, limit: 1, unmatched: true },
    { enabled: hasPermission(PERMISSIONS.EMPLOYEES_VIEW) },
  );

  const clientCount = hasPermission(PERMISSIONS.CLIENTS_VIEW)
    ? clientsQuery.isLoading
      ? '…'
      : String(clientsQuery.data?.pagination.total ?? 0)
    : '—';

  const unmatchedCount = hasPermission(PERMISSIONS.EMPLOYEES_VIEW)
    ? unmatchedQuery.isLoading
      ? '…'
      : String(unmatchedQuery.data?.pagination.total ?? 0)
    : '—';

  const filingCount = hasPermission(PERMISSIONS.FILINGS_VIEW)
    ? filingsQuery.isLoading
      ? '…'
      : String(filingsQuery.data?.pagination.total ?? 0)
    : '—';

  const pendingGenerate = hasPermission(PERMISSIONS.FILINGS_VIEW)
    ? pendingGenerateQuery.isLoading
      ? '…'
      : String(pendingGenerateQuery.data?.pagination.total ?? 0)
    : '—';

  const stats = [
    {
      title: 'Clients',
      value: clientCount,
      description: 'Employer client master.',
    },
    {
      title: 'This month filings',
      value: filingCount,
      description: 'Form 5 stubs for the current calendar month.',
    },
    {
      title: 'Pending generate',
      value: pendingGenerate,
      description: 'This-month filings without a filled Form 5 file yet.',
    },
    {
      title: 'Unmatched salary',
      value: unmatchedCount,
      description: 'Salary rows that could not be tied to a client.',
    },
  ] as const;

  return (
    <div>
      <PageHeader
        title={APP_NAME}
        description="Gujarat Professional Tax — Form 5 (Namuno-5) operations."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader>
              <CardDescription>{stat.title}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{stat.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
