import { describe, expect, it } from "vitest";
import { totalDurationMs } from "./config";
import { computeResult } from "./score";
import { createSession, reduceSession } from "./session";
import { columnDigits } from "./sheet";
import { parseSession } from "./storage";
import type { SessionAction, TestConfig, TestSession } from "./types";

// Randomized cross-check: drives the reducer with random action sequences,
// then recomputes every statistic with an independent oracle.

function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (Math.imul(a ^ (a >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    a ^= a >>> 13;
    return (a >>> 0) / 4294967296;
  };
}

/** Oracle: the correct answer for position k, written out directly per format. */
function oracleAnswer(config: TestConfig, digits: number[], k: number): number {
  const L = digits.length;
  const sum = config.kind === "pauli" ? digits[k] + digits[k + 1] : digits[L - 1 - k] + digits[L - 2 - k];
  return sum % 10;
}

function randomConfig(random: () => number): TestConfig {
  const pick = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  if (random() < 0.5) {
    const durationSec = 60 * pick(1, 3);
    const intervals = [30, 60, 120, 180].filter((s) => s <= durationSec);
    return {
      kind: "pauli",
      durationSec,
      columnCount: pick(1, 4),
      columnLength: pick(6, 9),
      intervalSec: intervals[pick(0, intervals.length - 1)],
    };
  }
  return { kind: "kraepelin", columnCount: pick(1, 5), columnSec: pick(5, 12), columnLength: pick(6, 9) };
}

function simulate(seed: number): { session: TestSession; states: TestSession[] } {
  const random = prng(seed);
  const config = randomConfig(random);
  let now = 1_700_000_000_000;
  let session = createSession(config, Math.floor(random() * 0xffffffff), `s${seed}`);
  const states = [session];
  const apply = (action: SessionAction) => {
    session = reduceSession(session, action);
    states.push(session);
  };
  apply({ type: "start", now });
  const limit = totalDurationMs(config) * 1.3;
  for (let step = 0; step < 400 && session.status !== "finished"; step++) {
    now += Math.floor(random() * (random() < 0.1 ? 4_000 : 900));
    const r = random();
    if (r < 0.7) apply({ type: "input", value: Math.floor(random() * 10), now });
    else if (r < 0.8) apply({ type: "erase", now });
    else if (r < 0.86) apply({ type: session.status === "paused" ? "resume" : "pause", now });
    else if (r < 0.995) apply({ type: "tick", now });
    else apply({ type: "finish", now });
    if (now - 1_700_000_000_000 > limit * 3) break;
  }
  if (session.status === "paused") apply({ type: "resume", now });
  apply({ type: "tick", now: now + limit * 2 });
  return { session, states };
}

describe("randomized sessions", () => {
  const runs = Array.from({ length: 400 }, (_, i) => simulate(i + 1));

  it("cover both formats, every end reason, pauses, and right and wrong answers", () => {
    const sessions = runs.map((r) => r.session);
    const results = sessions.map(computeResult);
    expect(new Set(sessions.map((s) => s.config.kind))).toEqual(new Set(["pauli", "kraepelin"]));
    expect(new Set(sessions.map((s) => s.endReason))).toEqual(new Set(["time", "sheet-complete", "manual"]));
    expect(sessions.some((s) => s.pauseCount > 0)).toBe(true);
    expect(results.reduce((n, r) => n + r.correct, 0)).toBeGreaterThan(100);
    expect(results.reduce((n, r) => n + r.incorrect, 0)).toBeGreaterThan(100);
  });

  it("always end finished, within the configured duration", () => {
    for (const { session } of runs) {
      expect(session.status).toBe("finished");
      expect(session.elapsedMs).toBeGreaterThanOrEqual(0);
      expect(session.elapsedMs).toBeLessThanOrEqual(totalDurationMs(session.config));
      if (session.endReason === "time") expect(session.elapsedMs).toBe(totalDurationMs(session.config));
    }
  });

  it("match the independent oracle for every statistic", () => {
    for (const { session } of runs) {
      const { config } = session;
      const pairs = config.columnLength - 1;
      const r = computeResult(session);
      let answered = 0;
      let correct = 0;
      session.columns.forEach((entries, c) => {
        const digits = columnDigits(session.seed, c, config.columnLength);
        const colCorrect = entries.filter((e, k) => e.value === oracleAnswer(config, digits, k)).length;
        expect(r.columns[c]).toEqual({
          index: c,
          positions: pairs,
          answered: entries.length,
          correct: colCorrect,
          incorrect: entries.length - colCorrect,
          unanswered: pairs - entries.length,
        });
        answered += entries.length;
        correct += colCorrect;
      });
      const positions = config.columnCount * pairs;
      expect(r.totalPositions).toBe(positions);
      expect(r.answered).toBe(answered);
      expect(r.correct).toBe(correct);
      expect(r.incorrect).toBe(answered - correct);
      expect(r.unanswered).toBe(positions - answered);
      expect(r.accuracy).toBe(answered === 0 ? null : correct / answered);
      expect(r.completion).toBe(answered / positions);

      if (config.kind === "pauli") {
        const ms = config.intervalSec * 1000;
        expect(r.intervals.length).toBe(Math.max(1, Math.ceil(session.elapsedMs / ms)));
        expect(r.intervals.reduce((n, i) => n + i.answered, 0)).toBe(answered);
        expect(r.intervals.reduce((n, i) => n + i.correct, 0)).toBe(correct);
        for (const i of r.intervals) {
          expect(i.correct + i.incorrect).toBe(i.answered);
          expect(i.endMs).toBeLessThanOrEqual(session.elapsedMs);
        }
      } else {
        expect(r.intervals).toEqual([]);
      }
    }
  });

  it("produce only states that pass stored-session validation", () => {
    for (const { states } of runs) {
      for (const state of states) {
        const restored = parseSession(JSON.parse(JSON.stringify(state)), state.config.kind);
        expect(restored).toEqual(state);
      }
    }
  });

  it("place every Kraepelin answer inside its column's time window", () => {
    for (const { session } of runs) {
      const { config } = session;
      if (config.kind !== "kraepelin") continue;
      const ms = config.columnSec * 1000;
      session.columns.forEach((entries, c) => {
        for (const e of entries) {
          expect(e.at).toBeGreaterThanOrEqual(c * ms);
          expect(e.at).toBeLessThan((c + 1) * ms);
        }
      });
    }
  });
});
