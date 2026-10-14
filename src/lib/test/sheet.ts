import type { TestConfig, WorkDirection } from "./types";

/*
 * Sheet layout rules. Everything that defines what the participant sees
 * (digit range, work direction, how answers map to digit pairs) lives here,
 * so the presentation can be adjusted to a specific test format in one place.
 */

export const DIGIT_MIN = 1;
export const DIGIT_MAX = 9;

export const WORK_DIRECTION: Record<TestConfig["kind"], WorkDirection> = {
  pauli: "down",
  kraepelin: "up",
};

/** mulberry32: small, fast, deterministic PRNG. Returns floats in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Digits of one column, top to bottom. Same seed and index always give the same column. */
export function columnDigits(seed: number, columnIndex: number, length: number): number[] {
  const random = mulberry32((seed ^ Math.imul(columnIndex + 1, 0x9e3779b1)) >>> 0);
  const span = DIGIT_MAX - DIGIT_MIN + 1;
  return Array.from({ length }, () => DIGIT_MIN + Math.floor(random() * span));
}

/**
 * Index (top to bottom) of the upper digit of answer position `pair`.
 * Position 0 is the first pair the participant works on.
 */
export function upperDigitIndex(pair: number, length: number, direction: WorkDirection): number {
  return direction === "down" ? pair : length - 2 - pair;
}

/** Correct answers for a column, in work order: last digit of each adjacent sum. */
export function expectedAnswers(digits: number[], direction: WorkDirection): number[] {
  const answers: number[] = [];
  for (let pair = 0; pair < digits.length - 1; pair++) {
    const top = upperDigitIndex(pair, digits.length, direction);
    answers.push((digits[top] + digits[top + 1]) % 10);
  }
  return answers;
}

export function randomSeed(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0];
}
