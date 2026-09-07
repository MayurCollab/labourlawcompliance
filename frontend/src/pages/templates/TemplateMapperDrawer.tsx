import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/buttons';
import { Drawer } from '@/components/dialogs/Drawer';
import { Input } from '@/components/inputs/Input';
import { useCanonicalSchemaQuery, useUpdateTemplateMutation } from '@/hooks/useTemplates';
import type { TemplateDetail, TemplateMapping } from '@/types/template.types';

type TemplateMapperDrawerProps = {
  open: boolean;
  template: TemplateDetail | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: (template: TemplateDetail) => void;
};

const cloneMapping = (mapping: TemplateMapping): TemplateMapping => ({
  scalars: { ...mapping.scalars },
  slabs: mapping.slabs.map((row) => ({
    ...row,
    binds: { ...row.binds },
  })),
});

/**
 * Bind canonical Form 5 fields to {{placeholders}} or Excel cells.
 * A second template is a new file + mapping — no generator code change.
 */
export function TemplateMapperDrawer({
  open,
  template,
  onOpenChange,
  onSaved,
}: TemplateMapperDrawerProps) {
  const schemaQuery = useCanonicalSchemaQuery();
  const updateMutation = useUpdateTemplateMutation();
  const [name, setName] = useState('');
  const [mapping, setMapping] = useState<TemplateMapping>({
    scalars: {},
    slabs: [],
  });

  useEffect(() => {
    if (!template) return;
    setName(template.name);
    setMapping(cloneMapping(template.mapping));
  }, [template]);

  const bindOptions = useMemo(() => {
    const options: { label: string; value: string }[] = [];
    const seen = new Set<string>();
    for (const token of template?.placeholders ?? []) {
      const value = `{{${token}}}`;
      if (!seen.has(value)) {
        seen.add(value);
        options.push({ label: value, value });
      }
    }
    for (const cell of template?.cells ?? []) {
      if (!seen.has(cell.bind)) {
        seen.add(cell.bind);
        options.push({
          label: `${cell.bind} (${cell.value || cell.address || 'empty box'})`,
          value: cell.bind,
        });
      }
    }
    return options;
  }, [template]);

  const datalistId = template ? `template-binds-${template.id}` : 'template-binds';

  const setScalar = (key: string, raw: string) => {
    setMapping((prev) => ({
      ...prev,
      scalars: {
        ...prev.scalars,
        [key]: raw.trim() === '' ? null : raw.trim(),
      },
    }));
  };

  const setSlabBind = (index: number, key: string, raw: string) => {
    setMapping((prev) => ({
      ...prev,
      slabs: prev.slabs.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              binds: {
                ...item.binds,
                [key]: raw.trim() === '' ? null : raw.trim(),
              },
            }
          : item,
      ),
    }));
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      className="max-w-xl"
      title={template ? `Map ${template.name}` : 'Map template'}
      description="Bind canonical fields to {{placeholders}}, Excel cells (F14), highlighted Word runs, or coloured PDF boxes. Slab rows match by salary from/to/rate, not by row index."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            loading={updateMutation.isPending}
            disabled={!template || updateMutation.isPending}
            onClick={async () => {
              if (!template) return;
              await updateMutation.mutateAsync({
                id: template.id,
                payload: { name, mapping },
              }).then((saved) => {
                onSaved?.(saved);
              });
              onOpenChange(false);
            }}
          >
            Save mapping
          </Button>
        </div>
      }
    >
      {!template ? null : (
        <div className="space-y-6">
          {template.warnings.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-amber-700 dark:text-amber-300">
              {template.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          <Input
            label="Display name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <datalist id={datalistId}>
            {bindOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </datalist>
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Header and employer</h3>
            <p className="text-xs text-muted-foreground">
              Type a placeholder, Excel cell (F14), Word bind (docx:12-14), or
              PDF box. Detected highlighted / coloured fields appear as
              suggestions.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(schemaQuery.data?.scalars ?? []).map((field) => (
                <Input
                  key={field.key}
                  label={field.label}
                  list={datalistId}
                  value={mapping.scalars[field.key] ?? ''}
                  placeholder="{{employerName}} or F14"
                  onChange={(event) => setScalar(field.key, event.target.value)}
                />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Slabs</h3>
            {mapping.slabs.map((row, index) => (
              <div
                key={`${row.salaryFrom}-${row.salaryTo ?? 'open'}-${row.rate}`}
                className="space-y-3 rounded-lg border border-border p-3"
              >
                <p className="text-sm font-medium">
                  {row.label ||
                    `Rs. ${row.salaryFrom.toLocaleString('en-IN')}${
                      row.salaryTo === null
                        ? ' and above'
                        : ` – ${row.salaryTo.toLocaleString('en-IN')}`
                    }`}{' '}
                  <span className="text-muted-foreground">
                    (₹{row.rate})
                  </span>
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(schemaQuery.data?.slabBinds ?? []).map((field) => (
                    <Input
                      key={field.key}
                      label={field.label}
                      list={datalistId}
                      value={row.binds[field.key] ?? ''}
                      placeholder="{{slab_12000_employeeCount}} or G22"
                      onChange={(event) =>
                        setSlabBind(index, field.key, event.target.value)
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Drawer>
  );
}
