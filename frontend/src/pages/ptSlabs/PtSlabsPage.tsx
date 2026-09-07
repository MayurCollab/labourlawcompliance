import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/buttons';
import { PermissionGate } from '@/components/common/PermissionGate';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { Modal } from '@/components/dialogs/Modal';
import { FormWrapper } from '@/components/forms/FormWrapper';
import { Input } from '@/components/inputs/Input';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type DataTableColumn } from '@/components/tables';
import { PERMISSIONS } from '@/constants/permissions';
import {
  useCreatePtSlabMutation,
  useDeletePtSlabMutation,
  usePtSlabsQuery,
  useUpdatePtSlabMutation,
} from '@/hooks/useMasters';
import { PATHS } from '@/routes/paths';
import type { PtSlab } from '@/types/masters.types';
import {
  ptSlabFormSchema,
  type PtSlabFormValues,
} from '@/validations/masters.validation';

const toDateInput = (value?: string | null) =>
  value ? value.slice(0, 10) : '2019-04-01';

const formatAmount = (value: number) => value.toLocaleString('en-IN');

/**
 * Effective-dated Gujarat PT slab table. Generator maps by from/to/rate.
 */
export function PtSlabsPage() {
  const slabsQuery = usePtSlabsQuery();
  const createMutation = useCreatePtSlabMutation();
  const updateMutation = useUpdatePtSlabMutation();
  const deleteMutation = useDeletePtSlabMutation();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingSlab, setEditingSlab] = useState<PtSlab | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PtSlab | null>(null);

  const columns: DataTableColumn<PtSlab>[] = useMemo(
    () => [
      {
        id: 'label',
        header: 'Slab',
        cell: (row) => <span className="font-medium">{row.label}</span>,
      },
      {
        id: 'range',
        header: 'Salary (₹)',
        cell: (row) =>
          row.salaryTo === null
            ? `${formatAmount(row.salaryFrom)} and above`
            : `${formatAmount(row.salaryFrom)} – ${formatAmount(row.salaryTo)}`,
      },
      {
        id: 'rate',
        header: 'Rate (₹)',
        cell: (row) => formatAmount(row.rate),
      },
      {
        id: 'effectiveFrom',
        header: 'Effective from',
        cell: (row) => new Date(row.effectiveFrom).toLocaleDateString(),
      },
      {
        id: 'actions',
        header: '',
        className: 'text-right',
        cell: (row) => (
          <div className="flex justify-end gap-2">
            <PermissionGate permission={PERMISSIONS.CLIENTS_EDIT}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingSlab(row);
                  setModalOpen(true);
                }}
              >
                Edit
              </Button>
            </PermissionGate>
            <PermissionGate permission={PERMISSIONS.CLIENTS_DELETE}>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setPendingDelete(row)}
              >
                Delete
              </Button>
            </PermissionGate>
          </div>
        ),
      },
    ],
    [],
  );

  const isEditing = Boolean(editingSlab);

  return (
    <div className="space-y-6">
      <PageHeader
        title="PT slabs"
        description="Gujarat Professional Tax bands. Rates are data, not hardcoded in the Form 5 generator."
        breadcrumbs={[
          { label: 'Home', href: PATHS.home },
          { label: 'PT slabs' },
        ]}
        actions={
          <PermissionGate permission={PERMISSIONS.CLIENTS_EDIT}>
            <Button
              leftIcon={<Plus className="size-4" />}
              onClick={() => {
                setEditingSlab(null);
                setModalOpen(true);
              }}
            >
              Add slab
            </Button>
          </PermissionGate>
        }
      />

      <DataTable
        columns={columns}
        data={slabsQuery.data ?? []}
        rowKey={(row) => row.id}
        loading={slabsQuery.isLoading}
        emptyTitle="No PT slabs"
        emptyDescription="Run the seeder to insert the Gujarat default table."
      />

      <Modal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditingSlab(null);
        }}
        title={isEditing ? 'Edit PT slab' : 'Add PT slab'}
        description="Leave salary to blank for an open-ended band (e.g. 12,000 and above)."
      >
        <FormWrapper<PtSlabFormValues>
          key={editingSlab?.id ?? 'create'}
          schema={ptSlabFormSchema}
          defaultValues={{
            salaryFrom: editingSlab?.salaryFrom ?? 0,
            salaryTo:
              editingSlab?.salaryTo === null || editingSlab?.salaryTo === undefined
                ? ''
                : String(editingSlab.salaryTo),
            rate: editingSlab?.rate ?? 0,
            label: editingSlab?.label ?? '',
            effectiveFrom: toDateInput(editingSlab?.effectiveFrom),
            sortOrder: editingSlab?.sortOrder ?? 0,
          }}
          onSubmit={(values) => {
            const salaryTo =
              values.salaryTo.trim() === '' ? null : Number(values.salaryTo);
            const payload = {
              salaryFrom: values.salaryFrom,
              salaryTo,
              rate: values.rate,
              label: values.label || undefined,
              effectiveFrom: values.effectiveFrom,
              sortOrder: values.sortOrder,
            };

            if (editingSlab) {
              updateMutation.mutate(
                { id: editingSlab.id, payload },
                {
                  onSuccess: () => {
                    setModalOpen(false);
                    setEditingSlab(null);
                  },
                },
              );
              return;
            }

            createMutation.mutate(payload, {
              onSuccess: () => setModalOpen(false),
            });
          }}
        >
          {(form) => (
            <>
              <Input
                label="Salary from"
                type="number"
                min={0}
                {...form.register('salaryFrom')}
                error={form.formState.errors.salaryFrom?.message}
              />
              <Input
                label="Salary to"
                type="number"
                min={0}
                hint="Leave blank for “and above”."
                {...form.register('salaryTo')}
                error={form.formState.errors.salaryTo?.message}
              />
              <Input
                label="Rate (₹ / month)"
                type="number"
                min={0}
                {...form.register('rate')}
                error={form.formState.errors.rate?.message}
              />
              <Input
                label="Label"
                hint="Optional — generated from the range if empty."
                {...form.register('label')}
                error={form.formState.errors.label?.message}
              />
              <Input
                label="Effective from"
                type="date"
                {...form.register('effectiveFrom')}
                error={form.formState.errors.effectiveFrom?.message}
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
        title="Delete PT slab?"
        message={
          pendingDelete
            ? `Delete “${pendingDelete.label}”? The seeder will re-insert Gujarat defaults if this row is one of them.`
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
