import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, parseConfig } from "./config";
import { computeResult } from "./score";
import { activeColumnAt, createSession, elapsedAt, reduceSession } from "./session";
import { columnDigits, expectedAnswers } from "./sheet";
import { parseSession } from "./storage";
import type { KraepelinConfig, PauliConfig, SessionAction, TestSession } from "./types";

const T0 = 1_000_000;

const pauli: PauliConfig = {
  kind: "pauli",
  durationSec: 60,
  columnCount: 2,
  columnLength: 4,
  intervalSec: 30,
};

const kraepelin: KraepelinConfig = {
  kind: "kraepelin",
  columnCount: 3,
  columnSec: 10,
  columnLength: 5,
};

function run(session: TestSession, actions: SessionAction[]): TestSession {
  return actions.reduce(reduceSession, session);
}

function answersFor(session: TestSession, column: number): number[] {
  const { config } = session;
  const direction = config.kind === "pauli" ? "down" : "up";
  return expectedAnswers(columnDigits(session.seed, column, config.columnLength), direction);
}

describe("sheet", () => {
  it("generates the same digits for the same seed", () => {
    expect(columnDigits(42, 3, 20)).toEqual(columnDigits(42, 3, 20));
    expect(columnDigits(42, 3, 20)).not.toEqual(columnDigits(43, 3, 20));
  });

  it("keeps the last digit of each adjacent sum, in work order", () => {
    expect(expectedAnswers([7, 8, 2, 9], "down")).toEqual([5, 0, 1]);
    expect(expectedAnswers([7, 8, 2, 9], "up")).toEqual([1, 0, 5]);
  });
});

describe("timer", () => {
  it("derives elapsed time from timestamps and excludes paused time", () => {
    let s = run(createSession(pauli, 1, "a"), [{ type: "start", now: T0 }]);
    expect(elapsedAt(s, T0 + 5_000)).toBe(5_000);
    s = run(s, [{ type: "pause", now: T0 + 5_000 }]);
    expect(elapsedAt(s, T0 + 999_999)).toBe(5_000);
    s = run(s, [{ type: "resume", now: T0 + 20_000 }]);
    expect(elapsedAt(s, T0 + 21_000)).toBe(6_000);
  });

  it("finishes on the first event after the deadline, even after a long gap", () => {
    const started = run(createSession(pauli, 1, "a"), [{ type: "start", now: T0 }]);
    const late = reduceSession(started, { type: "tick", now: T0 + 3_600_000 });
    expect(late.status).toBe("finished");
    expect(late.endReason).toBe("time");
    expect(late.elapsedMs).toBe(60_000);
  });

  it("rejects input arriving after the deadline", () => {
    const started = run(createSession(pauli, 1, "a"), [{ type: "start", now: T0 }]);
    const late = reduceSession(started, { type: "input", value: 3, now: T0 + 61_000 });
    expect(late.status).toBe("finished");
    expect(late.columns.flat()).toHaveLength(0);
  });

  it("transitions to finished exactly once", () => {
    const started = run(createSession(pauli, 1, "a"), [{ type: "start", now: T0 }]);
    const finished = reduceSession(started, { type: "finish", now: T0 + 10_000 });
    expect(reduceSession(finished, { type: "finish", now: T0 + 20_000 })).toBe(finished);
    expect(reduceSession(finished, { type: "tick", now: T0 + 90_000 })).toBe(finished);
    expect(reduceSession(finished, { type: "input", value: 1, now: T0 + 11_000 })).toBe(finished);
  });
});

