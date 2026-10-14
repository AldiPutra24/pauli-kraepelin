// Shared control styles. Radius stays small (6px) on every control so the
// sheet keeps its printed, ruled character; nothing is pill-shaped.
const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 text-base font-semibold transition-colors active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0";

export const buttonPrimary = `${base} bg-accent text-accent-ink hover:bg-accent/88`;

export const buttonSecondary = `${base} border border-rule-strong bg-sheet text-ink hover:bg-paper`;

export const buttonDanger = `${base} border border-wrong bg-sheet text-wrong hover:bg-paper`;

export const textLink =
  "font-semibold text-accent underline decoration-1 underline-offset-4 hover:decoration-2";
