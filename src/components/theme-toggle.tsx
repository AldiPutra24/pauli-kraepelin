"use client";

import { Moon, Sun } from "lucide-react";

// Both labels render; CSS shows the one matching the current theme, so the
// button is correct before hydration and needs no theme state in React.
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // The theme still switches for this page view.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-ink-muted hover:bg-sheet hover:text-ink print:hidden"
    >
      <span className="contents in-data-[theme=dark]:hidden">
        <Moon aria-hidden className="size-4" />
        Tema gelap
      </span>
      <span className="hidden in-data-[theme=dark]:contents">
        <Sun aria-hidden className="size-4" />
        Tema terang
      </span>
    </button>
  );
}