describe("input", () => {
  it("ignores input unless running and rejects non-digits", () => {
    const ready = createSession(pauli, 1, "a");
    expect(reduceSession(ready, { type: "input", value: 1, now: T0 })).toBe(ready);
    const running = reduceSession(ready, { type: "start", now: T0 });
    expect(reduceSession(running, { type: "input", value: 10, now: T0 })).toBe(running);
    expect(reduceSession(running, { type: "input", value: 2.5, now: T0 })).toBe(running);
  });

  it("Pauli moves to the next column when one fills and locks the filled column", () => {
    let s = run(createSession(pauli, 1, "a"), [{ type: "start", now: T0 }]);
    s = run(s, [1, 2, 3].map((value) => ({ type: "input", value, now: T0 + 1_000 }) as const));
    expect(activeColumnAt(s, 1_000)).toBe(1);
    const erased = reduceSession(s, { type: "erase", now: T0 + 1_000 });
    expect(erased).toBe(s);
  });

  it("Pauli finishes when the whole sheet is answered", () => {
    let s = run(createSession(pauli, 1, "a"), [{ type: "start", now: T0 }]);
    for (let i = 0; i < 6; i++) s = reduceSession(s, { type: "input", value: 0, now: T0 + 2_000 });
    expect(s.status).toBe("finished");
    expect(s.endReason).toBe("sheet-complete");
    expect(s.elapsedMs).toBe(2_000);
  });

  it("erase removes only the last answer of the active column", () => {
    let s = run(createSession(pauli, 1, "a"), [{ type: "start", now: T0 }]);
    s = run(s, [
      { type: "input", value: 4, now: T0 },
      { type: "input", value: 5, now: T0 },
      { type: "erase", now: T0 },
    ]);
    expect(s.columns[0].map((e) => e.value)).toEqual([4]);
  });
});

describe("Kraepelin columns", () => {
  it("advances columns on the clock and locks earlier columns", () => {
    let s = run(createSession(kraepelin, 7, "k"), [
      { type: "start", now: T0 },
      { type: "input", value: 1, now: T0 + 1_000 },
      { type: "input", value: 2, now: T0 + 11_000 },
    ]);
    expect(s.columns[0]).toHaveLength(1);
    expect(s.columns[1]).toHaveLength(1);
    s = reduceSession(s, { type: "erase", now: T0 + 21_000 });
    expect(s.columns[1]).toHaveLength(1);
  });

  it("waits when the active column is full", () => {
    let s = run(createSession(kraepelin, 7, "k"), [{ type: "start", now: T0 }]);
    for (let i = 0; i < 4; i++) s = reduceSession(s, { type: "input", value: 1, now: T0 + 500 });
    const full = reduceSession(s, { type: "input", value: 1, now: T0 + 600 });
    expect(full).toBe(s);
    expect(reduceSession(s, { type: "input", value: 1, now: T0 + 10_000 }).columns[1]).toHaveLength(1);
  });

  it("finishes after the last column's time", () => {
    const s = run(createSession(kraepelin, 7, "k"), [
      { type: "start", now: T0 },
      { type: "tick", now: T0 + 29_999 },
    ]);
    expect(s.status).toBe("running");
    expect(reduceSession(s, { type: "tick", now: T0 + 30_000 }).status).toBe("finished");
  });

  it("pausing freezes the column clock", () => {
    const s = run(createSession(kraepelin, 7, "k"), [
      { type: "start", now: T0 },
      { type: "pause", now: T0 + 8_000 },
      { type: "resume", now: T0 + 60_000 },
    ]);
    expect(activeColumnAt(s, elapsedAt(s, T0 + 61_000))).toBe(0);
    expect(activeColumnAt(s, elapsedAt(s, T0 + 62_000))).toBe(1);
  });
});

