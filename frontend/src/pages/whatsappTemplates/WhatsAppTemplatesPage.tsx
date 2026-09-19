import { useMemo, useState } from 'react';

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
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  useDeleteWhatsAppTemplateMutation,
  useWhatsAppTemplatesQuery,
} from '@/hooks/useWhatsAppTemplates';
import { WhatsAppTemplateEditorDrawer } from '@/pages/whatsappTemplates/WhatsAppTemplateEditorDrawer';
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
        cell: (row) => (
          <div className="flex flex-col gap-1">
            <span className="font-medium">{row.label}</span>
            {row.isSeeded && (
              <Badge variant="secondary" className="w-fit text-xs">
                Seeded
              </Badge>
            )}
          </div>
        ),
      },
      {
        id: 'msg91TemplateName',
        header: 'MSG91 Template',
        cell: (row) => (
          <span className="font-mono text-sm">{row.msg91TemplateName}</span>
        ),
      },
      {
        id: 'variables',
        header: 'Variables',
        cell: (row) => (
          <Badge variant="outline">{row.variables.length} fields</Badge>
        ),
      },
      {
        id: 'isActive',
        header: 'Status',
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
        width: 200,
        minWidth: 200,
        cell: (row) => (
          <div className="flex justify-end gap-2">
            <PermissionGate permission={PERMISSIONS.WHATSAPP_TEMPLATES_EDIT}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleEdit(row)}
              >
                Edit
              </Button>
            </PermissionGate>
            <PermissionGate permission={PERMISSIONS.WHATSAPP_TEMPLATES_DELETE}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPendingDelete(row)}
                disabled={row.isSeeded}
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
        description="Manage MSG91 WhatsApp message templates for Form 5 sends"
      >
        <PermissionGate permission={PERMISSIONS.WHATSAPP_TEMPLATES_CREATE}>
          <Button type="button" onClick={handleCreate}>
            New Template
          </Button>
        </PermissionGate>
      </PageHeader>

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
        <WhatsAppTemplateEditorDrawer
          template={editingTemplate}
          onClose={handleEditorClose}
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        onConfirm={handleDelete}
        title="Delete WhatsApp template?"
        description={
          pendingDelete
            ? `This will permanently delete "${pendingDelete.label}". This action cannot be undone.`
            : ''
        }
        confirmText="Delete"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
