"use client";

import { useEffect, useRef } from "react";
import { buttonDanger, buttonSecondary } from "./ui";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Native modal dialog: focus trap and Escape-to-close come from the browser. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      aria-labelledby="confirm-title"
      aria-describedby="confirm-description"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-rule-strong bg-sheet p-6 text-ink shadow-xl backdrop:bg-black/50"
    >
      <h2 id="confirm-title" className="font-serif text-xl font-semibold">
        {title}
      </h2>
      <p id="confirm-description" className="mt-2 text-ink-muted">
        {description}
      </p>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" className={buttonSecondary} onClick={onCancel} autoFocus>
          {cancelLabel}
        </button>
        <button type="button" className={buttonDanger} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
