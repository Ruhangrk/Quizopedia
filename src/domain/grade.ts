import type {
  FibQuestion,
  GradedItem,
  McqMultiQuestion,
  McqOption,
  McqQuestion,
  Question,
  SessionQuestion,
  UserAnswer,
} from "./types";

export function normalizeFib(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function sameIdSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((id, i) => id === right[i]);
}

function optionTextMap(options: McqOption[]): Map<string, string> {
  return new Map(options.map((o) => [o.id, o.text]));
}

function displayForIds(ids: string[], options: McqOption[]): string[] {
  const map = optionTextMap(options);
  return ids.map((id) => map.get(id) ?? id);
}

export function gradeMcq(
  question: McqQuestion,
  userAnswer: UserAnswer | undefined,
): { isCorrect: boolean; userIds: string[]; userDisplay: string[]; expectedDisplay: string[] } {
  const expected = question.correctOptionIds;
  const userIds =
    typeof userAnswer === "string"
      ? userAnswer
        ? [userAnswer]
        : []
      : Array.isArray(userAnswer)
        ? userAnswer
        : [];
  const isCorrect = userIds.length === 1 && userIds[0] === expected[0];
  return {
    isCorrect,
    userIds,
    userDisplay: displayForIds(userIds, question.options),
    expectedDisplay: displayForIds(expected, question.options),
  };
}

export function gradeMcqMulti(
  question: McqMultiQuestion,
  userAnswer: UserAnswer | undefined,
): { isCorrect: boolean; userIds: string[]; userDisplay: string[]; expectedDisplay: string[] } {
  const expected = question.correctOptionIds;
  const userIds = Array.isArray(userAnswer)
    ? userAnswer
    : typeof userAnswer === "string" && userAnswer
      ? [userAnswer]
      : [];
  const isCorrect = sameIdSet(userIds, expected);
  return {
    isCorrect,
    userIds,
    userDisplay: displayForIds(userIds, question.options),
    expectedDisplay: displayForIds(expected, question.options),
  };
}

export function gradeFib(
  question: FibQuestion,
  userAnswer: UserAnswer | undefined,
): { isCorrect: boolean; userText: string; expectedDisplay: string[] } {
  const raw = typeof userAnswer === "string" ? userAnswer : "";
  const normalized = normalizeFib(raw);
  const caseSensitive = question.caseSensitive === true;
  const isCorrect =
    normalized.length > 0 &&
    question.answers.some((answer) => {
      const target = normalizeFib(answer);
      return caseSensitive
        ? normalized === target
        : normalized.toLowerCase() === target.toLowerCase();
    });
  return {
    isCorrect,
    userText: raw,
    expectedDisplay: [...question.answers],
  };
}

export function gradeQuestion(
  sessionQ: SessionQuestion,
  userAnswer: UserAnswer | undefined,
  durationMs: number,
): GradedItem {
  const q = sessionQ.question;
  const base = {
    questionId: sessionQ.key,
    sourcePath: sessionQ.sourcePath,
    type: q.type,
    prompt: q.prompt,
    durationMs,
    explanation: q.explanation,
    tags: sessionQ.tags,
  };

  if (q.type === "mcq") {
    const result = gradeMcq(q, userAnswer);
    return {
      ...base,
      userAnswer: result.userIds,
      correctOptionIds: q.correctOptionIds,
      expectedDisplay: result.expectedDisplay,
      userDisplay: result.userDisplay,
      isCorrect: result.isCorrect,
    };
  }

  if (q.type === "mcq_multi") {
    const result = gradeMcqMulti(q, userAnswer);
    return {
      ...base,
      userAnswer: result.userIds,
      correctOptionIds: q.correctOptionIds,
      expectedDisplay: result.expectedDisplay,
      userDisplay: result.userDisplay,
      isCorrect: result.isCorrect,
    };
  }

  const result = gradeFib(q, userAnswer);
  return {
    ...base,
    userAnswer: result.userText,
    expectedDisplay: result.expectedDisplay,
    userDisplay: result.userText ? [result.userText] : [],
    isCorrect: result.isCorrect,
  };
}

export function isAnswered(question: Question, answer: UserAnswer | undefined): boolean {
  if (answer === undefined) return false;
  if (question.type === "fib") {
    return typeof answer === "string" && normalizeFib(answer).length > 0;
  }
  if (typeof answer === "string") return answer.length > 0;
  return Array.isArray(answer) && answer.length > 0;
}
