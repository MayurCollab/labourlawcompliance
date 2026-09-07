import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { templatesApi } from '@/api/templates.api';
import { Button } from '@/components/buttons';
import { Badge } from '@/components/common/Badge';
import { PermissionGate } from '@/components/common/PermissionGate';
import { Drawer } from '@/components/dialogs/Drawer';
import { Input } from '@/components/inputs/Input';
import { Select } from '@/components/inputs/Select';
import { Switch } from '@/components/inputs/Switch';
import { Textarea } from '@/components/inputs/Textarea';
import {
  DataTable,
  type DataTableColumn,
} from '@/components/tables';
import { PERMISSIONS } from '@/constants/permissions';
import {
  useComputeFilingMutation,
  useDownloadFilingMutation,
  useFilingQuery,
  useGenerateFilingMutation,
  useUpdateFilingOverridesMutation,
  filingsQueryKeys,
} from '@/hooks/useFilings';
import {
  useAssignTemplateMutation,
  useBundledTemplatesQuery,
  useResolveTemplateQuery,
} from '@/hooks/useTemplates';
import { useUpdateClientMutation } from '@/hooks/useClients';
import { useSettingsQuery } from '@/hooks/useMasters';
import type {
  EmployeePreviewRow,
  Filing,
  FilingSlabRow,
} from '@/types/filing.types';

const formatAmount = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : value.toLocaleString('en-IN');

const formatRange = (row: FilingSlabRow) => {
  const from = formatAmount(row.salaryFrom);
  if (row.salaryTo === null) return `${from} and above`;
  return `${from} – ${formatAmount(row.salaryTo)}`;
};

const toDateInput = (value: string | null | undefined) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

type OverrideForm = {
  filingDate: string;
  additionalTaxPayable: string;
};

const emptyOverrideForm = (): OverrideForm => ({
  filingDate: '',
  additionalTaxPayable: '',
});

type FilingComputeDrawerProps = {
  open: boolean;
  filing: Filing | null;
  onOpenChange: (open: boolean) => void;
};

/**
 * Review & generate: template, manual fields, employee preview, PT slabs, PDF.
 */
