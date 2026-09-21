import { useMemo, useState } from 'react';
import { History, Plus } from 'lucide-react';

import { Button } from '@/components/buttons';
import { Badge } from '@/components/common/Badge';
import { PermissionGate } from '@/components/common/PermissionGate';
import { ConfirmDialog } from '@/components/dialogs/ConfirmDialog';
import { SearchBox } from '@/components/forms/SearchBox';
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
import { PATHS } from '@/routes/paths';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  useDeleteWhatsAppTemplateMutation,
  useWhatsAppTemplatesQuery,
} from '@/hooks/useWhatsAppTemplates';
import { WhatsAppTemplateEditorModal } from '@/pages/whatsappTemplates/WhatsAppTemplateEditorModal';
import { WhatsAppTemplateHistoryModal } from '@/pages/whatsappTemplates/WhatsAppTemplateHistoryModal';
import type { WhatsAppTemplateListItem } from '@/types/whatsappTemplate.types';

/**
 * WhatsApp Templates management page.
 * List, create, edit, and delete MSG91 WhatsApp message templates.
 */
export function WhatsAppTemplatesPage() {
  const [search, setSearch] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<DataTablePageSizeOption>(
    DEFAULT_DATA_TABLE_PAGE_SIZE,
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<WhatsAppTemplateListItem | null>(null);
  const [pendingDelete, setPendingDelete] =
    useState<WhatsAppTemplateListItem | null>(null);
  const [historyTemplate, setHistoryTemplate] =
    useState<WhatsAppTemplateListItem | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  const listQuery = useWhatsAppTemplatesQuery({
    page,
    limit: resolveDataTableLimit(pageSize),
    search: debouncedSearch,
    isActive: isActiveFilter === 'all' ? undefined : isActiveFilter === 'true',
    sortBy: 'label',
    sortOrder: 'asc',
  });

  const deleteMutation = useDeleteWhatsAppTemplateMutation();

  const handleCreate = () => {
    setEditingTemplate(null);
    setEditorOpen(true);
  };

  const handleEdit = (template: WhatsAppTemplateListItem) => {
    setEditingTemplate(template);
    setEditorOpen(true);
  };

  const handleEditorClose = () => {
    setEditorOpen(false);
    setEditingTemplate(null);
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    await deleteMutation.mutateAsync(pendingDelete.id);
    setPendingDelete(null);
  };

  const columns: DataTableColumn<WhatsAppTemplateListItem>[] = useMemo(
    () => [
      {
        id: 'label',
        header: 'Template Name',
        minWidth: 160,
        cell: (row) => <span className="font-medium">{row.label}</span>,
      },
      {
        id: 'bodyPreview',
        header: 'Message',
        cell: (row) => (
          <span className="line-clamp-1 text-sm text-muted-foreground">
            {row.bodyPreview || '—'}
          </span>
        ),
      },
      {
        id: 'variables',
        header: 'Variables',
        width: 160,
        minWidth: 160,
        cell: (row) => {
          const custom = row.variables.filter(
            (variable) => variable.type === 'custom',
          ).length;
          return (
            <div className="flex flex-wrap gap-1">
              <Badge variant="outline">
                {row.variables.length}{' '}
                {row.variables.length === 1 ? 'variable' : 'variables'}
              </Badge>
              {custom > 0 && <Badge variant="secondary">{custom} custom</Badge>}
            </div>
          );
        },
      },
      {
        id: 'isActive',
        header: 'Status',
        width: 110,
        minWidth: 110,
        cell: (row) =>
          row.isActive ? (
            <Badge variant="success">Active</Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          ),
      },
      {
        id: 'actions',
        header: '',
        className: 'text-right',
        width: 280,
        minWidth: 280,
        cell: (row) => (
          <div className="flex justify-end gap-2">
            <PermissionGate permission={PERMISSIONS.WHATSAPP_TEMPLATES_VIEW}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setHistoryTemplate(row)}
                leftIcon={<History className="size-3.5" />}
              >
                History
              </Button>
            </PermissionGate>
            <PermissionGate permission={PERMISSIONS.WHATSAPP_TEMPLATES_EDIT}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleEdit(row)}
              >
                {row.isSeeded ? 'Preview' : 'Edit'}
              </Button>
            </PermissionGate>
            <PermissionGate permission={PERMISSIONS.WHATSAPP_TEMPLATES_DELETE}>
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="WhatsApp Templates"
        description="Name a template and compose its message — pick from your data or add your own text."
        breadcrumbs={[
          { label: 'Home', href: PATHS.home },
          { label: 'WhatsApp Templates' },
        ]}
        actions={
          <PermissionGate permission={PERMISSIONS.WHATSAPP_TEMPLATES_CREATE}>
            <Button
              type="button"
              leftIcon={<Plus className="size-4" />}
              onClick={handleCreate}
            >
              New Template
            </Button>
          </PermissionGate>
        }
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="Search templates..."
          className="w-full sm:w-80"
        />
        <Select
          value={isActiveFilter}
          onChange={(e) => setIsActiveFilter(e.target.value)}
          options={[
            { value: 'all', label: 'All templates' },
            { value: 'true', label: 'Active only' },
            { value: 'false', label: 'Inactive only' },
          ]}
          className="w-full sm:w-48"
        />
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
        emptyTitle="No WhatsApp templates found"
      />

      {editorOpen && (
        <WhatsAppTemplateEditorModal
          template={editingTemplate}
          onClose={handleEditorClose}
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        onConfirm={handleDelete}
        title="Delete WhatsApp template?"
        message={
          pendingDelete
            ? pendingDelete.isSeeded
              ? `Delete “${pendingDelete.label}”? This is the pre-configured template your existing Form 5 reminders use — deleting it stops those sends until you create a replacement. It's a soft delete (recoverable from the database), but there's no restore option in this screen.`
              : `Delete “${pendingDelete.label}”? Any send flow still pointing at it will stop working. Messages already sent keep their own copy of the template.`
            : ''
        }
        confirmLabel="Delete"
        danger
        loading={deleteMutation.isPending}
      />

      <WhatsAppTemplateHistoryModal
        open={!!historyTemplate}
        onOpenChange={(open) => !open && setHistoryTemplate(null)}
        templateId={historyTemplate?.id ?? null}
        templateLabel={historyTemplate?.label}
      />
    </div>
  );
}
