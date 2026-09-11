import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/buttons';
import { Badge } from '@/components/common/Badge';
import { PermissionGate } from '@/components/common/PermissionGate';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { FileUpload } from '@/components/inputs/FileUpload';
import { Input } from '@/components/inputs/Input';
import { SearchableSelect } from '@/components/inputs/SearchableSelect';
import { Select } from '@/components/inputs/Select';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  DataTable,
  DEFAULT_DATA_TABLE_PAGE_SIZE,
  resolveDataTableLimit,
  type DataTableColumn,
  type DataTablePageSizeOption,
} from '@/components/tables';
import { PERMISSIONS } from '@/constants/permissions';
import { useClientOptionsQuery, useLocationsQuery } from '@/hooks/useClients';
import {
  useAssignTemplateMutation,
  useCreateTemplateMutation,
  useDeleteTemplateMutation,
  useResolveTemplateQuery,
  useTemplatesQuery,
} from '@/hooks/useTemplates';
import { templatesApi } from '@/api/templates.api';
import { TemplateMapperDrawer } from '@/pages/templates/TemplateMapperDrawer';
import { PATHS } from '@/routes/paths';
import type {
  TemplateDetail,
  TemplateKind,
  TemplateListItem,
} from '@/types/template.types';

const TEMPLATE_ACCEPT =
  '.xlsx,.xlsm,.xls,.docx,.pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf';

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
};

const kindLabel = (kind: TemplateKind) => {
  if (kind === 'docx') return 'Word';
  if (kind === 'pdf') return 'PDF';
  if (kind === 'html') return 'HTML';
  return 'Excel';
};

/**
 * Form 5 layouts as data. Upload + map + assign. A new district file
 * works after mapping — the generator (Phase 6) does not hardcode layouts.
 */
