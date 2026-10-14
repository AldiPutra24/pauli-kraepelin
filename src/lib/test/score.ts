import { pairsPerColumn, totalDurationMs, totalPositions } from "./config";
import { WORK_DIRECTION, columnDigits, expectedAnswers } from "./sheet";
import type { ColumnResult, IntervalResult, TestResult, TestSession } from "./types";

/** Scores a finished session. Deterministic: the same session always yields the same result. */
export function computeResult(session: TestSession): TestResult {
  const { config } = session;
  const pairs = pairsPerColumn(config);
  const direction = WORK_DIRECTION[config.kind];

  const intervalMs = config.kind === "pauli" ? config.intervalSec * 1000 : 0;
  const intervalCount =
    config.kind === "pauli" ? Math.max(1, Math.ceil(session.elapsedMs / intervalMs)) : 0;
  const intervals: IntervalResult[] = Array.from({ length: intervalCount }, (_, index) => ({
    index,
    startMs: index * intervalMs,
    endMs: Math.min((index + 1) * intervalMs, session.elapsedMs),
    answered: 0,
    correct: 0,
    incorrect: 0,
  }));

  const columns: ColumnResult[] = session.columns.map((entries, index) => {
    const expected = expectedAnswers(columnDigits(session.seed, index, config.columnLength), direction);
    let correct = 0;
    entries.forEach((entry, pair) => {
      const isCorrect = entry.value === expected[pair];
      if (isCorrect) correct++;
      if (intervalCount > 0) {
        const bucket = intervals[Math.min(intervalCount - 1, Math.floor(entry.at / intervalMs))];
        bucket.answered++;
        if (isCorrect) bucket.correct++;
        else bucket.incorrect++;
      }
    });
    return {
      index,
      positions: pairs,
      answered: entries.length,
      correct,
      incorrect: entries.length - correct,
      unanswered: pairs - entries.length,
    };
  });

  const answered = columns.reduce((sum, c) => sum + c.answered, 0);
  const correct = columns.reduce((sum, c) => sum + c.correct, 0);
  const positions = totalPositions(config);

  return {
    config,
    configuredDurationMs: totalDurationMs(config),
    elapsedMs: session.elapsedMs,
    endReason: session.endReason ?? "manual",
    pauseCount: session.pauseCount,
    totalPositions: positions,
    answered,
    correct,
    incorrect: answered - correct,
    unanswered: positions - answered,
    accuracy: answered === 0 ? null : correct / answered,
    completion: positions === 0 ? 0 : answered / positions,
    columns,
    intervals,
  };
}
