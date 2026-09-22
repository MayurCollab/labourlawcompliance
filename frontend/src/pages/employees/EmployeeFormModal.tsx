import { useState } from 'react';

import { Button } from '@/components/buttons';
import { Modal } from '@/components/dialogs/Modal';
import { FormWrapper } from '@/components/forms/FormWrapper';
import { Input } from '@/components/inputs/Input';
import { Select, type SelectOption } from '@/components/inputs/Select';
import { useEmployeeLookup } from '@/hooks/useEmployees';
import type { Employee } from '@/types/employee.types';
import {
  employeeFormSchema,
  type EmployeeFormValues,
} from '@/validations/masters.validation';

type EmployeeFormModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  employee?: Employee | null;
  clientOptions: SelectOption[];
  loading?: boolean;
  /**
   * `matchedEmployeeId` is set when the user picked an Employee No + Client +
   * Period in create mode that already exists — the caller should update
   * that row instead of creating a new one.
   */
  onSubmit: (
    values: EmployeeFormValues,
    matchedEmployeeId: string | null,
  ) => void;
};

export function EmployeeFormModal({
  open,
  onOpenChange,
  mode,
  employee,
  clientOptions,
  loading = false,
  onSubmit,
}: EmployeeFormModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={mode === 'create' ? 'Add employee' : 'Edit employee'}
      description={
        mode === 'create'
          ? 'Employees are normally added from salary workbook uploads. Use this only if you must add one row by hand. Entering an Employee No, Client and Period that already exists loads that row for editing.'
          : 'Edit this employee-month row. P.Tax is recomputed from PT GROSS using the active slabs.'
      }
      className="max-w-xl"
    >
      {open ? (
        <EmployeeFormBody
          key={`${mode}-${employee?.id ?? 'new'}`}
          mode={mode}
          employee={employee}
          clientOptions={clientOptions}
          loading={loading}
          onOpenChange={onOpenChange}
          onSubmit={onSubmit}
        />
      ) : null}
    </Modal>
  );
}

function EmployeeFormBody({
  mode,
  employee,
  clientOptions,
  loading,
  onOpenChange,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  employee?: Employee | null;
  clientOptions: SelectOption[];
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    values: EmployeeFormValues,
    matchedEmployeeId: string | null,
  ) => void;
}) {
  const [matchedEmployee, setMatchedEmployee] = useState<Employee | null>(
    null,
  );
  const lookupMutation = useEmployeeLookup();

  const resolveMatch = (values: EmployeeFormValues) =>
    mode === 'create' &&
    matchedEmployee !== null &&
    matchedEmployee.client?.id === values.clientId &&
    matchedEmployee.employeeNo.trim().toUpperCase() ===
      values.employeeNo.trim().toUpperCase() &&
    matchedEmployee.period === values.period
      ? matchedEmployee.id
      : null;

  return (
    <FormWrapper<EmployeeFormValues>
      schema={employeeFormSchema}
      defaultValues={{
        clientId: employee?.client?.id ?? '',
        employeeNo: employee?.employeeNo ?? '',
        employeeName: employee?.employeeName ?? '',
        period: employee?.period ?? '',
        state: employee?.state ?? 'Gujarat',
        ptGross:
          employee?.ptGross === null || employee?.ptGross === undefined
            ? ''
            : String(employee.ptGross),
      }}
      onSubmit={(values) => onSubmit(values, resolveMatch(values))}
    >
      {(form) => {
        const clientField = form.register('clientId');
        const periodField = form.register('period');
        const employeeNoField = form.register('employeeNo');

        const currentClientId = form.watch('clientId');
        const currentPeriod = form.watch('period');
        const currentEmployeeNo = form.watch('employeeNo');
        const isMatchCurrent = resolveMatch({
          clientId: currentClientId,
          employeeNo: currentEmployeeNo || '',
          period: currentPeriod,
          employeeName: '',
          state: '',
          ptGross: '',
        })
          ? true
          : false;

        const attemptLookup = async (
          clientId: string,
          employeeNo: string,
          period: string,
        ) => {
          if (mode !== 'create') return;
          if (!clientId || !employeeNo.trim() || !period) {
            setMatchedEmployee(null);
            return;
          }
          const found = await lookupMutation
            .mutateAsync({ clientId, employeeNo: employeeNo.trim(), period })
            .catch(() => null);
          if (found) {
            setMatchedEmployee(found);
            form.reset({
              clientId,
              employeeNo: found.employeeNo,
              employeeName: found.employeeName ?? '',
              period: found.period,
              state: found.state ?? 'Gujarat',
              ptGross:
                found.ptGross === null || found.ptGross === undefined
                  ? ''
                  : String(found.ptGross),
            });
          } else {
            setMatchedEmployee(null);
          }
        };

        return (
          <>
            {isMatchCurrent && matchedEmployee ? (
              <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-100 px-3 py-2 text-xs text-amber-950 dark:bg-amber-950 dark:text-amber-100">
                Loaded existing row for{' '}
                <strong>{matchedEmployee.employeeNo}</strong> (
                {matchedEmployee.period}). Saving will update this row.
              </div>
            ) : null}

            <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
              <Select
                label="Client"
                placeholder="Select a client…"
                options={clientOptions}
                {...clientField}
                onChange={(event) => {
                  clientField.onChange(event);
                  void attemptLookup(
                    event.target.value,
                    form.getValues('employeeNo'),
                    form.getValues('period'),
                  );
                }}
                error={form.formState.errors.clientId?.message}
              />
              <Input
                label="Period"
                type="month"
                hint="Salary month this row belongs to."
                {...periodField}
                onChange={(event) => {
                  periodField.onChange(event);
                  void attemptLookup(
                    form.getValues('clientId'),
                    form.getValues('employeeNo'),
                    event.target.value,
                  );
                }}
                error={form.formState.errors.period?.message}
              />

              <Input
                label="Employee No"
                hint={
                  mode === 'create'
                    ? 'Type an existing Employee No (for this client and period) to load and edit that row.'
                    : undefined
                }
                {...employeeNoField}
                onBlur={(event) => {
                  employeeNoField.onBlur(event);
                  void attemptLookup(
                    form.getValues('clientId'),
                    event.target.value,
                    form.getValues('period'),
                  );
                }}
                error={form.formState.errors.employeeNo?.message}
              />
              <Input
                label="Employee name"
                {...form.register('employeeName')}
                error={form.formState.errors.employeeName?.message}
              />

              <Input
                label="PT GROSS"
                type="number"
                min={0}
                step="0.01"
                hint="Leave blank for the default ₹200 P.Tax."
                {...form.register('ptGross')}
                error={form.formState.errors.ptGross?.message}
              />
              <Input
                label="State"
                {...form.register('state')}
                error={form.formState.errors.state?.message}
              />
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={loading}>
                {mode === 'edit' || isMatchCurrent ? 'Save' : 'Add employee'}
              </Button>
            </div>
          </>
        );
      }}
    </FormWrapper>
  );
}
