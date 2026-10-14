import { pairsPerColumn, parseConfig, totalDurationMs } from "./config";
import type { EndReason, Entry, SessionStatus, TestConfig, TestKind, TestSession } from "./types";

const STATUSES: readonly SessionStatus[] = ["ready", "running", "paused", "finished"];
const END_REASONS: readonly EndReason[] = ["time", "sheet-complete", "manual"];

function storageKey(kind: TestKind): string {
  return `latihan-psikotes:${kind}:session`;
}

function isEntry(value: unknown, maxAt: number): value is Entry {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.value === "number" &&
    Number.isInteger(e.value) &&
    e.value >= 0 &&
    e.value <= 9 &&
    typeof e.at === "number" &&
    Number.isFinite(e.at) &&
    e.at >= 0 &&
    e.at <= maxAt
  );
}

function isSheetFull(columns: Entry[][], config: TestConfig, pairs: number): boolean {
  return config.kind === "kraepelin"
    ? columns[columns.length - 1].length === pairs
    : columns.every((c) => c.length === pairs);
}

/**
 * Checks that answers could have been produced by the session reducer:
 * time order is kept, Pauli fills columns strictly in sequence, and every
 * Kraepelin answer falls inside its own column's time window.
 */
function isConsistentSheet(columns: Entry[][], config: TestConfig, pairs: number): boolean {
  let previousAt = 0;
  for (let index = 0; index < columns.length; index++) {
    const column = columns[index];
    if (config.kind === "pauli" && column.length > 0 && index > 0 && columns[index - 1].length < pairs) {
      return false;
    }
    if (config.kind === "kraepelin") previousAt = 0;
    for (const entry of column) {
      if (entry.at < previousAt) return false;
      previousAt = entry.at;
      if (config.kind === "kraepelin") {
        const columnMs = config.columnSec * 1000;
        if (entry.at < index * columnMs || entry.at >= (index + 1) * columnMs) return false;
      }
    }
  }
  return true;
}

/**
 * Validates untrusted stored data. Returns null if anything is malformed,
 * outdated, or inconsistent. `now` enables checks against the current time.
 */
export function parseSession(raw: unknown, kind: TestKind, now?: number): TestSession | null {
  if (typeof raw !== "object" || raw === null) return null;
  const s = raw as Record<string, unknown>;
  if (s.version !== 1) return null;
  if (typeof s.id !== "string" || s.id.length === 0 || s.id.length > 100) return null;

  const config = parseConfig(s.config, kind);
  if (!config) return null;
  const total = totalDurationMs(config);
  const pairs = pairsPerColumn(config);

  if (typeof s.seed !== "number" || !Number.isInteger(s.seed) || s.seed < 0 || s.seed > 0xffffffff) {
    return null;
  }
  if (!STATUSES.includes(s.status as SessionStatus)) return null;
  const status = s.status as SessionStatus;

  if (typeof s.elapsedMs !== "number" || !Number.isFinite(s.elapsedMs)) return null;
  if (s.elapsedMs < 0 || s.elapsedMs > total) return null;

  const runningSince = s.runningSince;
  if (status === "running") {
    if (typeof runningSince !== "number" || !Number.isFinite(runningSince) || runningSince <= 0) {
      return null;
    }
  } else if (runningSince !== null) {
    return null;
  }

  // A running session's start lies in the past. Small tolerance for clock adjustments.
  if (status === "running" && now !== undefined && (runningSince as number) > now + 60_000) {
    return null;
  }

  // Answers can only be stamped with time already spent: the full duration
  // while running (the live part is unknown here), the recorded time otherwise.
  const maxAt = status === "running" ? total : s.elapsedMs;
  if (!Array.isArray(s.columns) || s.columns.length !== config.columnCount) return null;
  for (const column of s.columns) {
    if (!Array.isArray(column) || column.length > pairs) return null;
    // Index loop rather than every(): every() skips holes in sparse arrays.
    for (let i = 0; i < column.length; i++) {
      if (!isEntry(column[i], maxAt)) return null;
    }
  }
  const columns = s.columns as Entry[][];
  if (!isConsistentSheet(columns, config, pairs)) return null;

  if (typeof s.pauseCount !== "number" || !Number.isInteger(s.pauseCount) || s.pauseCount < 0) {
    return null;
  }

  if (status === "ready") {
    if (s.elapsedMs !== 0 || s.pauseCount !== 0 || columns.some((c) => c.length > 0)) return null;
  }

  const endReason = s.endReason;
  if (status === "finished") {
    if (!END_REASONS.includes(endReason as EndReason)) return null;
    if (endReason === "time" && s.elapsedMs !== total) return null;
    if (endReason === "sheet-complete" && !isSheetFull(columns, config, pairs)) return null;
  } else if (endReason !== null) {
    return null;
  }

  return {
    version: 1,
    id: s.id,
    config,
    seed: s.seed,
    status,
    elapsedMs: s.elapsedMs,
    runningSince: (runningSince as number | null) ?? null,
    columns,
    pauseCount: s.pauseCount,
    endReason: (endReason as EndReason | null) ?? null,
  };
}

export type LoadResult =
  | { state: "empty" }
  | { state: "invalid" }
  | { state: "ok"; session: TestSession };

export function loadSession(kind: TestKind): LoadResult {
  let text: string | null;
  try {
    text = window.sessionStorage.getItem(storageKey(kind));
  } catch {
    return { state: "empty" };
  }
  if (text === null) return { state: "empty" };
  try {
    const session = parseSession(JSON.parse(text), kind, Date.now());
    if (session) return { state: "ok", session };
  } catch {
    // Falls through to the invalid case below.
  }
  clearSession(kind);
  return { state: "invalid" };
}

export function saveSession(session: TestSession): void {
  try {
    window.sessionStorage.setItem(storageKey(session.config.kind), JSON.stringify(session));
  } catch {
    // Storage full or blocked: the session keeps working in memory.
  }
}

export function clearSession(kind: TestKind): void {
  try {
    window.sessionStorage.removeItem(storageKey(kind));
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
