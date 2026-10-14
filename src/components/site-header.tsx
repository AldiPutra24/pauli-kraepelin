import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader({ current }: { current?: "pauli" | "kraepelin" }) {
  const navLink = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold hover:bg-sheet ${
        active ? "text-ink underline decoration-2 underline-offset-8" : "text-ink-muted hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="border-b border-rule print:hidden">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 sm:px-6">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center font-serif text-lg font-semibold tracking-tight"
        >
          Latihan Pauli &amp; Kraepelin
        </Link>
        <div className="flex flex-wrap items-center gap-1">
          <nav aria-label="Tes" className="flex items-center gap-1">
            {navLink("/pauli", "Pauli", current === "pauli")}
            {navLink("/kraepelin", "Kraepelin", current === "kraepelin")}
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
