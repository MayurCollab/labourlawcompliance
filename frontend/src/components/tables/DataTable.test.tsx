import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DataTable } from '@/components/tables/DataTable';

type Row = { id: string; name: string };

const columns = [
  { id: 'name', header: 'Name', accessorKey: 'name' as const, sortable: true },
];

const data: Row[] = [
  { id: '1', name: 'Ada' },
  { id: '2', name: 'Grace' },
];

describe('DataTable', () => {
  it('renders rows', () => {
    render(
      <DataTable columns={columns} data={data} rowKey={(row) => row.id} />,
    );
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('Grace')).toBeInTheDocument();
  });

  it('shows empty state when there is no data', () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        rowKey={(row) => row.id}
        emptyTitle="No users"
      />,
    );
    expect(screen.getByText('No users')).toBeInTheDocument();
  });

  it('calls onSortChange when a sortable header is clicked', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();

    render(
      <DataTable
        columns={columns}
        data={data}
        rowKey={(row) => row.id}
        onSortChange={onSortChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Name/i }));
    expect(onSortChange).toHaveBeenCalledWith({
      sortBy: 'name',
      sortOrder: 'asc',
    });
  });
});
