import { describe, expect, it } from "vitest";
import { formatClock, formatElapsed } from "../format";
import { computeResult } from "./score";
import { createSession, reduceSession } from "./session";
import { parseSession } from "./storage";
import type { KraepelinConfig, PauliConfig, SessionAction, TestSession } from "./types";

// Regression tests for defects found in the correctness audit.

const T0 = 1_000_000;
const pauli: PauliConfig = { kind: "pauli", durationSec: 60, columnCount: 2, columnLength: 6, intervalSec: 30 };
const kraepelin: KraepelinConfig = { kind: "kraepelin", columnCount: 3, columnSec: 10, columnLength: 6 };

const run = (s: TestSession, actions: SessionAction[]) => actions.reduce(reduceSession, s);
const roundTrip = (s: unknown) => JSON.parse(JSON.stringify(s));

describe("stale Kraepelin column input", () => {
  const started = run(createSession(kraepelin, 3, "k"), [{ type: "start", now: T0 }]);

  it("ignores a key meant for a column whose time has just run out", () => {
    // Screen still shows column 0 (rendered before the deadline); clock is in column 1.
    const s = reduceSession(started, { type: "input", value: 4, now: T0 + 10_050, column: 0 });
    expect(s).toBe(started);
  });

  it("accepts input tagged with the current column", () => {
    const s = reduceSession(started, { type: "input", value: 4, now: T0 + 10_050, column: 1 });
    expect(s.columns[1]).toHaveLength(1);
  });

  it("ignores an erase meant for an earlier column", () => {
    const s = run(started, [{ type: "input", value: 4, now: T0 + 10_100, column: 1 }]);
    expect(reduceSession(s, { type: "erase", now: T0 + 20_050, column: 1 })).toBe(s);
  });
});

describe("elapsed time display", () => {
  it("rounds elapsed time down and remaining time up", () => {
    expect(formatElapsed(11_400)).toBe("0:11");
    expect(formatElapsed(60_000)).toBe("1:00");
    expect(formatClock(11_400)).toBe("0:12");
  });
});

describe("fuzzed stored data", () => {
  const junk: unknown[] = [
    null, undefined, 0, -1, NaN, Infinity, "", "x", true, [], {}, [[]], { a: 1 },
    { value: 1, at: 0 }, [{ value: "1", at: 0 }], 1e309, -0, 2 ** 53, "__proto__",
  ];
  const base = run(createSession(kraepelin, 9, "k"), [
    { type: "start", now: T0 },
    { type: "input", value: 2, now: T0 + 500 },
    { type: "input", value: 7, now: T0 + 11_000 },
    { type: "pause", now: T0 + 12_000 },
  ]);
  const paths: (string | number)[][] = [
    ["version"], ["id"], ["config"], ["config", "kind"], ["config", "columnCount"],
    ["config", "columnSec"], ["config", "columnLength"], ["seed"], ["status"], ["elapsedMs"],
    ["runningSince"], ["columns"], ["columns", 0], ["columns", 0, 0], ["columns", 0, 0, "value"],
    ["columns", 0, 0, "at"], ["columns", 1, 0, "at"], ["pauseCount"], ["endReason"],
  ];

  it("never throws, and anything accepted can be scored", () => {
    for (const path of paths) {
      for (const value of [...junk, "delete"]) {
        const data = roundTrip(base);
        let target = data;
        for (const key of path.slice(0, -1)) target = target?.[key];
        if (target && typeof target === "object") {
          const last = path[path.length - 1];
          if (value === "delete") delete target[last];
          else target[last] = value;
        }
        const parsed = parseSession(data, "kraepelin", T0);
        if (parsed) expect(() => computeResult({ ...parsed, status: "finished", endReason: "manual" })).not.toThrow();
      }
    }
  });

  it("rejects an outdated session format version", () => {
    expect(parseSession({ ...roundTrip(base), version: 0 }, "kraepelin")).toBeNull();
    expect(parseSession({ ...roundTrip(base), version: 2 }, "kraepelin")).toBeNull();
  });
});

