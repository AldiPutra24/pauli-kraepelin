export type TestKind = "pauli" | "kraepelin";

/** Order in which the participant works through a column. */
export type WorkDirection = "down" | "up";

export interface PauliConfig {
  kind: "pauli";
  durationSec: number;
  columnCount: number;
  /** Digits per column. A column holds `columnLength - 1` answer positions. */
  columnLength: number;
  /** Width of each bucket in the results work curve. */
  intervalSec: number;
}

export interface KraepelinConfig {
  kind: "kraepelin";
  columnCount: number;
  columnSec: number;
  columnLength: number;
}

export type TestConfig = PauliConfig | KraepelinConfig;

export type ConfigFor<K extends TestKind> = Extract<TestConfig, { kind: K }>;

export interface Entry {
  value: number;
  /** Active test time (ms) at which the answer was entered. */
  at: number;
}

export type SessionStatus = "ready" | "running" | "paused" | "finished";

export type EndReason = "time" | "sheet-complete" | "manual";

export interface TestSession {
  version: 1;
  id: string;
  config: TestConfig;
  seed: number;
  status: SessionStatus;
  /** Active time accumulated before the current running stretch. */
  elapsedMs: number;
  /** Wall-clock timestamp of the current running stretch, null unless running. */
  runningSince: number | null;
  /** Entered answers per column, in work order. */
  columns: Entry[][];
  pauseCount: number;
  endReason: EndReason | null;
}

export type SessionAction =
  | { type: "start"; now: number }
  | { type: "pause"; now: number }
  | { type: "resume"; now: number }
  /**
   * `column`: the column on screen when the key was pressed. When given and the
   * clock has already moved to another column, the action is ignored instead of
   * landing in a column the participant has not seen yet.
   */
  | { type: "input"; value: number; now: number; column?: number }
  | { type: "erase"; now: number; column?: number }
  | { type: "tick"; now: number }
  | { type: "finish"; now: number };

export interface ColumnResult {
  index: number;
  positions: number;
  answered: number;
  correct: number;
  incorrect: number;
  unanswered: number;
}

export interface IntervalResult {
  index: number;
  startMs: number;
  endMs: number;
  answered: number;
  correct: number;
  incorrect: number;
}

export interface TestResult {
  config: TestConfig;
  configuredDurationMs: number;
  elapsedMs: number;
  endReason: EndReason;
  pauseCount: number;
  totalPositions: number;
  answered: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  /** correct / answered, null when nothing was answered. */
  accuracy: number | null;
  /** answered / totalPositions. */
  completion: number;
  columns: ColumnResult[];
  /** Pauli only: answers per time interval. Empty for Kraepelin. */
  intervals: IntervalResult[];
}
