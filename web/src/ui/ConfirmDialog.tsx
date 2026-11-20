import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { ResponsivePanel } from './ResponsivePanel';

interface Props {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  /** Runs the action. The dialog stays open, disabled, until it settles. */
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

/** Replaces window.confirm so destructive actions read the same everywhere. */
export function ConfirmDialog({ title, children, confirmLabel, tone = 'danger', onConfirm, onClose }: Props) {
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ResponsivePanel
      title={title}
      size="sm"
      onClose={onClose}
      closeDisabled={busy}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={tone} onClick={() => void confirm()} disabled={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </ResponsivePanel>
  );
}
