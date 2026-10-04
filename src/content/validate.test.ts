import { describe, expect, it } from "vitest";
import { validateBank, validateQuestion } from "./validate";

describe("validateQuestion", () => {
  it("accepts valid mcq_multi", () => {
    const { question, errors } = validateQuestion({
      id: "q1",
      type: "mcq_multi",
      prompt: "Pick",
      options: [
        { id: "a", text: "A" },
        { id: "b", text: "B" },
      ],
      correctOptionIds: ["a", "b"],
    });
    expect(errors).toEqual([]);
    expect(question?.type).toBe("mcq_multi");
  });

  it("rejects mcq with two corrects", () => {
    const { errors } = validateQuestion({
      id: "q1",
      type: "mcq",
      prompt: "Pick",
      options: [
        { id: "a", text: "A" },
        { id: "b", text: "B" },
      ],
      correctOptionIds: ["a", "b"],
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("validateBank", () => {
  it("flags path mismatch without crashing", () => {
    const result = validateBank(
      {
        id: "x",
        title: "X",
        path: "questions/wrong.json",
        questions: [
          {
            id: "q1",
            type: "fib",
            prompt: "hi",
            answers: ["yo"],
          },
        ],
      },
      "questions/right.json",
    );
    expect(result.pathMatches).toBe(false);
    expect(result.validQuestions).toHaveLength(1);
    expect(result.warnings.some((w) => w.includes("path mismatch"))).toBe(true);
  });

  it("accepts matching path", () => {
    const result = validateBank(
      {
        id: "x",
        title: "X",
        path: "questions/right.json",
        questions: [],
      },
      "questions/right.json",
    );
    expect(result.pathMatches).toBe(true);
    expect(result.bank?.path).toBe("questions/right.json");
  });
});
