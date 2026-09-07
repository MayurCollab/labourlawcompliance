import { Button } from '@/components/buttons';
import { Drawer } from '@/components/dialogs/Drawer';
import { FormWrapper } from '@/components/forms/FormWrapper';
import { Input } from '@/components/inputs/Input';
import { Select } from '@/components/inputs/Select';
import { Switch } from '@/components/inputs/Switch';
import { Textarea } from '@/components/inputs/Textarea';
import type { Client, Location } from '@/types/client.types';
import {
  clientFormSchema,
  type ClientFormValues,
} from '@/validations/masters.validation';

type ClientFormDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  client?: Client | null;
  locations: Location[];
  loading?: boolean;
  onSubmit: (values: ClientFormValues) => void;
};

export function ClientFormDrawer({
  open,
  onOpenChange,
  mode,
  client,
  locations,
  loading = false,
  onSubmit,
}: ClientFormDrawerProps) {
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={mode === 'create' ? 'Create client' : 'Edit client'}
      description={
        mode === 'create'
          ? 'Clients are normally created from MasterSheet uploads. Use this only if you must add one by hand.'
          : 'Edit address, RC, template preference, and whether Form 5 includes the salary employee list.'
      }
    >
      {open ? (
        <ClientFormBody
          key={`${mode}-${client?.id ?? 'new'}`}
          mode={mode}
          client={client}
          locations={locations}
          loading={loading}
          onOpenChange={onOpenChange}
          onSubmit={onSubmit}
        />
      ) : null}
    </Drawer>
  );
}

function ClientFormBody({
  mode,
  client,
  locations,
  loading,
  onOpenChange,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  client?: Client | null;
  locations: Location[];
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ClientFormValues) => void;
}) {
  const locationOptions = locations.map((location) => ({
    label: location.name,
    value: location.name,
  }));

  return (
    <FormWrapper<ClientFormValues>
      schema={clientFormSchema}
      defaultValues={{
        clientCode: client?.clientCode ?? '',
        companyName: client?.companyName ?? '',
        locationName: client?.location?.name ?? '',
        draftName: client?.draftName ?? '',
        authorityName: client?.authorityName ?? '',
        address: client?.address ?? '',
        rcNumber: client?.rcNumber ?? '',
        contactNumber: client?.contactNumber ?? '',
        fundCode: client?.fundCode ?? '',
        phyCode: client?.phyCode ?? '',
        status: client?.status ?? '',
        signatoryName: client?.signatoryName ?? '',
        includeEmployeesOnForm5: client?.includeEmployeesOnForm5 !== false,
      }}
      onSubmit={onSubmit}
    >
      {(form) => (
        <>
          <Input
            label="Client code"
            hint="Stable key from MasterSheet, e.g. C0001"
            {...form.register('clientCode')}
            error={form.formState.errors.clientCode?.message}
          />
          <Input
            label="Name of company"
            {...form.register('companyName')}
            error={form.formState.errors.companyName?.message}
          />
          <Input
            label="Drafts in the name of"
            {...form.register('draftName')}
            error={form.formState.errors.draftName?.message}
          />
          {locationOptions.length > 0 ? (
            <Select
              label="Existing locations"
              placeholder="Copy an existing location…"
              options={locationOptions}
              value=""
              onChange={(event) => {
                if (event.target.value) {
                  form.setValue('locationName', event.target.value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                }
              }}
            />
          ) : null}
          <Input
            label="Location"
            hint="Typing a new name creates the location."
            {...form.register('locationName')}
            error={form.formState.errors.locationName?.message}
          />
          <Input
            label="Authority name"
            {...form.register('authorityName')}
            error={form.formState.errors.authorityName?.message}
          />
          <Textarea
            label="Employer address"
            hint="Filled from Client - Master.xlsx (Address.1). Used on Form 5."
            rows={3}
            {...form.register('address')}
            error={form.formState.errors.address?.message}
          />
          <Input
            label="Reg No. (RC)"
            {...form.register('rcNumber')}
            error={form.formState.errors.rcNumber?.message}
          />
          <Input
            label="Fund code"
            {...form.register('fundCode')}
            error={form.formState.errors.fundCode?.message}
          />
          <Input
            label="PHY code"
            hint="Salary branch code, e.g. 0083 for [83]"
            {...form.register('phyCode')}
            error={form.formState.errors.phyCode?.message}
          />
          <Input
            label="Contact number"
            {...form.register('contactNumber')}
            error={form.formState.errors.contactNumber?.message}
          />
          <Input
            label="Status"
            hint="Stored as-is from MasterSheet (G, SGC, …)"
            {...form.register('status')}
            error={form.formState.errors.status?.message}
          />
          <Input
            label="Signatory (this client)"
            hint="Leave blank to use the consultancy default."
            {...form.register('signatoryName')}
            error={form.formState.errors.signatoryName?.message}
          />
          <Switch
            label="Include salary employees on Form 5"
            hint="On by default. Turn off to generate Form 5 without the employee list for this client."
            checked={form.watch('includeEmployeesOnForm5') !== false}
            onChange={(event) =>
              form.setValue('includeEmployeesOnForm5', event.target.checked, {
                shouldDirty: true,
              })
            }
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              {mode === 'create' ? 'Create client' : 'Save'}
            </Button>
          </div>
        </>
      )}
    </FormWrapper>
  );
}
