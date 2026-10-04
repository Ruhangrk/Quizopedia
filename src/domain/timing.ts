export function roundMs(value: number): number {
  return Math.max(0, Math.round(value));
}

export function elapsedMs(startPerf: number, endPerf: number = performance.now()): number {
  return roundMs(endPerf - startPerf);
}

export function accumulateDuration(
  current: number | undefined,
  startedPerf: number,
  endedPerf: number = performance.now(),
): number {
  return (current ?? 0) + elapsedMs(startedPerf, endedPerf);
}

export function summarizePerQuestion(durations: number[]): {
  min: number;
  max: number;
  avg: number;
} {
  if (durations.length === 0) {
    return { min: 0, max: 0, avg: 0 };
  }
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  const avg = roundMs(durations.reduce((a, b) => a + b, 0) / durations.length);
  return { min, max, avg };
}

export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatMsPrecise(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)} s`;
  return formatDuration(ms);
}
