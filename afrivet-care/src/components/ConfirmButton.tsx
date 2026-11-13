"use client";

import { useTransition, type ReactNode } from "react";

interface Props {
  action: () => Promise<void>;
  /** When set, the user is asked to confirm first. */
  confirm?: string;
  className?: string;
  label?: string;
  children: ReactNode;
}

export function ActionButton({ action, confirm, className = "btn btn-ghost", label, children }: Props) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      disabled={pending}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(() => action());
      }}
    >
      {pending ? "…" : children}
    </button>
  );
}
