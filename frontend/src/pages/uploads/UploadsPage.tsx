import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Upload } from 'lucide-react';

import { uploadsApi } from '@/api/uploads.api';
import { Button } from '@/components/buttons';
import { Badge } from '@/components/common/Badge';
import { ImportProgressPanel } from '@/components/common/ImportProgressPanel';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/common/Card';
import { PermissionGate } from '@/components/common/PermissionGate';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { Modal } from '@/components/dialogs/Modal';
import { FileUpload } from '@/components/inputs/FileUpload';
import { Input } from '@/components/inputs/Input';
import { Select } from '@/components/inputs/Select';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  DataTable,
  type DataTableColumn,
} from '@/components/tables';
import { PERMISSIONS } from '@/constants/permissions';
import { useClientOptionsQuery } from '@/hooks/useClients';
import {
  useCreateUploadMutation,
  useDownloadImportErrorsMutation,
  useImportUploadMutation,
  usePreviewUploadMutation,
  usePurgeClientMasterMutation,
  usePurgeMasterMutation,
  usePurgeSalaryMutation,
  useUploadRowsQuery,
  useUploadsQuery,
} from '@/hooks/useUploads';
import { cn } from '@/lib/utils';
import { PATHS } from '@/routes/paths';
import type {
  ImportProgressEvent,
  ImportReport,
  UploadDetail,
  UploadField,
  UploadKind,
  UploadListItem,
  UploadMapping,
  UploadPreviewRow,
  UploadStatus,
} from '@/types/uploads.types';

const EXCEL_ACCEPT =
  '.xlsx,.xlsm,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const PURGE_MASTER_TEXT = 'CLEAR MASTER';
const PURGE_SALARY_TEXT = 'CLEAR SALARY';
const PURGE_CLIENT_MASTER_TEXT = 'CLEAR ADDRESSES';
const ROWS_PAGE_SIZE = 50;
const RECENT_VISIBLE = 5;
const RECENT_FETCH_LIMIT = 50;

const KIND_OPTIONS: {
  label: string;
  value: UploadKind;
  hint: string;
}[] = [
  {
    label: 'Clients / MasterSheet',
    value: 'master',
    hint: 'Typical file: MasterSheet All Clients.xlsx. Clients + month tracker (code, company, location, RC, challan).',
  },
  {
    label: 'Salary employees',
    value: 'salary',
    hint: 'Typical file: SalarySheet All Employees.xlsx. Match by PHY_CODE or Client code (C0001).',
  },
  {
    label: 'Client addresses / RC',
    value: 'clientMaster',
    hint: 'Typical file: Client - Master.xlsx. Matches clientno (C0001) and saves Address + RC.',
  },
];

const kindLabel = (kind: UploadKind) => {
  if (kind === 'salary') return 'Salary';
  if (kind === 'clientMaster') return 'Addresses';
  return 'Master';
};

const statusVariant = (
  status: UploadStatus,
): 'secondary' | 'warning' | 'success' | 'destructive' => {
  if (status === 'imported') return 'success';
  if (status === 'failed') return 'destructive';
  if (status === 'previewed') return 'warning';
  return 'secondary';
};

const mappingComplete = (
  fields: UploadField[],
  mapping: UploadMapping,
  kind: UploadKind,
) => {
  const requiredOk = fields
    .filter((field) => field.required)
    .every((field) => typeof mapping[field.key] === 'number');
  if (kind === 'salary') {
    return (
      requiredOk &&
      (typeof mapping.phyCode === 'number' ||
        typeof mapping.clientCode === 'number')
    );
  }
  return requiredOk;
};

const importHasErrors = (report?: ImportReport | null) =>
  Boolean(
    report &&
      ((report.skipped?.length ?? 0) > 0 ||
        (report.unmatched?.length ?? 0) > 0),
  );

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
};

/**
 * Sheet ingest: upload → full list → save to database (upsert).
 * Re-upload updates matching rows by client code; rows missing from the file are kept.
 */