export function FilingComputeDrawer({
  open,
  filing,
  onOpenChange,
}: FilingComputeDrawerProps) {
  const filingId = open && filing ? filing.id : null;
  const clientId = filing?.client?.id ?? '';
  const queryClient = useQueryClient();

  const detailQuery = useFilingQuery(filingId);
  const settingsQuery = useSettingsQuery({ enabled: open });
  const bundledQuery = useBundledTemplatesQuery({ enabled: open });
  const resolvedQuery = useResolveTemplateQuery(clientId, { enabled: open && Boolean(clientId) });

  const computeMutation = useComputeFilingMutation();
  const generateMutation = useGenerateFilingMutation();
  const downloadMutation = useDownloadFilingMutation();
  const overridesMutation = useUpdateFilingOverridesMutation();
  const assignMutation = useAssignTemplateMutation();
  const updateClientMutation = useUpdateClientMutation();

  const [overrideForm, setOverrideForm] = useState<OverrideForm>(emptyOverrideForm);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [showEmployees, setShowEmployees] = useState(true);
  const [includeEmployees, setIncludeEmployees] = useState(true);
  const [editingClientAddress, setEditingClientAddress] = useState(false);
  const [editingClientSignatory, setEditingClientSignatory] = useState(false);
  const [clientAddressDraft, setClientAddressDraft] = useState('');
  const [clientSignatoryDraft, setClientSignatoryDraft] = useState('');

  const current =
    overridesMutation.data?.id === filingId
      ? overridesMutation.data
      : generateMutation.data?.id === filingId
        ? generateMutation.data
        : computeMutation.data?.id === filingId
          ? computeMutation.data
          : detailQuery.data ?? filing;

  const computation = current?.computation;
  const generatedFile = current?.generatedFile;
  const employeePreview = current?.employeePreview;
  const locationName = filing?.client?.location?.name ?? '';

  const bundledTemplates = bundledQuery.data ?? [];
  const resolvedTemplateId = resolvedQuery.data?.template?.id ?? '';
  const activeTemplateId = selectedTemplateId || resolvedTemplateId;

  const templateOptions = useMemo(() => {
    const sorted = [...bundledTemplates].sort((left, right) => {
      const leftMatch = locationName
        ? left.locationNames.some(
            (name) => name.toLowerCase() === locationName.toLowerCase(),
          )
        : false;
      const rightMatch = locationName
        ? right.locationNames.some(
            (name) => name.toLowerCase() === locationName.toLowerCase(),
          )
        : false;
      if (leftMatch !== rightMatch) return leftMatch ? -1 : 1;
      if (left.isGlobalDefault !== right.isGlobalDefault) {
        return left.isGlobalDefault ? 1 : -1;
      }
      return left.name.localeCompare(right.name);
    });

    return sorted.map((template) => {
      const district =
        locationName &&
        template.locationNames.some(
          (name) => name.toLowerCase() === locationName.toLowerCase(),
        );
      return {
        label: district ? `${template.name} (district)` : template.name,
        value: template.id,
      };
    });
  }, [bundledTemplates, locationName]);

  const selectedTemplate = bundledTemplates.find(
    (template) => template.id === activeTemplateId,
  );
  const templateChanged =
    Boolean(activeTemplateId) &&
    Boolean(resolvedTemplateId) &&
    activeTemplateId !== resolvedTemplateId;

  useEffect(() => {
    if (!open) {
      setOverrideForm(emptyOverrideForm());
      setSelectedTemplateId('');
      setShowEmployees(true);
      setIncludeEmployees(true);
      setEditingClientAddress(false);
      setEditingClientSignatory(false);
      setClientAddressDraft('');
      setClientSignatoryDraft('');
    }
  }, [open]);

  const storedClientAddress = current?.client?.address?.trim() ?? '';
  const storedClientSignatory = current?.client?.signatoryName?.trim() ?? '';
  const defaultSignatory = settingsQuery.data?.signatoryName?.trim() ?? '';
  const effectiveSignatory = storedClientSignatory || defaultSignatory;

  useEffect(() => {
    if (!editingClientAddress) {
      setClientAddressDraft(storedClientAddress);
    }
  }, [storedClientAddress, editingClientAddress, current?.client?.id]);

  useEffect(() => {
    if (!editingClientSignatory) {
      setClientSignatoryDraft(storedClientSignatory);
    }
  }, [storedClientSignatory, editingClientSignatory, current?.client?.id]);

  useEffect(() => {
    if (!current?.generateOverrides) {
      setOverrideForm(emptyOverrideForm());
      return;
    }
    const overrides = current.generateOverrides;
    setOverrideForm({
      filingDate: toDateInput(overrides.filingDate),
      additionalTaxPayable:
        overrides.additionalTaxPayable != null
          ? String(overrides.additionalTaxPayable)
          : '',
    });
  }, [current?.id, current?.generateOverrides]);

  useEffect(() => {
    if (resolvedTemplateId) {
      setSelectedTemplateId(resolvedTemplateId);
    }
  }, [resolvedTemplateId, filing?.id]);

  useEffect(() => {
    const next = current?.client?.includeEmployeesOnForm5;
    if (typeof next === 'boolean') {
      setIncludeEmployees(next);
    } else if (open) {
      setIncludeEmployees(true);
    }
  }, [current?.client?.includeEmployeesOnForm5, current?.id, open]);

  const slabColumns: DataTableColumn<FilingSlabRow>[] = [
    {
      id: 'label',
      header: 'Slab',
      cell: (row) => row.label || formatRange(row),
    },
    {
      id: 'employeeCount',
      header: 'Employees',
      cell: (row) => row.employeeCount,
    },
    {
      id: 'exemptCount',
      header: 'Exempt',
      cell: (row) => row.exemptCount,
    },
    {
      id: 'taxableCount',
      header: 'Taxable',
      cell: (row) => row.taxableCount,
    },
    {
      id: 'rate',
      header: 'Rate',
      cell: (row) => formatAmount(row.rate),
    },
    {
      id: 'taxAmount',
      header: 'Tax',
      cell: (row) => formatAmount(row.taxAmount),
    },
  ];

  const employeeColumns: DataTableColumn<EmployeePreviewRow>[] = [
    { id: 'srNo', header: '#', cell: (row) => row.srNo },
    { id: 'employeeNo', header: 'EMPNO', accessorKey: 'employeeNo' },
    { id: 'employeeName', header: 'Name', accessorKey: 'employeeName' },
    { id: 'locationName', header: 'Location', accessorKey: 'locationName' },
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
  ];

  const busy =
    detailQuery.isFetching ||
    computeMutation.isPending ||
    generateMutation.isPending ||
    downloadMutation.isPending ||
    overridesMutation.isPending ||
    assignMutation.isPending ||
    updateClientMutation.isPending;

  const saveOverrides = async () => {
    if (!filing) return;
    const additionalRaw = overrideForm.additionalTaxPayable.trim();
    await overridesMutation.mutateAsync({
      id: filing.id,
      payload: {
        filingDate: overrideForm.filingDate || null,
        additionalTaxPayable:
          additionalRaw === '' ? null : Number(additionalRaw),
      },
    });
  };

  const refreshFilingAfterClientSave = async () => {
    if (!filingId) return;
    await queryClient.invalidateQueries({
      queryKey: filingsQueryKeys.detail(filingId),
    });
  };

  const saveClientAddress = async () => {
    if (!filing?.client?.id) return;
    await updateClientMutation.mutateAsync({
      id: filing.client.id,
      payload: { address: clientAddressDraft.trim() || null },
    });
    setEditingClientAddress(false);
    await refreshFilingAfterClientSave();
  };

  const saveClientSignatory = async () => {
    if (!filing?.client?.id) return;
    await updateClientMutation.mutateAsync({
      id: filing.client.id,
      payload: { signatoryName: clientSignatoryDraft.trim() || null },
    });
    setEditingClientSignatory(false);
    await refreshFilingAfterClientSave();
  };

  const saveTemplateForClient = async () => {
    if (!filing?.client?.id || !activeTemplateId) return;
    await assignMutation.mutateAsync({
      id: activeTemplateId,
      payload: { scope: 'client', clientId: filing.client.id },
    });
  };

  const saveEmployeePreference = async () => {
    if (!filing?.client?.id) return;
    const stored = current?.client?.includeEmployeesOnForm5 !== false;
    if (stored === includeEmployees) return;
    await updateClientMutation.mutateAsync({
      id: filing.client.id,
      payload: { includeEmployeesOnForm5: includeEmployees },
    });
  };

  const previewSelectedTemplate = async () => {
    if (!selectedTemplate?.code) return;
    const html = await templatesApi.fetchBundledPreviewHtml(selectedTemplate.code);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      className="max-w-3xl"
      title={
        filing
          ? `${filing.clientCode} · ${filing.periodLabel || filing.period}`
          : 'Review & generate'
      }
      description={
        filing?.client
          ? `${filing.client.companyName}${
              filing.client.location?.name
                ? ` · ${filing.client.location.name}`
                : ''
            }`
          : 'Pick a template, set manual fields, then generate a print-ready PDF.'
      }
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <PermissionGate permission={PERMISSIONS.FILINGS_EDIT}>
            <Button
              variant="outline"
              loading={overridesMutation.isPending}
              disabled={!filing || busy}
              onClick={() => void saveOverrides()}
            >
              Save month fields
            </Button>
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.FILINGS_EDIT}>
            <Button
              loading={computeMutation.isPending}
              disabled={!filing || busy}
              onClick={() => {
                if (!filing) return;
                void computeMutation.mutateAsync(filing.id);
              }}
            >
              Compute PT
            </Button>
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.FILINGS_GENERATE}>
            <Button
              loading={generateMutation.isPending}
              disabled={!filing || !current?.hasTemplate || busy}
              onClick={async () => {
                if (!filing) return;
                if (templateChanged && activeTemplateId && filing.client?.id) {
                  await saveTemplateForClient();
                }
                await saveEmployeePreference();
                await saveOverrides();
                await generateMutation.mutateAsync({
                  id: filing.id,
                  computeIfNeeded: true,
                });
              }}
            >
              Generate PDF
            </Button>
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.FILINGS_VIEW}>
            <Button
              variant="outline"
              loading={downloadMutation.isPending}
              disabled={!filing || !generatedFile || busy}
              onClick={() => {
                if (!filing) return;
                void downloadMutation.mutateAsync({
                  id: filing.id,
                  filename: generatedFile?.filename,
                });
              }}
            >
              {generatedFile?.mimetype?.includes('pdf')
                ? 'Download PDF'
                : generatedFile?.mimetype?.includes('sheet') ||
                    generatedFile?.filename?.endsWith('.xlsx')
                  ? 'Download Excel'
                  : 'Download'}
            </Button>
          </PermissionGate>
        </div>
      }
    >
      {!filing ? null : detailQuery.isLoading && !current ? (
        <p className="text-sm text-muted-foreground">Loading filing…</p>
      ) : (
        <div className="space-y-6">
          {generatedFile ? (
            <p className="text-sm">
              {generatedFile.filename} · v{generatedFile.version}
              {generatedFile.templateName
                ? ` · ${generatedFile.templateName}`
                : ''}
              {generatedFile.source ? ` (${generatedFile.source})` : ''}.
              Re-generate replaces this file and keeps the previous version.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Form 5 uses fixed HTML templates and outputs a print-ready A4 PDF.
              Assign a district template or use the general layout.
            </p>
          )}

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Template</h3>
              {current?.templateSource ? (
                <Badge variant="outline">
                  {current.templateSource}: {current.templateName ?? '—'}
                </Badge>
              ) : (
                <Badge variant="warning">No template</Badge>
              )}
            </div>
            <Select
              label="Form 5 layout"
              value={activeTemplateId}
              options={templateOptions}
              placeholder={
                bundledQuery.isLoading ? 'Loading templates…' : 'Pick a template'
              }
              disabled={!bundledTemplates.length || bundledQuery.isLoading}
              onChange={(event) => setSelectedTemplateId(event.target.value)}
              hint={
                locationName
                  ? `District layouts matching ${locationName} are listed first.`
                  : 'General layout is used when no district template is assigned.'
              }
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!selectedTemplate?.code}
                onClick={() => void previewSelectedTemplate()}
              >
                Preview layout
              </Button>
              <PermissionGate permission={PERMISSIONS.TEMPLATES_EDIT}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={assignMutation.isPending}
                  disabled={
                    !filing.client?.id ||
                    !activeTemplateId ||
                    !templateChanged ||
                    busy
                  }
                  onClick={() => void saveTemplateForClient()}
                >
                  Save as client default
                </Button>
              </PermissionGate>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-medium">Client details (database)</h3>
            <p className="text-sm text-muted-foreground">
              Address comes from Client - Master.xlsx. Signatory is the person
              who signs Form 5 (declaration at the bottom). Edit here to update
              the client record for all future filings.
            </p>

            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-medium">Employer address</p>
                <PermissionGate permission={PERMISSIONS.CLIENTS_EDIT}>
                  {!editingClientAddress ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!filing.client?.id || busy}
                      onClick={() => {
                        setClientAddressDraft(storedClientAddress);
                        setEditingClientAddress(true);
                      }}
                    >
                      Edit address
                    </Button>
                  ) : null}
                </PermissionGate>
              </div>
              {editingClientAddress ? (
                <>
                  <Textarea
                    rows={3}
                    value={clientAddressDraft}
                    onChange={(event) =>
                      setClientAddressDraft(event.target.value)
                    }
                    hint="Saved on the client. Re-uploading Client - Master can update this too."
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      loading={updateClientMutation.isPending}
                      disabled={!filing.client?.id || busy}
                      onClick={() => void saveClientAddress()}
                    >
                      Save to client
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={updateClientMutation.isPending}
                      onClick={() => {
                        setClientAddressDraft(storedClientAddress);
                        setEditingClientAddress(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              ) : storedClientAddress ? (
                <p className="whitespace-pre-wrap text-sm">{storedClientAddress}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No address yet. Upload Client - Master.xlsx or click Edit
                  address.
                </p>
              )}
            </div>

            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-medium">Signatory name</p>
                <PermissionGate permission={PERMISSIONS.CLIENTS_EDIT}>
                  {!editingClientSignatory ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!filing.client?.id || busy}
                      onClick={() => {
                        setClientSignatoryDraft(storedClientSignatory);
                        setEditingClientSignatory(true);
                      }}
                    >
                      Edit signatory
                    </Button>
                  ) : null}
                </PermissionGate>
              </div>
              {editingClientSignatory ? (
                <>
                  <Input
                    value={clientSignatoryDraft}
                    onChange={(event) =>
                      setClientSignatoryDraft(event.target.value)
                    }
                    hint="Person who signs the Form 5 declaration. Leave blank to use the consultancy default."
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      loading={updateClientMutation.isPending}
                      disabled={!filing.client?.id || busy}
                      onClick={() => void saveClientSignatory()}
                    >
                      Save to client
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={updateClientMutation.isPending}
                      onClick={() => {
                        setClientSignatoryDraft(storedClientSignatory);
                        setEditingClientSignatory(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              ) : effectiveSignatory ? (
                <p className="text-sm">{effectiveSignatory}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Not set. Add a signatory for this client or set a default on
                  the Clients page.
                </p>
              )}
              {!editingClientSignatory && storedClientSignatory ? (
                <p className="text-xs text-muted-foreground">
                  Stored on this client.
                </p>
              ) : null}
              {!editingClientSignatory &&
              !storedClientSignatory &&
              defaultSignatory ? (
                <p className="text-xs text-muted-foreground">
                  Using consultancy default: {defaultSignatory}
                </p>
              ) : null}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-medium">This month only</h3>
            <p className="text-sm text-muted-foreground">
              Optional overrides for this filing period only.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Filing date"
                type="date"
                value={overrideForm.filingDate}
                onChange={(event) =>
                  setOverrideForm((prev) => ({
                    ...prev,
                    filingDate: event.target.value,
                  }))
                }
                hint="Leave blank to use today when generating."
              />
              <Input
                label="Additional tax payable (Total B)"
                type="number"
                min={0}
                step={1}
                value={overrideForm.additionalTaxPayable}
                onChange={(event) =>
                  setOverrideForm((prev) => ({
                    ...prev,
                    additionalTaxPayable: event.target.value,
                  }))
                }
                hint="Optional. Overrides computed Total B when set."
              />
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Employee list</h3>
              {employeePreview ? (
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    {employeePreview.totalEmployeeCount} total
                  </Badge>
                  <Badge variant="outline">
                    {employeePreview.taxableEmployeeCount} taxable
                  </Badge>
                  <Badge variant="outline">
                    {employeePreview.exemptEmployeeCount} exempt
                  </Badge>
                </div>
              ) : null}
            </div>
            <Switch
              label="Add salary employees on Form 5"
              hint="Saved for this client. On by default. Turn off to print Form 5 without the employee table."
              checked={includeEmployees}
              disabled={!filing?.client?.id || busy}
              onChange={(event) => {
                const next = event.target.checked;
                setIncludeEmployees(next);
                if (!filing?.client?.id) return;
                void updateClientMutation.mutateAsync({
                  id: filing.client.id,
                  payload: { includeEmployeesOnForm5: next },
                });
              }}
            />
            {!employeePreview || employeePreview.totalEmployeeCount === 0 ? (
              <p className="text-sm text-muted-foreground">
                No salary rows matched this client for{' '}
                {filing.periodLabel || filing.period}. Upload the salary sheet
                and match by PHY_CODE or client code (C0039).
              </p>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEmployees((value) => !value)}
                >
                  {showEmployees ? 'Hide employees' : 'Show employees'}
                </Button>
                {showEmployees ? (
                  <DataTable
                    columns={employeeColumns}
                    data={employeePreview.employees}
                    rowKey={(row) => `${row.employeeNo}-${row.srNo}`}
                    emptyTitle="No employees"
                  />
                ) : null}
              </>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-medium">PT computation</h3>
            {computation ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat
                    label="Employees"
                    value={String(
                      computation.totalEmployeeCount ?? computation.employeeCount,
                    )}
                  />
                  <Stat label="Total A" value={formatAmount(computation.totalA)} />
                  <Stat label="Total B" value={formatAmount(computation.totalB)} />
                  <Stat
                    label="Interest"
                    value={formatAmount(computation.interest)}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Total payable {formatAmount(computation.totalPayable)}. Total B
                  and interest are filled as NIL when zero.
                </p>
                {computation.unmatchedExcluded > 0 ? (
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {computation.unmatchedExcluded} unmatched salary row
                    {computation.unmatchedExcluded === 1 ? '' : 's'} excluded from
                    slab counts.
                  </p>
                ) : null}
                {computation.varianceCount > 0 ? (
                  <div className="space-y-2">
                    <Badge variant="warning">
                      {computation.varianceCount} P_TAX variance
                      {computation.varianceCount === 1 ? '' : 's'}
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      Sheet P_TAX differs from the rate computed from PT GROSS.
                    </p>
                  </div>
                ) : null}
                <DataTable
                  columns={slabColumns}
                  data={computation.slabs}
                  rowKey={(row) =>
                    `${row.salaryFrom}-${row.salaryTo ?? 'open'}-${row.rate}`
                  }
                  emptyTitle="No slabs"
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No salary computation yet. Generate can still fill Form 5 from the
                MasterSheet P.Tax Amount for {filing.periodLabel || filing.period}.
                Compute PT when salary rows are imported.
              </p>
            )}
          </section>
        </div>
      )}
    </Drawer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
