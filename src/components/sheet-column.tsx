import { Fragment } from "react";
import { upperDigitIndex } from "@/lib/test/sheet";
import type { WorkDirection } from "@/lib/test/types";

interface SheetColumnProps {
  /** Digits top to bottom. */
  digits: number[];
  direction: WorkDirection;
  /** Entered answers in work order. */
  answers: number[];
  /** Answer position waiting for input, or null when none is active. */
  activePair: number | null;
  size?: "test" | "sample";
}

/**
 * One column of the sheet: digits stacked vertically, each answer written in
 * the gap between its two digits and offset to the right, as on paper.
 */
export function SheetColumn({ digits, direction, answers, activePair, size = "test" }: SheetColumnProps) {
  const length = digits.length;
  const activeTop = activePair === null ? -1 : upperDigitIndex(activePair, length, direction);
  const test = size === "test";

  return (
    <div
      className={`grid justify-center ${test ? "grid-cols-[3.5rem_3rem] sm:grid-cols-[4rem_3.5rem]" : "grid-cols-[2.25rem_2rem]"}`}
    >
      {digits.map((digit, row) => {
        const inActivePair = row === activeTop || row === activeTop + 1;
        const pair = row < length - 1 ? (direction === "down" ? row : length - 2 - row) : -1;
        const answer = pair >= 0 ? answers[pair] : undefined;
        const isActiveSlot = pair >= 0 && pair === activePair;

        return (
          <Fragment key={row}>
            <div
              className={`col-start-1 flex items-center justify-center font-semibold ${
                test ? "h-11 text-[2rem] sm:h-12 sm:text-[2.25rem]" : "h-8 text-xl"
              } ${inActivePair ? "bg-accent-soft text-ink" : "text-ink"} ${
                row === activeTop ? "rounded-t-md" : ""
              } ${row === activeTop + 1 ? "rounded-b-md" : ""}`}
            >
              {digit}
            </div>
            <div className={`col-start-2 ${test ? "h-11 sm:h-12" : "h-8"}`} aria-hidden />
            {pair >= 0 && (
              <>
                <div className={`col-start-1 ${test ? "h-8" : "h-6"} ${row === activeTop ? "bg-accent-soft" : ""}`} />
                <div
                  data-active-slot={isActiveSlot || undefined}
                  className={`col-start-2 flex items-center justify-center ${test ? "h-8 text-2xl" : "h-6 text-lg"}`}
                >
                  {isActiveSlot ? (
                    <span
                      className={`block rounded-sm border-2 border-accent ${test ? "h-8 w-8" : "h-6 w-6"}`}
                    />
                  ) : (
                    answer !== undefined && <span className="font-semibold text-ink-muted">{answer}</span>
                  )}
                </div>
              </>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