export function UploadsPage() {
  const [kind, setKind] = useState<UploadKind>('master');
  const [file, setFile] = useState<File | null>(null);
  const [current, setCurrent] = useState<UploadDetail | null>(null);
  const [mapping, setMapping] = useState<UploadMapping>({});
  const [report, setReport] = useState<ImportReport | null>(null);
  const [period, setPeriod] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [rowsPage, setRowsPage] = useState(1);
  const [purgeMasterOpen, setPurgeMasterOpen] = useState(false);
  const [purgeSalaryOpen, setPurgeSalaryOpen] = useState(false);
  const [purgeClientMasterOpen, setPurgeClientMasterOpen] = useState(false);
  const [purgeSalaryPeriod, setPurgeSalaryPeriod] = useState('');
  const [purgeSalaryCompany, setPurgeSalaryCompany] = useState('');
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [importProgress, setImportProgress] =
    useState<ImportProgressEvent | null>(null);

  const listQuery = useUploadsQuery({ page: 1, limit: RECENT_FETCH_LIMIT });
  const companiesQuery = useClientOptionsQuery({
    enabled: kind === 'salary' || current?.kind === 'salary',
  });
  const createMutation = useCreateUploadMutation();
  const previewMutation = usePreviewUploadMutation();
  const importMutation = useImportUploadMutation();
  const downloadErrorsMutation = useDownloadImportErrorsMutation();
  const purgeMasterMutation = usePurgeMasterMutation();
  const purgeSalaryMutation = usePurgeSalaryMutation();
  const purgeClientMasterMutation = usePurgeClientMasterMutation();

  const activeKind = current?.kind ?? kind;
  const isSalary = activeKind === 'salary';
  const isClientMaster = activeKind === 'clientMaster';
  const selectedKind = KIND_OPTIONS.find((option) => option.value === kind);

  const applyUpload = (
    upload: UploadDetail,
    nextReport?: ImportReport | null,
  ) => {
    setCurrent(upload);
    setKind(upload.kind);
    setMapping(upload.parse.mapping);
    setReport(nextReport ?? upload.report);
    setPeriod(upload.period || upload.parse.suggestedPeriod || '');
    setCompanyName(upload.companyName || '');
    setRowsPage(1);
  };

  const rowsQuery = useUploadRowsQuery(
    current?.id ?? null,
    {
      sheetName: current?.parse.selectedSheet ?? undefined,
      mapping,
      page: rowsPage,
      limit: ROWS_PAGE_SIZE,
      companyName: isSalary ? companyName || null : undefined,
    },
    { enabled: Boolean(current?.id) },
  );

  const headerOptions = useMemo(() => {
    const headers = current?.parse.headers ?? [];
    return headers.map((header) => ({
      label: `${header.label} (col ${header.index + 1})`,
      value: String(header.index),
    }));
  }, [current]);

  const canSave =
    Boolean(current) &&
    mappingComplete(current?.parse.fields ?? [], mapping, activeKind) &&
    (current?.kind !== 'salary' || Boolean(period));

  const previewColumns: DataTableColumn<UploadPreviewRow>[] = useMemo(() => {
    const fields = (rowsQuery.data?.fields ?? current?.parse.fields ?? []).filter(
      (field) =>
        field.key === 'matchedClientCode' ||
        field.key === 'matchedCompanyName' ||
        typeof mapping[field.key] === 'number',
    );
    return [
      {
        id: 'excelRow',
        header: 'Row',
        cell: (row) => row.excelRow,
      },
      ...fields.map((field) => ({
        id: field.key,
        header: field.label,
        cell: (row: UploadPreviewRow) => row.cells[field.key] || '—',
      })),
    ];
  }, [current, mapping, rowsQuery.data?.fields]);

  const historyColumns: DataTableColumn<UploadListItem>[] = useMemo(
    () => [
      {
        id: 'originalName',
        header: 'File',
        cell: (row) => <span className="font-medium">{row.originalName}</span>,
      },
      {
        id: 'kind',
        header: 'Kind',
        cell: (row) => <Badge variant="outline">{kindLabel(row.kind)}</Badge>,
      },
      {
        id: 'status',
        header: 'Status',
        cell: (row) => (
          <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
        ),
      },
      {
        id: 'selectedSheet',
        header: 'Sheet',
        accessorKey: 'selectedSheet',
      },
      {
        id: 'size',
        header: 'Size',
        cell: (row) => formatSize(row.size),
      },
      {
        id: 'createdAt',
        header: 'Uploaded',
        cell: (row) => new Date(row.createdAt).toLocaleString(),
      },
      {
        id: 'actions',
        header: '',
        className: 'text-right',
        cell: (row) => (
          <div className="flex justify-end gap-2">
            {importHasErrors(row.report) ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={
                  downloadErrorsMutation.isPending &&
                  downloadErrorsMutation.variables === row.id
                }
                onClick={() => downloadErrorsMutation.mutate(row.id)}
              >
                Errors
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                const upload = await uploadsApi.getById(row.id);
                applyUpload(upload);
              }}
            >
              Open
            </Button>
          </div>
        ),
      },
    ],
    [downloadErrorsMutation],
  );

  const companyOptions = (companiesQuery.data?.companies ?? []).map(
    (company) => ({
      label: `${company.name} (${company.clientCount})`,
      value: company.name,
    }),
  );

  const rowCount =
    rowsQuery.data?.pagination.total ?? current?.parse.rowCount ?? 0;

  const allRecentUploads = listQuery.data?.uploads ?? [];
  const visibleRecentUploads = historyExpanded
    ? allRecentUploads
    : allRecentUploads.slice(0, RECENT_VISIBLE);
  const hiddenRecentCount = Math.max(
    0,
    allRecentUploads.length - RECENT_VISIBLE,
  );

  const saveLabel = isSalary
    ? 'Save employees to database'
    : isClientMaster
      ? 'Save addresses to database'
      : 'Save clients to database';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Uploads"
        description="Upload MasterSheet, salary, and client-address workbooks. Matching rows update by client code (C0001)."
        breadcrumbs={[
          { label: 'Home', href: PATHS.home },
          { label: 'Uploads' },
        ]}
      />

      <PermissionGate permission={PERMISSIONS.UPLOADS_CREATE}>
        <Card>
          <CardHeader>
            <CardTitle>Upload workbook</CardTitle>
            <CardDescription>
              Choose the sheet type, pick an Excel file, then upload to preview
              and map columns before saving.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-medium">Upload type</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {KIND_OPTIONS.map((option) => {
                  const selected = kind === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setKind(option.value);
                        setFile(null);
                      }}
                      className={cn(
                        'rounded-lg border px-3 py-3 text-left transition-colors',
                        selected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                          : 'border-border bg-background hover:bg-muted/40',
                      )}
                    >
                      <span className="block text-sm font-medium">
                        {option.label}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {option.value === 'master'
                          ? 'Clients + filings'
                          : option.value === 'salary'
                            ? 'Employee rows'
                            : 'Address + RC'}
                      </span>
                    </button>
                  );
                })}
              </div>
              {selectedKind ? (
                <p className="text-sm text-muted-foreground">
                  {selectedKind.hint}
                </p>
              ) : null}
            </div>

            <FileUpload
              label="Workbook"
              accept={EXCEL_ACCEPT}
              value={file}
              onChange={(files) => setFile(files?.[0] ?? null)}
              hint={
                kind === 'salary'
                  ? 'Headers: EMPNO, PHY_CODE or Client, PT GROSS. Prefer the OutPut sheet.'
                  : kind === 'clientMaster'
                    ? 'Headers: clientno, Address.1, RC Professional Tax Number.'
                    : 'Headers: Client, Name of Company, Location, Reg No.'
              }
            />

            <Button
              type="button"
              className="w-full"
              size="lg"
              leftIcon={<Upload className="size-4" />}
              disabled={!file || createMutation.isPending}
              onClick={async () => {
                if (!file) return;
                const upload = await createMutation.mutateAsync({
                  file,
                  kind,
                });
                applyUpload(upload, null);
              }}
            >
              {createMutation.isPending
                ? 'Parsing workbook…'
                : 'Upload and show data'}
            </Button>
          </CardContent>
        </Card>
      </PermissionGate>

      {current ? (
        <Card>
          <CardHeader>
            <CardTitle>{current.originalName}</CardTitle>
            <CardDescription>
              {rowCount} data row{rowCount === 1 ? '' : 's'} · header row{' '}
              {current.parse.headerRow ?? '—'} on sheet{' '}
              {current.parse.selectedSheet ?? '—'}. Re-upload updates matching
              records by client code.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {current.parse.warnings.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-sm text-amber-700 dark:text-amber-300">
                {current.parse.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Select
                label="Sheet"
                value={current.parse.selectedSheet ?? ''}
                options={(current.parse.sheetNames || []).map((name) => ({
                  label: name,
                  value: name,
                }))}
                onChange={async (event) => {
                  const sheetName = event.target.value;
                  const upload = await previewMutation.mutateAsync({
                    id: current.id,
                    sheetName,
                  });
                  applyUpload(upload, report);
                }}
              />
              {isSalary ? (
                <>
                  <Input
                    label="Period *"
                    type="month"
                    value={period}
                    onChange={(event) => setPeriod(event.target.value)}
                    hint="Required. Guessed from the filename when possible."
                  />
                  <Select
                    label="Company"
                    value={companyName}
                    options={companyOptions}
                    placeholder="All clients (PHY / client code)"
                    onChange={(event) => setCompanyName(event.target.value)}
                    hint="Optional. Limits PHY_CODE matching to this legal company."
                  />
                </>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {current.parse.fields.map((field) => (
                <Select
                  key={field.key}
                  label={
                    field.required
                      ? `${field.label} *`
                      : field.key === 'phyCode' || field.key === 'clientCode'
                        ? `${field.label} (PHY or Client)`
                        : field.label
                  }
                  value={
                    typeof mapping[field.key] === 'number'
                      ? String(mapping[field.key])
                      : ''
                  }
                  options={headerOptions}
                  placeholder="Not mapped"
                  required={field.required}
                  onChange={(event) => {
                    const raw = event.target.value;
                    setMapping((prev) => ({
                      ...prev,
                      [field.key]: raw === '' ? null : Number(raw),
                    }));
                    setRowsPage(1);
                  }}
                />
              ))}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-medium">
                Sheet data ({rowCount})
              </h3>
              <DataTable
                columns={previewColumns}
                data={rowsQuery.data?.rows ?? []}
                rowKey={(row) => String(row.excelRow)}
                loading={rowsQuery.isFetching}
                pagination={rowsQuery.data?.pagination}
                onPageChange={setRowsPage}
                emptyTitle="No data rows"
                emptyDescription="Pick a sheet that has the expected headers and data."
              />
            </div>

            <PermissionGate permission={PERMISSIONS.UPLOADS_CREATE}>
              {importProgress ? (
                <ImportProgressPanel progress={importProgress} />
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  disabled={!canSave || importMutation.isPending}
                  onClick={async () => {
                    setImportProgress({
                      phase: 'import',
                      processed: 0,
                      total: rowCount,
                      inserted: 0,
                      updated: 0,
                      unchanged: 0,
                      skipped: 0,
                      unmatched: 0,
                    });
                    try {
                      const result = await importMutation.mutateAsync({
                        id: current.id,
                        payload: {
                          sheetName:
                            current.parse.selectedSheet ?? undefined,
                          mapping,
                          period: isSalary ? period || undefined : undefined,
                          companyName: isSalary
                            ? companyName || null
                            : undefined,
                        },
                        onProgress: setImportProgress,
                      });
                      applyUpload(result.upload, result.report);
                    } finally {
                      setImportProgress(null);
                    }
                  }}
                >
                  {importMutation.isPending ? 'Saving…' : saveLabel}
                </Button>
              </div>
            </PermissionGate>
          </CardContent>
        </Card>
      ) : null}

      {report ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div className="space-y-1.5">
              <CardTitle>Save report</CardTitle>
              <CardDescription>
                {isSalary
                  ? 'Employees upserted by EMPNO + PHY_CODE + period, matched to clients by Client code or PHY_CODE. Unmatched rows are stored, not dropped.'
                  : isClientMaster
                    ? 'Addresses and RC numbers upserted by clientno (C0001). Re-upload updates existing clients.'
                    : 'Clients upserted by client code. Monthly filings upserted by client code + period.'}
              </CardDescription>
            </div>
            {current && importHasErrors(report) ? (
              <Button
                type="button"
                variant="outline"
                loading={downloadErrorsMutation.isPending}
                onClick={() => downloadErrorsMutation.mutate(current.id)}
              >
                Download errors
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ReportStat
                label={
                  isSalary
                    ? 'Employees inserted'
                    : isClientMaster
                      ? 'Clients inserted'
                      : 'Clients inserted'
                }
                value={report.inserted}
              />
              <ReportStat
                label={
                  isSalary ? 'Employees updated' : 'Clients updated'
                }
                value={report.updated}
              />
              <ReportStat
                label={
                  isSalary ? 'Employees unchanged' : 'Clients unchanged'
                }
                value={report.unchanged}
              />
              <ReportStat
                label="Rows skipped"
                value={report.skipped.length}
              />
              {report.filings ? (
                <>
                  <ReportStat
                    label="Filings inserted"
                    value={report.filings.inserted}
                  />
                  <ReportStat
                    label="Filings updated"
                    value={report.filings.updated}
                  />
                  <ReportStat
                    label="Filings unchanged"
                    value={report.filings.unchanged}
                  />
                </>
              ) : null}
              <ReportStat
                label="Unmatched"
                value={report.unmatched.length}
              />
            </div>
            {report.skipped.length > 0 ? (
              <DataTable
                columns={[
                  { id: 'row', header: 'Excel row', accessorKey: 'row' },
                  { id: 'reason', header: 'Reason', accessorKey: 'reason' },
                ]}
                data={report.skipped}
                rowKey={(row) => `${row.row}-${row.reason}`}
                emptyTitle="No skipped rows"
              />
            ) : null}
            {report.unmatched.length > 0 ? (
              <DataTable
                columns={[
                  { id: 'row', header: 'Excel row', accessorKey: 'row' },
                  {
                    id: 'employeeNo',
                    header: 'EMPNO',
                    accessorKey: 'employeeNo',
                  },
                  {
                    id: 'phyCode',
                    header: 'PHY_CODE',
                    accessorKey: 'phyCode',
                  },
                  {
                    id: 'clientCode',
                    header: 'Client',
                    accessorKey: 'clientCode',
                  },
                  { id: 'reason', header: 'Reason', accessorKey: 'reason' },
                ]}
                data={report.unmatched}
                rowKey={(row) =>
                  `${row.row}-${row.employeeNo ?? ''}-${row.phyCode ?? ''}`
                }
                emptyTitle="No unmatched rows"
              />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <PermissionGate permission={PERMISSIONS.UPLOADS_PURGE}>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Clear sheet data</CardTitle>
            <CardDescription>
              Use this before replacing a full month. Clearing master removes
              clients and filings. Clearing salary removes employee rows for the
              selected month. Clearing addresses removes Address + RC only.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-3 rounded-lg border border-border p-4">
              <div>
                <h3 className="font-medium">Clear master data</h3>
                <p className="text-sm text-muted-foreground">
                  Soft-delete all clients and monthly filings. Employee rows
                  are kept.
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={() => setPurgeMasterOpen(true)}
              >
                Clear master data
              </Button>
            </div>
            <div className="space-y-3 rounded-lg border border-border p-4">
              <div>
                <h3 className="font-medium">Clear salary data</h3>
                <p className="text-sm text-muted-foreground">
                  Soft-delete employee rows for one month. Optionally limit to
                  one company or fund.
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={() => {
                  setPurgeSalaryPeriod(period || '');
                  setPurgeSalaryCompany(companyName || '');
                  setPurgeSalaryOpen(true);
                }}
              >
                Clear salary data
              </Button>
            </div>
            <div className="space-y-3 rounded-lg border border-border p-4">
              <div>
                <h3 className="font-medium">Clear address / RC data</h3>
                <p className="text-sm text-muted-foreground">
                  Clear Address and RC Professional Tax Number on clients.
                  Clients and filings stay.
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={() => setPurgeClientMasterOpen(true)}
              >
                Clear address data
              </Button>
            </div>
          </CardContent>
        </Card>
      </PermissionGate>

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Recent uploads</h2>
          {allRecentUploads.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Showing {visibleRecentUploads.length} of {allRecentUploads.length}
            </p>
          ) : null}
        </div>
        <DataTable
          columns={historyColumns}
          data={visibleRecentUploads}
          rowKey={(row) => row.id}
          loading={listQuery.isLoading}
          emptyTitle="No uploads yet"
          emptyDescription="Upload MasterSheet All Clients.xlsx, SalarySheet All Employees.xlsx, or Client - Master.xlsx."
        />
        {hiddenRecentCount > 0 || historyExpanded ? (
          <div className="mt-3 flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={
                historyExpanded ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )
              }
              onClick={() => setHistoryExpanded((prev) => !prev)}
            >
              {historyExpanded
                ? 'Show fewer'
                : `Show ${hiddenRecentCount} more`}
            </Button>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={purgeMasterOpen}
        onOpenChange={setPurgeMasterOpen}
        title="Clear all master data?"
        message="This removes every imported client and filing. Employee rows stay in the database."
        confirmLabel="Clear master data"
        danger
        loading={purgeMasterMutation.isPending}
        onConfirm={async () => {
          await purgeMasterMutation.mutateAsync(PURGE_MASTER_TEXT);
        }}
      />

      <ConfirmDialog
        open={purgeClientMasterOpen}
        onOpenChange={setPurgeClientMasterOpen}
        title="Clear address / RC data?"
        message="This clears Address and RC Professional Tax Number on all clients. Clients, filings, and employees stay."
        confirmLabel="Clear address data"
        danger
        loading={purgeClientMasterMutation.isPending}
        onConfirm={async () => {
          await purgeClientMasterMutation.mutateAsync(PURGE_CLIENT_MASTER_TEXT);
        }}
      />

      <Modal
        open={purgeSalaryOpen}
        onOpenChange={setPurgeSalaryOpen}
        title="Clear salary data?"
        description="This removes employee rows for the selected month. Clients and filings are kept."
        closeOnOverlayClick={!purgeSalaryMutation.isPending}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={purgeSalaryMutation.isPending}
              onClick={() => setPurgeSalaryOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={purgeSalaryMutation.isPending}
              disabled={!purgeSalaryPeriod}
              onClick={async () => {
                await purgeSalaryMutation.mutateAsync({
                  confirmation: PURGE_SALARY_TEXT,
                  period: purgeSalaryPeriod,
                  companyName: purgeSalaryCompany || null,
                });
                setPurgeSalaryOpen(false);
              }}
            >
              Clear salary data
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Period (YYYY-MM)"
            type="month"
            value={purgeSalaryPeriod}
            onChange={(event) => setPurgeSalaryPeriod(event.target.value)}
            placeholder="2026-07"
          />
          <Input
            label="Company / fund (optional)"
            value={purgeSalaryCompany}
            onChange={(event) => setPurgeSalaryCompany(event.target.value)}
            placeholder="SMFG India Credit Co. Ltd."
          />
        </div>
      </Modal>
    </div>
  );
}

function ReportStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
