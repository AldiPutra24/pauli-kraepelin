import type { KraepelinConfig, PauliConfig, TestConfig, TestKind } from "./types";

// Practice defaults. They are not an official administration procedure.
export const DEFAULT_CONFIG: { pauli: PauliConfig; kraepelin: KraepelinConfig } = {
  pauli: {
    kind: "pauli",
    durationSec: 180,
    columnCount: 10,
    columnLength: 31,
    intervalSec: 60,
  },
  kraepelin: {
    kind: "kraepelin",
    columnCount: 20,
    columnSec: 15,
    columnLength: 31,
  },
};

export interface Range {
  min: number;
  max: number;
}

export const LIMITS = {
  durationMin: { min: 1, max: 60 },
  columnCount: { min: 1, max: 60 },
  columnLength: { min: 6, max: 61 },
  columnSec: { min: 5, max: 120 },
} satisfies Record<string, Range>;

export const PAULI_INTERVAL_OPTIONS = [30, 60, 120, 180, 300] as const;

function isIntIn(value: unknown, range: Range): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= range.min &&
    value <= range.max
  );
}

/** Returns a valid config for `kind`, or null when `raw` is malformed or out of range. */
export function parseConfig(raw: unknown, kind: TestKind): TestConfig | null {
  if (typeof raw !== "object" || raw === null) return null;
  const c = raw as Record<string, unknown>;
  if (c.kind !== kind) return null;
  if (!isIntIn(c.columnCount, LIMITS.columnCount)) return null;
  if (!isIntIn(c.columnLength, LIMITS.columnLength)) return null;

  if (kind === "pauli") {
    const durationSec = c.durationSec;
    const intervalSec = c.intervalSec;
    if (
      typeof durationSec !== "number" ||
      !Number.isInteger(durationSec) ||
      durationSec % 60 !== 0 ||
      !isIntIn(durationSec / 60, LIMITS.durationMin)
    ) {
      return null;
    }
    if (
      typeof intervalSec !== "number" ||
      !(PAULI_INTERVAL_OPTIONS as readonly number[]).includes(intervalSec) ||
      intervalSec > durationSec
    ) {
      return null;
    }
    return {
      kind: "pauli",
      durationSec,
      intervalSec,
      columnCount: c.columnCount,
      columnLength: c.columnLength,
    };
  }

  if (!isIntIn(c.columnSec, LIMITS.columnSec)) return null;
  return {
    kind: "kraepelin",
    columnSec: c.columnSec,
    columnCount: c.columnCount,
    columnLength: c.columnLength,
  };
}

export function pairsPerColumn(config: TestConfig): number {
  return config.columnLength - 1;
}

export function totalPositions(config: TestConfig): number {
  return config.columnCount * pairsPerColumn(config);
}

export function totalDurationMs(config: TestConfig): number {
  return config.kind === "pauli"
    ? config.durationSec * 1000
    : config.columnCount * config.columnSec * 1000;
}