describe("internally inconsistent stored sessions are rejected", () => {
  const finishedPauli = run(createSession(pauli, 5, "p"), [
    { type: "start", now: T0 },
    { type: "input", value: 1, now: T0 + 1_000 },
    { type: "finish", now: T0 + 10_000 },
  ]);

  it("accepts the untouched finished session", () => {
    expect(parseSession(roundTrip(finishedPauli), "pauli")).toEqual(finishedPauli);
  });

  it("rejects an answer recorded after the session's elapsed time", () => {
    const tampered = roundTrip(finishedPauli);
    tampered.columns[0][0].at = 50_000;
    expect(parseSession(tampered, "pauli")).toBeNull();
  });

  it("rejects answers out of time order within a column", () => {
    const s = run(createSession(pauli, 5, "p"), [
      { type: "start", now: T0 },
      { type: "input", value: 1, now: T0 + 1_000 },
      { type: "input", value: 2, now: T0 + 2_000 },
      { type: "pause", now: T0 + 3_000 },
    ]);
    const tampered = roundTrip(s);
    tampered.columns[0].reverse();
    expect(parseSession(tampered, "pauli")).toBeNull();
  });

  it("rejects Pauli answers in a column before the previous one is full", () => {
    const tampered = roundTrip(finishedPauli);
    tampered.columns = [[], [{ value: 1, at: 1_000 }]];
    expect(parseSession(tampered, "pauli")).toBeNull();
  });

  it("rejects Kraepelin answers outside their column's time window", () => {
    const s = run(createSession(kraepelin, 3, "k"), [
      { type: "start", now: T0 },
      { type: "input", value: 1, now: T0 + 1_000 },
      { type: "finish", now: T0 + 25_000 },
    ]);
    const tampered = roundTrip(s);
    tampered.columns[2] = [{ value: 1, at: 1_000 }];
    expect(parseSession(tampered, "kraepelin")).toBeNull();
    // An answer for column 2 can only exist if the session reached column 2.
    const early = roundTrip(run(createSession(kraepelin, 3, "k"), [
      { type: "start", now: T0 },
      { type: "finish", now: T0 + 5_000 },
    ]));
    early.columns[1] = [{ value: 1, at: 12_000 }];
    expect(parseSession(early, "kraepelin")).toBeNull();
  });

  it("rejects a 'ready' session that already has answers or time", () => {
    const ready = roundTrip(createSession(pauli, 5, "p"));
    expect(parseSession(ready, "pauli")).not.toBeNull();
    expect(parseSession({ ...ready, elapsedMs: 5_000 }, "pauli")).toBeNull();
    expect(parseSession({ ...ready, columns: [[{ value: 1, at: 0 }], []] }, "pauli")).toBeNull();
  });

  it("rejects a 'time' ending that did not use the full duration", () => {
    expect(parseSession({ ...roundTrip(finishedPauli), endReason: "time" }, "pauli")).toBeNull();
  });

  it("rejects a 'sheet-complete' ending when the sheet is not complete", () => {
    expect(parseSession({ ...roundTrip(finishedPauli), endReason: "sheet-complete" }, "pauli")).toBeNull();
  });

  it("rejects a running session whose start time lies in the future", () => {
    const running = roundTrip(run(createSession(pauli, 5, "p"), [{ type: "start", now: T0 }]));
    expect(parseSession(running, "pauli", T0 + 1_000)).not.toBeNull();
    expect(parseSession(running, "pauli", T0 - 3_600_000)).toBeNull();
  });

  it("never yields statistics that exceed the sheet or the elapsed time", () => {
    const parsed = parseSession(roundTrip(finishedPauli), "pauli")!;
    const r = computeResult(parsed);
    expect(r.answered + r.unanswered).toBe(r.totalPositions);
    expect(r.intervals.reduce((n, i) => n + i.answered, 0)).toBe(r.answered);
    expect(r.intervals.every((i) => i.endMs <= r.elapsedMs)).toBe(true);
  });
});
