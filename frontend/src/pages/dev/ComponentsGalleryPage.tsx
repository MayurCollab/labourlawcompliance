import { useMemo, useState, type ReactNode } from 'react';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/buttons';
import {
  Avatar,
  Badge,
  Breadcrumb,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  LoadingSpinner,
  SkeletonLoader,
} from '@/components/common';
import {
  ConfirmDialog,
  Drawer,
  Modal,
  confirmDialog,
} from '@/components/dialogs';
import {
  FilterPanel,
  FormWrapper,
  SearchBox,
  type FilterValues,
} from '@/components/forms';
import {
  Checkbox,
  DatePicker,
  FileUpload,
  ImageUpload,
  Input,
  MultiSelect,
  PasswordInput,
  Radio,
  RadioGroup,
  Select,
  Switch,
  Textarea,
  TimePicker,
} from '@/components/inputs';
import { PageHeader } from '@/components/layout';
import { DataTable, Pagination, type DataTablePageSizeOption, type DataTableSort } from '@/components/tables';
import { toastSuccess } from '@/utils/toast';

type DemoRow = {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'inactive';
};

const demoRows: DemoRow[] = [
  { id: '1', name: 'Ada Lovelace', role: 'Admin', status: 'active' },
  { id: '2', name: 'Alan Turing', role: 'Editor', status: 'active' },
  { id: '3', name: 'Grace Hopper', role: 'Viewer', status: 'inactive' },
];

const demoSchema = z.object({
  email: z.email('Invalid email'),
  notes: z.string().min(3, 'Too short'),
});

type DemoFormValues = z.infer<typeof demoSchema>;

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        {children}
      </div>
    </section>
  );
}

/**
 * Internal visual gallery for the reusable component library.
 * Route: /dev/components — not linked in the real sidebar.
 */
