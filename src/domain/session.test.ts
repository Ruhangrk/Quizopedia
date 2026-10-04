import { describe, expect, it } from "vitest";
import { buildSessionQuestions, resolveBanksByPaths, shuffleCopy } from "./session";
import type { LoadedBank, McqQuestion } from "./types";

function bank(partial: Partial<LoadedBank> & { path: string; id: string }): LoadedBank {
  const question: McqQuestion = {
    id: "q1",
    type: "mcq",
    prompt: "P",
    options: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
      { id: "c", text: "C" },
    ],
    correctOptionIds: ["b"],
  };
  return {
    diskPath: partial.path,
    pathMatches: partial.pathMatches ?? true,
    warnings: [],
    validQuestions: partial.validQuestions ?? [question],
    bank: {
      id: partial.id,
      title: partial.id,
      path: partial.path,
      tags: ["t"],
      questions: partial.validQuestions ?? [question],
    },
  };
}

describe("shuffleCopy", () => {
  it("uses provided rng deterministically", () => {
    let i = 0;
    const rng = () => {
      const values = [0.9, 0.1, 0.5];
      return values[i++ % values.length];
    };
    const a = shuffleCopy([1, 2, 3, 4], rng);
    i = 0;
    const b = shuffleCopy([1, 2, 3, 4], rng);
    expect(a).toEqual(b);
    expect(a).not.toEqual([1, 2, 3, 4]);
  });
});

describe("buildSessionQuestions", () => {
  it("keeps straight order and shuffles options", () => {
    const banks = [
      bank({ id: "a", path: "questions/a.json" }),
      bank({ id: "b", path: "questions/b.json" }),
    ];
    let calls = 0;
    const rng = () => {
      calls += 1;
      return 0.99;
    };
    const session = buildSessionQuestions(banks, "straight", rng);
    expect(session.map((s) => s.bankId)).toEqual(["a", "b"]);
    expect(session[0].displayOptions).toBeDefined();
    expect(calls).toBeGreaterThan(0);
  });

  it("throws on path mismatch", () => {
    const banks = [bank({ id: "a", path: "questions/a.json", pathMatches: false })];
    expect(() => buildSessionQuestions(banks, "straight")).toThrow(/path mismatch/i);
  });
});

describe("resolveBanksByPaths", () => {
  it("finds by bank.path only", () => {
    const banks = [
      bank({ id: "a", path: "questions/a.json" }),
      bank({ id: "b", path: "questions/b.json" }),
    ];
    const { found, missing } = resolveBanksByPaths(banks, [
      "questions/b.json",
      "questions/missing.json",
    ]);
    expect(found.map((f) => f.bank.id)).toEqual(["b"]);
    expect(missing).toEqual(["questions/missing.json"]);
  });
});
