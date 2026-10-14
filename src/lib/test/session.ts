import { pairsPerColumn, totalDurationMs } from "./config";
import type {
  EndReason,
  SessionAction,
  TestConfig,
  TestSession,
} from "./types";

export function createSession(config: TestConfig, seed: number, id: string): TestSession {
  return {
    version: 1,
    id,
    config,
    seed,
    status: "ready",
    elapsedMs: 0,
    runningSince: null,
    columns: Array.from({ length: config.columnCount }, () => []),
    pauseCount: 0,
    endReason: null,
  };
}

/**
 * Active test time at `now`. Derived from timestamps rather than counted
 * ticks, so a throttled or backgrounded tab never gains time.
 */
export function elapsedAt(session: TestSession, now: number): number {
  const live =
    session.status === "running" && session.runningSince !== null
      ? Math.max(0, now - session.runningSince)
      : 0;
  return Math.min(totalDurationMs(session.config), session.elapsedMs + live);
}

export function remainingAt(session: TestSession, now: number): number {
  return totalDurationMs(session.config) - elapsedAt(session, now);
}

/**
 * Column that accepts input at `elapsed`.
 * Kraepelin: decided by the clock, one column per `columnSec`.
 * Pauli: the first column that is not yet full.
 */
export function activeColumnAt(session: TestSession, elapsed: number): number {
  const { config } = session;
  if (config.kind === "kraepelin") {
    return Math.min(config.columnCount - 1, Math.floor(elapsed / (config.columnSec * 1000)));
  }
  const pairs = pairsPerColumn(config);
  const open = session.columns.findIndex((column) => column.length < pairs);
  return open === -1 ? config.columnCount - 1 : open;
}

/** Kraepelin only: time left in the current column. */
export function columnRemainingAt(session: TestSession, elapsed: number): number {
  const { config } = session;
  if (config.kind !== "kraepelin") return 0;
  const columnMs = config.columnSec * 1000;
  const column = activeColumnAt(session, elapsed);
  return Math.max(0, (column + 1) * columnMs - elapsed);
}

function isSheetComplete(session: TestSession): boolean {
  const pairs = pairsPerColumn(session.config);
  if (session.config.kind === "kraepelin") {
    return session.columns[session.columns.length - 1].length >= pairs;
  }
  return session.columns.every((column) => column.length >= pairs);
}

function finish(session: TestSession, elapsed: number, reason: EndReason): TestSession {
  return {
    ...session,
    status: "finished",
    elapsedMs: elapsed,
    runningSince: null,
    endReason: reason,
  };
}

/**
 * Pure state transition. Returns the same object when the action has no
 * effect, so callers can detect no-ops by identity. A finished session never
 * changes again, which makes the transition to "finished" happen exactly once.
 */
export function reduceSession(session: TestSession, action: SessionAction): TestSession {
  if (session.status === "finished") return session;

  const total = totalDurationMs(session.config);
  const elapsed = elapsedAt(session, action.now);
  const expired = session.status === "running" && elapsed >= total;
  if (expired) return finish(session, total, "time");

  switch (action.type) {
    case "start":
      if (session.status !== "ready") return session;
      return { ...session, status: "running", runningSince: action.now };

    case "pause":
      if (session.status !== "running") return session;
      return {
        ...session,
        status: "paused",
        elapsedMs: elapsed,
        runningSince: null,
        pauseCount: session.pauseCount + 1,
      };

    case "resume":
      if (session.status !== "paused") return session;
      return { ...session, status: "running", runningSince: action.now };

    case "input": {
      if (session.status !== "running") return session;
      if (!Number.isInteger(action.value) || action.value < 0 || action.value > 9) return session;
      const index = activeColumnAt(session, elapsed);
      if (action.column !== undefined && action.column !== index) return session;
      const column = session.columns[index];
      if (column.length >= pairsPerColumn(session.config)) return session;
      const columns = session.columns.slice();
      columns[index] = [...column, { value: action.value, at: elapsed }];
      const next = { ...session, columns };
      return isSheetComplete(next) ? finish(next, elapsed, "sheet-complete") : next;
    }

    case "erase": {
      if (session.status !== "running") return session;
      const index = activeColumnAt(session, elapsed);
      if (action.column !== undefined && action.column !== index) return session;
      const column = session.columns[index];
      if (column.length === 0) return session;
      const columns = session.columns.slice();
      columns[index] = column.slice(0, -1);
      return { ...session, columns };
    }

    case "tick":
      return session;

    case "finish":
      return finish(session, elapsed, "manual");
  }
}
