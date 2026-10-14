import type { ReactNode } from "react";

/** Centered message for loading, empty, invalid and "already finished" states. */
export function StatusPanel({
  title,
  children,
  actions,
  busy = false,
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  busy?: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-16 sm:py-24" aria-busy={busy || undefined}>
      <h1 className="font-serif text-2xl font-semibold" role={busy ? "status" : undefined}>
        {title}
      </h1>
      {children && <div className="mt-3 text-ink-muted">{children}</div>}
      {actions && <div className="mt-8 flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}