export function TemplatesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [current, setCurrent] = useState<TemplateDetail | null>(null);
  const [mapperOpen, setMapperOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TemplateListItem | null>(
    null,
  );
  const [locationId, setLocationId] = useState('');
  const [clientId, setClientId] = useState('');
  const [resolveClientId, setResolveClientId] = useState('');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<DataTablePageSizeOption>(
    DEFAULT_DATA_TABLE_PAGE_SIZE,
  );
  const detailRef = useRef<HTMLDivElement>(null);

  const listQuery = useTemplatesQuery({
    page,
    limit: resolveDataTableLimit(pageSize),
  });
  const locationsQuery = useLocationsQuery();
  const clientsQuery = useClientOptionsQuery();
  const resolveQuery = useResolveTemplateQuery(resolveClientId);
  const createMutation = useCreateTemplateMutation();
  const assignMutation = useAssignTemplateMutation();
  const deleteMutation = useDeleteTemplateMutation();

  const loadPreview = async (template: TemplateDetail) => {
    if (template.kind !== 'html' || !template.code) {
      setPreviewHtml(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewHtml(null);
    try {
      const html = await templatesApi.fetchBundledPreviewHtml(template.code);
      setPreviewHtml(html);
    } catch {
      setPreviewError('Could not load HTML preview for this template.');
      setPreviewHtml(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const openTemplate = async (id: string) => {
    const template = await templatesApi.getById(id);
    setCurrent(template);
    await loadPreview(template);
    window.requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const openPreviewTab = () => {
    if (!previewHtml) return;
    const blob = new Blob([previewHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  useEffect(() => {
    if (!current) {
      setPreviewHtml(null);
      setPreviewError(null);
      setPreviewLoading(false);
    }
  }, [current]);

  const columns: DataTableColumn<TemplateListItem>[] = useMemo(
    () => [
      {
        id: 'name',
        header: 'Template',
        cell: (row) => <span className="font-medium">{row.name}</span>,
      },
      {
        id: 'kind',
        header: 'Kind',
        cell: (row) => (
          <Badge variant="outline">{kindLabel(row.kind)}</Badge>
        ),
      },
      {
        id: 'code',
        header: 'Code',
        accessorKey: 'code',
      },
      {
        id: 'assignment',
        header: 'Assigned',
        cell: (row) => (
          <span className="text-sm text-muted-foreground">
            {row.isGlobalDefault ? 'Global · ' : ''}
            {row.locationCount} loc · {row.clientCount} client
          </span>
        ),
      },
      {
        id: 'size',
        header: 'Size',
        cell: (row) => formatSize(row.size),
      },
      {
        id: 'actions',
        header: '',
        className: 'text-right',
        width: 200,
        minWidth: 200,
        cell: (row) => (
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                await openTemplate(row.id);
              }}
            >
              Open
            </Button>
            <PermissionGate permission={PERMISSIONS.TEMPLATES_DELETE}>
              <Button
                type="button"
                variant="outline"
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

  const locationOptions = (locationsQuery.data ?? []).map((location) => ({
    label: location.name,
    value: location.id,
  }));
  const clientOptions = (clientsQuery.data?.clients ?? []).map((client) => ({
    label: `${client.clientCode} · ${client.companyName}`,
    value: client.id,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates"
        description="Upload Form 5 Excel (filled to PDF on generate), Word, or PDF. Coloured/sample cells are auto-mapped; assign a location as the saved preference."
        breadcrumbs={[
          { label: 'Home', href: PATHS.home },
          { label: 'Templates' },
        ]}
      />

      <p className="max-w-3xl text-sm text-muted-foreground">
        Excel: yellow (or other colour) cells and sample values are auto-mapped,
        or use <code>{'{{placeholders}}'}</code> / cell binds like{' '}
        <code>F14</code>. Assign the template to a <strong>location</strong> so
        every client in that location uses it. Generate fills the Excel then
        converts to PDF (LibreOffice required on the server).
      </p>

      <PermissionGate permission={PERMISSIONS.TEMPLATES_CREATE}>
        <div className="space-y-3 rounded-lg border border-border p-4">
          <h2 className="text-sm font-medium">Upload template</h2>
          <Input
            label="Display name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Form 5 General"
          />
          <FileUpload
            label="File"
            accept={TEMPLATE_ACCEPT}
            value={file}
            onChange={(files) => setFile(files?.[0] ?? null)}
            hint=".xlsx / .xlsm / .xls / .docx / .pdf. Colour the changeable fields (or use {{employerName}} placeholders). Assign to a location as preference."
          />
          <Button
            type="button"
            disabled={!file || createMutation.isPending}
            onClick={async () => {
              if (!file) return;
              const template = await createMutation.mutateAsync({
                file,
                name: name || undefined,
              });
              setFile(null);
              setName('');
              setCurrent(template);
              setMapperOpen(true);
              await loadPreview(template);
            }}
          >
            {createMutation.isPending ? 'Uploading…' : 'Upload and map'}
          </Button>
        </div>
      </PermissionGate>

      {current ? (
        <div
          ref={detailRef}
          className="space-y-4 rounded-lg border border-border p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold">{current.name}</h2>
                <Badge variant="outline">{kindLabel(current.kind)}</Badge>
                {current.isBundled ? (
                  <Badge variant="secondary">Bundled</Badge>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {current.originalName} · {current.placeholders.length}{' '}
                placeholder{current.placeholders.length === 1 ? '' : 's'} ·{' '}
                {current.cells.length} field
                {current.cells.length === 1 ? '' : 's'}
                {current.isGlobalDefault ? ' · global default' : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {current.kind === 'html' && previewHtml ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openPreviewTab}
                >
                  Open preview tab
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMapperOpen(true)}
              >
                Edit mapping
              </Button>
            </div>
          </div>

          {current.kind === 'html' ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Layout preview</h3>
              {previewLoading ? (
                <p className="text-sm text-muted-foreground">Loading preview…</p>
              ) : null}
              {previewError ? (
                <p className="text-sm text-destructive">{previewError}</p>
              ) : null}
              {previewHtml ? (
                <iframe
                  title={`${current.name} preview`}
                  srcDoc={previewHtml}
                  className="h-[70vh] w-full rounded-md border border-border bg-white"
                  sandbox="allow-same-origin"
                />
              ) : null}
            </div>
          ) : null}

          <PermissionGate permission={PERMISSIONS.TEMPLATES_EDIT}>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Button
                  type="button"
                  variant={current.isGlobalDefault ? 'secondary' : 'outline'}
                  disabled={assignMutation.isPending}
                  onClick={() =>
                    void assignMutation.mutateAsync({
                      id: current.id,
                      payload: {
                        scope: 'global',
                        clear: current.isGlobalDefault,
                      },
                    }).then((template) => setCurrent(template))
                  }
                >
                  {current.isGlobalDefault
                    ? 'Clear global default'
                    : 'Set as global default'}
                </Button>
              </div>
              <div className="space-y-2">
                <Select
                  label="Location default"
                  value={locationId}
                  options={locationOptions}
                  placeholder="Pick a location"
                  onChange={(event) => setLocationId(event.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!locationId || assignMutation.isPending}
                    onClick={() =>
                      void assignMutation.mutateAsync({
                        id: current.id,
                        payload: { scope: 'location', locationId },
                      }).then((template) => setCurrent(template))
                    }
                  >
                    Save for location
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!locationId || assignMutation.isPending}
                    onClick={() =>
                      void assignMutation.mutateAsync({
                        id: current.id,
                        payload: {
                          scope: 'location',
                          locationId,
                          clear: true,
                        },
                      }).then((template) => setCurrent(template))
                    }
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <SearchableSelect
                  label="Client default"
                  value={clientId}
                  options={clientOptions}
                  placeholder="Pick a client"
                  searchPlaceholder="Search clients…"
                  onChange={setClientId}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!clientId || assignMutation.isPending}
                    onClick={() =>
                      void assignMutation.mutateAsync({
                        id: current.id,
                        payload: { scope: 'client', clientId },
                      }).then((template) => setCurrent(template))
                    }
                  >
                    Save for this client
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!clientId || assignMutation.isPending}
                    onClick={() =>
                      void assignMutation.mutateAsync({
                        id: current.id,
                        payload: { scope: 'client', clientId, clear: true },
                      }).then((template) => setCurrent(template))
                    }
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          </PermissionGate>

          {current.locations.length > 0 || current.clients.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Locations:{' '}
              {current.locations.map((row) => row.name).join(', ') || '—'}
              . Clients:{' '}
              {current.clients
                .map((row) => row.clientCode)
                .join(', ') || '—'}
              .
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium">Which template would generate use?</h2>
        <SearchableSelect
          label="Client"
          value={resolveClientId}
          options={clientOptions}
          placeholder="Pick a client to resolve"
          searchPlaceholder="Search clients…"
          clearable
          onChange={setResolveClientId}
        />
        {resolveQuery.data ? (
          <p className="text-sm">
            {resolveQuery.data.template
              ? `${resolveQuery.data.template.name} (${resolveQuery.data.source})`
              : 'No template assigned — generate will block until one is set.'}
          </p>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={listQuery.data?.templates ?? []}
        rowKey={(row) => row.id}
        loading={listQuery.isLoading}
        pagination={listQuery.data?.pagination}
        onPageChange={setPage}
        pageSizeSelection={pageSize}
        onPageSizeChange={(size) => {
          setPage(1);
          setPageSize(size);
        }}
        emptyTitle="No templates yet"
        emptyDescription="Upload an Excel, Word, or PDF Form 5. Highlight or colour the changeable fields, then map them. A second layout is another upload plus mapping."
      />

      <TemplateMapperDrawer
        open={mapperOpen}
        template={current}
        onOpenChange={setMapperOpen}
        onSaved={setCurrent}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete template?"
        message={
          pendingDelete
            ? `${pendingDelete.name} will be removed. Client and location assignments to it are cleared.`
            : ''
        }
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deleteMutation.mutateAsync(pendingDelete.id);
          if (current?.id === pendingDelete.id) setCurrent(null);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
