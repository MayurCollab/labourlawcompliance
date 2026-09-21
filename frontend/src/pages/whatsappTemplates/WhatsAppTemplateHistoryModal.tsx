import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/dialogs/Modal';
import { useActivityQuery } from '@/hooks/useActivity';

type WhatsAppTemplateHistoryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string | null;
  templateLabel?: string;
};

const ACTION_LABELS: Record<string, string> = {
  'whatsappTemplates.create': 'Created',
  'whatsappTemplates.update': 'Edited',
  'whatsappTemplates.soft_delete': 'Deleted',
};

const actionVariant = (action: string) => {
  if (action.endsWith('.create')) return 'success' as const;
  if (action.endsWith('.soft_delete')) return 'destructive' as const;
  return 'secondary' as const;
};

const formatChanges = (changes: Record<string, unknown> | null) => {
  if (!changes) return null;
  const parts = Object.entries(changes).map(
    ([key, value]) => `${key}: ${JSON.stringify(value)}`,
  );
  return parts.join(' · ');
};

const formatWhen = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

/**
 * Read-only history for one WhatsApp template — every create/edit/delete
 * recorded on it, from the append-only activity log. There is nothing to
 * restore here; it is a record of what happened, not an undo tool.
 */
export function WhatsAppTemplateHistoryModal({
  open,
  onOpenChange,
  templateId,
  templateLabel,
}: WhatsAppTemplateHistoryModalProps) {
  const activityQuery = useActivityQuery(
    {
      entityType: 'WhatsAppTemplate',
      entityId: templateId ?? undefined,
      limit: 50,
    },
    { enabled: open && Boolean(templateId) },
  );

  const entries = activityQuery.data?.entries ?? [];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Template History"
      description={
        templateLabel
          ? `Every change recorded for “${templateLabel}”.`
          : 'Every change recorded for this template.'
      }
      className="max-w-2xl"
    >
      <div className="flex flex-col gap-3">
        {activityQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading history…</p>
        ) : activityQuery.isError ? (
          <p className="text-sm text-destructive">
            Could not load history for this template.
          </p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No recorded changes yet.
          </p>
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-auto">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-md border bg-card p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={actionVariant(entry.action)}>
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </Badge>
                    <span className="text-muted-foreground">
                      {entry.actor.name || entry.actor.email || 'System'}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatWhen(entry.createdAt)}
                  </span>
                </div>
                {formatChanges(entry.changes) && (
                  <p className="mt-1 break-words text-xs text-muted-foreground">
                    {formatChanges(entry.changes)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
