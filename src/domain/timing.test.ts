import { describe, expect, it } from "vitest";
import { accumulateDuration, formatDuration, roundMs, summarizePerQuestion } from "./timing";

describe("timing", () => {
  it("rounds ms", () => {
    expect(roundMs(1.4)).toBe(1);
    expect(roundMs(1.5)).toBe(2);
  });

  it("accumulates question durations", () => {
    const first = accumulateDuration(undefined, 100, 250);
    expect(first).toBe(150);
    const second = accumulateDuration(first, 300, 360);
    expect(second).toBe(210);
  });

  it("summarizes per-question stats", () => {
    expect(summarizePerQuestion([10, 20, 30])).toEqual({ min: 10, max: 30, avg: 20 });
    expect(summarizePerQuestion([])).toEqual({ min: 0, max: 0, avg: 0 });
  });

  it("formats duration", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65_000)).toBe("1:05");
    expect(formatDuration(3_661_000)).toBe("1:01:01");
  });
});
