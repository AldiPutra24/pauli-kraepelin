/** Remaining time as 0:07, 2:45, 61:00. Rounds up so the clock reads 0:00 only when time is truly out. */
export function formatClock(ms: number): string {
  return clock(Math.ceil(ms / 1000));
}

/** Time already spent. Rounds down so 11.4 s reads 0:11, never more than was used. */
export function formatElapsed(ms: number): string {
  return clock(Math.floor(ms / 1000));
}

function clock(wholeSeconds: number): string {
  const totalSeconds = Math.max(0, wholeSeconds);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** "3 menit", "1 menit 30 detik", "45 detik". Floors to whole seconds. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} detik`;
  if (seconds === 0) return `${minutes} menit`;
  return `${minutes} menit ${seconds} detik`;
}

const percentFormat = new Intl.NumberFormat("id-ID", {
  style: "percent",
  maximumFractionDigits: 1,
});

export function formatPercent(ratio: number | null): string {
  return ratio === null ? "Tidak ada" : percentFormat.format(ratio);
}

const numberFormat = new Intl.NumberFormat("id-ID");

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}
