/**
 * Byte and count formatting for the Spotify traffic card.
 *
 * Uses binary units (KiB/MiB/GiB) because the numbers come from measured
 * response sizes, and keeps one decimal only where it adds information.
 */

const UNITS = ["B", "KiB", "MiB", "GiB", "TiB"] as const;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value >= 100 || unit === 0 ? Math.round(value) : Number(value.toFixed(1));
  return `${rounded} ${UNITS[unit]}`;
}

export function formatCount(count: number): string {
  if (!Number.isFinite(count) || count <= 0) {
    return "0";
  }
  return Math.round(count).toLocaleString();
}

export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return "0%";
  }
  const percent = ratio * 100;
  // Avoid showing "100%" when a small number of misses remain.
  if (percent > 99.5 && percent < 100) {
    return ">99%";
  }
  return `${percent.toFixed(percent >= 10 ? 0 : 1)}%`;
}