export function ComponentsGalleryPage() {
  const [search, setSearch] = useState('');
  const [multi, setMulti] = useState<string[]>(['users']);
  const [radio, setRadio] = useState('a');
  const [switched, setSwitched] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<DataTablePageSizeOption>(10);
  const [sort, setSort] = useState<DataTableSort>({
    sortBy: 'name',
    sortOrder: 'asc',
  });
  const [filters, setFilters] = useState<FilterValues>({
    q: '',
    status: '',
    activeOnly: false,
  });
  const [file, setFile] = useState<FileList | null>(null);
  const [image, setImage] = useState<File | null>(null);

  const columns = useMemo(
    () => [
      { id: 'name', header: 'Name', accessorKey: 'name' as const, sortable: true },
      { id: 'role', header: 'Role', accessorKey: 'role' as const, sortable: true },
      {
        id: 'status',
        header: 'Status',
        cell: (row: DemoRow) => (
          <Badge variant={row.status === 'active' ? 'success' : 'secondary'}>
            {row.status}
          </Badge>
        ),
      },
    ],
    [],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-10 pb-16">
      <PageHeader
        title="Component gallery"
        description="Internal sandbox for Phase 5 UI primitives. Not linked in navigation."
        breadcrumbs={[
          { label: 'Dev', href: '/dev/components' },
          { label: 'Components' },
        ]}
        actions={
          <Button leftIcon={<Plus className="size-4" />}>Primary action</Button>
        }
      />

      <Section title="Buttons">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive" leftIcon={<Trash2 className="size-4" />}>
            Destructive
          </Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Inputs">
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="Name" placeholder="Jane Doe" />
          <PasswordInput label="Password" placeholder="••••••••" />
          <Textarea label="Bio" placeholder="Tell us about yourself" />
          <Select
            label="Role"
            options={[
              { label: 'Admin', value: 'admin' },
              { label: 'Editor', value: 'editor' },
            ]}
          />
          <MultiSelect
            label="Modules"
            value={multi}
            onChange={setMulti}
            options={[
              { label: 'Users', value: 'users' },
              { label: 'Roles', value: 'roles' },
              { label: 'Permissions', value: 'permissions' },
            ]}
          />
          <DatePicker label="Start date" />
          <TimePicker label="Start time" />
          <Checkbox label="Remember me" defaultChecked />
          <Switch
            label="Email notifications"
            checked={switched}
            onChange={(event) => setSwitched(event.target.checked)}
          />
          <RadioGroup
            name="demo-radio"
            label="Plan"
            value={radio}
            onChange={setRadio}
          >
            <Radio value="a" label="Starter" />
            <Radio value="b" label="Pro" />
          </RadioGroup>
          <FileUpload
            label="Attachment"
            value={file}
            onChange={setFile}
            accept=".pdf,.png"
          />
          <ImageUpload label="Avatar upload" value={image} onChange={setImage} />
        </div>
      </Section>

      <Section title="Common">
        <div className="flex flex-wrap items-center gap-3">
          <Avatar name="Ada Lovelace" />
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <LoadingSpinner />
        </div>
        <Breadcrumb
          items={[
            { label: 'Home', href: '/' },
            { label: 'Settings', href: '/' },
            { label: 'Profile' },
          ]}
        />
        <Card>
          <CardHeader>
            <CardTitle>Card title</CardTitle>
            <CardDescription>Composable card chrome</CardDescription>
          </CardHeader>
          <CardContent>Card body content goes here.</CardContent>
        </Card>
        <EmptyState
          title="Nothing here yet"
          description="Empty states share one consistent look."
          action={<Button variant="outline">Create item</Button>}
        />
        <div className="grid gap-3 md:grid-cols-2">
          <SkeletonLoader.Card />
          <div className="space-y-2">
            <SkeletonLoader.Text />
            <SkeletonLoader.TableRow columns={3} />
          </div>
        </div>
      </Section>

      <Section title="Dialogs">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setModalOpen(true)}>Open modal</Button>
          <Button variant="outline" onClick={() => setDrawerOpen(true)}>
            Open drawer
          </Button>
          <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
            Confirm (controlled)
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              void confirmDialog({
                title: 'Delete item?',
                message: 'This action cannot be undone.',
                confirmLabel: 'Delete',
                danger: true,
              }).then((ok) => {
                if (ok) toastSuccess('Confirmed via promise API');
              });
            }}
          >
            Confirm (promise)
          </Button>
        </div>

        <Modal
          open={modalOpen}
          onOpenChange={setModalOpen}
          title="Example modal"
          description="Framer Motion enter/exit."
          footer={
            <Button onClick={() => setModalOpen(false)}>Close</Button>
          }
        >
          <p className="text-sm text-muted-foreground">
            Modal body content for forms and details.
          </p>
        </Modal>

        <Drawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          title="Example drawer"
          description="Slides in from the right."
        >
          <p className="text-sm text-muted-foreground">
            Drawer body — useful for filters and detail panels.
          </p>
        </Drawer>

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Are you sure?"
          message="Controlled ConfirmDialog with onConfirm callback."
          danger
          onConfirm={() => {
            toastSuccess('Confirmed');
          }}
        />
      </Section>

      <Section title="Tables">
        <DataTable
          columns={columns}
          data={demoRows}
          rowKey={(row) => row.id}
          sort={sort}
          onSortChange={setSort}
          pagination={{
            page,
            limit: pageSize === 'all' ? demoRows.length : pageSize,
            total: demoRows.length,
            totalPages: pageSize === 'all' ? 1 : Math.max(1, Math.ceil(demoRows.length / pageSize)),
          }}
          onPageChange={setPage}
          pageSizeSelection={pageSize}
          onPageSizeChange={(size) => {
            setPage(1);
            setPageSize(size);
          }}
        />
        <Pagination
          page={2}
          totalPages={5}
          total={48}
          pageSize={10}
          pageSizeSelection={10}
          onPageChange={() => undefined}
          onPageSizeChange={() => undefined}
        />
      </Section>

      <Section title="Forms">
        <SearchBox value={search} onChange={setSearch} onSubmit={() => undefined} />
        <FilterPanel
          fields={[
            { key: 'q', label: 'Keyword', type: 'text', placeholder: 'Search…' },
            {
              key: 'status',
              label: 'Status',
              type: 'select',
              options: [
                { label: 'Active', value: 'active' },
                { label: 'Inactive', value: 'inactive' },
              ],
            },
            { key: 'activeOnly', label: 'Active only', type: 'checkbox' },
            { key: 'joined', label: 'Joined after', type: 'date' },
          ]}
          values={filters}
          onChange={setFilters}
          onApply={() => toastSuccess('Filters applied')}
          onReset={() =>
            setFilters({ q: '', status: '', activeOnly: false, joined: '' })
          }
        />
        <FormWrapper<DemoFormValues>
          schema={demoSchema}
          defaultValues={{ email: '', notes: '' }}
          onSubmit={(values) => {
            toastSuccess(`Submitted ${values.email}`);
          }}
        >
          {(form) => (
            <>
              <Input
                label="Email"
                {...form.register('email')}
                error={form.formState.errors.email?.message}
              />
              <Textarea
                label="Notes"
                {...form.register('notes')}
                error={form.formState.errors.notes?.message}
              />
              <Button type="submit">Submit form</Button>
            </>
          )}
        </FormWrapper>
      </Section>
    </div>
  );
}