describe("results", () => {
  it("scores correct, incorrect and unanswered positions per column", () => {
    let s = run(createSession(kraepelin, 99, "k"), [{ type: "start", now: T0 }]);
    const col0 = answersFor(s, 0);
    const col1 = answersFor(s, 1);
    s = run(s, [
      { type: "input", value: col0[0], now: T0 + 1_000 },
      { type: "input", value: (col0[1] + 1) % 10, now: T0 + 2_000 },
      { type: "input", value: col1[0], now: T0 + 12_000 },
      { type: "tick", now: T0 + 30_000 },
    ]);
    const r = computeResult(s);
    expect(r.totalPositions).toBe(12);
    expect(r.answered).toBe(3);
    expect(r.correct).toBe(2);
    expect(r.incorrect).toBe(1);
    expect(r.unanswered).toBe(9);
    expect(r.accuracy).toBeCloseTo(2 / 3);
    expect(r.completion).toBeCloseTo(3 / 12);
    expect(r.columns.map((c) => [c.answered, c.correct, c.incorrect, c.unanswered])).toEqual([
      [2, 1, 1, 2],
      [1, 1, 0, 3],
      [0, 0, 0, 4],
    ]);
    expect(r.intervals).toEqual([]);
    expect(r.elapsedMs).toBe(30_000);
    expect(r.endReason).toBe("time");
  });

  it("buckets Pauli answers into time intervals", () => {
    let s = run(createSession(pauli, 5, "p"), [{ type: "start", now: T0 }]);
    const col0 = answersFor(s, 0);
    s = run(s, [
      { type: "input", value: col0[0], now: T0 + 1_000 },
      { type: "input", value: col0[1], now: T0 + 31_000 },
      { type: "input", value: (col0[2] + 5) % 10, now: T0 + 32_000 },
      { type: "finish", now: T0 + 40_000 },
    ]);
    const r = computeResult(s);
    expect(r.intervals.map((i) => [i.answered, i.correct, i.incorrect])).toEqual([
      [1, 1, 0],
      [2, 1, 1],
    ]);
    expect(r.intervals[1].endMs).toBe(40_000);
    expect(r.endReason).toBe("manual");
  });

  it("reports null accuracy when nothing was answered", () => {
    const s = run(createSession(pauli, 5, "p"), [
      { type: "start", now: T0 },
      { type: "finish", now: T0 + 1_000 },
    ]);
    const r = computeResult(s);
    expect(r.accuracy).toBeNull();
    expect(r.completion).toBe(0);
  });
});

describe("stored session validation", () => {
  const valid = run(createSession({ ...pauli, columnLength: 6 }, 5, "p"), [
    { type: "start", now: T0 },
    { type: "input", value: 3, now: T0 + 500 },
  ]);

  it("accepts a round-tripped session", () => {
    expect(parseSession(JSON.parse(JSON.stringify(valid)), "pauli")).toEqual(valid);
  });

  it("rejects a session of the other test kind", () => {
    expect(parseSession(valid, "kraepelin")).toBeNull();
  });

  it("rejects tampered or malformed data", () => {
    expect(parseSession({ ...valid, elapsedMs: -1 }, "pauli")).toBeNull();
    expect(parseSession({ ...valid, runningSince: null }, "pauli")).toBeNull();
    expect(parseSession({ ...valid, columns: [[{ value: 12, at: 0 }], []] }, "pauli")).toBeNull();
    expect(parseSession({ ...valid, columns: [[]] }, "pauli")).toBeNull();
    expect(parseSession({ ...valid, endReason: "time" }, "pauli")).toBeNull();
    expect(parseSession("nope", "pauli")).toBeNull();
  });

  it("accepts the default configs and rejects out-of-range ones", () => {
    expect(parseConfig(DEFAULT_CONFIG.pauli, "pauli")).toEqual(DEFAULT_CONFIG.pauli);
    expect(parseConfig(DEFAULT_CONFIG.kraepelin, "kraepelin")).toEqual(DEFAULT_CONFIG.kraepelin);
    expect(parseConfig({ ...DEFAULT_CONFIG.pauli, intervalSec: 300, durationSec: 120 }, "pauli")).toBeNull();
    expect(parseConfig({ ...DEFAULT_CONFIG.kraepelin, columnSec: 1 }, "kraepelin")).toBeNull();
  });
});
