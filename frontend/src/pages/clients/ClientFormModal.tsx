import { useState, type FocusEvent } from 'react';

import { Button } from '@/components/buttons';
import { Modal } from '@/components/dialogs/Modal';
import { Input } from '@/components/inputs/Input';
import { Select } from '@/components/inputs/Select';
import { Switch } from '@/components/inputs/Switch';
import { Textarea } from '@/components/inputs/Textarea';
import { FormWrapper } from '@/components/forms/FormWrapper';
import { useClientByCodeLookup } from '@/hooks/useClients';
import type { Client, Location } from '@/types/client.types';
import {
  clientFormSchema,
  type ClientFormValues,
} from '@/validations/masters.validation';

type ClientFormModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  client?: Client | null;
  locations: Location[];
  loading?: boolean;
  /**
   * `matchedClientId` is set when the user typed an existing client code in
   * create mode and it was auto-resolved — the caller should update that
   * client instead of creating a new one.
   */
  onSubmit: (values: ClientFormValues, matchedClientId: string | null) => void;
};

export function ClientFormModal({
  open,
  onOpenChange,
  mode,
  client,
  locations,
  loading = false,
  onSubmit,
}: ClientFormModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={mode === 'create' ? 'Create client' : 'Edit client'}
      description={
        mode === 'create'
          ? 'Clients are normally created from MasterSheet uploads. Use this only if you must add one by hand.'
          : 'Edit address, RC, contact name for Form 5 WhatsApp, and whether Form 5 includes the salary employee list.'
      }
      className="max-w-2xl"
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
    </Modal>
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
  onSubmit: (values: ClientFormValues, matchedClientId: string | null) => void;
}) {
  const locationOptions = locations.map((location) => ({
    label: location.name,
    value: location.name,
  }));

  const [matchedClient, setMatchedClient] = useState<Client | null>(null);
  const lookupMutation = useClientByCodeLookup();

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
        recipientName: client?.recipientName ?? '',
        fundCode: client?.fundCode ?? '',
        phyCode: client?.phyCode ?? '',
        status: client?.status ?? '',
        signatoryName: client?.signatoryName ?? '',
        includeEmployeesOnForm5: client?.includeEmployeesOnForm5 !== false,
      }}
      onSubmit={(values) => {
        const isMatchCurrent =
          mode === 'create' &&
          matchedClient !== null &&
          matchedClient.clientCode.trim().toUpperCase() ===
            values.clientCode.trim().toUpperCase();
        onSubmit(values, isMatchCurrent ? matchedClient!.id : null);
      }}
    >
      {(form) => {
        const codeField = form.register('clientCode');
        const isMatchCurrent =
          mode === 'create' &&
          matchedClient !== null &&
          matchedClient.clientCode.trim().toUpperCase() ===
            (form.watch('clientCode') || '').trim().toUpperCase();

        const handleCodeBlur = async (
          event: FocusEvent<HTMLInputElement>,
        ) => {
          codeField.onBlur(event);
          if (mode !== 'create') return;
          const code = event.target.value.trim();
          if (!code) {
            setMatchedClient(null);
            return;
          }
          const found = await lookupMutation
            .mutateAsync(code)
            .catch(() => null);
          if (found) {
            setMatchedClient(found);
            form.reset({
              clientCode: found.clientCode,
              companyName: found.companyName,
              locationName: found.location?.name ?? '',
              draftName: found.draftName ?? '',
              authorityName: found.authorityName ?? '',
              address: found.address ?? '',
              rcNumber: found.rcNumber ?? '',
              contactNumber: found.contactNumber ?? '',
              recipientName: found.recipientName ?? '',
              fundCode: found.fundCode ?? '',
              phyCode: found.phyCode ?? '',
              status: found.status ?? '',
              signatoryName: found.signatoryName ?? '',
              includeEmployeesOnForm5: found.includeEmployeesOnForm5 !== false,
            });
          } else {
            setMatchedClient(null);
          }
        };

        return (
          <>
            {isMatchCurrent ? (
              <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-100 px-3 py-2 text-xs text-amber-950 dark:bg-amber-950 dark:text-amber-100">
                Loaded existing client <strong>{matchedClient!.clientCode}</strong> —{' '}
                {matchedClient!.companyName}. Saving will update this client.
              </div>
            ) : null}

            <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
              <Input
                label="Client code"
                hint={
                  mode === 'create'
                    ? 'Type an existing code to load and edit that client.'
                    : 'Stable key from MasterSheet, e.g. C0001'
                }
                {...codeField}
                onBlur={handleCodeBlur}
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
              <Input
                label="Authority name"
                {...form.register('authorityName')}
                error={form.formState.errors.authorityName?.message}
              />

              {locationOptions.length > 0 ? (
                <div className="sm:col-span-2">
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
                </div>
              ) : null}
              <Input
                label="Location"
                hint="Typing a new name creates the location."
                {...form.register('locationName')}
                error={form.formState.errors.locationName?.message}
              />
              <Input
                label="Reg No. (RC)"
                {...form.register('rcNumber')}
                error={form.formState.errors.rcNumber?.message}
              />

              <Input
                label="Contact number"
                {...form.register('contactNumber')}
                error={form.formState.errors.contactNumber?.message}
              />
              <Input
                label="Contact name"
                hint="Recipient name used on Form 5 WhatsApp messages."
                {...form.register('recipientName')}
                error={form.formState.errors.recipientName?.message}
              />

              <Input
                label="Signatory (this client)"
                hint="Leave blank to use the consultancy default."
                {...form.register('signatoryName')}
                error={form.formState.errors.signatoryName?.message}
              />
              <div className="flex items-center">
                <Switch
                  label="Include salary employees on Form 5"
                  hint="On by default. Turn off to generate Form 5 without the employee list for this client."
                  checked={form.watch('includeEmployeesOnForm5') !== false}
                  onChange={(event) =>
                    form.setValue(
                      'includeEmployeesOnForm5',
                      event.target.checked,
                      { shouldDirty: true },
                    )
                  }
                />
              </div>

              <div className="sm:col-span-2">
                <Textarea
                  label="Employer address"
                  hint="Filled from Client - Master.xlsx (Address.1). Used on Form 5."
                  rows={2}
                  {...form.register('address')}
                  error={form.formState.errors.address?.message}
                />
              </div>
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
                {mode === 'edit' || isMatchCurrent ? 'Save' : 'Create client'}
              </Button>
            </div>
          </>
        );
      }}
    </FormWrapper>
  );
}
