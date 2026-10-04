import { describe, expect, it } from "vitest";
import { gradeFib, gradeMcq, gradeMcqMulti, gradeQuestion, normalizeFib } from "./grade";
import type { FibQuestion, McqMultiQuestion, McqQuestion, SessionQuestion } from "./types";

const mcq: McqQuestion = {
  id: "q1",
  type: "mcq",
  prompt: "Pick",
  options: [
    { id: "a", text: "A" },
    { id: "b", text: "B" },
  ],
  correctOptionIds: ["b"],
};

const multi: McqMultiQuestion = {
  id: "q2",
  type: "mcq_multi",
  prompt: "Pick many",
  options: [
    { id: "a", text: "A" },
    { id: "b", text: "B" },
    { id: "c", text: "C" },
  ],
  correctOptionIds: ["a", "c"],
};

const fib: FibQuestion = {
  id: "q3",
  type: "fib",
  prompt: "Blank",
  answers: ["time"],
  caseSensitive: false,
};

describe("normalizeFib", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeFib("  round   trip  ")).toBe("round trip");
  });
});

describe("gradeMcq", () => {
  it("accepts the correct option id", () => {
    expect(gradeMcq(mcq, "b").isCorrect).toBe(true);
  });
  it("rejects wrong or empty", () => {
    expect(gradeMcq(mcq, "a").isCorrect).toBe(false);
    expect(gradeMcq(mcq, undefined).isCorrect).toBe(false);
  });
  it("does not grade by position", () => {
    expect(gradeMcq(mcq, "0").isCorrect).toBe(false);
  });
});

describe("gradeMcqMulti", () => {
  it("requires exact set equality ignoring order", () => {
    expect(gradeMcqMulti(multi, ["c", "a"]).isCorrect).toBe(true);
    expect(gradeMcqMulti(multi, ["a"]).isCorrect).toBe(false);
    expect(gradeMcqMulti(multi, ["a", "b", "c"]).isCorrect).toBe(false);
  });
});

describe("gradeFib", () => {
  it("matches case-insensitively by default", () => {
    expect(gradeFib(fib, "Time").isCorrect).toBe(true);
    expect(gradeFib(fib, "  time ").isCorrect).toBe(true);
  });
  it("respects caseSensitive", () => {
    const strict: FibQuestion = { ...fib, caseSensitive: true };
    expect(gradeFib(strict, "Time").isCorrect).toBe(false);
    expect(gradeFib(strict, "time").isCorrect).toBe(true);
  });
});

describe("gradeQuestion", () => {
  it("attaches duration and display fields", () => {
    const session: SessionQuestion = {
      key: "bank:q1",
      sourcePath: "questions/x.json",
      bankId: "bank",
      tags: ["t"],
      question: mcq,
    };
    const graded = gradeQuestion(session, "b", 1234);
    expect(graded.isCorrect).toBe(true);
    expect(graded.durationMs).toBe(1234);
    expect(graded.expectedDisplay).toEqual(["B"]);
    expect(graded.userDisplay).toEqual(["B"]);
  });
});
