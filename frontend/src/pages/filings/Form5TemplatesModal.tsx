import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/buttons';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/dialogs/Modal';
import {
  DataTable,
  DEFAULT_DATA_TABLE_PAGE_SIZE,
  resolveDataTableLimit,
  type DataTableColumn,
  type DataTablePageSizeOption,
} from '@/components/tables';
import { templatesApi } from '@/api/templates.api';
import { useTemplatesQuery } from '@/hooks/useTemplates';
import type { TemplateDetail, TemplateKind, TemplateListItem } from '@/types/template.types';

type Form5TemplatesModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const kindLabel = (kind: TemplateKind) => {
  if (kind === 'docx') return 'Word';
  if (kind === 'pdf') return 'PDF';
  if (kind === 'html') return 'HTML';
  return 'Excel';
};

/**
 * Read-only view of the Form 5 layouts the app can generate — reachable from
 * the Form 5 page. Uploading/mapping/assigning a template is a developer task
 * now that the standard layouts are bundled HTML; this only lists and
 * previews, it does not manage them.
 */
export function Form5TemplatesModal({
  open,
  onOpenChange,
}: Form5TemplatesModalProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<DataTablePageSizeOption>(
    DEFAULT_DATA_TABLE_PAGE_SIZE,
  );
  const [viewing, setViewing] = useState<TemplateDetail | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const listQuery = useTemplatesQuery({
    page,
    limit: resolveDataTableLimit(pageSize),
  });

  const handleView = async (row: TemplateListItem) => {
    const template = await templatesApi.getById(row.id);
    setViewing(template);

    if (template.kind !== 'html' || !template.code) {
      setPreviewHtml(null);
      setPreviewError(null);
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewHtml(null);
    try {
      const html = await templatesApi.fetchBundledPreviewHtml(template.code);
      setPreviewHtml(html);
    } catch {
      setPreviewError('Could not load a preview for this template.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleBack = () => {
    setViewing(null);
    setPreviewHtml(null);
    setPreviewError(null);
  };

  // Reset to the list every time the modal is reopened.
  useEffect(() => {
    if (open) handleBack();
  }, [open]);

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
        width: 100,
        minWidth: 100,
        cell: (row) => <Badge variant="outline">{kindLabel(row.kind)}</Badge>,
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
        id: 'actions',
        header: '',
        className: 'text-right',
        width: 120,
        minWidth: 120,
        cell: (row) => (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleView(row)}
            >
              View
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={viewing ? viewing.name : 'Form 5 Templates'}
      description={
        viewing
          ? `${viewing.originalName} · ${kindLabel(viewing.kind)}${viewing.isGlobalDefault ? ' · global default' : ''}`
          : 'The Form 5 layouts available for generation. Managed by developers — view only.'
      }
      className="max-w-4xl"
    >
      {viewing ? (
        <div className="flex flex-col gap-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon={<ArrowLeft className="size-3.5" />}
            onClick={handleBack}
            className="w-fit"
          >
            Back to list
          </Button>

          {viewing.kind === 'html' ? (
            <div className="space-y-2">
              {previewLoading ? (
                <p className="text-sm text-muted-foreground">
                  Loading preview…
                </p>
              ) : null}
              {previewError ? (
                <p className="text-sm text-destructive">{previewError}</p>
              ) : null}
              {previewHtml ? (
                <iframe
                  title={`${viewing.name} preview`}
                  srcDoc={previewHtml}
                  className="h-[65vh] w-full rounded-md border border-border bg-white"
                  sandbox="allow-same-origin"
                />
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No preview available for this template type.
            </p>
          )}
        </div>
      ) : (
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
          gridMaxHeight="55vh"
          hideColumnSizing
          emptyTitle="No templates yet"
        />
      )}
    </Modal>
  );
}
