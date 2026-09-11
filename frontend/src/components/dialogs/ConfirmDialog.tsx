import { useEffect, useState } from 'react';

import { Button } from '@/components/buttons/Button';
import { Modal } from '@/components/dialogs/Modal';

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Uses the destructive button variant when true. */
  danger?: boolean;
  loading?: boolean;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const busy = loading || pending;

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    if (!onConfirm) {
      onOpenChange(false);
      return;
    }
    try {
      setPending(true);
      await onConfirm();
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next && busy) return;
        if (!next) onCancel?.();
        onOpenChange(next);
      }}
      title={title}
      description={<span className="whitespace-pre-line">{message}</span>}
      closeOnOverlayClick={!busy}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={handleCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={danger ? 'destructive' : 'primary'}
            loading={busy}
            onClick={() => void handleConfirm()}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {null}
    </Modal>
  );
}

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmResolver = {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
};

let activeResolver: ConfirmResolver | null = null;
const listeners = new Set<() => void>();

const notifyHost = () => {
  listeners.forEach((listener) => listener());
};

const settle = (value: boolean) => {
  if (!activeResolver) return;
  activeResolver.resolve(value);
  activeResolver = null;
  notifyHost();
};

/**
 * Imperative confirm helper — returns a Promise&lt;boolean&gt;.
 * Requires &lt;ConfirmDialogHost /&gt; mounted once near the app root.
 */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    activeResolver = { options, resolve };
    notifyHost();
  });
}

/** Mount once to enable `confirmDialog()` promise API. */
export function ConfirmDialogHost() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((value) => value + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  if (!activeResolver) return null;

  const { options } = activeResolver;

  return (
    <ConfirmDialog
      open
      title={options.title}
      message={options.message}
      confirmLabel={options.confirmLabel}
      cancelLabel={options.cancelLabel}
      danger={options.danger}
      onOpenChange={(open) => {
        if (!open) settle(false);
      }}
      onCancel={() => settle(false)}
      onConfirm={() => {
        settle(true);
      }}
    />
  );
}
