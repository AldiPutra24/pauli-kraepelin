import { Delete } from "lucide-react";

interface KeypadProps {
  disabled: boolean;
  canErase: boolean;
  onDigit: (digit: number) => void;
  onErase: () => void;
}

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// Mouse and touch presses must not leave focus on the key: a later Enter or
// Space from a physical keyboard would otherwise repeat the digit.
const keepFocus = (event: React.MouseEvent) => event.preventDefault();

const keyClass =
  "flex h-13 items-center justify-center rounded-md border border-rule-strong bg-sheet text-2xl font-semibold text-ink hover:bg-paper active:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-45 sm:h-14";

export function Keypad({ disabled, canErase, onDigit, onErase }: KeypadProps) {
  return (
    <div role="group" aria-label="Papan angka" className="grid grid-cols-3 gap-2">
      {DIGITS.map((digit) => (
        <button
          key={digit}
          type="button"
          className={keyClass}
          disabled={disabled}
          onMouseDown={keepFocus}
          onClick={() => onDigit(digit)}
        >
          {digit}
        </button>
      ))}
      <button
        type="button"
        className={`${keyClass} col-span-2`}
        disabled={disabled}
        onMouseDown={keepFocus}
        onClick={() => onDigit(0)}
      >
        0
      </button>
      <button
        type="button"
        className={`${keyClass} gap-1.5 text-base`}
        disabled={disabled || !canErase}
        onMouseDown={keepFocus}
        onClick={onErase}
      >
        {/* Backspace glyph: matches the physical key that does the same thing. */}
        <Delete aria-hidden className="size-5" />
        Hapus
      </button>
    </div>
  );
}
