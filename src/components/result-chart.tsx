"use client";

import { useState } from "react";

export interface ChartBar {
  label: string;
  /** Longer label for the hover readout, e.g. "Kolom 3". */
  name: string;
  correct: number;
  incorrect: number;
}

function niceCeiling(value: number): number {
  if (value <= 5) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => Math.ceil(value / s) <= 5)!;
  return Math.ceil(value / step) * step;
}

/**
 * Stacked bars: correct (bottom) and incorrect (top) answers per bucket.
 * Decorative for screen readers; the table next to it carries the same data.
 */
export function ResultChart({
  title,
  bars,
  maxValue,
}: {
  title: string;
  bars: ChartBar[];
  /** Fixed scale top, e.g. column capacity. Defaults to a rounded data maximum. */
  maxValue?: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const top = maxValue ?? niceCeiling(Math.max(1, ...bars.map((b) => b.correct + b.incorrect)));
  // The midline is always drawn; it is labelled only when it falls on a whole number.
  const ticks = [String(top), Number.isInteger(top / 2) ? String(top / 2) : "", "0"];
  const labelEvery = bars.length <= 15 ? 1 : 5;
  const focus = hovered === null ? null : bars[hovered];

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <span className="font-semibold">{title}</span>
        <span className="flex gap-4 text-sm text-ink-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-[2px] bg-chart-correct" aria-hidden />
            Benar
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-[2px] bg-chart-wrong" aria-hidden />
            Salah
          </span>
        </span>
      </figcaption>

      <p className="tabular min-h-6 text-sm text-ink-muted" aria-hidden>
        {focus
          ? `${focus.name}: ${focus.correct} benar, ${focus.incorrect} salah`
          : "Arahkan kursor atau ketuk batang untuk melihat angkanya."}
      </p>

      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2" aria-hidden>
        <div className="tabular flex h-48 flex-col justify-between text-right text-xs text-ink-muted">
          {ticks.map((tick, index) => (
            <span key={index} className="-my-2 min-h-4 leading-4">
              {tick}
            </span>
          ))}
        </div>
        <div className="relative h-48 border-b border-rule-strong">
          <div className="absolute inset-x-0 top-0 border-t border-dashed border-rule" />
          <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-rule" />
          <div className="absolute inset-0 flex items-end gap-0.5 sm:gap-1">
            {bars.map((bar, index) => {
              const total = bar.correct + bar.incorrect;
              const dimmed = hovered !== null && hovered !== index;
              return (
                <div
                  key={index}
                  className={`flex h-full max-w-10 min-w-0 flex-1 cursor-default flex-col justify-end ${dimmed ? "opacity-45" : ""}`}
                  onPointerEnter={() => setHovered(index)}
                  onPointerLeave={() => setHovered(null)}
                  onClick={() => setHovered(index)}
                >
                  <div className="flex flex-col gap-[2px]" style={{ height: `${(total / top) * 100}%` }}>
                    {bar.incorrect > 0 && (
                      <div
                        className="rounded-t-[4px] bg-chart-wrong"
                        style={{ flexGrow: bar.incorrect, flexBasis: 0 }}
                      />
                    )}
                    {bar.correct > 0 && (
                      <div
                        className={`bg-chart-correct ${bar.incorrect > 0 ? "" : "rounded-t-[4px]"}`}
                        style={{ flexGrow: bar.correct, flexBasis: 0 }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div />
        <div className="flex gap-0.5 pt-1 sm:gap-1">
          {bars.map((bar, index) => (
            <span key={index} className="tabular max-w-10 min-w-0 flex-1 text-center text-xs text-ink-muted">
              {index % labelEvery === 0 || index === bars.length - 1 ? bar.label : ""}
            </span>
          ))}
        </div>
      </div>
    </figure>
  );
}
