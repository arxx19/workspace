"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export default function ConfirmButton({
  message,
  title = "Are you sure?",
  confirmLabel = "Remove",
  className,
  children,
}: {
  message: string;
  title?: string;
  confirmLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close the popup when Escape is pressed
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function confirm() {
    setOpen(false);
    // Submit the form this button lives in
    triggerRef.current?.form?.requestSubmit();
  }

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={className}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="w-full max-w-sm rounded-lg border border-gray-700 bg-gray-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="confirm-title"
              className="mb-2 text-lg font-bold text-white"
            >
              {title}
            </h2>
            <p className="mb-6 text-sm text-gray-300">{message}</p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                autoFocus
                onClick={() => setOpen(false)}
                className="rounded border border-gray-600 px-4 py-2 text-sm text-gray-200 hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm}
                className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
